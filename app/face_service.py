"""Face detection and clarity checks."""

from __future__ import annotations

import io
import os
from typing import Any
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from insightface.app import FaceAnalysis
from insightface.utils.face_align import norm_crop
import onnxruntime as ort

from app.quality import assess_face_quality


_face_analyzer: FaceAnalysis | None = None
_mobilefacenet_session: ort.InferenceSession | None = None


def _get_face_analyzer() -> FaceAnalysis:
    """Load InsightFace's SCRFD-10G detector once per process."""
    global _face_analyzer
    if _face_analyzer is None:
        # The buffalo_l model pack uses SCRFD-10GF for face detection. InsightFace
        # downloads the pack on first use into its standard model cache.
        _face_analyzer = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=["detection"],
            providers=["CPUExecutionProvider"],
        )
        # SCRFD scores can vary substantially with input scale. Run both a
        # smaller and standard input and let SCRFD's NMS keep the strongest box.
        _face_analyzer.prepare(ctx_id=-1, det_size=[(320, 320), (640, 640)])
    return _face_analyzer


class FaceAnalysisError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _read_image(file_bytes: bytes) -> np.ndarray:
    if not file_bytes:
        raise FaceAnalysisError("Empty upload", 400)
    if len(file_bytes) > 10 * 1024 * 1024:
        raise FaceAnalysisError("Image too large (max 10 MB)", 413)

    try:
        pil = Image.open(io.BytesIO(file_bytes))
        pil = pil.convert("RGB")
    except Exception as exc:
        raise FaceAnalysisError("Invalid image file") from exc

    rgb = np.array(pil)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def analyze_image(file_bytes: bytes) -> dict[str, Any]:
    image_bgr = _read_image(file_bytes)
    img_h, img_w = image_bgr.shape[:2]

    try:
        detected_faces = _get_face_analyzer().get(image_bgr)
    except Exception as exc:
        raise FaceAnalysisError(f"Face analysis failed: {exc}", 500) from exc

    if not detected_faces:
        return {
            "face_detected": False,
            "face_count": 0,
            "image_size": {"width": img_w, "height": img_h},
            "quality": None,
            "acceptable_for_enrollment": False,
            "message": "No face detected. Use a clear front-facing photo with good lighting.",
        }

    if len(detected_faces) > 1:
        return {
            "face_detected": True,
            "face_count": len(detected_faces),
            "image_size": {"width": img_w, "height": img_h},
            "quality": {"acceptable": False, "issues": ["Multiple faces detected (only 1 face allowed)"]},
            "acceptable_for_enrollment": False,
            "message": "Exactly one face is required.",
        }

    face = detected_faces[0]
    x1, y1, x2, y2 = (int(round(float(value))) for value in face.bbox)
    x, y = max(0, x1), max(0, y1)
    w, h = min(img_w, x2) - x, min(img_h, y2) - y
    confidence = float(face.det_score)
    landmarks = face.kps
    left_eye = (float(landmarks[0][0]), float(landmarks[0][1])) if landmarks is not None else None
    right_eye = (float(landmarks[1][0]), float(landmarks[1][1])) if landmarks is not None else None
    mouth_left = (float(landmarks[3][0]), float(landmarks[3][1])) if landmarks is not None else None
    mouth_right = (float(landmarks[4][0]), float(landmarks[4][1])) if landmarks is not None else None
    quality = assess_face_quality(
        image_bgr,
        x,
        y,
        w,
        h,
        confidence,
        left_eye=left_eye,
        right_eye=right_eye,
        mouth_left=mouth_left,
        mouth_right=mouth_right,
    )
    enrollment_ok = quality.acceptable
    message = (
        "One clear face detected."
        if enrollment_ok
        else "A face was detected, but it is not clear enough. " + "; ".join(quality.issues)
    )

    return {
        "face_detected": True,
        "face_count": 1,
        "image_size": {"width": img_w, "height": img_h},
        "facial_area": {"x": x, "y": y, "width": w, "height": h},
        "quality": {
            "acceptable": quality.acceptable,
            "issues": quality.issues,
            "blur_variance": quality.blur_variance,
            "brightness": quality.brightness,
            "face_size_px": {"width": quality.face_width, "height": quality.face_height},
            "detection_confidence": quality.detection_confidence,
            "visible_eye_count": quality.visible_eye_count,
            "open_eye_count": quality.open_eye_count,
            "full_face_visible": quality.full_face_visible,
            "mouth_visible": quality.mouth_visible,
        },
        "acceptable_for_enrollment": enrollment_ok,
        "message": message,
    }


