import re
import fitz  # PyMuPDF
from PIL import Image, ImageOps, ImageFilter
import pytesseract
from dateutil import parser as dateparser
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import io
import logging
import os
from openai import AzureOpenAI

# configure a simple logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- AZURE OPENAI CONFIG FOR FRAUD CHECK ---
AZURE_KEY = os.environ.get("AZURE_OPENAI_API_KEY") 
ENDPOINT = "https://crhr-model-testing.openai.azure.com/"
DEPLOYMENT_NAME = "gpt-4.1-nano"

client = None
if AZURE_KEY:
    try:
        client = AzureOpenAI(
            api_key=AZURE_KEY,
            api_version="2024-05-01-preview", 
            azure_endpoint=ENDPOINT
        )
    except Exception as e:
        logger.error(f"Failed to initialize Azure OpenAI client in validators: {e}")

# -------------------------
# STRICT AI FRAUD & MATCH CHECK
# -------------------------
def smart_ai_fraud_check(text: str, category: str) -> dict:
    if not client or not text or len(text) < 10:
        return {"status": "VALID", "reason": "No text or AI unavailable"}
    
    prompt = f"""
    You are a strict compliance AI for a healthcare system.
    The user claims the uploaded document is a: '{category.upper()}'.

    Analyze the following extracted text from the document.
    Does this text belong to the category '{category.upper()}'?

    CRITICAL RULES:
    1. If the text clearly belongs to a completely different type of document (e.g., it is a Resume but they claimed it was a Passport, or it is a Police Check but they claimed WWCC), respond strictly with "FAKE".
    2. If the text reasonably matches the claimed category '{category.upper()}', respond strictly with "VALID".

    Reply ONLY with the exact word "FAKE" or "VALID". Do not explain your reasoning.

    Text to analyze:
    {text[:2500]}
    """
    
    try:
        resp = client.chat.completions.create(
            model=DEPLOYMENT_NAME,
            messages=[{"role": "system", "content": prompt}],
            temperature=0.0,
            max_tokens=10
        )
        res_str = resp.choices[0].message.content.strip().upper()
        
        if "FAKE" in res_str:
            return {"status": "FAKE", "reason": f"AI detected a category mismatch or fake document for '{category}'."}
        
        return {"status": "VALID", "reason": "Passed strict AI classification check."}
    except Exception as e:
        logger.error(f"AI Fraud Check failed: {e}")
        return {"status": "VALID", "reason": "AI Check failed, assuming valid."}


# -------------------------
# Text extraction utilities
# -------------------------

def _ocr_image(img: Image.Image, psm: int = 6, oem: int = 3, lang: str = "eng") -> str:
    try:
        img_gray = img.convert("L")
        w, h = img_gray.size
        scale = 2 if max(w, h) < 2000 else 1
        if scale != 1:
            img_gray = img_gray.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        img_gray = ImageOps.autocontrast(img_gray)
        img_gray = img_gray.filter(ImageFilter.SHARPEN)

        config = f"--oem {oem} --psm {psm}"
        text = pytesseract.image_to_string(img_gray, config=config, lang=lang)
        if not text or len(text.strip()) < 10:
            config2 = f"--oem {oem} --psm 3"
            text = pytesseract.image_to_string(img_gray, config=config2, lang=lang)
        return text or ""
    except Exception as e:
        logger.exception("OCR failed: %s", e)
        try:
            return pytesseract.image_to_string(img)
        except Exception:
            return ""

