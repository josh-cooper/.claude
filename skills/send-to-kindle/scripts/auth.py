#!/usr/bin/env python3
"""Gmail API OAuth2 authentication helper."""

import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"]

# Paths relative to project root
PROJECT_ROOT = Path(__file__).parent.parent
CREDENTIALS_DIR = PROJECT_ROOT / "credentials"
CREDENTIALS_FILE = CREDENTIALS_DIR / "credentials.json"
TOKEN_FILE = CREDENTIALS_DIR / "token.json"


def get_gmail_service():
    """Get authenticated Gmail API service.

    Returns:
        Gmail API service object

    Raises:
        FileNotFoundError: If credentials.json is missing
        Exception: If authentication fails
    """
    creds = None

    # Load existing token if available
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    # Refresh or get new credentials if needed
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_FILE.exists():
                raise FileNotFoundError(
                    f"OAuth credentials not found at {CREDENTIALS_FILE}\n"
                    "Please download credentials.json from Google Cloud Console:\n"
                    "1. Go to https://console.cloud.google.com/apis/credentials\n"
                    "2. Create OAuth 2.0 Client ID (Desktop app)\n"
                    "3. Download and save as credentials/credentials.json"
                )

            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_FILE), SCOPES
            )
            creds = flow.run_local_server(port=0)

        # Save token for future use
        CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


if __name__ == "__main__":
    # Test authentication
    try:
        service = get_gmail_service()
        print("Authentication successful!")

        # Get user's email address
        profile = service.users().getProfile(userId="me").execute()
        print(f"Authenticated as: {profile['emailAddress']}")
    except Exception as e:
        print(f"Authentication failed: {e}")
