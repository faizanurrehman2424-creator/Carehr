CareHR Compliance Portal - System Documentation
Version: 1.0.0 Status: Pre-Deployment Tech Stack: Next.js (Frontend) + Python FastAPI (Backend)

1. Executive Summary
CareHR is a compliance automation tool designed for medical professionals (Doctors, Nurses, Allied Health) to streamline the onboarding process.

Core Functions:

Candidate Portal: Users log in, view required documents (AHPRA, Police Checks), and track progress.

Smart Uploads: Drag-and-drop interface with auto-categorization of documents (Supports both PDFs and Images like PNG, JPEG, WEBP).

Backend Automation: Automatically creates structured folders in Google Drive, logs entries in Google Sheets, and notifies managers via Gmail.

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

Saves metadata to a local SQLite database (for UI persistence).

3. Project Structure (File Map)
Here is where everything lives. Use this map to orient new developers.

Plaintext
CareHr/
├── frontend/                  # Next.js Application
│   ├── app/
│   │   ├── page.tsx           # THE BRAIN. Handles Login, View Switching, and State.
│   │   ├── layout.tsx         # Global fonts and ThemeProvider wrapper.
│   │   └── providers.tsx      # Dark/Light mode context logic.
│   ├── components/
│   │   ├── Sidebar.tsx        # Left nav + Progress Bar + Checklist logic.
│   │   ├── DocumentUploader.tsx # Drag-n-Drop zone + Auto-categorization logic.
│   │   ├── CandidateCard.tsx  # UI for displaying candidate info.
│   │   └── ThemeToggle.tsx    # Dark mode switch button.
│   └── lib/
│       ├── api.ts             # Axios instance pointing to Backend URL.
│       └── categories.ts      # (Assumed) The static list of required documents.
│
├── backend/                   # Python API
│   ├── main.py                # Main API routes (/upload, /candidates).
│   ├── google_drive.py        # Logic to create folders and upload files to Drive.
│   ├── google_sheets_utils.py # Logic to append rows to Google Sheets.
│   ├── run.py                 # Entry point to start the server.
│   ├── service_account.json   # (SECRET) The Google Robot Key.
│   └── token.json             # (SECRET) User auth token for private Drive access.
4. Frontend Logic Breakdown
Main Logic Controller (app/page.tsx)
This file acts as the "State Manager" for the application.

View State: Switches between 'profile' (Login), 'home' (Dashboard), 'documents', and 'chat'.

Login Logic: When a user logs in, it calls /candidates/lookup. If the user exists, it pre-fills their previously uploaded files so they don't have to start over.

Chat: Contains a simple mock AI interface (handleSendMessage).

The Sidebar (components/Sidebar.tsx)
Progress Calculation: Dynamically calculates compliance % based on how many unique categories have been uploaded versus the CHECKLIST_GROUPS.

Dynamic Icons: Changes the user avatar based on the selected Role (Doctor vs. Nurse vs. Admin).

The "Magic" Uploader (components/DocumentUploader.tsx)
Auto-Categorization: This is a key feature.

Function: autoCategorizeFile(filename)

Logic: It scans the filename of the dropped PDF. If it sees "CV" or "Resume", it automatically tags it as cv. If it sees "AHPRA", it tags it ahpra.

Upload Logic: It creates a FormData object containing the file and the user's profile data, sending it all to the backend in one request.

5. Backend Logic Breakdown
API Endpoints (main.py)
GET /candidates/lookup?email=...: Checks the SQLite database. If found, returns the candidate details and a list of their uploaded files (view links).

POST /upload: The heavy lifter.

Receives file + User Data.

Calls google_drive.py to create a folder: CareHR Candidates / [Name] [Role] / [Category].

Uploads the file.

Calls google_sheets_utils.py to log the upload.

Sends an email summary to the manager.

Google Integration (google_drive.py & sheets)
Authentication: Uses service_account.json to act as a "Robot User."

Folder Structure: It enforces a strict hierarchy in Drive so files never get lost.

Root: CareHR Candidates

Sub: John Doe Doctor

Sub: Identity / Compliance / CV

6. Environment Variables & Secrets
⚠️ CRITICAL: These files must never be shared publicly or committed to a public repo without encryption.

Frontend (.env.local):

Bash
NEXT_PUBLIC_API_URL=https://carehr-backend.onrender.com
Backend (Render Environment Variables):

Bash
# Google Credentials (Copy paste content of JSON files into Render "Secret Files")
service_account.json
token.json

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

[ ] Frontend: Ensure NEXT_PUBLIC_API_URL points to the live Render backend, not localhost.

[ ] Backend: Ensure service_account.json is added to Render Secret Files.

[ ] Google: Check that the Google Drive folder is shared with the Service Account email.

[ ] Email: Generate a fresh App Password if the current one expires.

How to Run Locally
Backend:

Bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python run.py
Frontend:

Bash
cd frontend
npm install
npm run dev