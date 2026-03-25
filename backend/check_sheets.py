import gspread
from google.oauth2.service_account import Credentials

# --- FIX: ADD BOTH SCOPES ---
scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"  # <--- This was missing!
]

try:
    # Load credentials
    creds = Credentials.from_service_account_file("service_account.json", scopes=scopes)
    client = gspread.authorize(creds)

    print("🤖 Authenticated! Listing accessible sheets...")
    
    # List all sheets the robot can see
    sheets = client.openall()
    
    if not sheets:
        print("⚠️  The robot is connected, but it sees 0 sheets.")
        print("   -> Did you share 'CareHr Live Data' with the robot's email?")
        print("   -> Open 'service_account.json', find 'client_email', and share your sheet with it.")
    else:
        for sheet in sheets:
            print(f" ✅ Found Sheet: '{sheet.title}'")

except Exception as e:
    print(f"❌ Error: {e}")