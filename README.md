CareHR Compliance Portal - System Documentation
Version: 2.0.0 Status: Sales-Ready (Pilot) Tech Stack: Next.js 16 (Frontend) + Python FastAPI (Backend)

1. Executive Summary
CareHR is a compliance automation tool designed for medical professionals (Doctors, Nurses, Allied Health) to streamline the onboarding process.

Core Functions:

Candidate Portal: Users log in, view required documents (AHPRA, Police Checks), and track progress via role-specific checklists.

Smart Uploads: Drag-and-drop interface with auto-categorization of documents (Supports both PDFs and Images — PNG, JPEG, WEBP).

AI-Powered Verification: Automated fraud detection flags mismatched documents. AHPRA registration numbers are verified against the live public register.

Backend Automation: Automatically creates structured folders in Google Drive, logs entries in Google Sheets, and notifies managers via Gmail.

Admin Dashboard: Password-protected admin view at /dashboard showing all candidates, compliance status, and CSV/JSON/Salesforce export.

Privacy & Compliance: Privacy Policy and Terms of Service modals visible within the product at login.

Persistence: Checks if a user already exists to load previous uploads.

2. High-Level Architecture
The system operates as a Monorepo containing a React Frontend and a Python Backend.

Data Flow:

User enters details in the Frontend (page.tsx).

Frontend sends data to Backend API (/upload or /candidates/lookup).

Backend (main.py) processes the request:

Authenticates with Google via Service Account.

Uploads files to a specific Google Drive folder structure.

Updates a Google Sheet (CareHr Live Data).

Sends an email alert to the Manager.

Saves metadata to a database (local SQLite for development, Supabase PostgreSQL for production persistence).

3. Project Structure (File Map)
Here is where everything lives. Use this map to orient new developers.

Plaintext
CareHr/
├── frontend/                  # Next.js 16 Application
│   ├── app/
│   │   ├── page.tsx           # THE BRAIN. Login, Chat, Uploads, Privacy/T&C Modals.
│   │   ├── dashboard/
│   │   │   └── page.tsx       # Admin Dashboard. Candidate list, compliance audit, export.
│   │   ├── layout.tsx         # Global fonts and ThemeProvider wrapper.
│   │   └── providers.tsx      # Dark/Light mode context logic.
│   ├── components/
│   │   ├── Sidebar.tsx        # Left nav + Progress Bar + Checklist + Vault tab.
│   │   └── themetoggle.tsx    # Dark mode switch button.
│   └── lib/
│       ├── api.ts             # Axios instance pointing to Backend URL.
│       └── categories.ts      # Role-specific checklists (Doctor, Nurse, Generic).
│
├── backend/                   # Python FastAPI
│   ├── main.py                # API routes (/upload, /candidates, /verify, /export, /chat).
│   ├── validators.py          # Text extraction (PDF + Image OCR), AI fraud detection.
│   ├── ahpra_validator.py     # Live AHPRA register verification via Playwright.
│   ├── chatbot.py             # Streaming AI chatbot (Azure OpenAI).
│   ├── google_drive.py        # Google Drive folder creation and file upload.
│   ├── google_sheets_utils.py # Google Sheets logging for AHPRA results.
│   ├── run.py                 # Entry point to start the server.
│   ├── service_account.json   # (SECRET) Google Service Account key.
│   └── token.json             # (SECRET) OAuth token for Drive access.
4. Frontend Logic Breakdown
Main Logic Controller (app/page.tsx)
This file acts as the "State Manager" for the application.

View State: Switches between 'profile' (Login) and 'chat' (Main workspace with drag-and-drop uploads).

Login Logic: When a user logs in, it calls /candidates/lookup. If the user exists, it pre-fills their previously uploaded files so they don't have to start over.

Chat: AI-powered streaming chatbot via Azure OpenAI. Context-aware of the candidate's role, uploaded documents, and missing items.

Privacy & Terms Modals: Clickable Privacy Policy and Terms of Service links on the login page open full-content modal dialogs.

The Sidebar (components/Sidebar.tsx)
Two Tabs: "Checklist" (role-specific compliance items) and "Vault" (uploaded documents with status badges).

Progress Calculation: Dynamically calculates compliance % based on how many unique categories have been uploaded versus the role-specific checklist.

Dynamic Icons: Changes the user avatar based on the selected Role (Doctor vs. Nurse vs. Admin). Vault shows "PDF" or "IMG" file type badges.

AHPRA Verify Button: For AHPRA documents, a "Verify AHPRA" button triggers live register verification with visual status badges (Verified, Name Mismatch, Not Found).

Role-Specific Checklists (lib/categories.ts)
Doctor: 38 items across 6 groups (includes Insurance, Medicare/Prescriber numbers, Postgrad qualifications).
Nurse: 35 items across 6 groups (includes 13 Mandatory Trainings like BLS, IV Admin, Venipuncture).
Generic (Admin/IT/Facility): 7 items across 3 groups.

Auto-Categorization: The autoCategorizeFile() function scans filenames against the active role's checklist items to auto-tag uploaded files.

Admin Dashboard (app/dashboard/page.tsx)
Password-protected admin view with candidate list, role filtering, per-candidate compliance audit, and multi-format export (CSV by category, Salesforce CSV, Raw JSON).

