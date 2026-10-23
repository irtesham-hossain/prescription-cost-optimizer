"""
Prescription scanner service for the Prescription Cost Optimizer.

FastAPI endpoint that takes a prescription photo, reads it with Gemini,
and returns a structured medicine list with a confidence colour per item
(green / amber / red) for the confirmation screen.

Run locally:
    export GEMINI_API_KEY="your-key"
    uvicorn scanner:app --reload

The photo is processed in memory only and is never saved to disk.
"""

import io
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from PIL import Image, ImageOps
from pydantic import BaseModel, Field
from rapidfuzz import fuzz, process
import psycopg
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Check https://ai.google.dev/gemini-api/docs/models for the current Flash model name.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
MAX_UPLOAD_BYTES = 8 * 1024 * 1024   # 8 MB raw upload limit
MAX_SIDE_PX = 1600                   # resize before sending to Gemini
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

client = genai.Client()  # reads GEMINI_API_KEY from the environment

app = FastAPI(title="Prescription Scanner")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Output schema Gemini must follow
# (plain str fields with "" for missing values; Gemini's schema mode
#  handles these more reliably than Optional/Union types)
# ---------------------------------------------------------------------------


class Medicine(BaseModel):
    raw_text: str = Field(description="The line exactly as written on the prescription")
    brand_name: str = Field(description="Medicine brand name as best read, e.g. Napa, Seclo, Fexo")
    strength: str = Field(description="e.g. '500 mg', '10 mg/5 ml'. Empty string if not written")
    dosage_form: str = Field(
        description="One of: tablet, capsule, syrup, suspension, injection, drops, cream, inhaler, other"
    )
    dose_pattern: str = Field(description="Bangladeshi pattern like '1+0+1' or '0+0+1'. Empty if not written")
    meal_timing: str = Field(description="One of: before_meal, after_meal, with_meal, unknown")
    duration: str = Field(description="e.g. '7 days', '1 month', 'continue'. Empty if not written")
    confidence: float = Field(description="0.0 to 1.0, how sure you are about brand_name")


class ScanResult(BaseModel):
    is_prescription: bool = Field(description="False if the image is not a medical prescription")
    image_quality: str = Field(description="One of: good, blurry, dark, cropped")
    medicines: list[Medicine]


PROMPT = """You are reading a handwritten or printed medical prescription from Bangladesh.

Extract every medicine line. Rules:
- Prescriptions mix Bangla and English. Brand names are usually in English.
- Dosage is often written as 1+0+1 (morning+noon+night) or 0+0+1.
- "খাবার পরে" or "after meal" means after_meal; "খাবার আগে" or "before meal" means before_meal.
- Tab / Cap / Syp / Susp / Inj are dosage form abbreviations.
- Ignore patient name, age, doctor name, chamber address, tests and advice lines.
- Never guess a brand you cannot read. Give your best reading and a low confidence instead.
- If the image is not a prescription, set is_prescription to false and return an empty list.
"""

# ---------------------------------------------------------------------------
# Brand catalogue, read once from the database and kept in memory
# ---------------------------------------------------------------------------

_BRANDS: list[str] = []


def load_brand_names() -> list[str]:
    global _BRANDS
    if not _BRANDS:
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            rows = conn.execute("SELECT DISTINCT brand_name FROM brand").fetchall()
        _BRANDS = [r[0] for r in rows]
    return _BRANDS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def preprocess(image_bytes: bytes) -> bytes:
    """Fix phone rotation, convert to RGB, shrink, re-encode as JPEG."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open the image file.")
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((MAX_SIDE_PX, MAX_SIDE_PX))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


def read_prescription(jpeg_bytes: bytes) -> ScanResult:
    """Send the image to Gemini and get back a validated ScanResult."""
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                PROMPT,
            ],
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema=ScanResult,
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scanner service error: {exc}")

    if response.parsed is not None:
        return response.parsed
    try:
        return ScanResult.model_validate_json(response.text)
    except Exception:
        raise HTTPException(status_code=502, detail="Scanner returned an unreadable result.")


def match_to_catalogue(med: Medicine, brands: list[str]) -> dict:
    """Fuzzy match the AI reading to a real brand and assign a card colour."""
    best = process.extractOne(med.brand_name, brands, scorer=fuzz.WRatio)
    matched, score = (best[0], best[1]) if best else ("", 0)

    if med.confidence >= 0.85 and score >= 90:
        status = "green"      # confident, no action needed
    elif score >= 75:
        status = "amber"      # user must confirm
    else:
        status = "red"        # user must pick from search
        matched = ""

    return {
        **med.model_dump(),
        "matched_brand": matched,
        "match_score": round(score, 1),
        "status": status,
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@app.post("/scan")
async def scan(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Please upload a JPEG, PNG, WebP or HEIC photo.")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large (max 8 MB).")

    jpeg = preprocess(raw)
    del raw  # nothing is written to disk; drop the original bytes

    result = read_prescription(jpeg)

    if not result.is_prescription:
        return {"ok": False, "reason": "not_prescription",
                "message": "This doesn't look like a prescription. Try again?"}
    if not result.medicines:
        return {"ok": False, "reason": "unreadable", "image_quality": result.image_quality,
                "message": "Couldn't read any medicines. Retake the photo or type them in."}

    brands = load_brand_names()
    items = [match_to_catalogue(m, brands) for m in result.medicines]

    return {
        "ok": True,
        "image_quality": result.image_quality,
        "needs_review": any(i["status"] != "green" for i in items),
        "medicines": items,
    }
