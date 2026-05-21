"use client";

import React, { useState } from "react";
import { getChecklistForRole } from "@/lib/categories";
import { UploadedFile } from "@/app/page";

type SidebarProps = {
  progress: number;
  uploadedCategories: Set<string>;
  role: string;
  firstName: string;
  lastName: string;
  uploadedFiles: UploadedFile[];
  onNavigate?: (view: "chat" | "profile") => void;
  onDeleteFile?: (stableId: string) => void;
  onVerifyFile?: (stableId: string) => void;
  verifyingId?: string | null;
};

// Helper to determine if a file category is AHPRA-related
const isAhpraCategory = (category: string) => {
  const cat = (category || "").toLowerCase();
  return cat.includes("ahpra") || cat.includes("registration");
};

// Helper to get verification status display
const getVerificationBadge = (status?: string) => {
  switch (status) {
    case "AHPRA_VERIFIED":
      return {
        color: "bg-emerald-500",
        icon: (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
          </svg>
        ),
        label: "AHPRA Verified",
        textColor: "text-emerald-300",
      };
    case "AHPRA_NAME_MISMATCH":
      return {
        color: "bg-orange-500",
        icon: (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        label: "Name Mismatch",
        textColor: "text-orange-300",
      };
    case "AHPRA_NOT_FOUND":
      return {
        color: "bg-red-500",
        icon: (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
        label: "Not Found",
        textColor: "text-red-300",
      };
    default:
      return null;
  }
};

export default function Sidebar({ progress, uploadedCategories, role, firstName, lastName, uploadedFiles, onNavigate, onDeleteFile, onVerifyFile, verifyingId }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'checklist' | 'vault'>('checklist');

  const toggleGroup = (groupId: string) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getRoleIcon = () => {
    const r = role?.toLowerCase() || "";
    const size = isCollapsed ? "h-12 w-12" : "h-28 w-28";
    
    let imgSrc = "/facility.png"; 
    if (r.includes("doctor") || r.includes("surgeon")) imgSrc = "/doctor.png";
    else if (r.includes("nurse")) imgSrc = "/nurse.png";
    else if (r.includes("allied")) imgSrc = "/allied.png";
    else if (r.includes("admin")) imgSrc = "/admin.png";
    else if (r.includes("it")) imgSrc = "/it.png";

    return (
      <div className={`${size} rounded-[2rem] bg-white p-2.5 flex items-center justify-center overflow-hidden border border-white/50 shadow-2xl transition-all hover:scale-105 duration-500`}>
          <img 
              src={imgSrc} 
              alt={role} 
              className="w-full h-full object-contain animate-in fade-in zoom-in duration-700"
              onError={(e) => { e.currentTarget.src = "/logo-light.png"; }} 
          />
      </div>
    );
  };

  const displayName = firstName ? `${firstName} ${lastName}`.trim() : "Candidate";
  const currentChecklist = getChecklistForRole(role);

  return (
    <aside className={`${isCollapsed ? 'w-24' : 'w-80'} bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-slate-900 dark:to-cyan-950 flex-shrink-0 h-screen sticky top-0 z-40 transition-all duration-500 shadow-2xl overflow-hidden`}>
      
      <div className="h-full overflow-y-auto no-scrollbar flex flex-col pt-4">
        
        {/* Toggle Button */}
        <div className={`px-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'} flex-shrink-0 mb-4`}>
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                {isCollapsed ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                )}
            </button>
        </div>

        {/* User Info & Avatar (Moved up where logo used to be) */}
        <div className={`flex flex-col items-center ${isCollapsed ? 'px-2' : 'px-6'} mb-6 flex-shrink-0`}>
          <div className="transition-all duration-500">{getRoleIcon()}</div>
          {!isCollapsed && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-500 w-full px-2 mt-4">
                <p className="text-xl font-black text-white tracking-tight truncate w-full">{displayName}</p>
                <p className="text-[10px] font-bold text-white mt-1 uppercase tracking-[0.2em] opacity-60">{role || "Unassigned"}</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 mb-6">
          {!isCollapsed ? (
             <div className="px-8">
               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2.5 text-white/90">
                 <span>Compliance</span>
                 <span>{progress}%</span>
               </div>
               <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden border border-white/5">
                 <div className="bg-white h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(255,255,255,0.6)]" style={{ width: `${progress}%` }}></div>
               </div>
             </div>
          ) : (
             <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center bg-white/10 backdrop-blur-md">
                    <span className="text-[10px] font-black text-white">{progress}</span>
                </div>
             </div>
          )}
        </div>

        {!isCollapsed && (
            <div className="px-6 mb-4 flex-shrink-0">
                <div className="flex bg-black/20 p-1.5 rounded-2xl border border-white/10 shadow-inner backdrop-blur-sm">
                    <button 
                        onClick={() => setActiveTab('checklist')} 
                        className={`flex-1 text-[11px] py-2.5 rounded-xl font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'checklist' ? 'bg-white text-gray-900 shadow-2xl scale-[1.02]' : 'text-white/60 hover:text-white'}`}>
                        Checklist
                    </button>
                    <button 
                        onClick={() => setActiveTab('vault')} 
                        className={`flex-1 text-[11px] py-2.5 rounded-xl font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'vault' ? 'bg-white text-gray-900 shadow-2xl scale-[1.02]' : 'text-white/60 hover:text-white'}`}>
                        Vault
                    </button>
                </div>
            </div>
        )}

        <div className="px-6 flex-1">
          {!isCollapsed ? (
              activeTab === 'checklist' ? (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                      {currentChecklist.map((group) => (
                          <div key={group.id} className="border-b border-white/10 last:border-0">
                              <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center justify-between py-4 px-2 hover:bg-white/5 rounded-xl group transition-all">
                                  <span className="font-black text-white/90 text-[10px] uppercase tracking-[0.15em]">{group.label}</span>
                                  <svg className={`w-3 h-3 text-white/50 transition-transform ${openGroups[group.id] ? 'rotate-180 text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              <div className={`overflow-hidden transition-all duration-500 ${openGroups[group.id] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                  <div className="pb-3 space-y-1.5">
                                      {group.items.map((item) => {
                                          const isCompleted = uploadedCategories.has(item.id);
                                          return (
                                              <div key={item.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/10 transition-all ml-1">
                                                  <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${isCompleted ? 'bg-white border-white text-teal-600 scale-110 shadow-lg' : 'border-white/30'}`}>
                                                      {isCompleted && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                                  </div>
                                                  <span className={`text-[11px] font-bold leading-tight ${isCompleted ? 'text-white/40 line-through' : 'text-white/80'}`}>{item.label}</span>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 pt-2">
                      {uploadedFiles.length === 0 ? (
                          <div className="text-center py-12 px-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                              <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner">
                                  <svg className="w-8 h-8 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </div>
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Vault is Empty</p>
                              <p className="text-[10px] font-medium text-white/40 mt-2">Documents will appear here</p>
                          </div>
                      ) : (
                          uploadedFiles.map(file => {
                              const isAhpra = isAhpraCategory(file.category);
                              const isVerifying = verifyingId === file.stableId;
                              const verificationBadge = getVerificationBadge(file.status);
                              const isAhpraVerified = file.status?.startsWith("AHPRA_");

                              return (
                              <div key={file.stableId} className={`bg-white/10 border ${file.status === 'FAKE' ? 'border-red-500/50 bg-red-900/20' : isAhpraVerified ? (file.status === 'AHPRA_VERIFIED' ? 'border-emerald-400/50 bg-emerald-900/20' : file.status === 'AHPRA_NAME_MISMATCH' ? 'border-orange-400/50 bg-orange-900/20' : 'border-red-400/50 bg-red-900/20') : 'border-white/20'} rounded-2xl p-4 shadow-lg backdrop-blur-md hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:bg-white/20 transition-all duration-300 relative group flex flex-col gap-4`}>
                                  
                                  {/* Delete Button */}
                                  <button 
                                      type="button"
                                      onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (onDeleteFile) onDeleteFile(file.stableId);
                                      }} 
                                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/20 text-white/50 hover:bg-red-500 hover:text-white transition-all shadow-sm z-20 opacity-0 group-hover:opacity-100" 
                                      title="Delete Document"
                                  >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>

                                  {/* Top Row: Icon & File Details */}
                                  <div className="flex items-start gap-4 pr-6 relative">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs shadow-md relative ${file.status === 'FAKE' ? 'bg-red-100 text-red-600' : 'bg-white text-teal-600'}`}>
                                          {/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.filename || '') ? 'IMG' : 'PDF'}
                                          {file.status === 'FAKE' && (
                                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg" title="Fraud Detected">
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                              </div>
                                          )}
                                          {(file.status === 'RECEIVED' || file.status === 'Pending') && (
                                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 text-white rounded-full flex items-center justify-center shadow-lg" title="Pending Verification">
                                                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                              </div>
                                          )}
                                          {file.status === 'VALID' && (
                                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg" title="Verified">
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                              </div>
                                          )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                          <p className="text-xs font-black text-white truncate drop-shadow-sm" title={file.filename}>{file.filename}</p>
                                          <p className={`text-[10px] font-bold mt-1 uppercase tracking-widest ${file.status === 'FAKE' ? 'text-red-300' : 'text-teal-100/90'}`}>{file.category.replace("_", " ")}</p>
                                      </div>
                                  </div>

                                  {/* Middle Row: Action Buttons */}
                                  <div className="flex gap-2">
                                      {file.viewLink ? (
                                          <a href={file.viewLink} target="_blank" rel="noreferrer" className="flex-1 text-center bg-white text-gray-900 hover:bg-gray-100 font-black text-[10px] py-2.5 rounded-xl transition-all shadow-md uppercase tracking-wider">View</a>
                                      ) : (
                                          <button disabled className="flex-1 text-center bg-black/20 text-white/30 font-black text-[10px] py-2.5 rounded-xl border border-transparent cursor-not-allowed uppercase tracking-wider">No Link</button>
                                      )}
                                      {/* AHPRA Verify Button (only if AHPRA document AND not yet verified) */}
                                      {isAhpra && !isAhpraVerified && (
                                          <button 
                                              onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  if (onVerifyFile) onVerifyFile(file.stableId);
                                              }}
                                              disabled={isVerifying}
                                              className={`flex-1 text-center font-black text-[10px] py-2.5 rounded-xl uppercase tracking-wider transition-all shadow-md ${
                                                  isVerifying
                                                      ? 'bg-teal-600/50 text-white/70 cursor-wait'
                                                      : 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow-lg transform hover:-translate-y-0.5'
                                              }`}
                                          >
                                              {isVerifying ? (
                                                  <span className="flex items-center justify-center gap-1.5">
                                                      <div className="w-2.5 h-2.5 border-[1.5px] border-white/60 border-t-transparent rounded-full animate-spin"></div>
                                                      Verifying...
                                                  </span>
                                              ) : (
                                                  "Verify AHPRA"
                                              )}
                                          </button>
                                      )}
                                  </div>

                                  {/* Bottom Row / Full-width Status Strip: AHPRA Verified Status */}
                                  {isAhpraVerified && verificationBadge && (
                                      <div className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-wider shadow-inner ${
                                          file.status === 'AHPRA_VERIFIED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                          file.status === 'AHPRA_NAME_MISMATCH' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                          'bg-red-500/20 text-red-300 border-red-500/30'
                                      }`}>
                                          <span className="opacity-80 scale-110">{verificationBadge.icon}</span>
                                          <span>{verificationBadge.label}</span>
                                      </div>
                                  )}
                              </div>
                              );
                          })
                      )}
                  </div>
              )
          ) : null}
        </div>

        <div className="p-6 mt-6 border-t border-white/10 bg-black/5">
            <button 
               onClick={() => onNavigate && onNavigate('profile')} 
               className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl transform hover:-translate-y-1 bg-white text-gray-900 hover:bg-gray-100"
               title="Edit Profile Settings"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
               </svg>
               {!isCollapsed && <span>Edit Profile</span>}
            </button>
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </aside>
  );
}
