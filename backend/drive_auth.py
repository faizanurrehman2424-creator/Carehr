from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
import os

SCOPES = ["https://www.googleapis.com/auth/drive"]

def authenticate():
    # 1. Delete the old broken token
    if os.path.exists("token.json"):
        os.remove("token.json")
        print("🗑️  Deleted old token.json (It was missing the refresh_token)")

    flow = InstalledAppFlow.from_client_secrets_file("client_secret.json", SCOPES)

    # 2. THE FIX: Add access_type='offline' and prompt='consent'
    # This forces Google to give us a permanent "Refresh Token"
    creds = flow.run_local_server(
        port=8080, 
        access_type='offline', 
        prompt='consent'
    )

    # 3. Save the new powerful token
    with open("token.json", "w") as token:
        token.write(creds.to_json())

    print("✅ Success! New 'token.json' saved with Refresh Token.")
    print("👉 You can now run the backend.")

if __name__ == "__main__":
    authenticate()