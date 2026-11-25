# Face Registration & Monitoring System Portal

Integrated biometrics enrollment application powered by the modern Face Analyzer UI and Google MediaPipe Face Landmarker.

## Features

- **Email OTP Verification**: Secure two-factor identity verification via Gmail SMTP before entering the portal.
- **Biometric Face Capture (Live Camera)**: Real-time pose, centering, lighting, chin-level, neutral expression, and eye-open checks. Mesh UI is removed so users see their natural face inside the oval alignment guide. Capture is only enabled when all quality conditions are green.
- **Photo Upload Verification**: Alternative fallback to upload and verify a photo file against the face quality service.
- **Member Registration Details**: Form capturing Member ID, Full Name, Verified Email (locked), Academic Year, and Student ID card photo.
- **Secure Integration**: Never exposes SMTP credentials or OTP codes to the frontend. All verification and email logic is strictly handled backend-side.

## Requirements

- Node.js 18+
- Backend Face Detection & OTP Server running at `http://127.0.0.1:8100`
- Monitoring System ASP.NET Core API at `https://localhost:7062`

## Running the Application

### 1. Start the Backend:
In `Face-Detection-API`:
```bat
start.bat
```

### 2. Start this Frontend:
In `UploadFace`:
```bat
start.bat
```
Or with npm:
```sh
npm run dev
```
Open `http://127.0.0.1:5173` in your browser.
