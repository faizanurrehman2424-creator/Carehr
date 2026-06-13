import React, { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/themetoggle";

interface AdminLoginProps {
  onSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = React.memo(({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError("Invalid password");
      }
    } catch (err) {
      setError("Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="absolute top-8 right-8 z-50 flex gap-4 items-center">
          <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">Go to App</Link>
          <ThemeToggle />
      </div>
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-slate-100 dark:border-slate-800 text-center relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-sky-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-lg rotate-3">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-extrabold mb-2 text-slate-900 dark:text-white">Admin Access</h2>
          <p className="text-sm text-slate-500 mb-8">Secure dashboard for CareHR</p>
          <input 
            type="password" 
            placeholder="Enter Password" 
            className="w-full p-4 mb-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono tracking-widest text-center" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleLogin()} 
          />
          {error && <p className="text-red-500 text-sm mb-4 font-bold">{error}</p>}
          <button onClick={handleLogin} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Unlock Dashboard</button>
      </div>
      <div className="absolute inset-0 opacity-10 dark:opacity-5 pointer-events-none z-0">
           <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 100 C 30 50 70 50 100 100 Z" fill="currentColor" /></svg>
      </div>
    </div>
  );
});

AdminLogin.displayName = "AdminLogin";
