import React from "react";

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

function normalize(s: any): string {
  return String(s || "").trim().toLowerCase();
}

function matchesCategory(d: any, keyword: string): boolean {
  const candidates: string[] = [];
  if (d.category) candidates.push(normalize(d.category));
  if (d.category_name) candidates.push(normalize(d.category_name));
  return candidates.some((c) => c.includes(keyword));
}

interface CandidateChecklistProps {
  activeCandidate: any;
  loadingDocs: boolean;
  activeChecklist: any[];
  selectedCandidateDocs: any[];
  onClose: () => void;
}

export const CandidateChecklist: React.FC<CandidateChecklistProps> = React.memo(({
  activeCandidate,
  loadingDocs,
  activeChecklist,
  selectedCandidateDocs,
  onClose
}) => {
  return (
    <div className="flex-[2] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
          <div>
              <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{activeCandidate.first_name} {activeCandidate.last_name}</h2>
                  <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${activeCandidate.completed ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                      {activeCandidate.completed ? "100% Compliant" : `${activeCandidate.missingCount} Action Required`}
                  </span>
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">{activeCandidate.role || "Role Unassigned"}</span> 
                  <span className="opacity-50">•</span> 
                  <span>{activeCandidate.email}</span>
              </p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-900/30 custom-scrollbar">
          <div className="flex justify-between items-end mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Compliance Audit</h3>
              <div className="text-xs font-semibold text-slate-500">
                  {activeCandidate.totalRequired - activeCandidate.missingCount} of {activeCandidate.totalRequired} verified
              </div>
          </div>
          
          {loadingDocs ? (
              <div className="h-48 flex flex-col items-center justify-center text-blue-600 gap-3">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-bold animate-pulse">Syncing Google Drive...</span>
              </div>
          ) : (
              <div className="space-y-8">
                  {activeChecklist.map((group: any) => (
                      <div key={group.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                              {group.label}
                          </h4>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              {group.items.map((item: any) => {
                                  const docMatch = selectedCandidateDocs.find(d => matchesCategory(d, item.id) && d.status !== 'FAKE');
                                  const isPresent = !!docMatch;
                                  const ahpraBadge = isPresent ? getVerificationBadge(docMatch.status) : null;
                                  
                                  return (
                                      <div key={item.id} className={`flex flex-col justify-between p-4 rounded-xl border transition-all relative overflow-hidden backdrop-blur-sm ${ahpraBadge ? `${ahpraBadge.bgColor} ${ahpraBadge.borderColor}` : isPresent ? 'bg-white/40 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-700' : 'bg-red-50/20 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/30 border-dashed'}`}>
                                          <div className="flex items-start gap-4 mb-4">
                                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ahpraBadge ? `${ahpraBadge.bgColor} ${ahpraBadge.textColor} shadow-sm border ${ahpraBadge.borderColor}` : isPresent ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                  {ahpraBadge ? ahpraBadge.icon : isPresent ? (
                                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                  ) : (
                                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                  )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                  <div className={`text-sm font-bold truncate ${ahpraBadge ? ahpraBadge.textColor : isPresent ? 'text-slate-900 dark:text-slate-100' : 'text-red-700 dark:text-red-400'}`}>
                                                      {item.label}
                                                  </div>
                                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
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
                                                     className={`block w-full text-center text-xs font-bold py-2 rounded-lg transition-colors border ${ahpraBadge ? `bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 ${ahpraBadge.textColor} ${ahpraBadge.borderColor}` : 'text-blue-700 bg-white hover:bg-blue-50 dark:text-blue-300 dark:bg-slate-800 dark:hover:bg-blue-900/30 border-slate-200 dark:border-slate-700'}`}
                                                  >
                                                      OPEN DOCUMENT
                                                  </a>
                                              ) : !isPresent ? (
                                                  <div className="w-full text-center text-xs font-bold text-red-400 bg-red-50/50 dark:bg-red-900/10 py-2 rounded-lg border border-red-100 dark:border-red-900/20">
                                                      MISSING
                                                  </div>
                                              ) : (
                                                  <div className="w-full text-center text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                      PROCESSING LINK...
                                                  </div>
                                              )}
                                          </div>
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
  );
});

CandidateChecklist.displayName = "CandidateChecklist";
