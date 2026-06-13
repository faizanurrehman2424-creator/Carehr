# CareHR — Sprint Completion Report
### Sales-Ready Pilot Sprint · May 2025

---

**Prepared for:** Crystal & Omar
**Prepared by:** Faizan & Ahsan
**Date:** 21 May 2025
**Sprint Goal:** Deliver against all 6 items required to confidently take CareHR to paid pilot clients.

---

## Executive Summary

All **6 deliverables** outlined in the sprint brief have been completed, tested, and deployed. The CareHR Compliance Portal is now at **v2.0.0** and is sales-ready for paid pilot demonstrations.

| # | Deliverable | Status |
|---|---|---|
| 1 | AHPRA verification passes both positive and negative tests | ✅ Complete |
| 2 | Fake document detection behaves predictably | ✅ Complete |
| 3 | Nurse and doctor checklists are correct and configurable | ✅ Complete |
| 4 | Upload supports both PDF and image formats | ✅ Complete |
| 5 | Admin dashboard clearly shows status (with export) | ✅ Complete |
| 6 | Privacy policy and T&Cs visible within the product | ✅ Complete |

---

## Deliverable Breakdown

---

### 1. AHPRA Verification — Positive & Negative Tests ✅

We built a **live AHPRA register verification system** that queries the official AHPRA Practitioner Register in real-time.

**How it works:**
- When a candidate uploads an AHPRA certificate, our system extracts the registration number using regex pattern matching (e.g., `MED0001234567`).
- The candidate or admin can then click **"Verify AHPRA"** in the sidebar to trigger a live check.
- Our backend launches a headless browser (Playwright + Chromium), navigates to the AHPRA public register, enters the registration number, and scrapes the results.

**Three outcome states are handled:**

| Result | What Happens |
|---|---|
| ✅ **Verified** | Registration found on AHPRA register, and practitioner name matches the candidate's name on file. Green "AHPRA Verified" badge displayed. |
| ⚠️ **Name Mismatch** | Registration is valid on the AHPRA register, but the name on the register doesn't match the candidate's name in our system. Orange warning badge shown. |
| ❌ **Not Found** | Registration number does not exist on the AHPRA public register. Red "Not Found" badge displayed. |

**Additional features:**
- Flexible name matching that strips professional titles (Dr, Mr, Ms) and handles name ordering differences.
- Verification results are stored against the document record, so the status persists across sessions.
- Practitioner details (profession, registration status, expiry date) are extracted and logged.
- An automated email is sent to the compliance manager with the verification outcome.
- Results are also logged to the "CareHr Live Data" Google Sheet for audit purposes.

---

### 2. Fake Document Detection ✅

We implemented an **AI-powered fraud detection system** that flags documents uploaded under the wrong category — without excessive false positives.

**How it works:**
- Every uploaded document goes through text extraction (PDF parsing or image OCR).
- The extracted text is then sent to **Azure OpenAI (GPT-4.1-nano)** with a strict classification prompt.
- The AI determines whether the document content genuinely matches the category the user claimed (e.g., "Is this really an AHPRA certificate, or is it actually a CV?").
- The model is configured with `temperature: 0.0` for maximum consistency, and responds with only **"VALID"** or **"FAKE"** — no ambiguity.

**What happens when a fake is detected:**
- The document is flagged with a **"FAKE" status** in the database.
- The file is **NOT uploaded to Google Drive** — preventing fraudulent documents from entering the compliance vault.
- A red **"Fraud Detected"** notification appears instantly in the candidate's portal.
- The admin dashboard shows FAKE documents with a distinct red status badge.

**Why it avoids false positives:**
- We only flag a document as fake when the content clearly belongs to a **completely different** document type. A police check that's slightly ambiguous is still marked VALID — only clear mismatches (e.g., a Resume uploaded as an Immunisation Record) are flagged.
- If the AI service is unavailable, documents default to VALID to prevent blocking legitimate uploads.

