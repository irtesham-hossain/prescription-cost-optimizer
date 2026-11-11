"""
Prescription Cost Optimizer: prototype API.

Adds two endpoints to the scanner app:
    POST /alternatives   cheaper brands with the same generic, strength and form
    GET  /search?q=napa  find a medicine by name (for fixing red cards)

Run from the backend folder:
    uvicorn main:app --reload
"""
import os
import re
from decimal import Decimal

import psycopg
from fastapi import HTTPException, Query
from psycopg.rows import dict_row
from pydantic import BaseModel

from scanner import app  # same app, so /scan keeps working

# Quality score for each manufacturer tier (1 = largest companies)
QUALITY = {1: 1.0, 2: 0.6, 3: 0.3}

# Weights for the Recommended score
W_PRICE, W_QUALITY, W_AVAIL = 0.5, 0.3, 0.2


def db():
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)


def num(x):
    return float(x) if isinstance(x, Decimal) else x


def digits(text: str) -> list[str]:
    """'500 mg' -> ['500'], so strengths can be compared."""
    return re.findall(r"\d+(?:\.\d+)?", text or "")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class MedicineIn(BaseModel):
    brand_name: str
    strength: str = ""
    dosage_form: str = ""
    dose_pattern: str = ""
    duration: str = ""


class AlternativesRequest(BaseModel):
    medicines: list[MedicineIn]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def units_needed(pattern: str, duration: str) -> int:
    """'1+0+1' for '7 days' -> 14 tablets. Returns 0 when it cannot tell."""
    if not re.fullmatch(r"\s*\d+(\s*\+\s*\d+)+\s*", pattern or ""):
        return 0
    per_day = sum(int(x) for x in re.findall(r"\d+", pattern))
    m = re.search(r"(\d+)\s*(day|week|month)", duration or "", re.I)
    if not m:
        return 0
    days = int(m.group(1)) * {"day": 1, "week": 7, "month": 30}[m.group(2).lower()]
    return per_day * days


def find_brand(cur, med: MedicineIn):
    """Find the prescribed brand, preferring the row whose strength and form match."""
    sql = """
        SELECT b.brand_id, b.brand_name, b.group_id, e.strength, e.dosage_form,
               g.generic_name, g.no_substitute
        FROM brand b
        JOIN equivalence_group e ON e.group_id = b.group_id
        JOIN generic g ON g.generic_id = e.generic_id
        WHERE {where}
        LIMIT 20
    """
    cur.execute(sql.format(where="lower(b.brand_name) = lower(%s)"), (med.brand_name,))
    rows = cur.fetchall()
    if not rows:  # spelling slightly off: use fuzzy search
        cur.execute(
            sql.format(where="b.brand_name %% %s ORDER BY similarity(b.brand_name, %s) DESC"),
            (med.brand_name, med.brand_name),
        )
        rows = cur.fetchall()
    if not rows:
        return None

    want_strength = digits(med.strength)
    want_form = (med.dosage_form or "").lower()

    def fit(r):
        return (
            bool(want_strength) and digits(r["strength"]) == want_strength,
            bool(want_form) and want_form in r["dosage_form"].lower(),
        )

    return max(rows, key=fit)


def group_options(cur, group_id: int) -> list[dict]:
    """Every brand in the group with its newest price."""
    cur.execute(
        """
        SELECT DISTINCT ON (b.brand_id)
               b.brand_id, b.brand_name, m.name AS manufacturer, m.quality_tier,
               b.availability_score, p.compare_price, p.compare_unit,
               p.unit_price, p.unit_label, p.source, p.fetched_at
        FROM brand b
        JOIN manufacturer m ON m.manufacturer_id = b.manufacturer_id
        JOIN price_record p ON p.brand_id = b.brand_id
        WHERE b.group_id = %s AND p.compare_price > 0
        ORDER BY b.brand_id, p.fetched_at DESC
        """,
        (group_id,),
    )
    return cur.fetchall()


def as_option(o: dict) -> dict:
    return {
        "brand_id": o["brand_id"],
        "brand": o["brand_name"],
        "manufacturer": o["manufacturer"],
        "price": round(num(o["compare_price"]), 2),
        "unit": o["compare_unit"],
        "pack_price": num(o["unit_price"]),
        "pack_label": o["unit_label"],
        "source": o["source"],
        "date": o["fetched_at"].date().isoformat() if o["fetched_at"] else None,
    }


def rank(options: list[dict], prescribed: dict, no_substitute: bool) -> dict:
    """Pick Cheapest, Best and Recommended."""
    prices = [num(o["compare_price"]) for o in options]
    hi, lo = max(prices), min(prices)

    def score(o):
        # Min-max normalised price: cheapest = 1, most expensive = 0
        price_score = 1.0 if hi == lo else (hi - num(o["compare_price"])) / (hi - lo)
        quality = QUALITY.get(o["quality_tier"], 0.3)
        avail = num(o["availability_score"]) or 1.0
        return W_PRICE * price_score + W_QUALITY * quality + W_AVAIL * avail

    cheapest = min(options, key=lambda o: num(o["compare_price"]))
    best = min(options, key=lambda o: (o["quality_tier"] or 3, num(o["compare_price"])))
    recommended = prescribed if no_substitute else max(options, key=score)
    return {"cheapest": cheapest, "best": best, "recommended": recommended}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/")
def health():
    return {"ok": True, "message": "Prescription Cost Optimizer API is running"}


