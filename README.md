# Face Detection, OTP & Biometric Registration Portal

FastAPI backend with InsightFace & SCRFD face detection, MobileFaceNet embeddings, secure email OTP verification via Gmail SMTP, and an integrated React + MediaPipe frontend.

## Requirements

- **Python**: 3.10 or newer
- **Node.js**: 18 or newer
- **ASP.NET Core Backend**: Monitoring System API running on `https://localhost:7062`

---

## Getting Started (Quick Run on Windows)

### 1. Configure Environment Secrets
Create a `.env` file in the root directory (you can copy `.env.example`):

```cmd
copy .env.example .env
```

Open `.env` and fill in your Gmail SMTP credentials:
```env
GMAIL_USER=monitoringsystem466@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
OTP_EXPIRE_SECONDS=300
RATE_LIMIT_SECONDS=60
MONITORING_API_URL=https://localhost:7062
```
> **Security Notice**: Never commit `.env` to GitHub. The `.gitignore` file is already configured to keep `.env` private.

---

### 2. Start the Backend API (FastAPI)
Double-click `start.bat` in the root folder, or run:

```powershell
.\start.bat
```
*(On first run, this automatically creates `.venv`, installs requirements, and launches `http://127.0.0.1:8100`)*.

---

### 3. Start the Frontend (Face Registration UI)
In a new terminal or by double-clicking:

```cmd
cd frontend
start.bat
```
*(On first run, this automatically installs `npm` dependencies and opens the web application on `http://127.0.0.1:5173`)*.

---

## API Endpoints

- **`POST /api/otp/send`**: Sends 6-digit verification code to user email.
- **`POST /api/otp/verify`**: Verifies 6-digit code and returns verification session token.
- **`POST /api/verify`**: Validates face image clarity, alignment, and enrollment suitability.
- **`POST /api/embedding`**: Generates 128-d MobileFaceNet biometric face embeddings.
- **`POST /registrationRequest`**: Proxies registration submissions to upstream ASP.NET backend.
