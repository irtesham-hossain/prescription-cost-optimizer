"""
Live price lookup from MedEx with a headless browser (Playwright).

How it works:
  1. Brand IDs in our database are the same as MedEx brand IDs,
     so each brand page is https://medex.com.bd/brands/<brand_id>/
  2. Prices checked in the last CACHE_DAYS are reused (no new visit).
  3. Pages are visited slowly (DELAY_SECONDS apart) and at most
     MAX_BRANDS per request, to be polite to the site.
  4. A new row is saved in price_record with source = 'live'.
  5. If anything fails, nothing changes and the dataset price is used.

robots.txt of medex.com.bd (checked 8 Nov 2026): User-agent: *  Disallow: (nothing blocked)

Test from the backend folder:
    python live_price.py 10452
"""
import os
import re
import sys
import time
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

BASE_URL = "https://medex.com.bd/brands/{brand_id}/"
CACHE_DAYS = 7
DELAY_SECONDS = 3
MAX_BRANDS = 6
TIMEOUT_MS = 20000
USER_AGENT = "PrescriptionCostOptimizer/0.1 (IUB CSE398 student project)"

NUM = r"([\d,]+(?:\.\d+)?)"


def to_num(s: str) -> float:
    return float(s.replace(",", ""))


def parse_price_text(text: str):
    """Read the price from the page text.

    MedEx shows either 'Unit Price: ৳ 1.20' (tablets, capsules)
    or '100 ml bottle: ৳ 45.00' (syrups, creams and so on).
    Returns (unit_price, unit_label) or None.
    """
    m = re.search(r"Unit Price:\s*৳\s*" + NUM, text)
    if m:
        return to_num(m.group(1)), "unit"
    m = re.search(r"(\d+(?:\.\d+)?\s*(?:ml|gm|g|mg)\s+[A-Za-z ]{2,20}?):\s*৳\s*" + NUM, text)
    if m:
        return to_num(m.group(2)), m.group(1).strip()
    return None


def compare_price(unit_price: float, unit_label: str):
    """Same rule as data/clean.py: price per tablet, per ml or per gm."""
    if unit_label == "unit":
        return unit_price, "per unit"
    m = re.match(r"([\d.]+)\s*(ml|gm|g|mg)\b", unit_label)
    if m and float(m.group(1)) > 0:
        return round(unit_price / float(m.group(1)), 4), "per " + m.group(2)
    return unit_price, "per " + unit_label


def fresh_ids(cur, brand_ids: list[int]) -> set[int]:
    """Brands that already have a live price from the last CACHE_DAYS."""
    cur.execute(
        """SELECT DISTINCT brand_id FROM price_record
           WHERE source = 'live' AND brand_id = ANY(%s)
             AND fetched_at > NOW() - make_interval(days => %s)""",
        (brand_ids, CACHE_DAYS),
    )
    return {r[0] for r in cur.fetchall()}


def fetch_from_medex(brand_ids: list[int]) -> dict[int, dict]:
    """Open each brand page in one headless browser and read its price."""
    from playwright.sync_api import sync_playwright

    found = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        for i, brand_id in enumerate(brand_ids):
            if i:
                time.sleep(DELAY_SECONDS)
            url = BASE_URL.format(brand_id=brand_id)
            try:
                page.goto(url, timeout=TIMEOUT_MS, wait_until="domcontentloaded")
                parsed = parse_price_text(page.inner_text("body"))
            except Exception as exc:
                print(f"[live price] {brand_id}: {exc}")
                continue
            if not parsed:
                print(f"[live price] {brand_id}: no price found on page")
                continue
            unit_price, unit_label = parsed
            cp, cu = compare_price(unit_price, unit_label)
            found[brand_id] = {"unit_price": unit_price, "unit_label": unit_label,
                               "compare_price": cp, "compare_unit": cu, "url": page.url}
        browser.close()
    return found


def refresh_prices(brand_ids: list[int]) -> dict:
    """Update live prices for up to MAX_BRANDS brands. Safe to call any time."""
    brand_ids = list(dict.fromkeys(int(b) for b in brand_ids))[:MAX_BRANDS]
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cached = fresh_ids(cur, brand_ids)
        todo = [b for b in brand_ids if b not in cached]
        try:
            found = fetch_from_medex(todo) if todo else {}
        except Exception as exc:  # browser missing, site down and so on
            print(f"[live price] browser failed: {exc}")
            found = {}
        for brand_id, p in found.items():
            cur.execute(
                """INSERT INTO price_record
                   (brand_id, unit_price, unit_label, compare_price, compare_unit, source, source_url, fetched_at)
                   VALUES (%s, %s, %s, %s, %s, 'live', %s, NOW())""",
                (brand_id, p["unit_price"], p["unit_label"], p["compare_price"], p["compare_unit"], p["url"]),
            )
    return {"cached": sorted(cached), "updated": sorted(found), "failed": sorted(set(todo) - set(found))}


if __name__ == "__main__":
    ids = [int(x) for x in sys.argv[1:]] or [10452]
    print(fetch_from_medex(ids))
