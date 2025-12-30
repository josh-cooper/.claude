---
name: send-to-kindle
description: Send documents to Kindle via email. Use when user wants to send files to Kindle, read documents on Kindle, transfer ebooks, or send PDFs/EPUBs to their e-reader.
---

# Send to Kindle

Send documents to a Kindle device via Gmail API.

## Supported Formats

PDF, DOC, DOCX, TXT, RTF, HTM, HTML, PNG, GIF, JPG, JPEG, BMP, EPUB

## Pre-flight Checks

Before sending, verify setup is complete. Run these checks:

```bash
# Check all prerequisites at once
cd ~/.claude/skills/send-to-kindle && \
[ -d venv ] && source venv/bin/activate && python -c "import googleapiclient; import google_auth_oauthlib" 2>/dev/null && echo "Dependencies: OK" || echo "Dependencies: MISSING (run venv setup)" && \
[ -n "$KINDLE_EMAIL" ] && echo "KINDLE_EMAIL: $KINDLE_EMAIL" || echo "KINDLE_EMAIL: MISSING" && \
[ -f credentials/credentials.json ] && echo "OAuth credentials: OK" || echo "OAuth credentials: MISSING" && \
[ -f credentials/token.json ] && echo "Auth token: OK" || echo "Auth token: MISSING (run auth.py)"
```

## If Setup Incomplete

If any check shows MISSING, help the user complete setup:

### Dependencies missing
```bash
cd ~/.claude/skills/send-to-kindle && python3 -m venv venv && source venv/bin/activate && pip install -r scripts/requirements.txt
```

### KINDLE_EMAIL missing
Ask the user for their Kindle email address, then instruct them to set it:
```bash
export KINDLE_EMAIL="<their-email>@kindle.com"
```
Remind them to add this to their shell profile (~/.zshrc or ~/.bashrc) for persistence.

Find Kindle email at: Amazon > Manage Your Content and Devices > Preferences > Personal Document Settings

### OAuth credentials missing
Guide them through Google Cloud Console setup:
1. Go to https://console.cloud.google.com/
2. Create project and enable Gmail API
3. Create OAuth 2.0 Client ID (Desktop app)
4. Download JSON and save as `~/.claude/skills/send-to-kindle/credentials/credentials.json`

See README.md in the skill directory for detailed steps.

### First-time authentication
Once credentials.json exists:
```bash
cd ~/.claude/skills/send-to-kindle && source venv/bin/activate && python scripts/auth.py
```
This opens a browser for Google sign-in.

### Approved sender
User's Gmail must be added to Kindle's approved senders list in Amazon account settings.

## Sending a Document

Once setup is verified:

```bash
cd ~/.claude/skills/send-to-kindle && source venv/bin/activate && python scripts/send_to_kindle.py "<file_path>"
```

**Note:** If the file path contains special characters (`;`, `©`, commas, etc.), copy the file to a simpler filename first to avoid shell escaping issues.

Report success or failure to user.

## Troubleshooting

- **Auth error / "Insufficient Permission"**: Delete `~/.claude/skills/send-to-kindle/credentials/token.json` and re-run auth.py to re-authenticate with correct scopes
- **Not delivered**: Gmail must be in Kindle's approved senders list
- **File too large**: Must be under 25MB
- **File not found with special characters**: Copy file to a simpler filename without `;`, `©`, or other special characters
