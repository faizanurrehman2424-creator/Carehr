"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "@/lib/api";
import ThemeToggle from "@/components/themetoggle";
import Link from "next/link"; 
import { getChecklistForRole, DOCTOR_CHECKLIST, NURSE_CHECKLIST, CHECKLIST_GROUPS } from "@/lib/categories";
import { AdminLogin } from "@/components/dashboard/AdminLogin";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { CandidateList } from "@/components/dashboard/CandidateList";
import { CandidateChecklist } from "@/components/dashboard/CandidateChecklist";

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
  
  // Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  useEffect(() => {
    if (localStorage.getItem("admin_authenticated") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = React.useCallback(() => {
    localStorage.setItem("admin_authenticated", "true");
    setIsAuthenticated(true);
  }, []);

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
    return <AdminLogin onSuccess={handleLoginSuccess} />;
  }

  // --- Render Dashboard ---
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
        
        {/* MOBILE SIDEBAR OVERLAY */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 w-72 md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.05)] md:shadow-none`}>
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-sky-600 flex items-center justify-center text-white shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-white tracking-tight">Admin HQ</span>
                </div>
                <button 
                  className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2 mt-2">Filter by Role</div>
                {uniqueRoles.map(role => (
                    <button 
                        key={role}
                        onClick={() => { setSelectedRole(role); setSelectedCandidateId(null); setIsSidebarOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex justify-between items-center ${
                            selectedRole === role 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-[1.02]' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <span>{role}</span>
                        {role !== 'All' && (
                             <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${selectedRole === role ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                {candidates.filter(c => c.displayRole === role).length}
                             </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <Link href="/" className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider">Exit Admin</Link>
                 <ThemeToggle />
            </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950 w-full">
            
            {/* Top Header */}
            <header className="h-auto min-h-[5rem] py-4 md:h-20 md:py-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 sticky top-0 gap-4 md:gap-0">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      onClick={() => setIsSidebarOpen(true)}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div>
                        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{selectedRole} Candidates</h2>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">Real-time compliance monitoring</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-end">
                     <button onClick={fetchCandidates} className="p-2.5 text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all flex-shrink-0" title="Refresh Data">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </button>
                     
                     {/* FIXED EXPORT MENU */}
                     <div className="relative" ref={exportMenuRef}>
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)} 
                            className="px-4 md:px-5 py-2.5 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-all shadow-md flex items-center gap-2"
                        >
                            <span className="hidden sm:inline">Export Data</span>
                            <span className="sm:hidden">Export</span>
                            <svg className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        
                        {showExportMenu && (
                          <div className="absolute right-0 mt-2 w-56 md:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-visible">
                            <div className="py-1 relative">
                              
                              <div 
                                className="relative group"
                                onMouseEnter={() => setShowSubMenu(true)}
                                onMouseLeave={() => setShowSubMenu(false)}
                              >
                                <button className="flex items-center justify-between w-full text-left px-5 py-4 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                  <div>
                                    <div className="font-bold">CSVs by Category</div>
                                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Select specific docs</div>
                                  </div>
                                  <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>

                                {/* Dynamic Submenu mapped to ALL possible categories */}
                                {showSubMenu && (
                                  <div className="absolute top-0 right-full mr-1 w-64 md:w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-y-auto max-h-96 z-[110] custom-scrollbar animate-in slide-in-from-right-2">
                                     <button onClick={() => exportCSV()} className="block w-full text-left px-5 py-3 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-bold border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm z-10">
                                       Export All Categories
                                     </button>
                                     {ALL_CATEGORIES.map(cat => (
                                       <button key={cat.id} onClick={() => exportCSV(cat.id)} className="block w-full text-left px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0 truncate">
                                         {cat.label}
                                       </button>
                                     ))}
                                  </div>
                                )}
                              </div>

                              <button onClick={exportSalesforce} className="block w-full text-left px-5 py-4 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700">
                                <div className="font-bold">Salesforce Import</div>
                                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">CRM formatted CSV</div>
                              </button>
                              
                              <button onClick={exportJSON} className="block w-full text-left px-5 py-4 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700">
                                <div className="font-bold">Raw JSON Data</div>
                                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Developer Data Dump</div>
                              </button>
                            </div>
                          </div>
                        )}
                     </div>
                </div>
            </header>

            {/* Scrollable Workspace */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                
                <StatsCards stats={stats} />

                <div className="flex flex-col lg:flex-row gap-6 md:gap-8 max-w-7xl mx-auto pb-12">
                    
                    {/* Candidate List (Left Panel) */}
                    <div className={`w-full lg:w-1/3 xl:w-[400px] flex-shrink-0 ${selectedCandidateId ? 'hidden lg:block' : 'block'}`}>
                        <CandidateList 
                           candidates={filteredCandidates as any} 
                           selectedCandidateId={selectedCandidateId} 
                           onSelectCandidate={selectCandidate as any} 
                        />
                    </div>

                    {/* Candidate Detail / Checklist (Right Panel) */}
                    {selectedCandidateId && activeCandidate ? (
                        <div className="flex-1 min-w-0">
                            <CandidateChecklist 
                               activeCandidate={activeCandidate} 
                               loadingDocs={loadingDocs} 
                               activeChecklist={activeChecklist} 
                               selectedCandidateDocs={selectedCandidateDocs} 
                               onClose={() => setSelectedCandidateId(null)} 
                            />
                        </div>
                    ) : (
                        <div className="flex-1 min-w-0 hidden lg:flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 border-dashed dark:border-slate-800 shadow-sm p-12 text-center relative overflow-hidden h-[600px]">
                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                                    </pattern>
                                    <rect width="100" height="100" fill="url(#grid)" />
                                </svg>
                            </div>
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-6 relative z-10 shadow-sm border border-white dark:border-slate-700">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 relative z-10">Select a Candidate</h3>
                            <p className="text-sm text-slate-500 max-w-xs relative z-10">Choose a candidate from the directory to view their complete compliance audit and documents.</p>
                        </div>
                    )}
                </div>

            </main>
        </div>
    </div>
  );
}
