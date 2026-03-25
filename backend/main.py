import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import os
import uuid
from datetime import date, datetime
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse # NEW: Required for streaming chat
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Date, JSON, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dateutil import parser as dateparser
import smtplib
from email.mime.text import MIMEText
import logging

from validators import extract_text_file, run_validation_for_category
from google_sheets_utils import extract_ahpra_details, update_ahpra_sheet
from google_drive import upload_to_drive, get_or_create_candidate_folder, delete_from_drive
from ahpra_validator import verify_ahpra_live, verify_ahpra_full
from chatbot import process_chat_message_stream # UPDATED IMPORT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./trendcraft.db")
UPLOAD_TEMP_DIR = "temp/"
os.makedirs(UPLOAD_TEMP_DIR, exist_ok=True)

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER") 
SMTP_PASS = os.environ.get("SMTP_PASS") 
EMAIL_FROM = os.environ.get("EMAIL_FROM", SMTP_USER)
EMAIL_TO_OVERRIDE = os.environ.get("EMAIL_TO", SMTP_USER)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
Base = declarative_base()

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(String(36), primary_key=True, index=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(64))
    dob = Column(String(32), nullable=True)
    role = Column(String(64), nullable=True)
    drive_root_folder_id = Column(String(128), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

class Document(Base):
    __tablename__ = "documents"
    id = Column(String(36), primary_key=True, index=True)
    candidate_id = Column(String(36), index=True)
    category = Column(String(64))
    filename = Column(String(512))
    drive_file_id = Column(String(128))
    drive_view_link = Column(String(1024))
    status = Column(String(32), default="RECEIVED")
    extracted_json = Column(JSON, nullable=True)
    expiry_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Compliance Doc Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CandidateCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    role: Optional[str] = None
    
class ChatRequest(BaseModel):
    email: str
    message: str
    
class CandidateOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    dob: Optional[str]
    role: Optional[str]
    drive_root_folder_id: Optional[str]

def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def send_summary_email(to_email: str, subject: str, body: str):
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        logger.error("Email config missing. Skipping email.")
        return
    
    recipient = EMAIL_TO_OVERRIDE if EMAIL_TO_OVERRIDE else to_email
    
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = recipient
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(EMAIL_FROM, [recipient], msg.as_string())
    except Exception as e:
        logger.error(f"Email send failed: {e}")

def format_email_summary(candidate: Candidate, docs: List[Document]) -> str:
    required_map = {
        "ahpra": "AHPRA Registration", "police": "National Police Check",
        "wwcc": "Working With Children Check", "work_eligibility": "Work Eligibility",
        "qualification": "Qualifications", "cv": "Resume/CV",
        "vaccinations": "Vaccinations", "immunisation": "Immunisation Record",
        "training": "Training Certificates", "indemnity": "Indemnity Insurance",
        "photo_id": "Photo ID"
    }
    
    submitted_cats = set()
    submitted_list = []
    
    for d in docs:
        clean_cat = (d.category or "").lower().strip()
        label = clean_cat
        for key, val in required_map.items():
            if key in clean_cat:
                submitted_cats.add(key)
                label = val
                break
        submitted_list.append(f" - {label}: {d.filename}")

    missing_cats = set(required_map.keys()) - submitted_cats
    
    lines = [f"Candidate: {candidate.first_name} {candidate.last_name}", f"Role: {candidate.role}", f"Email: {candidate.email}", "", "--- SUBMISSION UPDATE ---", f"New activity detected at {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}.", "", "DOCUMENTS ON FILE:"]
    if submitted_list: lines.extend(submitted_list)
    else: lines.append(" - None")
    
    lines.extend(["", "MISSING DOCUMENTS:"])
    if missing_cats:
        for cat in missing_cats: lines.append(f" - {required_map[cat]}")
    else:
        lines.append(" - None! All baseline documents received.")
    
    lines.extend(["", "Please review these files in the dashboard."])
    return "\n".join(lines)

async def process_ahpra_full_flow(first_name: str, last_name: str, role: str, email: str, text_content: str):
    logger.info(f"Starting AHPRA verification for {first_name} {last_name}...")
    extracted = extract_ahpra_details(text_content)
    reg_id = extracted.get("registration_id")
    
    verification_status = "Pending"
    details_msg = ""

    if reg_id and reg_id != "Not Found":
        try:
            result = await verify_ahpra_live(reg_id, last_name)
            raw_status = result.get("status", "Error")
            details_msg = result.get("details", "")
            if raw_status == "Error": verification_status = "Pending"
            else: verification_status = raw_status
        except Exception:
            verification_status = "Pending"
            details_msg = "System check failed"
    else:
        verification_status = "Pending"
        details_msg = "Could not read registration number."

    payload = {"first_name": first_name, "last_name": last_name, "role": role, "registration_id": reg_id, "expiry_date": extracted.get("expiry_date"), "status": verification_status}
    update_ahpra_sheet(payload)

    manager_email = EMAIL_TO_OVERRIDE
    if manager_email:
        subject = f"AHPRA Check Result: {first_name} {last_name} -> {verification_status}"
        body_lines = ["Automated AHPRA Verification Report", "-----------------------------------", f"Candidate: {first_name} {last_name}", f"Role: {role}", f"AHPRA ID: {reg_id}", "", f"STATUS: {verification_status.upper()}", ""]
        send_summary_email(manager_email, subject, "\n".join(body_lines))

@app.get("/health")
def health():
    return {"status": "ok"}
    

# --- UPDATED: CHAT ENDPOINT NOW STREAMS ---
@app.post("/chat")
async def chat_endpoint(payload: ChatRequest):
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.email == payload.email).first()
        
        if not candidate:
            # Fake a stream for the static error message
            async def mock_stream():
                yield "Please complete your profile setup so I can help you with your specific compliance needs!"
            return StreamingResponse(mock_stream(), media_type="text/event-stream")

        docs = db.query(Document).filter(Document.candidate_id == candidate.id).all()
        doc_list = [{"category": d.category, "status": d.status} for d in docs]
        cand_data = {"first_name": candidate.first_name, "role": candidate.role}

        return StreamingResponse(
            process_chat_message_stream(payload.message, cand_data, doc_list),
            media_type="text/event-stream"
        )
    finally:
        db.close()
    