---

### 3. Nurse & Doctor Checklists — Correct and Configurable ✅

We built **distinct, comprehensive checklists** for each professional role, aligned with real Australian healthcare onboarding requirements.

**Doctor Checklist — 38 items across 6 groups:**

| Group | Items |
|---|---|
| A. Compliance & Clearances | National Police Check, WWCC, Evidence of Citizenship/Visa, Statutory Declaration, Photo ID |
| B. Professional Registration | AHPRA Registration Number, AHPRA Certificate, Practitioner Type, Specialties, Registration Questionnaire, Medicare Provider Number(s), Prescriber Number(s), Certificate of Good Standing, Professional Memberships |
| C. Qualifications & Experience | Medical Degree, Postgraduate Qualifications, Academic Transcripts, Evidence of Internship, CV, Work Experience/Resume, Three Professional References |
| D. Insurance | Medical Indemnity Insurance, Public Liability Insurance, Workers Compensation |
| E. Immunisations & Health Records | MMR, DTP, Varicella, TB, Hepatitis B, Influenza (Annual), COVID-19, Immunisation Declaration |
| F. Contact & Financial | Emergency Contact Details, Bank Account Details, Superannuation Details, Tax File Number |

**Nurse Checklist — 35 items across 6 groups:**

| Group | Items |
|---|---|
| A. Compliance & Clearances | National Police Check, WWCC, Evidence of Citizenship/Visa, Statutory Declaration, Photo ID |
| B. Professional Registration | AHPRA Registration Certificate, Registration Questionnaire, Practitioner Type |
| C. Qualifications & Experience | Medical/Nursing Degree, Academic Transcripts, CV, Work Experience/Resume, Two Reference Checks |
| D. Immunisations & Health Records | MMR, DTP, Varicella, TB, Hepatitis B, Influenza (Annual), COVID-19, Immunisation Declaration |
| E. Mandatory Trainings | Manual Handling, Fire & Evacuation, Basic Life Support (BLS), Infection Prevention, Hand Hygiene, Medication Calculation Test, IV Medication Administration, Aseptic Technique, Bluff Safe Learning, Nurse Immunizer, Good Clinical Practice, Venipuncture, IV Cannulation |
| F. Contact & Financial | Emergency Contact Details, Bank Account Details, Superannuation Details, Tax File Number |

**Key differences between Doctor and Nurse:**
- Doctors have a dedicated **Insurance group** (Medical Indemnity, Public Liability, Workers Comp) — not required for Nurses.
- Doctors require **9 Professional Registration items** vs Nurse's 3 (includes Medicare/Prescriber numbers, Good Standing, Memberships).
- Doctors require **Postgraduate Qualifications and Internship evidence** — Nurses do not.
- Nurses have **13 Mandatory Trainings** (BLS, IV Admin, Venipuncture, etc.) — Doctors do not have this group.
- Doctors require **3 Professional References** vs Nurse's **2 Reference Checks**.

**Generic checklist** (for Admin, IT, Facility roles) contains 7 simplified items.

**Configurability:** The `getChecklistForRole()` function dynamically selects the correct checklist based on the candidate's role at login. The sidebar, progress calculation, and admin dashboard all use this same function, ensuring consistency across the entire platform.

---

### 4. Upload Supports PDF + Image Formats ✅

The platform now accepts **both PDF documents and image files** for upload.

**Supported formats:**
- PDF (`.pdf`)
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- WebP (`.webp`)

**How it works — Frontend:**
- The file picker dialog allows selecting any of the above formats.
- Drag-and-drop accepts all supported types with a visual overlay: *"Drop documents or images here"*.
- The file filter logic validates both MIME types (`application/pdf`, `image/*`) and file extensions.

