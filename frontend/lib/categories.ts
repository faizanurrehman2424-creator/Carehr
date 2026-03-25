export type ChecklistItem = {
  id: string;
  label: string;
};

export type ChecklistGroup = {
  id: string;
  label: string;
  items: ChecklistItem[];
};

// --- GENERIC CHECKLIST (Allied Health, Admin, IT, Facility, etc.) ---
export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    id: "experience",
    label: "Experience",
    items: [
      { id: "cv", label: "Resume / CV" },
      { id: "reference", label: "Reference Letters" }
    ]
  },
  {
    id: "identity",
    label: "Identity & Checks",
    items: [
      { id: "police", label: "National Police Check" },
      { id: "wwcc", label: "Working With Children Check" },
      { id: "photo_id", label: "Photo ID (Passport/License)" }
    ]
  },
  {
    id: "qualifications",
    label: "Qualifications",
    items: [
      { id: "degree", label: "Degree Certificate" },
      { id: "ahpra", label: "AHPRA Registration" }
    ]
  }
];

// --- NURSE CHECKLIST ---
export const NURSE_CHECKLIST: ChecklistGroup[] = [
  {
    id: "compliance",
    label: "A. Compliance & Clearances",
    items: [
      { id: "police", label: "National Police Check" },
      { id: "wwcc", label: "Working with Children Check" },
      { id: "work_eligibility", label: "Evidence of Citizenship/Visa" },
      { id: "stat_dec", label: "Statutory Declaration" },
      { id: "photo_id", label: "Photo ID" },
    ]
  },
  {
    id: "registration",
    label: "B. Professional Registration",
    items: [
      { id: "ahpra", label: "AHPRA Registration Certificate" },
      { id: "reg_questionnaire", label: "Registration Questionnaire" },
      { id: "practitioner_type", label: "Practitioner Type" },
    ]
  },
  {
    id: "qualifications",
    label: "C. Qualifications & Experience",
    items: [
      { id: "degree", label: "Medical/Nursing Degree" },
      { id: "transcripts", label: "Academic Transcripts" },
      { id: "cv", label: "Curriculum Vitae (CV)" },
      { id: "resume", label: "Work Experience/Resume" },
      { id: "references", label: "Two Reference Checks" },
    ]
  },
  {
    id: "immunisations",
    label: "D. Immunisations & Health Records",
    items: [
      { id: "imm_mmr", label: "Measles, Mumps, Rubella (MMR)" },
      { id: "imm_dtp", label: "Diphtheria, Tetanus, Pertussis (DTP)" },
      { id: "imm_varicella", label: "Varicella (Chickenpox)" },
      { id: "imm_tb", label: "Tuberculosis (TB)" },
      { id: "imm_hepb", label: "Hepatitis B" },
      { id: "imm_flu", label: "Influenza (Annual)" },
      { id: "imm_covid", label: "COVID-19" },
      { id: "imm_record", label: "Immunisation Declaration" },
    ]
  },
  {
    id: "training",
    label: "E. Mandatory Trainings",
    items: [
      { id: "train_manual", label: "Manual Handling" },
      { id: "train_fire", label: "Fire and Evacuation" },
      { id: "train_bls", label: "Basic Life Support (BLS)" },
      { id: "train_infection", label: "Infection Prevention" },
      { id: "train_hand", label: "Hand Hygiene" },
      { id: "train_med", label: "Medication Calculation Test" },
      { id: "train_iv", label: "IV Medication Administration" },
      { id: "train_aseptic", label: "Aseptic Technique" },
      { id: "train_bluff", label: "Bluff Safe Learning" },
      { id: "train_immunizer", label: "Nurse Immunizer" },
      { id: "train_gcp", label: "Good Clinical Practice" },
      { id: "train_venipuncture", label: "Venipuncture" },
      { id: "train_cannulation", label: "IV Cannulation" },
    ]
  },
  {
    id: "financial",
    label: "F. Contact & Financial",
    items: [
      { id: "emergency_contact", label: "Emergency Contact Details" },
      { id: "bank_details", label: "Bank Account Details" },
      { id: "superannuation", label: "Superannuation Details" },
      { id: "tfn", label: "Tax File Number (TFN)" },
    ]
  }
];

