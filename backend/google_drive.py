import os
import logging
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

SCOPES = ["https://www.googleapis.com/auth/drive"]

MASTER_FOLDER_ID = "1TeBRE76oNCSWHnVbS4989JfjlvhADJJD"

def get_secret_path(filename):
    if os.path.exists(filename):
        return filename
    elif os.path.exists(f"/etc/secrets/{filename}"):
        return f"/etc/secrets/{filename}"
    return None

def get_drive_service():
    token_path = get_secret_path("token.json")

    if not token_path:
        raise FileNotFoundError("CRITICAL: token.json not found. Upload it to Render Secret Files.")

    try:
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    except Exception as e:
        logger.error(f"Error loading token: {e}")
        raise

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            logger.info("Token refreshed successfully.")
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            raise

    return build("drive", "v3", credentials=creds, cache_discovery=False)

def create_folder(name: str, parent_id: str = None) -> str:
    service = get_drive_service()
    safe_name = name.replace("'", "\\'")
    
    q = f"name = '{safe_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        q += f" and '{parent_id}' in parents"

    try:
        res = service.files().list(q=q, fields="files(id)").execute()
        items = res.get("files", [])
        if items:
            return items[0]["id"]
    except HttpError:
        pass

    metadata = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_id:
        metadata["parents"] = [parent_id]

    try:
        folder = service.files().create(body=metadata, fields="id").execute()
        return folder.get("id")
    except Exception as e:
        logger.error(f"Error creating folder '{name}': {e}")
        return None

def _ensure_public(service, file_id: str):
    try:
        service.permissions().create(
            fileId=file_id, 
            body={"type": "anyone", "role": "reader"}
        ).execute()
    except Exception as e:
        logger.warning(f"Could not set permissions: {e}")

def upload_to_drive(filepath: str, filename: str, folder_id: str = None) -> dict:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Missing file: {filepath}")

    service = get_drive_service()
    metadata = {"name": filename}
    if folder_id:
        metadata["parents"] = [folder_id]

    try:
        media = MediaFileUpload(filepath, resumable=True)
        uploaded = service.files().create(
            body=metadata, 
            media_body=media, 
            fields="id, webViewLink"
        ).execute()
        
        file_id = uploaded.get("id")
        _ensure_public(service, file_id)
        
        return {"id": file_id, "webViewLink": uploaded.get("webViewLink")}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise

def get_or_create_candidate_folder(candidate_name: str, candidate_id: str = None, role: str = None) -> dict:
    master_id = MASTER_FOLDER_ID
    folder_name = f"{candidate_name} {role}" if role else candidate_name
    root_id = create_folder(folder_name, parent_id=master_id)

    subs = ["Identity", "Compliance", "Checks", "Certifications", "Registrations", "CV"]
    subfolders = {}
    for s in subs:
        subfolders[s.lower()] = create_folder(s, parent_id=root_id)

    return {"root": root_id, **subfolders}

def delete_from_drive(file_id: str):
    service = get_drive_service()
    try:
        service.files().delete(fileId=file_id).execute()
        logger.info(f"Successfully deleted file {file_id} from Google Drive.")
    except Exception as e:
        logger.error(f"Failed to delete file {file_id} from Google Drive: {e}")
        raise