**How it works — Backend:**
- When an image file is received, the backend detects the file extension and routes it directly to our **OCR pipeline** (pytesseract + Pillow).
- Images are converted to grayscale, upscaled if small, auto-contrasted, and sharpened before OCR to maximise text extraction accuracy.
- The extracted text then goes through the same validation and fraud detection pipeline as PDF documents.
- The sidebar vault intelligently shows an **"IMG"** badge for image files and **"PDF"** for PDFs.

---

### 5. Admin Dashboard with Status & Export ✅

A full **Admin Dashboard** is available at `/dashboard`, protected behind password authentication.

**Candidate Overview:**
- All registered candidates are displayed in a searchable, role-filterable list.
- Each candidate shows their name, email, role, and compliance status at a glance.
- A **"Missing"** badge shows exactly how many documents are still outstanding.
- Fully compliant candidates display a green checkmark.

**Stats Summary:**
Three cards at the top show real-time metrics:
- **Total Tracking** — total number of candidates in the system
- **Action Required** — candidates with missing or pending documents
- **Fully Compliant** — candidates who have submitted all required items

**Per-Candidate Compliance Audit:**
- Clicking a candidate opens a detailed compliance audit panel on the right.
- Every item from their role-specific checklist is shown with status:
  - ✅ Verified & Stored (with "Open Document" link to Google Drive)
  - ❌ Missing (red highlight)
  - AHPRA verification badges (Verified / Name Mismatch / Not Found)
- Expiry dates are displayed where extracted from documents.

**Export Functionality — Three formats:**

| Export Type | Description |
|---|---|
| **CSV by Category** | Downloads one CSV per document category (or all at once). Fields include: candidate name, email, role, category, filename, status, expiry date, document identifier, Drive link. |
| **Salesforce Import** | CRM-formatted CSV ready for Salesforce bulk import. |
| **Raw JSON** | Full data dump for developer/integration use. |

---

### 6. Privacy Policy & Terms of Service ✅

Both the **Privacy Policy** and **Terms of Service** are now visible within the product on the login page.

**Implementation:**
- On the login/registration page, users must check "I agree to the Privacy Policy and Terms of Service" before proceeding.
- Clicking **"Privacy Policy"** opens a polished modal dialog with the full policy text (8 sections).
- Clicking **"Terms of Service"** opens a separate modal with the full terms (10 sections).

**Privacy Policy covers:**
1. Information We Collect
2. How We Use Your Information
3. Storage and Security
4. AI Document Processing
5. Disclosure to Third Parties
6. Your Rights
7. Data Retention
8. Contact Information

**Terms of Service covers:**
1. Eligibility and Account
2. Use of Services
3. Document Upload and Verification
4. AHPRA Verification
5. Intellectual Property
6. Limitation of Liability
7. Termination
8. Governing Law
9. Changes to Terms
10. Contact Information

The content is aligned with the **Australian Privacy Act 1988** and references relevant bodies (OAIC, Australian Consumer Law). Both modals support dark/light mode and are fully responsive.

> **Note:** The current text is professional placeholder content. When Crystal and Omar finalise the official Data Security Charter and legal text, we can swap it in — it's a straightforward text replacement with no code changes needed.

---

## Deployment

| Component | Platform | URL |
|---|---|---|
| Frontend | Vercel | Auto-deployed from `main` branch |
| Backend | Render | Auto-deployed from `main` branch |
| Repository | GitHub | `faizanurrehman2424-creator/Carehr` |

All changes are live and deployed. The platform is version **2.0.0** and tagged as **Sales-Ready (Pilot)**.

---

## What's Next

With all 6 sprint items delivered, the platform is ready for paid pilot demonstrations. Potential next steps for future sprints could include:

- Finalising the official legal text from Crystal & Omar for Privacy Policy / T&Cs
- Adding candidate search and filtering in the admin dashboard
- Email reminders for candidates with missing or expiring documents
- Bulk upload support for compliance managers
- Audit log / activity history per candidate

---

*Looking forward to the client demos. Let us know if any adjustments are needed before the first pilot.*
