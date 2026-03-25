"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "@/lib/api";
import ThemeToggle from "@/components/themetoggle";
import Link from "next/link"; 
import { getChecklistForRole, DOCTOR_CHECKLIST, NURSE_CHECKLIST, CHECKLIST_GROUPS } from "@/lib/categories";

// --- Types ---
type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role?: string | null;
};

type DocumentRow = {
  id: string;
  category?: string;
  filename?: string;
  status?: string;
  expiry_date?: string | null;
  view_link?: any;
  extracted?: any;
};

type CandidateMeta = Candidate & {
  displayRole: string;
  missingCount: number;
  totalRequired: number;
  completed: boolean;
  documents?: DocumentRow[];
};

// --- Helpers to get ALL unique categories for the Export Menu ---
const getAllUniqueCategories = () => {
  const allItems = [...DOCTOR_CHECKLIST, ...NURSE_CHECKLIST, ...CHECKLIST_GROUPS].flatMap(g => g.items);
  const unique = new Map();
  allItems.forEach(i => unique.set(i.id, i.label));
  return Array.from(unique.entries()).map(([id, label]) => ({id, label}));
};
const ALL_CATEGORIES = getAllUniqueCategories();

function normalizeRole(role?: string | null): string {
  if (!role) return "Unassigned";
  const r = role.trim();
  const lower = r.toLowerCase();
  if (lower.includes("doctor") || lower.includes("surgeon") || lower.includes("gp")) return "Doctor";
  if (lower.includes("nurse") || lower.includes("midwife")) return "Nurse";
  if (lower.includes("allied")) return "Allied Health";
  return r;
}

function normalize(s: any): string {
  return String(s || "").trim().toLowerCase();
}

function matchesCategory(d: any, keyword: string): boolean {
  const candidates: string[] = [];
  if (d.category) candidates.push(normalize(d.category));
  if (d.category_name) candidates.push(normalize(d.category_name));
  return candidates.some((c) => c.includes(keyword));
}

function getVerificationBadge(status?: string | null) {
  if (!status) return null;
  if (status === "AHPRA_VERIFIED") {
      return {
          label: "Fully Verified",
          color: "bg-emerald-500",
          textColor: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
          borderColor: "border-emerald-200 dark:border-emerald-800",
          icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      };
  }
  if (status === "AHPRA_NAME_MISMATCH") {
      return {
          label: "Name Mismatch",
          color: "bg-orange-500",
          textColor: "text-orange-600 dark:text-orange-400",
          bgColor: "bg-orange-50 dark:bg-orange-900/30",
          borderColor: "border-orange-200 dark:border-orange-800",
          icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      };
  }
  if (status === "AHPRA_NOT_FOUND") {
      return {
          label: "Not Found",
          color: "bg-red-500",
          textColor: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-900/30",
          borderColor: "border-red-200 dark:border-red-800",
          icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      };
  }
  return null;
}

function toLinkString(link: any): string | null {
  if (!link) return null;
  if (typeof link === "string") return link;
  if (typeof link === "object") return link.webViewLink || link.webContentLink || link.url || null;
  return null;
}

