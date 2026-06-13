import React from "react";

interface PrivacyModalProps {
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = React.memo(({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Privacy Policy</h3>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Last updated: May 2025</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-4 custom-scrollbar">
          <p className="font-semibold text-gray-900 dark:text-white">CareHR Pty Ltd (&quot;CareHR&quot;, &quot;we&quot;, &quot;us&quot;) is committed to protecting the privacy of your personal information in accordance with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">1. Information We Collect</h4>
          <p>We collect personal information that is reasonably necessary for our compliance management services, including: full name, email address, professional role, date of birth, AHPRA registration details, police check certificates, working with children check details, immunisation records, qualification certificates, photo identification, and curriculum vitae.</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">2. How We Use Your Information</h4>
          <p>Your information is used to: verify professional credentials and compliance status; manage onboarding documentation; communicate with designated compliance managers; maintain audit trails for regulatory purposes; and provide our AI-assisted document verification services.</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">3. Storage and Security</h4>
          <p>Documents are securely stored in encrypted Google Drive folders with role-based access controls. Our database is hosted on secured infrastructure with industry-standard encryption at rest and in transit. Only authorised personnel and designated compliance managers have access to your documents.</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">4. AI Document Processing</h4>
          <p>We use artificial intelligence to assist with document categorisation, fraud detection, and AHPRA registration verification. Document text is processed through secure AI services and is not used to train AI models. AI analysis is supplementary and subject to human review.</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">5. Disclosure to Third Parties</h4>
          <p>We do not sell or rent your personal information. Information may be shared with: your designated employer or compliance manager; AHPRA (for registration verification); government authorities where required by law; and our technology service providers (Google, Microsoft Azure) under strict data processing agreements.</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">6. Your Rights</h4>
          <p>You have the right to: access your personal information held by us; request correction of inaccurate information; request deletion of your data (subject to legal retention obligations); withdraw consent at any time; and lodge a complaint with the Office of the Australian Information Commissioner (OAIC).</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">7. Data Retention</h4>
          <p>We retain your documents and personal information for the duration of your engagement with our services and for a period required by applicable healthcare regulations thereafter. You may request deletion at any time by contacting our privacy officer.</p>
          
          <h4 className="font-bold text-gray-900 dark:text-white pt-2">8. Contact Us</h4>
          <p>For privacy-related enquiries, please contact our Privacy Officer at <span className="font-semibold text-teal-600 dark:text-teal-400">privacy@carehr.com.au</span></p>
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-md text-sm">Close</button>
        </div>
      </div>
    </div>
  );
});

PrivacyModal.displayName = "PrivacyModal";