// --- DOCTOR CHECKLIST ---
export const DOCTOR_CHECKLIST: ChecklistGroup[] = [
  {
    id: "compliance",
    label: "A. Compliance & Clearances",
    items: [
      { id: "police", label: "National Police Check" },
      { id: "wwcc", label: "Working with Children Check" },
      { id: "work_eligibility", label: "Evidence of Citizenship/Visa" },
      { id: "stat_dec", label: "Statutory Declaration" },
      { id: "photo_id", label: "Photo ID" },
    ]
  },
  {
    id: "registration",
    label: "B. Professional Registration",
    items: [
      { id: "ahpra_no", label: "AHPRA Registration Number" },
      { id: "ahpra", label: "AHPRA Registration Certificate" },
      { id: "practitioner_type", label: "Practitioner Type" },
      { id: "specialties", label: "Specialties" },
      { id: "reg_questionnaire", label: "Registration Questionnaire" },
      { id: "medicare", label: "Medicare Provider Number(s)" },
      { id: "prescriber", label: "Prescriber Number(s)" },
      { id: "good_standing", label: "Certificate of Good Standing" },
      { id: "memberships", label: "Professional Memberships" },
    ]
  },
  {
    id: "qualifications",
    label: "C. Qualifications & Experience",
    items: [
      { id: "degree", label: "Medical Degree Certificate" },
      { id: "postgrad", label: "Postgraduate Qualifications" },
      { id: "transcripts", label: "Academic Transcripts" },
      { id: "internship", label: "Evidence of Internship" },
      { id: "cv", label: "Curriculum Vitae (CV)" },
      { id: "resume", label: "Work Experience/Resume" },
      { id: "references", label: "Three Professional References" },
    ]
  },
  {
    id: "insurance",
    label: "D. Insurance",
    items: [
      { id: "indemnity", label: "Medical Indemnity Insurance" },
      { id: "public_liability", label: "Public Liability Insurance" },
      { id: "workers_comp", label: "Workers Compensation" },
    ]
  },
  {
    id: "immunisations",
    label: "E. Immunisations & Health Records",
    items: [
      { id: "imm_mmr", label: "Measles, Mumps, Rubella (MMR)" },
      { id: "imm_dtp", label: "Diphtheria, Tetanus, Pertussis (DTP)" },
      { id: "imm_varicella", label: "Varicella (Chickenpox)" },
      { id: "imm_tb", label: "Tuberculosis (TB)" },
      { id: "imm_hepb", label: "Hepatitis B" },
      { id: "imm_flu", label: "Influenza (Annual)" },
      { id: "imm_covid", label: "COVID-19" },
      { id: "imm_record", label: "Immunisation Declaration" },
    ]
  },
  {
    id: "financial",
    label: "F. Contact & Financial",
    items: [
      { id: "emergency_contact", label: "Emergency Contact Details" },
      { id: "bank_details", label: "Bank Account Details" },
      { id: "superannuation", label: "Superannuation Details" },
      { id: "tfn", label: "Tax File Number (TFN)" },
    ]
  }
];

// Helper function to return the correct list based on user role
export function getChecklistForRole(role: string): ChecklistGroup[] {
  const r = (role || "").toLowerCase();
  
  if (r.includes("doctor") || r.includes("surgeon") || r.includes("gp")) {
    return DOCTOR_CHECKLIST;
  }
  
  if (r.includes("nurse") || r.includes("midwife")) {
    return NURSE_CHECKLIST;
  }
  
  // Default to Generic checklist for roles like Admin, IT, Facility, Allied Health, etc.
  return CHECKLIST_GROUPS;
}