5. Backend Logic Breakdown
API Endpoints (main.py)
GET /candidates/lookup?email=...: Checks the SQLite database. If found, returns the candidate details and a list of their uploaded files (view links).

POST /upload: The heavy lifter. Receives file(s) + User Data. Extracts text (PDF or Image OCR), runs AI fraud detection, validates against claimed category, uploads to Google Drive, logs to database, and sends email summary.

POST /verify/{document_id}: On-demand AHPRA verification. Scrapes the AHPRA public register using Playwright, compares practitioner name with candidate record. Returns Verified, Name Mismatch, or Not Found.

POST /chat: Streaming AI chatbot endpoint using Azure OpenAI (gpt-4.1-nano). Context-aware of candidate data and compliance status.

GET /export: Returns all document data as JSON for dashboard export.
GET /export/salesforce: Returns CRM-formatted export for Salesforce import.

DELETE /documents/{id}: Removes document from database and Google Drive.

AI & Verification (validators.py, ahpra_validator.py)
Text Extraction: PDF text via PyMuPDF with OCR fallback (pytesseract). Image files (.png, .jpg, .jpeg, .webp) route directly to OCR.

Fraud Detection: Azure OpenAI gpt-4.1-nano classifies uploaded documents against claimed categories. Mismatches are flagged as FAKE and blocked from Google Drive.

Category Validators: Regex-based extraction of AHPRA registration numbers, police check certificate IDs, WWCC IDs, visa details, qualification keywords, immunisation records, and insurance policy numbers.

AHPRA Live Verification: Playwright-based headless browser scrapes the AHPRA Practitioner Register. Extracts practitioner name, profession, registration status, and expiry. Flexible name matching with title stripping.

Google Integration (google_drive.py & sheets)
Authentication: Uses service_account.json (Robot User) and token.json (OAuth).

Folder Structure: Enforces strict hierarchy in Drive — CareHR Candidates / [Name] [Role] / [Subfolder].

Subfolders: Identity, Compliance, Checks, Certifications, Registrations, CV.

6. Environment Variables & Secrets
⚠️ CRITICAL: These files must never be shared publicly or committed to a public repo without encryption.

Frontend (.env.local):

Bash
NEXT_PUBLIC_API_URL=https://your-hetzner-vps-api-domain.com

Backend (.env file on Hetzner VPS):

Bash
# Database Settings
DATABASE_URL=postgresql://postgres.iemjrkdxvgxwdocnbdbf:your_password@aws-0-[region].pooler.supabase.com:6543/postgres

# Google Credentials
# Placed directly inside the backend/ folder on the VPS:
# - service_account.json
# - token.json

# Email Settings
SMTP_HOST=smtp.gmail.com
SMTP_USER=klauskite24@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  (App Password)
EMAIL_TO=manager@company.com
7. Known Behaviors & Edge Cases
"Mock" File Objects: In page.tsx, when loading an existing user, we create "Mock" file objects to display them in the UI list. These are not real files (we can't re-download them to the browser instantly), but they serve as visual placeholders so the user knows they completed that task.

Windows vs. Linux: The backend includes a specific fix (asyncio.set_event_loop_policy) to ensure it runs smoothly on Windows local development.

Drive Permissions: The Service Account (Robot) must be an Editor of the "CareHR Candidates" folder in the Manager's Google Drive, or the files will be uploaded to a hidden drive that humans cannot see.

8. Deployment Checklist
Before going live:

[ ] Frontend: Ensure NEXT_PUBLIC_API_URL points to the Hetzner VPS backend domain, not localhost.

[ ] Backend: Ensure .env file on Hetzner VPS contains the correct DATABASE_URL (Supabase connection pooler) and Azure/SMTP credentials.

[ ] Backend: Verify that service_account.json and token.json are in the backend/ folder on the VPS.

[ ] Google: Check that the Google Drive folder is shared with the Service Account email.

[ ] Email: Generate a fresh App Password if the current one expires.

How to Run Locally
Backend:

Bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
playwright install chromium  # Required for AHPRA verification
python run.py
Frontend:

Bash
cd frontend
npm install
npm run dev

9. Recent Updates (May 2025 Sprint)
This sprint focused on getting the platform sales-ready for paid pilots.

Completed Items:
[x] AHPRA Verification: Live scraping of the AHPRA public register with positive (Verified), negative (Not Found), and name mismatch detection.
[x] AI Fraud Detection: Azure OpenAI-powered document classification flags mismatched uploads (e.g., a CV uploaded as a Police Check).
[x] Role-Specific Checklists: Doctor (38 items), Nurse (35 items), and Generic (7 items) checklists with distinct groups and requirements.
[x] PDF + Image Upload: Frontend accepts PDF, PNG, JPEG, and WebP. Backend routes images directly to OCR.
[x] Admin Dashboard: Password-protected dashboard at /dashboard with candidate list, compliance audit, and multi-format export (CSV, JSON, Salesforce).
[x] Privacy Policy & Terms of Service: Full-content modal dialogs accessible from the login page with professional legal placeholder text (Australian Privacy Act aligned).