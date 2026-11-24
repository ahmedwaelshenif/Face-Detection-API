import hashlib
import os
import re
import secrets
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# Load environment variables from .env if present
def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.is_file():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip("'\"")
                if key and key not in os.environ:
                    os.environ[key] = value

_load_env_file()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
GMAIL_USER = os.getenv("GMAIL_USER", "monitoringsystem466@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").strip()

OTP_EXPIRE_SECONDS = int(os.getenv("OTP_EXPIRE_SECONDS", "300"))
RATE_LIMIT_SECONDS = int(os.getenv("RATE_LIMIT_SECONDS", "60"))
MAX_ATTEMPTS = int(os.getenv("MAX_ATTEMPTS", "5"))
TOKEN_EXPIRE_SECONDS = 3600  # Verification token valid for 1 hour

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class OtpRecord:
    def __init__(self, code_hash: str, salt: str, expires_at: float):
        self.code_hash = code_hash
        self.salt = salt
        self.expires_at = expires_at
        self.created_at = time.time()
        self.attempts = 0
        self.used = False


class VerifiedToken:
    def __init__(self, email: str, expires_at: float):
        self.email = email
        self.expires_at = expires_at


# In-memory stores (normalized email -> record)
_otp_store: dict[str, OtpRecord] = {}
_verified_tokens: dict[str, VerifiedToken] = {}


def _hash_code(code: str, salt: str) -> str:
    return hashlib.sha256((salt + code).encode("utf-8")).hexdigest()


def is_valid_email(email: str) -> bool:
    if not email or len(email) > 254:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def send_otp_email(recipient_email: str) -> tuple[bool, str]:
    """Generates and sends a 6-digit OTP to the recipient email.

    Never returns the OTP code to callers.
    """
    recipient_email = recipient_email.strip().lower()
    if not is_valid_email(recipient_email):
        return False, "Please provide a valid email address."

    now = time.time()
    existing = _otp_store.get(recipient_email)
    if existing and not existing.used and (now - existing.created_at) < RATE_LIMIT_SECONDS:
        remaining = int(RATE_LIMIT_SECONDS - (now - existing.created_at))
        return False, f"Please wait {remaining} seconds before requesting a new code."

    # Generate 6-digit numeric OTP
    code = f"{secrets.randbelow(900000) + 100000}"
    salt = secrets.token_hex(16)
    code_hash = _hash_code(code, salt)
    expires_at = now + OTP_EXPIRE_SECONDS

    _otp_store[recipient_email] = OtpRecord(code_hash, salt, expires_at)

    app_password = GMAIL_APP_PASSWORD.replace(" ", "")
    if not app_password:
        return False, "Email service is not configured on the server."

    # Build email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Verification Code - Registration Request"
    msg["From"] = f"Monitoring System <{GMAIL_USER}>"
    msg["To"] = recipient_email

    text_content = (
        f"Your verification code is: {code}\n\n"
        f"This code will expire in {OTP_EXPIRE_SECONDS // 60} minutes.\n"
        "If you did not request this verification code, please ignore this email.\n"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #171615; color: #d6d1c9; margin: 0; padding: 24px; }}
    .card {{ max-width: 460px; margin: 0 auto; background: #1f1d1c; border: 1px solid #2e2c2a; border-radius: 20px; padding: 32px 28px; text-align: center; }}
    .title {{ font-size: 22px; font-weight: 700; color: #ebe6de; margin: 0 0 10px 0; }}
    .subtitle {{ font-size: 14px; color: #8a847c; margin: 0 0 24px 0; }}
    .code-box {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #93ad9c; background: #282624; border: 1px dashed #93ad9c; border-radius: 14px; padding: 16px; margin: 0 0 24px 0; user-select: all; }}
    .info {{ font-size: 13px; color: #8a847c; line-height: 1.5; margin: 0; }}
    .footer {{ font-size: 11px; color: #5f5a54; margin-top: 24px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1 class="title">Verification Code</h1>
    <p class="subtitle">Use this code to verify your email address and continue your registration request.</p>
    <div class="code-box">{code}</div>
    <p class="info">This code is valid for <strong>{OTP_EXPIRE_SECONDS // 60} minutes</strong> and can only be used once.<br>Never share this code with anyone.</p>
    <div class="footer">Monitoring System · Secure Registration Portal</div>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(GMAIL_USER, app_password)
            server.sendmail(GMAIL_USER, [recipient_email], msg.as_string())
        return True, "Verification code sent to your email."
    except Exception as exc:
        return False, f"Failed to send email: {exc}"


def verify_otp_code(recipient_email: str, code: str) -> tuple[bool, str, str | None]:
    """Verifies the OTP code for the given email.

    Enforces expiration, attempt limits, and single-use.
    Returns (success, message, verification_token).
    """
    recipient_email = recipient_email.strip().lower()
    code = code.strip()

    record = _otp_store.get(recipient_email)
    if not record:
        return False, "No verification code was requested for this email.", None

    now = time.time()
    if record.used:
        return False, "This verification code has already been used. Please request a new one.", None

    if now > record.expires_at:
        return False, "Verification code has expired. Please request a new one.", None

    if record.attempts >= MAX_ATTEMPTS:
        return False, "Too many failed attempts. Please request a new verification code.", None

    expected_hash = _hash_code(code, record.salt)
    if not secrets.compare_digest(record.code_hash, expected_hash):
        record.attempts += 1
        remaining = MAX_ATTEMPTS - record.attempts
        if remaining > 0:
            return False, f"Incorrect verification code. {remaining} attempt(s) remaining.", None
        return False, "Too many failed attempts. Please request a new verification code.", None

    # Mark as used immediately to prevent reuse
    record.used = True

    # Generate a verification token for this session
    token = secrets.token_urlsafe(32)
    _verified_tokens[token] = VerifiedToken(recipient_email, now + TOKEN_EXPIRE_SECONDS)

    return True, "Email verified successfully.", token


def is_email_verified(recipient_email: str, token: str | None) -> bool:
    """Checks whether the token is valid and belongs to the given email."""
    if not token:
        return False
    entry = _verified_tokens.get(token)
    if not entry:
        return False
    if time.time() > entry.expires_at:
        _verified_tokens.pop(token, None)
        return False
    return entry.email == recipient_email.strip().lower()
