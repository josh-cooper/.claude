# Send to Kindle - Claude Code Skill

A Claude Code skill for sending documents to your Kindle device via Gmail. Claude automatically uses this skill when you mention sending files to Kindle.

## Quick Start

1. Set up Gmail API credentials (see below)
2. Install dependencies: `pip install -r ~/.claude/skills/send-to-kindle/scripts/requirements.txt`
3. Set your Kindle email: `export KINDLE_EMAIL="your-kindle@kindle.com"`
4. Ask Claude: "Send this PDF to my Kindle"

## Supported Formats

PDF, DOC, DOCX, TXT, RTF, HTM, HTML, PNG, GIF, JPG, JPEG, BMP, EPUB

## Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API**:
   - Go to APIs & Services > Library
   - Search for "Gmail API"
   - Click Enable

### 2. Create OAuth Credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal for Workspace)
   - Add your email as a test user
4. Application type: **Desktop app**
5. Download the JSON file
6. Save as `~/.claude/skills/send-to-kindle/credentials/credentials.json`

### 3. Set Environment Variable

Add your Kindle email address to your shell profile:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
export KINDLE_EMAIL="your-kindle@kindle.com"
```

Find your Kindle email at: [Amazon Manage Your Content and Devices](https://www.amazon.com/hz/mycd/myx#/home/settings/payment) > Preferences > Personal Document Settings

### 4. Add Sender to Approved List

Your Gmail address must be approved to send documents to your Kindle:

1. Go to [Amazon Personal Document Settings](https://www.amazon.com/hz/mycd/myx#/home/settings/payment)
2. Scroll to "Approved Personal Document E-mail List"
3. Add your Gmail address

### 5. Install Dependencies

```bash
pip install -r ~/.claude/skills/send-to-kindle/scripts/requirements.txt
```

### 6. Authenticate (First Run)

Run the auth script to complete OAuth flow:

```bash
python ~/.claude/skills/send-to-kindle/scripts/auth.py
```

A browser window will open for Google sign-in. After authorization, a token is saved locally.

## Usage

Claude automatically detects when to use this skill. Just ask naturally:

- "Send this PDF to my Kindle"
- "I want to read document.epub on my Kindle"
- "Transfer this file to my e-reader"

Or run directly:

```bash
python ~/.claude/skills/send-to-kindle/scripts/send_to_kindle.py /path/to/document.pdf
```

## File Structure

```
~/.claude/skills/send-to-kindle/
├── SKILL.md                    # Skill definition (auto-discovered by Claude)
├── README.md                   # This file
├── scripts/
│   ├── auth.py                 # OAuth2 authentication
│   ├── send_to_kindle.py       # Main send script
│   └── requirements.txt        # Python dependencies
└── credentials/
    ├── .gitignore              # Ignores credential files
    ├── credentials.json        # OAuth client (you create)
    └── token.json              # Auth token (auto-created)
```

## Troubleshooting

### "KINDLE_EMAIL environment variable not set"

Export your Kindle email address:
```bash
export KINDLE_EMAIL="your-kindle@kindle.com"
```

### "OAuth credentials not found"

Download credentials.json from Google Cloud Console and save to `~/.claude/skills/send-to-kindle/credentials/credentials.json`.

### "Authentication failed" or token issues

Delete the token and re-authenticate:
```bash
rm ~/.claude/skills/send-to-kindle/credentials/token.json
python ~/.claude/skills/send-to-kindle/scripts/auth.py
```

### Document not appearing on Kindle

- Verify your Gmail is in Kindle's approved senders list
- Check file size is under 25MB
- Some formats may take a few minutes to process

## Security Notes

- Credentials stored in `~/.claude/skills/send-to-kindle/credentials/` (not in any repo)
- OAuth tokens have minimal scope (gmail.send only)
- Personal skill scope means credentials are per-user, not shared
