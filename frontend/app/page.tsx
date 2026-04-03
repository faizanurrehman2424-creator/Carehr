"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/themetoggle";
import api from "@/lib/api"; 
import { getChecklistForRole } from "@/lib/categories";

export type UploadedFile = {
  file: File;
  stableId: string;
  category: string;
  isExisting?: boolean; 
  filename?: string;
  viewLink?: string;
  status?: string; 
};

type ViewState = "chat" | "profile"; 
type Notification = { id: string; title: string; message: string; type: 'info'|'success'|'error'|'warning'; time: Date };

const autoCategorizeFile = (filename: string, role: string): string => {
  const lower = filename.toLowerCase();
  const currentChecklist = getChecklistForRole(role);
  
  for (const group of currentChecklist) {
    for (const item of group.items) {
        if (lower.includes(item.id) || lower.includes(item.label.toLowerCase().split(' ')[0])) {
            return item.id;
        }
    }
  }
  return "uncategorized";
};

export default function Page() {
  const [currentView, setCurrentView] = useState<ViewState>("profile"); 
  const [role, setRole] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hello! I am your CareHR Assistant. You can ask me what documents you are missing, or simply drop your PDF files right here into the chat to upload them!" }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<{status: 'idle' | 'uploading' | 'success' | 'error', message: string}>({status: 'idle', message: ''});

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const addNotification = (title: string, message: string, type: 'info'|'success'|'error'|'warning') => {
      setNotifications(prev => [{ id: Math.random().toString(36), title, message, type, time: new Date() }, ...prev]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if(!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput(""); 
    
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);

    setMessages(prev => [...prev, { role: "ai", text: "" }]);

    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        
        const response = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, message: userMsg })
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        setIsTyping(false); 

        let done = false;
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        text: newMessages[lastIndex].text + chunk
                    };
                    return newMessages;
                });
            }
        }
    } catch (e) {
        setIsTyping(false);
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { role: "ai", text: "I'm having trouble connecting to the server. Please try again later." };
            return newMessages;
        });
    }
  };

  const handleProfileLogin = async (isSilent = false) => {
    if(!role || !firstName || !lastName || !email) {
        if(!isSilent) alert("Please fill all fields");
        return;
    }
    if (!isSilent) {
        const termsCheckbox = document.getElementById('terms') as HTMLInputElement;
        if (termsCheckbox && !termsCheckbox.checked) {
            alert("Please agree to the Privacy Policy and Terms of Service.");
            return;
        }
        setIsLoggingIn(true);
    }

    try {
        const res = await api.get(`/candidates/lookup?email=${email}`);
        if (res.data.found) {
            const existingFiles: UploadedFile[] = res.data.documents.map((d: any) => ({
                file: { name: d.filename } as File,
                stableId: d.id,
                category: d.category,
                isExisting: true,
                filename: d.filename,
                viewLink: d.drive_view_link,
                status: d.status
            }));
            setUploadedFiles(existingFiles);
        } else {
            await api.post('/candidates', {
                first_name: firstName,
                last_name: lastName,
                email: email,
                role: role
            });
        }
        if(!isSilent) setCurrentView('chat');
    } catch (e) { 
        console.error(e);
        if(!isSilent) alert("Failed to connect to the database.");
    } finally {
        if (!isSilent) setIsLoggingIn(false);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    setIsDragging(false); 
    const pdfs = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) return;

    setUploadState({ status: 'uploading', message: `Uploading ${pdfs.length} file(s)...` });
    addNotification("Upload Started", `Processing ${pdfs.length} document(s)...`, "info");
    setIsNotifOpen(true); 

    try {
        const formData = new FormData();
        formData.append("first_name", firstName);
        formData.append("last_name", lastName);
        formData.append("email", email);
        formData.append("role", role);
        formData.append("dob", "");

        for (const f of pdfs) {
            formData.append("files", f);
            formData.append("categories", autoCategorizeFile(f.name, role));
        }

        const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
        
        let hasFake = false;
        res.data.documents.forEach((d: any) => {
             if(d.status === "FAKE") {
                 hasFake = true;
                 addNotification("Fake Document Detected", `Document flagged as suspicious. Not saved to vault storage.`, "error");
             }
        });

        if (!hasFake) {
             addNotification("Upload Complete", "Documents successfully verified and saved to Vault.", "success");
             setUploadState({ status: 'success', message: "Documents saved!" });
             setMessages(prev => [...prev, { role: "ai", text: "I've received your uploaded documents! I'm processing them now. You will see your sidebar checklist update shortly." }]);
        } else {
             setUploadState({ status: 'error', message: "Fraud detected in upload." });
        }
        
        handleProfileLogin(true); 
        setTimeout(() => setUploadState({ status: 'idle', message: '' }), 4000);
    } catch (e) {
        setUploadState({ status: 'error', message: "Upload failed." });
        addNotification("Upload Failed", "An error occurred while uploading.", "error");
        setTimeout(() => setUploadState({ status: 'idle', message: '' }), 4000);
    }
  };

  const handleDeleteFile = async (stableId: string) => {
    setUploadState({ status: 'uploading', message: "Deleting document..." });
    addNotification("Deletion Started", "Removing document from Vault...", "info");
    setIsNotifOpen(true);
    
    try {
        await api.delete(`/documents/${stableId}`);
        setUploadedFiles(prev => prev.filter(f => f.stableId !== stableId));
        setUploadState({ status: 'success', message: "Document deleted!" });
        addNotification("Deletion Complete", "Document successfully removed.", "success");
        setTimeout(() => setUploadState({ status: 'idle', message: '' }), 3000);
    } catch (e) {
        setUploadState({ status: 'error', message: "Failed to delete document." });
        addNotification("Deletion Failed", "Could not remove document.", "error");
        setTimeout(() => setUploadState({ status: 'idle', message: '' }), 4000);
    }
  };

  const handleVerifyFile = async (stableId: string) => {
    setVerifyingId(stableId);
    addNotification("AHPRA Verification", "Starting AHPRA register check... This may take 15-20 seconds.", "info");
    setIsNotifOpen(true);

    try {
        const res = await api.post(`/verify/${stableId}`);
        const data = res.data;

        if (data.status === 'success') {
            setUploadedFiles(prev => prev.map(f => {
                if (f.stableId === stableId) {
                    return { ...f, status: data.document_status };
                }
                return f;
            }));

            const verification = data.verification || {};
            
            if (data.document_status === 'AHPRA_VERIFIED') {
                addNotification("✅ AHPRA Verified", 
                    `Registration confirmed. Practitioner: ${verification.practitioner_name || 'N/A'}. Name matches candidate record.`,
                    "success");
            } else if (data.document_status === 'AHPRA_NAME_MISMATCH') {
                addNotification("⚠️ Name Mismatch", 
                    `AHPRA registration is valid, but the name on record (${verification.practitioner_name || 'Unknown'}) does not match the candidate's name.`,
                    "warning");
            } else if (data.document_status === 'AHPRA_NOT_FOUND') {
                addNotification("❌ Not Found", 
                    "This AHPRA registration number was not found on the public register.",
                    "error");
            }
        } else {
            addNotification("Verification Issue", data.message || "Could not complete verification.", "warning");
        }
    } catch (e: any) {
        const msg = e?.response?.data?.detail || "Verification request failed. Please try again.";
        addNotification("Verification Error", msg, "error");
    } finally {
        setVerifyingId(null);
    }
  };

  const validOrReceivedFiles = uploadedFiles.filter(f => f.status !== 'FAKE');
  const currentChecklist = getChecklistForRole(role);
  const totalRequired = currentChecklist.reduce((acc, group) => acc + group.items.length, 0);
  const fulfilledCategories = new Set(validOrReceivedFiles.map((f) => f.category));
  const progressPercentage = Math.round((fulfilledCategories.size / totalRequired) * 100);

  const ROLES_LIST = ["Doctor", "Nurse", "Allied Health", "Admin", "IT", "Facility"];

  if (currentView === "profile") {
    return (
      <div className="min-h-screen flex bg-white dark:bg-gray-950 font-sans transition-colors duration-500">
        
        <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12 overflow-hidden bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-slate-900 dark:to-cyan-950 transition-all duration-500">
          <div className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none">
             <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                 <path d="M0 100 C 30 50 70 50 100 100 Z" fill="white" />
                 <circle cx="80" cy="20" r="20" fill="white" opacity="0.5" />
             </svg>
          </div>
          <div className="relative z-10 text-center text-white">
            <div className="mb-10 flex flex-col items-center justify-center">
               <div className="bg-white py-2 px-6 rounded-[2.5rem] shadow-2xl mb-8 transform transition-transform hover:scale-105 duration-300">
                 <img 
                    src="/logo-light.png" 
                    alt="Logo" 
                    className="h-48 w-auto object-contain" 
                    onError={(e) => { e.currentTarget.style.display='none'; }} 
                 />
              </div>              
            </div>
            <h1 className="text-2xl font-extrabold mb-2 text-white leading-tight drop-shadow-md">
              From paperwork to people work, AI agents create seamless onboarding for healthcare.
            </h1>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24 bg-gray-50 dark:bg-gray-950 relative transition-colors duration-500">
          
          <div className="absolute top-8 right-8 z-50 flex items-center gap-4">
            {/* NEW: Feedback Form Link */}
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSegC8PbeLYDTywFMw7yfuS7ybYugQjNf7lfAfzWwtbgHEC9Rw/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition-colors">
              Feedback
            </a>
            <Link href="/dashboard" className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">Admin Login</Link>
            <ThemeToggle />
          </div>

          <div className="w-full max-w-md space-y-8 flex-1 flex flex-col justify-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Get Started</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Create your profile or Log in</p>
            </div>
            
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white outline-none transition-shadow" placeholder="Jane" />
                  </div>
                  <div className="group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white outline-none transition-shadow" placeholder="Doe" />
                  </div>
              </div>
              
              <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Work Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white outline-none transition-shadow" placeholder="jane@hospital.com" />
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Profession</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white outline-none cursor-pointer transition-shadow">
                      <option value="">Select your role</option>
                      {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
              </div>

              <div className="flex items-start gap-3 px-1">
                <div className="relative flex items-center h-5">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    className="w-5 h-5 rounded-md border-gray-300 dark:border-gray-700 text-teal-600 focus:ring-teal-500 cursor-pointer transition-all"
                  />
                </div>
                <div className="text-xs leading-normal text-gray-500 dark:text-gray-400">
                  I agree to the{" "}
                  <span className="group relative inline-block">
                    <button type="button" className="underline font-bold text-gray-700 dark:text-gray-200 hover:text-teal-600 transition-colors">
                      Privacy Policy
                    </button>
                    <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl text-[10px] z-[60] animate-in fade-in zoom-in duration-200 pointer-events-none">
                      <p className="font-bold mb-1 uppercase tracking-widest text-[9px]">Data Security Charter</p>
                      <p className="opacity-80 italic">Note: Crystal and Omar to develop the privacy/data security charter and determine how these commitments will be communicated to clients and users.</p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900 dark:border-t-white"></div>
                    </div>
                  </span>{" "}
                  and{" "}
                  <button type="button" className="underline font-bold text-gray-700 dark:text-gray-200 hover:text-teal-600 transition-colors">
                    Terms of Service
                  </button>
                </div>
              </div>

              <button 
                  onClick={() => handleProfileLogin(false)} 
                  disabled={isLoggingIn}
                  className={`w-full flex items-center justify-center py-4 mt-2 font-bold rounded-xl shadow-lg transition-all transform ${
                      isLoggingIn 
                      ? 'bg-gray-400 text-gray-100 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed scale-[0.98]' 
                      : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 hover:-translate-y-0.5'
                  }`}
              >
                  {isLoggingIn ? (
                      <>
                          <svg className="w-5 h-5 mr-3 animate-spin border-2 border-white dark:border-gray-900 border-t-transparent rounded-full" viewBox="0 0 24 24"></svg>
                          Logging in...
                      </>
                  ) : "Log In"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 flex overflow-hidden relative">
      
      <Sidebar 
         progress={progressPercentage} 
         uploadedCategories={fulfilledCategories} 
         role={role} 
         firstName={firstName} 
         lastName={lastName} 
         uploadedFiles={uploadedFiles}
         onNavigate={setCurrentView}
         onDeleteFile={handleDeleteFile}
         onVerifyFile={handleVerifyFile}
         verifyingId={verifyingId}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen relative bg-gray-50/50 dark:bg-gray-950">
        
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 h-20 px-8 flex justify-between items-center flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-sm">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h1 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">CareHR Assistant</h1>
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Active Workspace</span>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* NEW: Feedback Form Link Button */}
            <a 
               href="https://docs.google.com/forms/d/e/1FAIpQLSegC8PbeLYDTywFMw7yfuS7ybYugQjNf7lfAfzWwtbgHEC9Rw/viewform?usp=publish-editor" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors uppercase tracking-wider hidden sm:block border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg shadow-sm"
            >
               Share Feedback
            </a>

            <div className="relative">
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {notifications.length > 0 && (
                        <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                    )}
                </button>
                
                {isNotifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <span className="font-bold text-sm tracking-tight">Notifications</span>
                            <button onClick={() => setNotifications([])} className="text-[10px] uppercase font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Clear All</button>
                        </div>
                        <div className="max-h-72 overflow-y-auto custom-scrollbar p-2">
                            {notifications.length === 0 ? (
                                <p className="text-center text-xs font-medium text-gray-500 py-6">No new notifications.</p>
                            ) : (
                                notifications.map(n => (
                                    <div key={n.id} className="p-3 mb-1 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex gap-3">
                                        <div className="mt-0.5 flex-shrink-0">
                                            {n.type === 'error' && <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                            {n.type === 'success' && <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                            {n.type === 'info' && <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold">{n.title}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{n.message}</p>
                                            <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-widest">{n.time.toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Link href="/dashboard" className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-wider hidden sm:block">Admin HQ</Link>
            <ThemeToggle />
          </div>
        </header>

        <main 
            className="flex-1 overflow-hidden flex flex-col relative"
            onDrop={(e) => { e.preventDefault(); handleFilesSelected(Array.from(e.dataTransfer.files)); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 z-30 flex flex-col items-center justify-center border-4 border-dashed border-gray-900 dark:border-white m-6 rounded-3xl backdrop-blur-sm transition-all">
                    <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full shadow-lg mb-4 animate-bounce border border-gray-200 dark:border-gray-700">
                        <svg className="w-12 h-12 text-gray-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <p className="text-gray-900 dark:text-white font-extrabold text-2xl tracking-tight">Drop PDF documents here</p>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">They will instantly upload to your vault.</p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth max-w-4xl mx-auto w-full pt-6 custom-scrollbar">
                <div className="space-y-6 pb-4">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${m.role === 'ai' ? 'bg-teal-50 border-teal-100 text-teal-600 dark:bg-teal-900/30 dark:border-teal-800' : 'bg-gray-900 border-gray-900 text-white dark:bg-white dark:border-white dark:text-gray-900'}`}>
                                    {m.role === 'ai' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> : <span className="text-xs font-bold uppercase">{firstName[0] || "U"}</span>}
                                </div>
                                <div className={`p-4 rounded-2xl shadow-sm whitespace-pre-wrap text-[15px] leading-relaxed ${m.role === 'user' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-tr-none border-transparent' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-none text-gray-800 dark:text-gray-200'}`}>
                                    {m.text}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="flex gap-3 flex-row">
                                <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 dark:bg-teal-900/30 dark:border-teal-800 flex items-center justify-center flex-shrink-0">
                                     <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                     </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            
            <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10">
              <div className="max-w-4xl mx-auto flex gap-2 p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-inner relative items-center">
                  
                  <input type="file" accept="application/pdf" multiple className="hidden" id="chat-file-upload" onChange={(e) => {
                      if(e.target.files) handleFilesSelected(Array.from(e.target.files));
                      e.target.value = '';
                  }} />
                  <label htmlFor="chat-file-upload" className="p-3 text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer transition-colors flex items-center justify-center rounded-xl hover:bg-white dark:hover:bg-gray-700 shadow-sm" title="Attach Document">
                      <svg className="w-5 h-5 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </label>

                  <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask me anything, or drop a PDF here..."
                      className="flex-1 bg-transparent p-2 outline-none text-gray-900 dark:text-white placeholder-gray-400 text-[15px] font-medium" 
                  />
                  
                  <button onClick={handleSendMessage} disabled={!chatInput.trim()} className="p-3 px-5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-xl hover:opacity-90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm">
                      Send
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
              </div>
            </div>
        </main>
      </div>
    </div>
  );
}