@app.get("/candidates/lookup")
def lookup_candidate(email: str):
    db = next(db_session())
    c = db.query(Candidate).filter(Candidate.email == email).first()
    if not c:
        db.close()
        return {"found": False}
    
    docs = db.query(Document).filter(Document.candidate_id == c.id).all()
    out_docs = [
        {"id": d.id, "category": d.category, "filename": d.filename, "status": d.status, "drive_view_link": d.drive_view_link} 
        for d in docs
    ]
    db.close()
    return {
        "found": True,
        "candidate": {"id": c.id, "first_name": c.first_name, "last_name": c.last_name, "role": c.role, "dob": c.dob},
        "documents": out_docs
    }

@app.post("/candidates", response_model=CandidateOut)
def create_candidate(payload: CandidateCreate):
    db = next(db_session())
    candidate_id = str(uuid.uuid4())[:36]
    role_clean = (payload.role or "").strip().title() or None
    candidate = Candidate(id=candidate_id, first_name=payload.first_name, last_name=payload.last_name, email=payload.email, phone=payload.phone, dob=payload.dob, role=role_clean)
    try:
        folder_map = get_or_create_candidate_folder(f"{payload.first_name} {payload.last_name}", candidate_id, role_clean)
        candidate.drive_root_folder_id = folder_map.get("root")
    except Exception as e:
        logger.error(f"Folder creation failed: {e}")

    db.add(candidate)
    db.commit()
    db.close()
    return CandidateOut(id=candidate_id, first_name=payload.first_name, last_name=payload.last_name, email=payload.email, phone=payload.phone, dob=payload.dob, role=role_clean, drive_root_folder_id=candidate.drive_root_folder_id)

@app.get("/candidates", response_model=List[CandidateOut])
def list_candidates():
    db = next(db_session())
    items = db.query(Candidate).all()
    out = [CandidateOut(id=i.id, first_name=i.first_name, last_name=i.last_name, email=i.email, phone=i.phone, dob=i.dob, role=i.role, drive_root_folder_id=i.drive_root_folder_id) for i in items]
    db.close()
    return out