@app.post("/alternatives")
def alternatives(req: AlternativesRequest):
    if not req.medicines:
        raise HTTPException(status_code=400, detail="Send at least one medicine.")

    results, total_saving = [], 0.0
    with db() as conn, conn.cursor() as cur:
        for med in req.medicines:
            brand = find_brand(cur, med)
            if not brand:
                results.append({"input": med.brand_name, "found": False})
                continue

            options = group_options(cur, brand["group_id"])
            prescribed = next((o for o in options if o["brand_id"] == brand["brand_id"]), None)
            if not prescribed:
                results.append({"input": med.brand_name, "found": False,
                                "reason": "No price for this brand"})
                continue

            # Compare like with like: per tablet with per tablet, per ml with per ml
            options = [o for o in options if o["compare_unit"] == prescribed["compare_unit"]]
            picks = rank(options, prescribed, brand["no_substitute"])

            # How many units the prescription needs
            if prescribed["compare_unit"] == "per unit":
                qty = units_needed(med.dose_pattern, med.duration) or 1
            else:  # liquids and creams: one pack of the prescribed size
                size = digits(prescribed["unit_label"] or "")
                qty = float(size[0]) if size else 1

            saving = (num(prescribed["compare_price"]) - num(picks["recommended"]["compare_price"])) * qty
            total_saving += max(saving, 0)

            results.append({
                "input": med.brand_name,
                "found": True,
                "generic": brand["generic_name"],
                "strength": brand["strength"],
                "dosage_form": brand["dosage_form"],
                "no_substitute": brand["no_substitute"],
                "quantity": qty,
                "prescribed": as_option(prescribed),
                "cheapest": as_option(picks["cheapest"]),
                "best": as_option(picks["best"]),
                "recommended": as_option(picks["recommended"]),
                "all_options": [as_option(o) for o in sorted(options, key=lambda o: num(o["compare_price"]))],
                "saving": round(max(saving, 0), 2),
            })

    return {"total_saving": round(total_saving, 2), "medicines": results}


@app.get("/search")
def search(q: str = Query(..., min_length=2)):
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT b.brand_name, e.strength, e.dosage_form, m.name AS manufacturer
            FROM brand b
            JOIN equivalence_group e ON e.group_id = b.group_id
            JOIN manufacturer m ON m.manufacturer_id = b.manufacturer_id
            WHERE b.brand_name ILIKE %s OR b.brand_name %% %s
            ORDER BY (b.brand_name ILIKE %s) DESC, similarity(b.brand_name, %s) DESC
            LIMIT 12
            """,
            (q + "%", q, q + "%", q),
        )
        return {"results": cur.fetchall()}


# ---------------------------------------------------------------------------
# Live prices (headless browser)
# ---------------------------------------------------------------------------


class LivePriceRequest(BaseModel):
    brand_ids: list[int]


@app.post("/live-prices")
def live_prices(req: LivePriceRequest):
    """Check today's price on MedEx for a few brands, then call /alternatives again."""
    from live_price import refresh_prices

    if not req.brand_ids:
        return {"cached": [], "updated": [], "failed": []}
    return refresh_prices(req.brand_ids)


# ---------------------------------------------------------------------------
# Saved prescriptions (no login yet: keyed by an anonymous device id)
# ---------------------------------------------------------------------------
import json
import uuid as _uuid


class SaveRequest(BaseModel):
    device_id: str
    title: str = ""
    medicines: list[dict]
    results: dict


def _check_device(device_id: str) -> str:
    try:
        return str(_uuid.UUID(device_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device id.")


@app.post("/prescriptions")
def save_prescription(req: SaveRequest):
    device = _check_device(req.device_id)
    title = req.title or ", ".join(
        (m.get("matched_brand") or m.get("brand_name") or "") for m in req.medicines
    )[:200]
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """INSERT INTO scan_session (device_id, title, medicines, results, total_saving, status)
               VALUES (%s, %s, %s, %s, %s, 'saved')
               RETURNING scan_id, created_at""",
            (device, title, json.dumps(req.medicines), json.dumps(req.results),
             req.results.get("total_saving", 0)),
        )
        row = cur.fetchone()
    return {"id": str(row["scan_id"]), "created_at": row["created_at"].isoformat()}


@app.get("/prescriptions")
def list_prescriptions(device_id: str):
    device = _check_device(device_id)
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT scan_id, title, created_at, total_saving, medicines, results
               FROM scan_session WHERE device_id = %s AND status = 'saved'
               ORDER BY created_at DESC LIMIT 50""",
            (device,),
        )
        rows = cur.fetchall()
    return {"prescriptions": [
        {"id": str(r["scan_id"]), "title": r["title"], "created_at": r["created_at"].isoformat(),
         "total_saving": num(r["total_saving"]) or 0, "medicines": r["medicines"], "results": r["results"]}
        for r in rows
    ]}


@app.delete("/prescriptions/{scan_id}")
def delete_prescription(scan_id: str, device_id: str):
    device = _check_device(device_id)
    with db() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM scan_session WHERE scan_id = %s AND device_id = %s",
                    (_check_device(scan_id), device))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Not found.")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Featured (sponsored) pharmacies
# ---------------------------------------------------------------------------


@app.get("/featured-pharmacies")
def featured_pharmacies():
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT pharmacy_id, name, address, phone, latitude, longitude
               FROM featured_pharmacy WHERE active ORDER BY pharmacy_id LIMIT 3"""
        )
        rows = cur.fetchall()
    return {"pharmacies": [{**r, "latitude": num(r["latitude"]), "longitude": num(r["longitude"])} for r in rows]}
