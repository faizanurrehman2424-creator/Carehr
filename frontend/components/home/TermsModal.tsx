import React from "react";

interface TermsModalProps {
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = React.memo(({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Terms of Service</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">Last updated: May 2025</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-4 custom-scrollbar">
          <p className="font-semibold text-slate-900 dark:text-white">These Terms of Service (&quot;Terms&quot;) govern your use of the CareHR Compliance Portal (&quot;Platform&quot;) operated by CareHR Pty Ltd (ABN pending). By accessing or using the Platform, you agree to be bound by these Terms.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">1. Eligibility and Account</h4>
          <p>The Platform is intended for healthcare professionals, administrative staff, and authorised compliance managers in Australia. You must provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">2. Use of Services</h4>
          <p>You may use the Platform to: upload and manage compliance documents; track onboarding progress; verify professional registrations; and communicate with your compliance manager. You agree not to upload fraudulent, forged, or misleading documents. Any document flagged by our verification systems may be reported to your compliance manager.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">3. Document Upload and Verification</h4>
          <p>By uploading documents, you confirm that: the documents are genuine and unaltered; you are the rightful owner or have authorisation to submit them; and the information contained is accurate to the best of your knowledge. CareHR uses AI-assisted verification but does not guarantee the accuracy of automated checks. Final compliance determinations are made by your designated compliance manager.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">4. AHPRA Verification</h4>
          <p>Our Platform queries the publicly available AHPRA Practitioner Register to verify registration details. This is a convenience service and does not replace official AHPRA verification processes. Results are indicative only and subject to the accuracy and availability of the AHPRA public register.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">5. Intellectual Property</h4>
          <p>The Platform, including its design, features, and technology, is the intellectual property of CareHR Pty Ltd. You retain ownership of all documents you upload. By uploading, you grant CareHR a limited licence to store, process, and display your documents for the purpose of providing our services.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">6. Limitation of Liability</h4>
          <p>To the maximum extent permitted by Australian Consumer Law, CareHR shall not be liable for: any indirect, incidental, or consequential damages; delays in document processing; inaccuracies in AI-assisted verification; or system downtime. Our total liability shall not exceed the fees paid by you in the preceding 12 months.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">7. Termination</h4>
          <p>You may cease using the Platform at any time. CareHR reserves the right to suspend or terminate accounts that violate these Terms, upload fraudulent documents, or misuse the Platform. Upon termination, your data will be handled in accordance with our Privacy Policy and applicable retention requirements.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">8. Governing Law</h4>
          <p>These Terms are governed by the laws of the Commonwealth of Australia. Any disputes shall be subject to the exclusive jurisdiction of the courts of New South Wales, Australia.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">9. Changes to Terms</h4>
          <p>We may update these Terms from time to time. Material changes will be communicated via email or in-app notification. Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>
          
          <h4 className="font-bold text-slate-900 dark:text-white pt-2">10. Contact</h4>
          <p>For questions about these Terms, contact us at <span className="font-semibold text-blue-600 dark:text-blue-400">legal@carehr.com.au</span></p>
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button onClick={onClose} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-md text-sm">Close</button>
        </div>
      </div>
    </div>
  );
});

TermsModal.displayName = "TermsModal";