def _get_mobilefacenet_session() -> ort.InferenceSession:
    global _mobilefacenet_session
    if _mobilefacenet_session is None:
        model_path = Path(os.environ.get("MOBILEFACENET_MODEL_PATH", "models/mobilefacenet.onnx"))
        if not model_path.is_file():
            raise FaceAnalysisError(
                f"MobileFaceNet ONNX model not found at '{model_path}'. Set MOBILEFACENET_MODEL_PATH to the model file.",
                500,
            )
        try:
            _mobilefacenet_session = ort.InferenceSession(
                str(model_path), providers=["CPUExecutionProvider"]
            )
        except Exception as exc:
            raise FaceAnalysisError(f"Could not load MobileFaceNet ONNX model: {exc}", 500) from exc
    return _mobilefacenet_session


def extract_mobilefacenet_embedding(file_bytes: bytes) -> list[bytes]:
    """Return one normalized float32 embedding for every detected face."""
    image_bgr = _read_image(file_bytes)
    try:
        faces = _get_face_analyzer().get(image_bgr)
    except Exception as exc:
        raise FaceAnalysisError(f"Face detection failed: {exc}", 500) from exc
    if not faces:
        return []

    try:
        session = _get_mobilefacenet_session()
        input_metas = session.get_inputs()
        input_meta = input_metas[0]
        shape = input_meta.shape
        # MobileFaceNet models commonly use [1, 3, 112, 112]; accept NCHW/NHWC.
        if len(shape) != 4:
            raise ValueError("Expected a four-dimensional image input")
        if isinstance(shape[1], int) and shape[1] == 3:
            nchw = True
            height = int(shape[2]) if isinstance(shape[2], int) else 112
            width = int(shape[3]) if isinstance(shape[3], int) else 112
        elif isinstance(shape[3], int) and shape[3] == 3:
            nchw = False
            height = int(shape[1]) if isinstance(shape[1], int) else 112
            width = int(shape[2]) if isinstance(shape[2], int) else 112
        else:
            raise ValueError("Expected a three-channel NCHW or NHWC image input")
        if width != height:
            raise ValueError("MobileFaceNet input must be square for face alignment")
        embeddings: list[bytes] = []
        img_h, img_w = image_bgr.shape[:2]
        for face in faces:
            landmarks = getattr(face, "kps", None)
            if landmarks is not None:
                aligned = norm_crop(image_bgr, landmarks, image_size=width)
            else:
                x1, y1, x2, y2 = (int(round(float(value))) for value in face.bbox)
                crop = image_bgr[max(0, y1):min(img_h, y2), max(0, x1):min(img_w, x2)]
                if crop.size == 0:
                    continue
                aligned = cv2.resize(crop, (width, height))

            rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB).astype(np.float32)
            # Qualcomm's published float model accepts RGB pixels in [0, 1].
            tensor = rgb / 255.0
            if nchw:
                tensor = np.transpose(tensor, (2, 0, 1))
            tensor = np.expand_dims(tensor, 0).astype(np.float32)
            # The published export takes two images and returns two embeddings.
            output = session.run(
                None, {meta.name: tensor for meta in input_metas}
            )[0]
            if output.ndim == 2:
                output = output[0]
            embedding = np.asarray(output, dtype=np.float32).reshape(-1)
            norm = float(np.linalg.norm(embedding))
            if embedding.size == 0 or not np.isfinite(embedding).all() or norm <= 0:
                raise ValueError("Model returned an invalid embedding")
            embeddings.append((embedding / norm).astype("<f4", copy=False).tobytes())
        return embeddings
    except FaceAnalysisError:
        raise
    except Exception as exc:
        raise FaceAnalysisError(f"MobileFaceNet inference failed: {exc}", 500) from exc
