import React from "react";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role?: string | null;
  displayRole: string;
  missingCount: number;
  totalRequired: number;
  completed: boolean;
}

interface CandidateListProps {
  candidates: Candidate[];
  selectedCandidateId: string | null;
  onSelectCandidate: (candidate: Candidate) => void;
}

export const CandidateList: React.FC<CandidateListProps> = React.memo(({
  candidates,
  selectedCandidateId,
  onSelectCandidate
}) => {
  return (
    <div className={`flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col max-h-[800px] ${selectedCandidateId ? 'hidden lg:flex lg:w-1/3 lg:flex-none' : 'w-full'}`}>
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
        <span className="font-bold text-sm text-slate-500 uppercase tracking-wider">Directory</span>
        <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">{candidates.length} Users</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {candidates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm font-medium">No candidates found in this category.</p>
          </div>
        ) : (
          candidates.map((c) => (
            <div 
              key={c.id} 
              onClick={() => onSelectCandidate(c)}
              className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                selectedCandidateId === c.id 
                ? 'bg-white border-blue-500 dark:bg-slate-800 dark:border-blue-500 shadow-md transform scale-[1.02]' 
                : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${c.completed ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white leading-tight">{c.first_name} {c.last_name}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[150px]">{c.email || "No Email"}</div>
                  </div>
                </div>
                {c.completed ? (
                  <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md text-[10px] font-bold tracking-widest">{c.missingCount} MISSING</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

CandidateList.displayName = "CandidateList";