@app.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: str):
    db = next(db_session())
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        db.close()
        raise HTTPException(status_code=404, detail="Candidate not found")
    docs = db.query(Document).filter(Document.candidate_id == candidate_id).all()
    out_docs = [{"id": d.id, "category": d.category, "filename": d.filename, "status": d.status, "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None, "view_link": d.drive_view_link, "extracted": d.extracted_json} for d in docs]
    db.close()
    return {"candidate": {"id": c.id, "first_name": c.first_name, "last_name": c.last_name, "email": c.email, "phone": c.phone, "dob": c.dob, "role": c.role}, "documents": out_docs}

@app.post("/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    categories: List[str] = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    dob: str = Form(""),
    role: str = Form(...),
):
    if not files or not categories or len(files) != len(categories):
        raise HTTPException(status_code=400, detail="Files and categories must be aligned.")
    
    role_clean = (role or "").strip()
    if not role_clean: raise HTTPException(status_code=400, detail="Role is required.")

    db = next(db_session())
    candidate = db.query(Candidate).filter(Candidate.email == email).first()
    folder_map = {}
    
    try:
        if not candidate:
            candidate_id = str(uuid.uuid4())[:36]
            candidate = Candidate(id=candidate_id, first_name=first_name, last_name=last_name, email=email, phone=phone, dob=dob, role=role_clean)
            folder_map = get_or_create_candidate_folder(f"{first_name} {last_name}", candidate_id, role_clean)
            candidate.drive_root_folder_id = folder_map.get("root")
            db.add(candidate)
            db.commit()
        else:
            candidate_id = candidate.id
            folder_map = get_or_create_candidate_folder(f"{first_name} {last_name}", candidate_id, role_clean)
    except Exception as e:
        logger.error(f"Critical error creating candidate/folder: {e}")
        if not candidate: raise HTTPException(status_code=500, detail="Database error saving candidate")

    saved_docs: List[Document] = []
    results = []
    is_fake = False

    for idx, file in enumerate(files):
        category = categories[idx].strip().lower()
        temp_path = os.path.join(UPLOAD_TEMP_DIR, f"{uuid.uuid4().hex}_{file.filename}")
        
        try:
            with open(temp_path, "wb") as fobj:
                fobj.write(await file.read())
        except Exception as e:
            continue

        target_folder = {
            "cv": folder_map.get("cv"), "ahpra": folder_map.get("registrations"),
            "police": folder_map.get("checks"), "wwcc": folder_map.get("checks"),
            "work_eligibility": folder_map.get("identity"), "photo_id": folder_map.get("identity"),
            "qualification": folder_map.get("certifications"), "training": folder_map.get("certifications"),
            "vaccinations": folder_map.get("compliance"), "immunisation": folder_map.get("compliance"),
            "indemnity": folder_map.get("compliance"),
        }.get(category, folder_map.get("compliance"))

        filename = f"{role_clean.upper()}_{category.upper()}_{file.filename}"

        full_text = ""
        try: full_text = extract_text_file(temp_path)
        except Exception: pass

        validation = run_validation_for_category(category, full_text)
        is_fake = validation.get("ai_fraud_status") == "FAKE"

        drive_id, view_link = None, None
        status_val = "RECEIVED"

        if is_fake:
            status_val = "FAKE"
            logger.warning(f"Document {filename} flagged as FAKE. Skipping Drive Upload.")
        else:
            try:
                uploaded = upload_to_drive(temp_path, filename, folder_id=target_folder)
                drive_id = uploaded.get("id")
                view_link = uploaded.get("webViewLink")
            except Exception as e:
                logger.error(f"Drive upload error: {e}")

        if "ahpra" in category and not is_fake:
            background_tasks.add_task(process_ahpra_full_flow, first_name, last_name, role_clean, email, full_text)
        
        expiry_date = None
        if validation.get("expiry"):
            try: expiry_date = dateparser.parse(validation.get("expiry")).date()
            except: pass

        doc_id = str(uuid.uuid4())[:36]
        doc = Document(
            id=doc_id, candidate_id=candidate_id, category=category, filename=filename,
            drive_file_id=drive_id, drive_view_link=view_link, status=status_val,
            extracted_json=validation, expiry_date=expiry_date,
        )
        db.add(doc)
        db.commit()
        saved_docs.append(doc)

        try: os.remove(temp_path)
        except: pass

        results.append({
            "document_id": doc_id, "category": category, "drive_file_id": drive_id, 
            "view_link": view_link, "validation": validation, "status": status_val
        })

    if saved_docs and not any(d.status == 'FAKE' for d in saved_docs):
        background_tasks.add_task(light_validate_document, saved_docs[0].id)

    manager_email = EMAIL_TO_OVERRIDE 
    if manager_email:
        all_docs = db.query(Document).filter(Document.candidate_id == candidate_id).all()
        body = format_email_summary(candidate, all_docs)
        subject = f"Manager Alert: Docs Uploaded by {first_name} {last_name}"
        background_tasks.add_task(send_summary_email, manager_email, subject, body)

    db.close()
    return {"status": "success", "candidate_id": candidate_id, "documents": results}

@app.delete("/documents/{document_id}")
def delete_document(document_id: str):
    db = next(db_session())
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        if doc.drive_file_id:
            try: delete_from_drive(doc.drive_file_id)
            except Exception as e: logger.error(f"Could not delete from Drive: {e}")

        db.delete(doc)
        db.commit()
        return {"status": "success", "message": "Document deleted"}
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")
    finally:
        db.close()


@app.post("/verify/{document_id}")
async def verify_document(document_id: str):
    """
    On-demand AHPRA verification for a specific document.
    Scrapes the AHPRA register and compares the result with the candidate's name.
    """
    db = next(db_session())
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        candidate = db.query(Candidate).filter(Candidate.id == doc.candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # Extract AHPRA registration number from the document's extracted data
        extracted = doc.extracted_json or {}
        reg_id = extracted.get("identifier") or extracted.get("registration_no")

        if not reg_id or reg_id == "Not Found":
            return {
                "status": "error",
                "message": "No AHPRA registration number found in this document. Please ensure you uploaded a valid AHPRA certificate.",
                "verification": None,
            }

        # Run real AHPRA verification with name matching
        result = await verify_ahpra_full(
            registration_id=reg_id,
            candidate_first=candidate.first_name,
            candidate_last=candidate.last_name,
        )

        # Determine document status based on verification result
        verify_status = result.get("status", "Error")
        name_match = result.get("name_match")

        if verify_status == "Verified":
            if name_match is True:
                doc.status = "AHPRA_VERIFIED"
            elif name_match is False:
                doc.status = "AHPRA_NAME_MISMATCH"
            else:
                doc.status = "AHPRA_VERIFIED"  # name couldn't be compared, trust verification
        elif verify_status == "Not Found":
            doc.status = "AHPRA_NOT_FOUND"
        else:
            # Error case — don't change status, just return the error
            return {
                "status": "error",
                "message": result.get("details", "Verification failed"),
                "verification": result,
            }

        # Store verification result in extracted_json
        updated_extracted = dict(extracted)
        updated_extracted["ahpra_verification"] = {
            "verified": verify_status == "Verified",
            "practitioner_name": result.get("practitioner_name"),
            "registration_expiry": result.get("registration_expiry"),
            "registration_status": result.get("registration_status"),
            "profession": result.get("profession"),
            "name_match": name_match,
            "status": doc.status,
        }
        doc.extracted_json = updated_extracted
        db.commit()

        return {
            "status": "success",
            "document_status": doc.status,
            "verification": updated_extracted["ahpra_verification"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")
    finally:
        db.close()


def light_validate_document(document_id: str):
    db = next(db_session())
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc or doc.status == "FAKE": return

        extracted = doc.extracted_json or {}
        extracted_valid = None
        if "valid" in extracted:
            v = extracted.get("valid")
            if isinstance(v, bool): extracted_valid = v
            else: extracted_valid = str(v).strip().lower() in {"true", "1", "yes", "valid", "passed"}

        if extracted_valid is False: status = "RECEIVED"
        else: status = "VALID"

        if doc.expiry_date:
            try:
                today = date.today()
                if doc.expiry_date < today: status = "EXPIRED"
                elif (doc.expiry_date - today).days <= 90: status = "EXPIRING"
                else: status = "VALID"
            except Exception: pass

        if doc.status != status:
            doc.status = status
            db.commit()
    except Exception as e:
        logger.error(f"light_validate_document error for {document_id}: {e}")
    finally:
        db.close()

@app.get("/export")
def export_data():
    db = next(db_session())
    try:
        results = []
        candidates = db.query(Candidate).all()
        cand_map = {c.id: c for c in candidates}
        docs = db.query(Document).all()
        for d in docs:
            c = cand_map.get(d.candidate_id)
            if not c: continue
            results.append({
                "candidate_id": c.id,
                "first_name": c.first_name,
                "last_name": c.last_name,
                "email": c.email,
                "role": c.role,
                "category": d.category,
                "filename": d.filename,
                "status": d.status,
                "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                "view_link": d.drive_view_link,
                "extracted": d.extracted_json or {}
            })
        return results
    except Exception as e:
        logger.error(f"Error during /export: {e}")
        raise HTTPException(status_code=500, detail="Export failed")
    finally:
        db.close()

@app.get("/export/salesforce")
def export_salesforce():
    db = next(db_session())
    try:
        results = []
        candidates = db.query(Candidate).all()
        cand_map = {c.id: c for c in candidates}
        docs = db.query(Document).all()
        for d in docs:
            c = cand_map.get(d.candidate_id)
            if not c: continue
            results.append({
                "Contact_ID": c.id,
                "FirstName": c.first_name,
                "LastName": c.last_name,
                "Email": c.email,
                "Title": c.role,
                "Document_Category": d.category,
                "Document_Name": d.filename,
                "Compliance_Status": d.status,
                "Expiration_Date": d.expiry_date.isoformat() if d.expiry_date else "",
                "File_Link": d.drive_view_link or ""
            })
        return results
    except Exception as e:
        logger.error(f"Error during /export/salesforce: {e}")
        raise HTTPException(status_code=500, detail="Salesforce export failed")
    finally:
        db.close()