// --- Component ---

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  
  // Data State
  const [candidates, setCandidates] = useState<CandidateMeta[]>([]);
  const [loading, setLoading] = useState(false);
  
  // View State
  const [selectedRole, setSelectedRole] = useState<string>("All");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateDocs, setSelectedCandidateDocs] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Export Menu State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) fetchCandidates();
    
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
        setShowSubMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAuthenticated]);

  async function fetchCandidates() {
    setLoading(true);
    try {
      const resp = await api.get("/candidates");
      const base: Candidate[] = resp.data || [];
      
      const metaPromises = base.map(async (c) => {
        try {
          const r = await api.get(`/candidates/${c.id}`);
          const docsRaw = r.data?.documents || [];
          
          // DYNAMIC CHECKLIST CALCULATION
          const roleChecklist = getChecklistForRole(c.role || "");
          const requiredItems = roleChecklist.flatMap(g => g.items);
          
          let missingCount = 0;
          requiredItems.forEach((req) => {
             const found = docsRaw.some((d: any) => matchesCategory(d, req.id) && d.status !== 'FAKE');
             if (!found) missingCount++;
          });

          return {
            ...c,
            displayRole: normalizeRole(c.role),
            missingCount,
            totalRequired: requiredItems.length,
            completed: missingCount === 0,
            documents: docsRaw
          } as CandidateMeta;
        } catch (e) { 
          return { ...c, displayRole: "Unknown", missingCount: 99, totalRequired: 99, completed: false } as CandidateMeta; 
        }
      });

      const metas = await Promise.all(metaPromises);
      setCandidates(metas);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }

  async function selectCandidate(candidate: CandidateMeta) {
    setSelectedCandidateId(candidate.id);
    setLoadingDocs(true);
    try {
        const resp = await api.get(`/candidates/${candidate.id}`);
        const docs = (resp.data?.documents || []).map((d: any) => ({
            id: d.id,
            category: d.category || d.category_name,
            filename: d.filename || d.name,
            view_link: d.view_link || d.url,
            expiry_date: d.expiry_date,
            status: d.status
        }));
        setSelectedCandidateDocs(docs);
    } catch(e) { console.error(e); }
    finally { setLoadingDocs(false); }
  }

  function handleLogin() {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || password === "admin123") setIsAuthenticated(true);
    else alert("Invalid password");
  }

  // --- EXPORT LOGIC ---
  async function exportJSON() {
    setShowExportMenu(false);
    try {
      const resp = await api.get("/export");
      const data = resp.data || [];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance_export_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to export JSON");
    }
  }

  async function exportCSV(targetCategoryId?: string) {
    setShowExportMenu(false);
    setShowSubMenu(false);
    try {
      const resp = await api.get("/export");
      const data = resp.data || [];
      if (!data.length) {
        alert("No data to export.");
        return;
      }

      const flattened = data.map((row: any) => {
        const catData = row.category_data || {};
        const extracted = row.extracted || {};
        return {
          candidate_id: row.candidate_id ?? "",
          full_name: `${row.first_name ?? ""} ${row.last_name ?? ""}`,
          email: row.email ?? "",
          role: row.role ?? "",
          category: row.category ?? "uncategorized",
          filename: row.filename ?? "",
          status: row.status ?? "",
          expiry_date: row.expiry_date ?? "",
          view_link: toLinkString(row.view_link) ?? "",
          doc_identifier: catData.identifier || extracted.identifier || "",
          doc_notes: catData.notes || "",
        };
      });

      const groups: Record<string, any[]> = {};
      for (const row of flattened) {
        const cat = (row.category || "uncategorized").toLowerCase();
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(row);
      }

      let keysToExport: string[] = [];
      if (targetCategoryId) {
        keysToExport = Object.keys(groups).filter(k => k.includes(targetCategoryId.toLowerCase()));
        if (keysToExport.length === 0) {
            alert(`No documents found for category ID: ${targetCategoryId}`);
            return;
        }
      } else {
        keysToExport = Object.keys(groups);
      }

      for (const cat of keysToExport) {
        const rows = groups[cat];
        if (!rows || rows.length === 0) continue;

        const headers = Object.keys(rows[0]);
        const esc = (v: any) => {
          if (v === null || v === undefined) return "";
          const s = String(v);
          return (s.includes(",") || s.includes("\n") || s.includes('"')) 
            ? `"${s.replace(/"/g, '""')}"` 
            : s;
        };

        const csvContent = [
          headers.join(","), 
          ...rows.map(r => headers.map(h => esc(r[h])).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `compliance_${cat}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 200)); 
      }
    } catch (err) {
      console.error("Failed to export CSVs", err);
      alert("Failed to export CSVs");
    }
  }

  async function exportSalesforce() {
    setShowExportMenu(false);
    try {
      const resp = await api.get("/export/salesforce");
      const rows = resp.data || [];
      if (!rows.length) {
        alert("No data to export.");
        return;
      }
      const headers = Object.keys(rows[0]);
      const esc = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = typeof v === "object" ? JSON.stringify(v) : String(v);
        return (s.includes(",") || s.includes("\n") || s.includes('"')) 
          ? `"${s.replace(/"/g, '""')}"` 
          : s;
      };

      const lines = [
        headers.join(","), 
        ...rows.map((r: any) => headers.map(h => esc(r[h])).join(","))
      ];
      const csv = lines.join("\n");
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salesforce_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Salesforce export failed", err);
      alert("Salesforce export failed");
    }
  }

  // --- Derived State for UI ---
  const uniqueRoles = useMemo(() => {
     const roles = new Set(candidates.map(c => c.displayRole));
     return ["All", ...Array.from(roles)];
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
     if (selectedRole === "All") return candidates;
     return candidates.filter(c => c.displayRole === selectedRole);
  }, [candidates, selectedRole]);

  const stats = useMemo(() => {
     const total = filteredCandidates.length;
     const completed = filteredCandidates.filter(c => c.completed).length;
     const remaining = total - completed;
     return { total, completed, remaining };
  }, [filteredCandidates]);

  const activeCandidate = useMemo(() => {
     return candidates.find(c => c.id === selectedCandidateId);
  }, [candidates, selectedCandidateId]);

  // Derived active checklist for the right panel
  const activeChecklist = useMemo(() => {
      if (!activeCandidate) return [];
      return getChecklistForRole(activeCandidate.role || "");
  }, [activeCandidate]);

  // --- Render Login ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="absolute top-8 right-8 z-50 flex gap-4 items-center">
            <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-teal-600 transition-colors">Go to App</Link>
            <ThemeToggle />
        </div>
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 text-center relative z-10">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-lg rotate-3">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-2xl font-extrabold mb-2 text-gray-900 dark:text-white">Admin Access</h2>
            <p className="text-sm text-gray-500 mb-8">Secure dashboard for CareHR</p>
            <input type="password" placeholder="Enter Password" className="w-full p-4 mb-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-teal-500 transition-all font-mono tracking-widest text-center" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={handleLogin} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Unlock Dashboard</button>
        </div>
        <div className="absolute inset-0 opacity-10 dark:opacity-5 pointer-events-none z-0">
             <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 100 C 30 50 70 50 100 100 Z" fill="currentColor" /></svg>
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
        
        {/* SIDEBAR */}
        <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-sm">
            <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="font-bold text-gray-800 dark:text-white tracking-tight">Admin HQ</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-2 mt-2">Filter by Role</div>
                {uniqueRoles.map(role => (
                    <button 
                        key={role}
                        onClick={() => { setSelectedRole(role); setSelectedCandidateId(null); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex justify-between items-center ${
                            selectedRole === role 
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-md scale-[1.02]' 
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <span>{role}</span>
                        {role !== 'All' && (
                             <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${selectedRole === role ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                {candidates.filter(c => c.displayRole === role).length}
                             </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                 <Link href="/" className="text-xs font-bold text-gray-500 hover:text-teal-600 transition-colors uppercase tracking-wider">Exit Admin</Link>
                 <ThemeToggle />
            </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50/50 dark:bg-gray-950">
            
            {/* Top Header */}
            <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 flex-shrink-0 z-10 sticky top-0">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{selectedRole} Candidates</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Real-time compliance monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                     <button onClick={fetchCandidates} className="p-2.5 text-gray-500 hover:text-teal-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-sm transition-all" title="Refresh Data">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </button>
                     
                     {/* FIXED EXPORT MENU */}
                     <div className="relative" ref={exportMenuRef}>
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)} 
                            className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-xl hover:opacity-90 transition-all shadow-md flex items-center gap-2"
                        >
                            Export Data
                            <svg className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        
                        {showExportMenu && (
                          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-visible">
                            <div className="py-1 relative">
                              
                              <div 
                                className="relative group"
                                onMouseEnter={() => setShowSubMenu(true)}
                                onMouseLeave={() => setShowSubMenu(false)}
                              >
                                <button className="flex items-center justify-between w-full text-left px-5 py-4 text-sm text-gray-700 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                                  <div>
                                    <div className="font-bold">CSVs by Category</div>
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">Select specific docs</div>
                                  </div>
                                  <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>

                                {/* Dynamic Submenu mapped to ALL possible categories */}
                                {showSubMenu && (
                                  <div className="absolute top-0 right-full mr-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-y-auto max-h-96 z-[110] custom-scrollbar animate-in slide-in-from-right-2">
                                     <button onClick={() => exportCSV()} className="block w-full text-left px-5 py-3 text-sm text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 font-bold border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm z-10">
                                       Export All Categories
                                     </button>
                                     {ALL_CATEGORIES.map(cat => (
                                       <button key={cat.id} onClick={() => exportCSV(cat.id)} className="block w-full text-left px-5 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-teal-600 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 truncate">
                                         {cat.label}
                                       </button>
                                     ))}
                                  </div>
                                )}
                              </div>

                              <button onClick={exportSalesforce} className="block w-full text-left px-5 py-4 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700">
                                <div className="font-bold">Salesforce Import</div>
                                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">CRM formatted CSV</div>
                              </button>
                              
                              <button onClick={exportJSON} className="block w-full text-left px-5 py-4 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700">
                                <div className="font-bold">Raw JSON Data</div>
                                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">Developer Data Dump</div>
                              </button>
                            </div>
                          </div>
                        )}
                     </div>
                </div>
            </header>

            {/* Scrollable Workspace */}
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-7xl mx-auto">
                     <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Tracking</span>
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                         </div>
                         <div className="text-5xl font-black text-gray-900 dark:text-white">{stats.total}</div>
                     </div>
                     <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/5 p-6 rounded-2xl border border-orange-200 dark:border-orange-800/30 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Action Required</span>
                            <div className="w-8 h-8 rounded-full bg-orange-200/50 dark:bg-orange-800/50 flex items-center justify-center text-orange-600 dark:text-orange-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                         </div>
                         <div className="text-5xl font-black text-orange-700 dark:text-orange-400">{stats.remaining}</div>
                     </div>
                     <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-900/5 p-6 rounded-2xl border border-teal-200 dark:border-teal-800/30 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Fully Compliant</span>
                            <div className="w-8 h-8 rounded-full bg-teal-200/50 dark:bg-teal-800/50 flex items-center justify-center text-teal-600 dark:text-teal-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                         </div>
                         <div className="text-5xl font-black text-teal-700 dark:text-teal-400">{stats.completed}</div>
                     </div>
                </div>

                <div className="flex gap-8 max-w-7xl mx-auto pb-12">
                    
                    {/* Candidate List (Left Panel) */}
                    <div className={`flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col max-h-[800px] ${selectedCandidateId ? 'hidden lg:flex lg:w-1/3 lg:flex-none' : 'w-full'}`}>
                         <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center">
                             <span className="font-bold text-sm text-gray-500 uppercase tracking-wider">Directory</span>
                             <span className="text-xs font-bold bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md">{filteredCandidates.length} Users</span>
                         </div>
                         <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                             {filteredCandidates.length === 0 ? (
                                 <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                    <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                    <p className="text-sm font-medium">No candidates found in this category.</p>
                                 </div>
                             ) : (
                                 filteredCandidates.map(c => (
                                     <div 
                                        key={c.id} 
                                        onClick={() => selectCandidate(c)}
                                        className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                                            selectedCandidateId === c.id 
                                            ? 'bg-white border-teal-500 dark:bg-gray-800 dark:border-teal-500 shadow-md transform scale-[1.02]' 
                                            : 'bg-white dark:bg-gray-900 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                     >
                                         <div className="flex justify-between items-start">
                                            <div className="flex gap-3 items-center">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${c.completed ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                    {c.first_name[0]}{c.last_name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white leading-tight">{c.first_name} {c.last_name}</div>
                                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[150px]">{c.email || "No Email"}</div>
                                                </div>
                                            </div>
                                            {c.completed ? (
                                                <div className="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 p-1.5 rounded-full"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                                            ) : (
                                                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md text-[10px] font-bold tracking-widest">{c.missingCount} MISSING</div>
                                            )}
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>
                    </div>

                    {/* Candidate Detail / Checklist (Right Panel) */}
                    {selectedCandidateId && activeCandidate ? (
                        <div className="flex-[2] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-300">
                             
                             <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-gray-800/50">
                                 <div>
                                     <div className="flex items-center gap-3 mb-2">
                                         <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{activeCandidate.first_name} {activeCandidate.last_name}</h2>
                                         <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${activeCandidate.completed ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                             {activeCandidate.completed ? "100% Compliant" : `${activeCandidate.missingCount} Action Required`}
                                         </span>
                                     </div>
                                     <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                         <span className="bg-white dark:bg-gray-800 px-2 py-1 rounded border dark:border-gray-700">{activeCandidate.role || "Role Unassigned"}</span> 
                                         <span className="opacity-50">•</span> 
                                         <span>{activeCandidate.email}</span>
                                     </p>
                                 </div>
                                 <button onClick={() => setSelectedCandidateId(null)} className="lg:hidden p-2 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                                     <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                             </div>

                             <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 dark:bg-gray-900/30 custom-scrollbar">
                                 <div className="flex justify-between items-end mb-6">
                                     <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Compliance Audit</h3>
                                     <div className="text-xs font-semibold text-gray-500">
                                         {activeCandidate.totalRequired - activeCandidate.missingCount} of {activeCandidate.totalRequired} verified
                                     </div>
                                 </div>
                                 
                                 {loadingDocs ? (
                                     <div className="h-48 flex flex-col items-center justify-center text-teal-600 gap-3">
                                         <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                         <span className="text-sm font-bold animate-pulse">Syncing Google Drive...</span>
                                     </div>
                                 ) : (
                                     <div className="space-y-8">
                                         {/* DYNAMIC CHECKLIST RENDERING BY GROUP */}
                                         {activeChecklist.map(group => (
                                             <div key={group.id} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                                 <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                                                     {group.label}
                                                 </h4>
                                                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                     {group.items.map(item => {
                                                         const docMatch = selectedCandidateDocs.find(d => matchesCategory(d, item.id) && d.status !== 'FAKE');
                                                         const isPresent = !!docMatch;
                                                         const ahpraBadge = isPresent ? getVerificationBadge(docMatch.status) : null;
                                                         
                                                         return (
                                                             <div key={item.id} className={`flex flex-col justify-between p-4 rounded-xl border transition-all relative overflow-hidden backdrop-blur-sm ${ahpraBadge ? `${ahpraBadge.bgColor} ${ahpraBadge.borderColor}` : isPresent ? 'bg-white/40 dark:bg-gray-800/40 border-gray-200/60 dark:border-gray-700/60 hover:border-teal-300 dark:hover:border-teal-700' : 'bg-red-50/20 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/30 border-dashed'}`}>
                                                                 <div className="flex items-start gap-4 mb-4">
                                                                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ahpraBadge ? `${ahpraBadge.bgColor} ${ahpraBadge.textColor} shadow-sm border ${ahpraBadge.borderColor}` : isPresent ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                         {ahpraBadge ? ahpraBadge.icon : isPresent ? (
                                                                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                         ) : (
                                                                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                         )}
                                                                     </div>
                                                                     <div className="flex-1 min-w-0">
                                                                         <div className={`text-sm font-bold truncate ${ahpraBadge ? ahpraBadge.textColor : isPresent ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-400'}`}>
                                                                             {item.label}
                                                                         </div>
                                                                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                                            {ahpraBadge ? ahpraBadge.label : isPresent ? 'Verified & Stored' : 'Awaiting Upload'}
                                                                         </div>
                                                                     </div>
                                                                 </div>
                                                                 
                                                                 {ahpraBadge && docMatch?.extracted?.registration_type && (
                                                                     <div className={`text-[10px] mb-3 px-2 py-1.5 rounded-md mix-blend-multiply dark:mix-blend-lighten opacity-80 ${ahpraBadge.bgColor}`}>
                                                                         <div className="flex justify-between items-center whitespace-nowrap overflow-hidden">
                                                                             <span className="font-semibold truncate mr-2">{docMatch.extracted.registration_type}</span>
                                                                             {docMatch.extracted.expiry_date && <span>Exp: {docMatch.extracted.expiry_date}</span>}
                                                                         </div>
                                                                     </div>
                                                                 )}
                                                                 
                                                                 <div className="mt-auto relative z-10">
                                                                     {isPresent && docMatch?.view_link ? (
                                                                         <a 
                                                                            href={typeof docMatch.view_link === 'string' ? docMatch.view_link : docMatch.view_link.webViewLink} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className={`block w-full text-center text-xs font-bold py-2 rounded-lg transition-colors border ${ahpraBadge ? `bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 ${ahpraBadge.textColor} ${ahpraBadge.borderColor}` : 'text-teal-700 bg-white hover:bg-teal-50 dark:text-teal-300 dark:bg-gray-800 dark:hover:bg-teal-900/30 border-gray-200 dark:border-gray-700'}`}
                                                                         >
                                                                             OPEN DOCUMENT
                                                                         </a>
                                                                     ) : !isPresent ? (
                                                                         <div className="w-full text-center text-xs font-bold text-red-400 bg-red-50/50 dark:bg-red-900/10 py-2 rounded-lg border border-red-100 dark:border-red-900/20">
                                                                             MISSING
                                                                         </div>
                                                                     ) : (
                                                                         <div className="w-full text-center text-xs font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                             PROCESSING LINK...
                                                                         </div>
                                                                     )}
                                                                 </div>
                                                                 
                                                                 {ahpraBadge && (
                                                                     <div className={`absolute bottom-0 left-0 w-full h-1 ${ahpraBadge.color}`} />
                                                                 )}
                                                             </div>
                                                         );
                                                     })}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 )}
                             </div>
                        </div>
                    ) : (
                        <div className="hidden lg:flex flex-[2] bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 items-center justify-center text-gray-400 flex-col gap-3">
                             <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm mb-2">
                                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                             </div>
                             <span className="font-bold text-gray-500">Select a candidate</span>
                             <span className="text-sm">Click a profile on the left to view their detailed audit.</span>
                        </div>
                    )}
                </div>

            </main>
        </div>
    </div>
  );
}