def extract_text_from_pdf(path: str, render_dpi: int = 300) -> str:
    text_parts: List[str] = []
    try:
        doc = fitz.open(path)
    except Exception as e:
        logger.exception("Failed to open PDF %s: %s", path, e)
        return ""

    for page_number in range(len(doc)):
        try:
            page = doc.load_page(page_number)
            page_text = page.get_text("text") or ""
            page_text = page_text.strip()
            if page_text and len(page_text) > 50:
                text_parts.append(page_text)
                continue

            mat = fitz.Matrix(render_dpi / 72.0, render_dpi / 72.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            ocr_text = _ocr_image(img, psm=6)
            if ocr_text and len(ocr_text.strip()) > 0:
                text_parts.append(ocr_text.strip())
            else:
                ocr_text2 = _ocr_image(img, psm=3)
                if ocr_text2:
                    text_parts.append(ocr_text2.strip())
        except Exception as e:
            logger.exception("Failed to extract page %s from %s: %s", page_number, path, e)

    return "\n\n".join([p for p in text_parts if p]).strip()

def extract_text_from_image(path: str) -> str:
    try:
        img = Image.open(path)
        return _ocr_image(img, psm=6)
    except Exception as e:
        logger.exception("Failed to OCR image %s: %s", path, e)
        return ""

def extract_text_file(path: str) -> str:
    try:
        text = extract_text_from_pdf(path)
        if not text or len(text) < 50:
            logger.info("PDF text short (%d chars). Running page-level OCR fallback for %s", len(text), path)
            try:
                doc = fitz.open(path)
                pages_text = []
                for page_number in range(len(doc)):
                    try:
                        page = doc.load_page(page_number)
                        mat = fitz.Matrix(400 / 72.0, 400 / 72.0)
                        pix = page.get_pixmap(matrix=mat, alpha=False)
                        img_bytes = pix.tobytes("png")
                        img = Image.open(io.BytesIO(img_bytes))
                        page_ocr = _ocr_image(img, psm=3)
                        if page_ocr and len(page_ocr.strip()) > 0:
                            pages_text.append(page_ocr.strip())
                    except Exception as e:
                        logger.exception("Aggressive OCR failed for page %s of %s: %s", page_number, path, e)
                if pages_text:
                    text = "\n\n".join(pages_text)
            except Exception as e:
                logger.exception("Aggressive PDF OCR fallback failed for %s: %s", path, e)
                text = extract_text_from_image(path)
        return text or ""
    except Exception as e:
        logger.exception("extract_text_file failed for %s: %s", path, e)
        return extract_text_from_image(path)

# -------------------------
# Date extraction utilities
# -------------------------

DATE_PATTERNS = [
    r"\b(?:[0-3]?\d[\/\-\.][0-1]?\d[\/\-\.](?:\d{2}|\d{4}))\b",
    r"\b(?:\d{4}[\/\-\.][0-1]?\d[\/\-\.][0-3]?\d)\b",
    r"\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b",
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b",
]

def find_dates_in_text(text: str) -> List[datetime]:
    found = []
    for pat in DATE_PATTERNS:
        for m in re.findall(pat, text, flags=re.IGNORECASE):
            try:
                dt = dateparser.parse(m, dayfirst=True, yearfirst=False, fuzzy=True)
                if dt:
                    found.append(dt)
            except Exception:
                pass
    unique = {}
    for d in found:
        unique[d.date().isoformat()] = d
    return list(unique.values())

def get_most_likely_expiry(text: str) -> Optional[datetime]:
    dates = find_dates_in_text(text)
    if not dates:
        return None
    now = datetime.now()
    future = [d for d in dates if d > now - timedelta(days=1)]
    if future:
        return min(future)
    return max(dates)

def is_expired(expiry_dt: Optional[datetime], threshold_days: int = 0) -> Optional[bool]:
    if expiry_dt is None:
        return None
    check_dt = datetime.now() + timedelta(days=threshold_days)
    return expiry_dt < check_dt

# -------------------------
# Regexes and validators
# -------------------------

AHPRA_EXACT_ID = re.compile(r"\b([A-Z]{3}[0-9]{10})\b", re.IGNORECASE)
AHPRA_STRONG = re.compile(r"(AHPRA|Registration|Reg\.?\s*No\.?)\s*[:\-]?\s*([A-Z]{0,4}\s?\d{6,12})", re.IGNORECASE)
AFP_REGEX_ALT = re.compile(r"(Certificate\s*No\.?|Cert\s*No\.?|Reference|Ref)\s*[:\s]*([A-Z0-9\-\/]{4,40})", re.IGNORECASE)
AFP_CONTEXT = re.compile(r".{0,80}(Australian Federal Police|AFP|National Police|Police Check|Police Certificate).{0,80}", re.IGNORECASE)
AFP_GENERIC_ID = re.compile(r"\b([A-Z]{1,3}\d{3,10}[A-Z0-9\-]*)\b", re.IGNORECASE)
WWCC_REGEX = re.compile(r"\b(WWC|Working With Children|WWCC).{0,40}([A-Z0-9\-]{4,20})\b", re.IGNORECASE)
VEVO_REGEX = re.compile(r"\b(VEVO|Visa|Subclass|Visa subclass)\b", re.IGNORECASE)

def _normalize(document_type: str, identifier_label: str, identifier_value: Optional[str], text: str, extra: Dict = None) -> Dict:
    expiry_dt = get_most_likely_expiry(text)
    return {
        "document_type": document_type,
        "identifier_label": identifier_label,
        "identifier": identifier_value,
        "expiry": expiry_dt.date().isoformat() if expiry_dt else None,
        "expired": is_expired(expiry_dt, threshold_days=0),
        "valid": True if identifier_value or (extra and extra.get("valid_detected")) else False,
        **(extra or {}),
    }

def validate_ahpra(text: str) -> Dict:
    exact_match = AHPRA_EXACT_ID.search(text)
    if exact_match:
        registration = exact_match.group(1).upper()
    else:
        strong = AHPRA_STRONG.search(text)
        registration = strong.group(2).replace(" ", "") if strong else None
    
    return _normalize("AHPRA", "registration_no", registration, text, {
        "raw_matches": [registration] if registration else [],
        "context": "AHPRA/Registration",
    })

def validate_afp(text: str) -> Dict:
    m = AFP_REGEX_ALT.search(text)
    cert_id = m.group(2).strip() if m else None
    if not cert_id:
        for ctx in AFP_CONTEXT.finditer(text):
            window = ctx.group(0)
            gm = AFP_GENERIC_ID.search(window)
            if gm:
                cert_id = gm.group(1).strip()
                break
    if not cert_id:
        gm2 = AFP_GENERIC_ID.search(text)
        cert_id = gm2.group(1).strip() if gm2 else None

    expiry_dt = get_most_likely_expiry(text)
    return {
        "document_type": "AFP_Police_Check",
        "identifier_label": "certificate_id",
        "identifier": cert_id,
        "expiry": expiry_dt.date().isoformat() if expiry_dt else None,
        "expired": is_expired(expiry_dt),
        "valid": bool(cert_id),
        "found_key_phrases": bool(cert_id),
    }

def validate_wwcc(text: str) -> Dict:
    m = WWCC_REGEX.search(text)
    wwcc_id = m.group(2).strip() if m else None
    return _normalize("WWCC", "wwcc_id", wwcc_id, text, {"valid_detected": bool(m)})

def validate_vevo(text: str) -> Dict:
    m = VEVO_REGEX.search(text)
    return _normalize("Work_Eligibility", "visa_detected", "YES" if m else None, text, {"valid_detected": bool(m)})

def validate_qualification(text: str) -> Dict:
    keywords = ["Bachelor", "Master", "Diploma", "Nursing", "Midwifery", "Degree", "Transcript", "University", "College"]
    found = [k for k in keywords if re.search(r"\b" + re.escape(k) + r"\b", text, re.IGNORECASE)]
    return _normalize("Qualification", "degree_keywords", ", ".join(found), text, {"valid_detected": len(found) >= 2})

def validate_training(text: str) -> Dict:
    keywords = ["Certificate", "Completion", "Competency", "CPD", "Life Support", "CPR", "Manual Handling", "Fire", "Infection"]
    found = [k for k in keywords if re.search(r"\b" + re.escape(k) + r"\b", text, re.IGNORECASE)]
    return _normalize("Training", "training_topics", ", ".join(found), text, {"valid_detected": bool(found)})

def validate_indemnity(text: str) -> Dict:
    keywords = ["Indemnity", "Insurance", "Liability", "Policy", "Certificate of Currency", "Cover"]
    found = [k for k in keywords if re.search(r"\b" + re.escape(k) + r"\b", text, re.IGNORECASE)]
    policy_match = re.search(r"(Policy|Cert|Number)\s*[:\#]?\s*([A-Z0-9]{5,20})", text, re.IGNORECASE)
    identifier = policy_match.group(2) if policy_match else None
    return _normalize("Insurance", "policy_no", identifier, text, {"valid_detected": len(found) >= 2 or bool(identifier)})

def validate_immunisation(text: str) -> Dict:
    keywords = ["Vaccine", "Vaccination", "Immunisation", "COVID", "Influenza", "Hepatitis", "Serology", "Dose"]
    found = [k for k in keywords if re.search(r"\b" + re.escape(k) + r"\b", text, re.IGNORECASE)]
    return _normalize("Immunisation", "vaccines_found", ", ".join(found), text, {"valid_detected": len(found) >= 2})

def validate_cv(text: str) -> Dict:
    return {
        "document_type": "CV",
        "identifier_label": "n/a",
        "identifier": None,
        "expiry": None,
        "expired": None,
        "valid": True,
        "notes": "CV considered valid (no identifier/expiry).",
    }

def validate_passport(text: str) -> Dict:
    m = re.search(r"(passport(?:\s*no\.?|number)?[:\s]*)([A-Z0-9\-]{5,20})", text, re.IGNORECASE)
    passport_no = m.group(2).strip() if m else None
    expiry_dt = get_most_likely_expiry(text)
    return {
        "document_type": "Passport/ID",
        "identifier_label": "passport_id",
        "identifier": passport_no,
        "expiry": expiry_dt.date().isoformat() if expiry_dt else None,
        "expired": is_expired(expiry_dt),
        "valid": bool(passport_no or expiry_dt),
    }

def run_validation_for_category(category: str, text: str) -> Dict:
    cat = (category or "").lower()
    
    if "cv" in cat: val = validate_cv(text)
    elif "ahpra" in cat: val = validate_ahpra(text)
    elif "police" in cat: val = validate_afp(text)
    elif "wwcc" in cat: val = validate_wwcc(text)
    elif "work" in cat or "eligibility" in cat or "vevo" in cat: val = validate_vevo(text)
    elif "qualification" in cat or "degree" in cat: val = validate_qualification(text)
    elif "vaccin" in cat or "immun" in cat: val = validate_immunisation(text)
    elif "training" in cat: val = validate_training(text)
    elif "indemnity" in cat or "insurance" in cat: val = validate_indemnity(text)
    elif "photo" in cat or "passport" in cat or "id" in cat: val = validate_passport(text)
    else: val = validate_cv(text)

    # --- RUN SMART AI FRAUD CHECK ---
    ai_check = smart_ai_fraud_check(text, category)
    val["ai_fraud_status"] = ai_check.get("status", "VALID")
    val["ai_fraud_reason"] = ai_check.get("reason", "")
    
    return val
