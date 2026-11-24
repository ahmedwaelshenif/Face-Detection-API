import base64
import binascii
import os
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from app.face_service import FaceAnalysisError, analyze_image, extract_mobilefacenet_embedding
from app.otp_service import is_valid_email, send_otp_email, verify_otp_code, is_email_verified

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MONITORING_API_URL = os.getenv("MONITORING_API_URL", "https://localhost:7062").rstrip("/")

app = FastAPI(
    title="Face Detection & Registration API",
    description="Face verification, embeddings extraction, and secure email OTP verification.",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VerifyRequest(BaseModel):
    image: str = Field(description="Base64 image data, optionally as a data URL")


class EmbeddingRequest(BaseModel):
    image: str | None = Field(default=None, description="One base64 image, optionally as a data URL")
    images: list[str] | None = Field(default=None, description="Multiple base64 images, optionally as data URLs")


class SendOtpRequest(BaseModel):
    email: str = Field(description="Recipient email address")


class VerifyOtpRequest(BaseModel):
    email: str = Field(description="Recipient email address")
    otp: str = Field(description="6-digit verification code")


class CheckVerifiedRequest(BaseModel):
    email: str = Field(description="Recipient email address")
    token: str = Field(description="Verification session token")


def _response(accepted: bool, flaws: str, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"accepted": accepted, "flaws": flaws},
    )


@app.exception_handler(RequestValidationError)
async def invalid_request_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return _response(False, "Invalid request. Please check your input parameters.", 400)


# ==========================================
# OTP Endpoints
# ==========================================

@app.post("/api/otp/send")
def api_send_otp(payload: SendOtpRequest) -> JSONResponse:
    email = payload.email.strip()
    if not is_valid_email(email):
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid email address."})

    success, message = send_otp_email(email)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content={"success": success, "message": message})


@app.post("/api/otp/verify")
def api_verify_otp(payload: VerifyOtpRequest) -> JSONResponse:
    email = payload.email.strip()
    otp = payload.otp.strip()

    if not is_valid_email(email):
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid email address."})

    if not otp or len(otp) != 6 or not otp.isdigit():
        return JSONResponse(status_code=400, content={"success": False, "message": "Verification code must be 6 digits."})

    success, message, token = verify_otp_code(email, otp)
    if not success:
        return JSONResponse(status_code=400, content={"success": False, "message": message})

    return JSONResponse(status_code=200, content={
        "success": True,
        "verified": True,
        "message": message,
        "email": email.lower(),
        "token": token,
    })


@app.post("/api/otp/status")
def api_otp_status(payload: CheckVerifiedRequest) -> JSONResponse:
    verified = is_email_verified(payload.email, payload.token)
    return JSONResponse(status_code=200, content={"verified": verified})


# ==========================================
# Registration Request Forwarder (to ASP.NET)
# ==========================================

@app.post("/registrationRequest")
@app.post("/api/registrationRequest")
async def proxy_registration_request(request: Request):
    """Forwards registration requests to the ASP.NET Core monitoring backend."""
    target_url = f"{MONITORING_API_URL}/registrationRequest"
    content_type = request.headers.get("content-type", "")
    body = await request.body()

    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        target_url,
        data=body,
        headers={"Content-Type": content_type} if content_type else {},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            resp_body = resp.read()
            return Response(
                content=resp_body,
                status_code=resp.status,
                media_type=resp.headers.get("content-type", "application/json"),
            )
    except urllib.error.HTTPError as exc:
        err_body = exc.read()
        return Response(
            content=err_body,
            status_code=exc.code,
            media_type=exc.headers.get("content-type", "application/json"),
        )
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"error": f"Failed to forward request to monitoring service: {exc}"},
        )


# ==========================================
# Face Quality & Verification Endpoints
# ==========================================

@app.post("/api/verify")
def verify_face(payload: VerifyRequest) -> JSONResponse:
    encoded_image = payload.image.strip()

    if encoded_image.startswith("data:"):
        header, separator, encoded_image = encoded_image.partition(",")
        if not separator or ";base64" not in header.lower():
            return _response(False, "Image data URL must use base64 encoding.", 400)

    # Reject oversized requests before allocating a decoded copy.
    if len(encoded_image) > ((MAX_IMAGE_BYTES + 2) // 3) * 4:
        return _response(False, "Image is too large (maximum 10 MB).", 413)

    try:
        image_bytes = base64.b64decode(encoded_image, validate=True)
    except (binascii.Error, ValueError):
        return _response(False, "Image must be valid base64 data.", 400)

    if len(image_bytes) > MAX_IMAGE_BYTES:
        return _response(False, "Image is too large (maximum 10 MB).", 413)

    try:
        result: dict[str, Any] = analyze_image(image_bytes)
    except FaceAnalysisError as exc:
        return _response(False, str(exc), exc.status_code)

    if result.get("acceptable_for_enrollment"):
        return _response(True, "")

    quality = result.get("quality") or {}
    issues = quality.get("issues") or []
    if issues:
        flaws = "; ".join(issues)
    else:
        flaws = result.get("message") or "The image was not accepted."
    return _response(False, flaws)


# ==========================================
# Face Embedding Endpoint
# ==========================================

@app.post("/api/embedding")
def face_embedding(payload: EmbeddingRequest) -> JSONResponse:
    """Return embeddings for every detected face, without quality filtering."""
    if (payload.image is None) == (payload.images is None):
        return JSONResponse(status_code=400, content={"error": "Provide either 'image' or 'images'."})
    encoded_images = [payload.image] if payload.image is not None else payload.images
    if not encoded_images:
        return JSONResponse(status_code=400, content={"error": "'images' must contain at least one image."})

    decoded_images: list[bytes] = []
    for encoded_image in encoded_images:
        encoded_image = encoded_image.strip()
        if encoded_image.startswith("data:"):
            header, separator, encoded_image = encoded_image.partition(",")
            if not separator or ";base64" not in header.lower():
                return JSONResponse(status_code=400, content={"error": "Image data URL must use base64 encoding."})
        if len(encoded_image) > ((MAX_IMAGE_BYTES + 2) // 3) * 4:
            return JSONResponse(status_code=413, content={"error": "An image exceeds the 10 MB limit."})
        try:
            image_bytes = base64.b64decode(encoded_image, validate=True)
        except (binascii.Error, ValueError):
            return JSONResponse(status_code=400, content={"error": "Every image must be valid base64 data."})
        if len(image_bytes) > MAX_IMAGE_BYTES:
            return JSONResponse(status_code=413, content={"error": "An image exceeds the 10 MB limit."})
        decoded_images.append(image_bytes)

    results = []
    try:
        for image_bytes in decoded_images:
            face_embeddings = extract_mobilefacenet_embedding(image_bytes)
            results.append({
                "embeddings": [base64.b64encode(item).decode("ascii") for item in face_embeddings],
                "face_count": len(face_embeddings),
            })
    except FaceAnalysisError as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc)})

    return JSONResponse(content={
        "results": results,
        "dtype": "float32",
        "dimensions": 128,
        "encoding": "base64 little-endian byte[]",
    })
