import gspread
import os
from google.oauth2.service_account import Credentials
import re
from datetime import datetime
from typing import Dict, Any

def get_gspread_client():
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    
    filename = "service_account.json"
    if os.path.exists(filename):
        path = filename
    elif os.path.exists(f"/etc/secrets/{filename}"):
        path = f"/etc/secrets/{filename}"
    else:
        raise FileNotFoundError("service_account.json not found in local or /etc/secrets/")

    creds = Credentials.from_service_account_file(path, scopes=scopes)
    client = gspread.authorize(creds)
    return client

def extract_ahpra_details(text_content):
    data = {
        "registration_id": "Not Found",
        "expiry_date": "Not Found"
    }

    if not text_content:
        return data

    reg_id_match = re.search(r'\b([A-Z]{3})\s?([0-9]{10})\b', text_content, re.IGNORECASE)
    
    if reg_id_match:
        data["registration_id"] = f"{reg_id_match.group(1)}{reg_id_match.group(2)}".upper()

    lines = text_content.split('\n')
    date_pattern = r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'

    for line in lines:
        if any(x in line.lower() for x in ["expir", "valid", "renew", "until"]):
            date_match = re.search(date_pattern, line)
            if date_match:
                data["expiry_date"] = date_match.group(0)
                break
    
    if data["expiry_date"] == "Not Found":
        all_dates = re.findall(date_pattern, text_content)
        if all_dates:
            data["expiry_date"] = all_dates[-1] 

    return data

def update_ahpra_sheet(candidate_data: Dict[str, Any]):
    try:
        client = get_gspread_client()
        sheet_name = "CareHr Live Data"
        try:
            sheet = client.open(sheet_name).sheet1
        except gspread.SpreadsheetNotFound:
            print(f"Error: Could not find Google Sheet named '{sheet_name}'.")
            return False

        status = candidate_data.get("status", "Pending")
        
        row = [
            candidate_data.get("first_name", ""),
            candidate_data.get("last_name", ""),
            candidate_data.get("role", ""),
            candidate_data.get("registration_id", "Not Found"),
            candidate_data.get("expiry_date", "Not Found"),
            status,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ]
        
        sheet.append_row(row)
        print(f"Google Sheet Updated: {candidate_data.get('first_name')} -> {status}")
        return True
    except Exception as e:
        print(f"Google Sheet Error: {e}")
        return False
