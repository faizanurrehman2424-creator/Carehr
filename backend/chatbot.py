import os
import logging
import json
import requests
import google.auth
from google.auth.transport.requests import Request

logger = logging.getLogger(__name__)

# --- CONFIG ---
def get_adc_path():
    if os.environ.get("VERTEX_ADC_PATH"):
        return os.environ.get("VERTEX_ADC_PATH")
        
    if os.name == "nt":
        path = os.path.expandvars(r"%APPDATA%\gcloud\application_default_credentials.json")
        if os.path.exists(path):
            return path
    else:
        path = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")
        if os.path.exists(path):
            return path
        container_path = "/root/.config/gcloud/application_default_credentials.json"
        if os.path.exists(container_path):
            return container_path
    return None

def get_vertex_token_and_project():
    try:
        adc_path = get_adc_path()
        if adc_path and os.path.exists(adc_path):
            from google.auth import load_credentials_from_file
            creds, project_id = load_credentials_from_file(adc_path, scopes=["https://www.googleapis.com/auth/cloud-platform"])
        else:
            creds, project_id = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            
        if not project_id:
            project_id = os.environ.get("GCP_PROJECT")
            
        if not creds.valid:
            creds.refresh(Request())
            
        return creds.token, project_id
    except Exception as e:
        logger.error(f"Failed to load Vertex credentials: {e}")
        return None, None

def process_chat_message_stream(user_message: str, candidate_data: dict, documents: list):
    """
    Uses Gemini 2.5 Flash on Google Vertex AI to act as a proactive, friendly CareHR Assistant.
    Streams the response chunk by chunk to the frontend.
    """
    token, project_id = get_vertex_token_and_project()
    if not token or not project_id:
        yield "My systems are currently booting up. Please ensure Google Cloud Application Default Credentials (ADC) are set up on the host!"
        return

    try:
        # 1. Analyze Current Uploads
        doc_list_str = "\n".join([f"- {d['category'].upper()}: Status is {d['status']}" for d in documents])
        if not doc_list_str:
            doc_list_str = "No documents uploaded yet."

        # 2. Calculate Missing Core Documents
        required_cats = {"cv", "ahpra", "police", "wwcc", "vaccinations"}
        uploaded_cats = {d['category'].lower() for d in documents}
        missing_cats = required_cats - uploaded_cats
        
        missing_list_str = ", ".join([c.replace("_", " ").upper() for c in missing_cats])
        if not missing_cats:
            missing_list_str = "None! All core baseline documents are received."

        # 3. The Advanced System Persona
        system_prompt = f"""
        You are the 'CareHR AI Assistant', a highly capable, warm, and proactive compliance expert for a medical recruitment agency.
        You are assisting a busy healthcare professional. Always be respectful, encouraging, and try to brighten their day!

        --- USER CONTEXT ---
        Name: {candidate_data.get('first_name', 'Candidate')}
        Role: {candidate_data.get('role', 'Health Professional')}
        
        --- COMPLIANCE STATUS ---
        Currently Uploaded Documents:
        {doc_list_str}

        Missing Core Documents:
        {missing_list_str}

        --- YOUR DIRECTIVES ---
        1. PROACTIVE GUIDANCE: If they ask "What do I do?" or "How do I start?", greet them warmly, list the specific documents they are missing from the 'Missing Core Documents' list, and tell them: "You can simply drag and drop your PDF files directly into this chat window, or click the paperclip icon to upload them!"
        2. STATUS UPDATES: If they ask if a document is uploaded, check the 'Currently Uploaded Documents' list. If AHPRA is 'RECEIVED', enthusiastically let them know it is currently being verified live by the system.
        3. COMPLIANCE TIPS: If asked, briefly explain why certain docs are needed (e.g., "A National Police Check ensures patient safety, which is our top priority!").
        4. UPLIFTING TONE: Healthcare is stressful. Occasionally sprinkle in a warm compliment, thank them for their dedication to healthcare, or wish them a great shift.
        5. LIMITATIONS: You do not upload the files yourself. The chat interface handles that in the background. Do not invent fake document statuses.
        """

        # 4. Generate Streamed Response via REST API
        location = os.environ.get("GCP_LOCATION", "global")
        url = f"https://aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/gemini-2.5-flash:streamGenerateContent"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": user_message
                        }
                    ]
                }
            ],
            "systemInstruction": {
                "parts": [
                    {
                        "text": system_prompt
                    }
                ]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 400
            }
        }

        response = requests.post(url, headers=headers, json=payload, stream=True)
        response.raise_for_status()

        # Parse response stream of JSON parts incrementally
        buffer = ""
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            if not chunk:
                continue
            buffer += chunk
            if buffer.startswith("["):
                buffer = buffer[1:].strip()
            
            while True:
                buffer = buffer.strip()
                if buffer.startswith(","):
                    buffer = buffer[1:].strip()
                if not buffer or buffer == "]":
                    break
                
                try:
                    obj, index = json.JSONDecoder().raw_decode(buffer)
                    buffer = buffer[index:].strip()
                    
                    candidates = obj.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text = parts[0].get("text", "")
                            if text:
                                yield text
                except json.JSONDecodeError:
                    break

    except Exception as e:
        logger.error(f"Chatbot Error: {e}")
        yield "I'm having a little trouble connecting to my records right now. Please give me a moment and try again!"
