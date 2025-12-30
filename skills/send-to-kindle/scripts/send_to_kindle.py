#!/usr/bin/env python3
"""Send documents to Kindle via Gmail API."""

import argparse
import base64
import mimetypes
import os
import sys
from email.message import EmailMessage
from pathlib import Path

from auth import get_gmail_service

SUPPORTED_FORMATS = {
    ".pdf", ".doc", ".docx", ".txt", ".rtf",
    ".htm", ".html", ".png", ".gif", ".jpg",
    ".jpeg", ".bmp", ".epub"
}


def validate_file(file_path: Path) -> None:
    """Validate file exists and has supported format.

    Args:
        file_path: Path to the file to validate

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file format is not supported
    """
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = file_path.suffix.lower()
    if suffix not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format: {suffix}\n"
            f"Supported formats: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )


def get_kindle_email() -> str:
    """Get Kindle email address from environment.

    Returns:
        Kindle email address

    Raises:
        EnvironmentError: If KINDLE_EMAIL is not set
    """
    kindle_email = os.environ.get("KINDLE_EMAIL")
    if not kindle_email:
        raise EnvironmentError(
            "KINDLE_EMAIL environment variable not set.\n"
            "Set it to your Kindle email address:\n"
            "  export KINDLE_EMAIL='your-kindle@kindle.com'"
        )
    return kindle_email


def create_message_with_attachment(
    sender: str,
    to: str,
    subject: str,
    body: str,
    file_path: Path
) -> dict:
    """Create email message with file attachment.

    Args:
        sender: Sender email address
        to: Recipient email address
        subject: Email subject
        body: Email body text
        file_path: Path to file to attach

    Returns:
        Message dict ready for Gmail API
    """
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"

    maintype, subtype = mime_type.split("/", 1)

    # Read and attach file
    with open(file_path, "rb") as f:
        file_data = f.read()

    message.add_attachment(
        file_data,
        maintype=maintype,
        subtype=subtype,
        filename=file_path.name
    )

    # Encode for Gmail API
    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {"raw": encoded_message}


def send_to_kindle(file_path: str) -> dict:
    """Send a file to Kindle via Gmail.

    Args:
        file_path: Path to the file to send

    Returns:
        Gmail API response dict

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file format not supported
        EnvironmentError: If KINDLE_EMAIL not set
        Exception: If sending fails
    """
    path = Path(file_path).resolve()

    # Validate inputs
    validate_file(path)
    kindle_email = get_kindle_email()

    # Get Gmail service
    service = get_gmail_service()

    # Get sender email
    profile = service.users().getProfile(userId="me").execute()
    sender_email = profile["emailAddress"]

    # Create and send message
    message = create_message_with_attachment(
        sender=sender_email,
        to=kindle_email,
        subject=f"Send to Kindle: {path.name}",
        body=f"Document: {path.name}",
        file_path=path
    )

    result = service.users().messages().send(
        userId="me",
        body=message
    ).execute()

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Send documents to Kindle via Gmail"
    )
    parser.add_argument(
        "file",
        help="Path to the document file to send"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed output"
    )

    args = parser.parse_args()

    try:
        result = send_to_kindle(args.file)

        file_name = Path(args.file).name
        kindle_email = os.environ.get("KINDLE_EMAIL", "Kindle")

        print(f"Successfully sent '{file_name}' to {kindle_email}")

        if args.verbose:
            print(f"Message ID: {result.get('id')}")

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except EnvironmentError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Failed to send: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
