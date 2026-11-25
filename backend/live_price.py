"""
Live price lookup from MedEx.

How it works:
  1. Brand IDs in our database are the same as MedEx brand IDs,
     so each brand page is https://medex.com.bd/brands/<brand_id>/
  2. If that page fails, shows no price, or is for a different medicine,
     we search MedEx by name and open the result with the same name,
     strength and dosage form (the fallback). Sponsored results are skipped.
  3. Prices checked in the last CACHE_DAYS are reused (no new visit).
  4. Brands wait in a queue and ONE background worker checks them one at a
     time, DELAY_SECONDS apart, so MedEx never gets more than one request
     at a time from us. The API returns at once; the app asks for progress.
  5. A new row is saved in price_record with source = 'live'.
  6. If anything fails, nothing changes and the dataset price is used.
     A failed brand is not tried again for FAIL_RETRY_HOURS.

The price is part of the page's plain HTML, so a normal HTTP request is
enough. No headless browser is needed, which means this works on Windows
and on Render's free tier with no extra installs (only the standard library).

robots.txt of medex.com.bd (checked 8 Nov 2026): User-agent: *  Disallow: (nothing blocked)

Test from the backend folder:
    python live_price.py 7630 28439                          by ID (names come from the database if DATABASE_URL is set)
    python live_price.py --name "Roxim" "200 mg" "Capsule"   by name only
"""
import collections
import html
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

BASE_URL = "https://medex.com.bd/brands/{brand_id}/"
SEARCH_URL = "https://medex.com.bd/search?search={query}"
CACHE_DAYS = 7
DELAY_SECONDS = float(os.getenv("LIVE_DELAY_SECONDS", "2"))  # gap between two MedEx requests
MAX_PER_CALL = 400          # brands accepted in one /live-prices call
MAX_QUEUE = 3000            # brands waiting in total
FAIL_RETRY_HOURS = 6
TIMEOUT_SECONDS = 15
USER_AGENT = "PrescriptionCostOptimizer/0.3 (IUB CSE398 student project)"

NUM = r"([\d,]+(?:\.\d+)?)"
TAKA = r"(?:৳|Tk\.?)"

# Main dosage form words, so a tablet is never matched to a capsule and so on
FORM_WORDS = {"tablet", "capsule", "syrup", "suspension", "injection", "infusion", "drop",
              "cream", "ointment", "gel", "lotion", "suppository", "inhaler", "spray",
              "solution", "powder", "granule", "sachet", "patch", "shampoo", "soap"}


# ---------------------------------------------------------------------------
# Reading a page
# ---------------------------------------------------------------------------

def to_num(s: str) -> float:
    return float(s.replace(",", ""))


def page_text(raw_html: str) -> str:
    """Turn the page HTML into plain text with single spaces."""
    text = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", raw_html)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text)


def parse_price_text(text: str):
    """Read the price from the page text.

    MedEx shows either 'Unit Price: ৳ 44.00 (2 x 8: ৳ 704.00)' (tablets, capsules)
    or '60 ml bottle (Mixed fruit flavour): ৳ 35.00' (syrups, creams and so on).
    The first price on the page is the brand's own pack.
    Returns (unit_price, unit_label) or None.
    """
    m = re.search(r"Unit Price\s*:\s*" + TAKA + r"\s*" + NUM, text)
    if m:
        return to_num(m.group(1)), "unit"
    m = re.search(
        r"(\d+(?:\.\d+)?\s*(?:ml|gm|g|mg)\s+[A-Za-z][A-Za-z ]{1,19}?)"  # '60 ml bottle'
        r"\s*(?:\([^)]{0,60}\))?"                                        # '(Mixed fruit flavour)'
        r"\s*:\s*" + TAKA + r"\s*" + NUM,
        text,
    )
    if m:
        return to_num(m.group(2)), re.sub(r"\s+", " ", m.group(1)).strip()
    return None


def compare_price(unit_price: float, unit_label: str):
    """Same rule as data/clean.py: price per tablet, per ml or per gm."""
    if unit_label == "unit":
        return unit_price, "per unit"
    m = re.match(r"([\d.]+)\s*(ml|gm|g|mg)\b", unit_label)
    if m and float(m.group(1)) > 0:
        return round(unit_price / float(m.group(1)), 4), "per " + m.group(2)
    return unit_price, "per " + unit_label


# ---------------------------------------------------------------------------
# Polite fetching
# ---------------------------------------------------------------------------

_last_request = 0.0


def fetch_page(url: str) -> str:
    """GET a page, waiting DELAY_SECONDS after the previous request."""
    global _last_request
    wait = _last_request + DELAY_SECONDS - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html",
        "Accept-Language": "en",
    })
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as r:
            charset = r.headers.get_content_charset() or "utf-8"
            return r.read().decode(charset, errors="replace")
    finally:
        _last_request = time.monotonic()


# ---------------------------------------------------------------------------
# Finding a brand by name (fallback)
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def _words(s: str) -> set[str]:
    """'Pediatric Drops' -> {'pediatric', 'drop'} (plural s removed)."""
    return {w[:-1] if w.endswith("s") and len(w) > 3 else w for w in slugify(s).split("-") if w}


def match_search_results(raw_html: str, name: str, strength: str = "", form: str = ""):
    """Pick the search result with the same name, strength and form.

    MedEx result links look like /brands/7630/roxim-200-mg-capsule, so the
    link itself tells us the name, the first strength number and the form.
    Sponsored results use a redirect link (/to/...), so they never match.
    Returns (medex_id, url) or None.
    """
    links = re.findall(r"""href=["'](?:https?://(?:www\.)?medex\.com\.bd)?/brands/(\d+)/([a-z0-9-]+)[/?"']""", raw_html)
    want_name = slugify(name)
    nums = re.findall(r"\d+(?:\.\d+)?", strength or "")
    want_num = slugify(nums[0]) if nums else None
    want_form = _words(form)
    want_core = want_form & FORM_WORDS

    for medex_id, slug in dict.fromkeys(links):  # keeps order, drops repeats
        if not slug.startswith(want_name + "-"):
            continue  # 'roximax-...' is not 'roxim'
        rest = slug[len(want_name) + 1:]
        if want_num:
            if rest != want_num and not rest.startswith(want_num + "-"):
                continue  # different strength, or 'roxim-xl-...'
        elif not rest[:1].isdigit():
            continue  # 'roxim-xl-...' when we do not know the strength
        have = _words(rest)
        if want_core and not (want_core & have):
            continue  # tablet vs capsule and so on
        if want_form and not (want_form & have):
            continue
        return int(medex_id), f"https://medex.com.bd/brands/{medex_id}/{slug}"
    return None


def find_by_name(name: str, strength: str = "", form: str = ""):
    """Search MedEx by brand name. Returns (medex_id, url) or None."""
    raw = fetch_page(SEARCH_URL.format(query=urllib.parse.quote(name)))
    return match_search_results(raw, name, strength, form)


# ---------------------------------------------------------------------------
# Checking prices
# ---------------------------------------------------------------------------

def _price_from(url: str, name: str = ""):
    """Open a brand page. Returns (price dict, None) or (None, reason)."""
    try:
        text = page_text(fetch_page(url))
    except urllib.error.HTTPError as exc:
        return None, f"HTTP {exc.code}"
    except Exception as exc:  # no internet, timeout and so on
        return None, f"{type(exc).__name__}: {exc}"
    if name and name.lower() not in text.lower():
        return None, "page is for a different medicine"
    parsed = parse_price_text(text)
    if not parsed:
        return None, "no price found on page"
    unit_price, unit_label = parsed
    cp, cu = compare_price(unit_price, unit_label)
    return {"unit_price": unit_price, "unit_label": unit_label,
            "compare_price": cp, "compare_unit": cu, "url": url}, None


def check_brand(brand: dict):
    """brand = {'brand_id', 'brand_name', 'strength', 'dosage_form'}; only brand_id is required.

    Returns (price dict, None) or (None, reason).
    """
    name = brand.get("brand_name") or ""
    found, reason = _price_from(BASE_URL.format(brand_id=brand["brand_id"]), name)
    if found:
        found["via"] = "id"
        return found, None
    if not name:
        return None, reason

    # Fallback: search by name
    try:
        hit = find_by_name(name, brand.get("strength") or "", brand.get("dosage_form") or "")
    except Exception as exc:
        return None, f"{reason}; name search failed ({type(exc).__name__}: {exc})"
    if not hit:
        return None, f"{reason}; no search result with the same name, strength and form"
    found, reason2 = _price_from(hit[1], name)
    if not found:
        return None, f"{reason}; by name: {reason2}"
    found["via"] = "name"
    return found, None


def fetch_from_medex(brands: list[dict]) -> tuple[dict[int, dict], dict[int, str]]:
    """Check each brand. Returns (found, errors), both keyed by our brand_id."""
    found, errors = {}, {}
    for b in brands:
        price, reason = check_brand(b)
        if price:
            found[b["brand_id"]] = price
            if price["via"] == "name":
                print(f"[live price] {b['brand_id']}: found by name at {price['url']}")
        else:
            errors[b["brand_id"]] = reason
            print(f"[live price] {b['brand_id']}: {reason}")
    return found, errors


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def brand_details(cur, brand_ids: list[int]) -> list[dict]:
    """Name, strength and form of each brand, in the order asked."""
    cur.execute(
        """SELECT b.brand_id, b.brand_name, e.strength, e.dosage_form
           FROM brand b JOIN equivalence_group e ON e.group_id = b.group_id
           WHERE b.brand_id = ANY(%s)""",
        (brand_ids,),
    )
    rows = {r[0]: {"brand_id": r[0], "brand_name": r[1], "strength": r[2], "dosage_form": r[3]}
            for r in cur.fetchall()}
    return [rows.get(i, {"brand_id": i}) for i in brand_ids]


def fresh_ids(cur, brand_ids: list[int]) -> set[int]:
    """Brands that already have a live price from the last CACHE_DAYS."""
    cur.execute(
        """SELECT DISTINCT brand_id FROM price_record
           WHERE source = 'live' AND brand_id = ANY(%s)
             AND fetched_at > NOW() - make_interval(days => %s)""",
        (brand_ids, CACHE_DAYS),
    )
    return {r[0] for r in cur.fetchall()}


def save_price(cur, brand_id: int, p: dict):
    cur.execute(
        """INSERT INTO price_record
           (brand_id, unit_price, unit_label, compare_price, compare_unit, source, source_url, fetched_at)
           VALUES (%s, %s, %s, %s, %s, 'live', %s, NOW())""",
        (brand_id, p["unit_price"], p["unit_label"], p["compare_price"], p["compare_unit"], p["url"]),
    )


# ---------------------------------------------------------------------------
# Background queue: one worker thread checks brands one at a time
# ---------------------------------------------------------------------------

_queue: "collections.OrderedDict[int, dict]" = collections.OrderedDict()  # brand_id -> details
_failed: dict[int, tuple[str, float]] = {}  # brand_id -> (reason, when)
_current: int | None = None
_lock = threading.Lock()
_wake = threading.Event()
_worker: threading.Thread | None = None


def _db():
    import psycopg
    return psycopg.connect(os.environ["DATABASE_URL"])


def _recently_failed(brand_id: int) -> bool:
    hit = _failed.get(brand_id)
    return bool(hit) and time.time() - hit[1] < FAIL_RETRY_HOURS * 3600


def _work():
    global _current
    while True:
        with _lock:
            if _queue:
                brand_id, details = _queue.popitem(last=False)
                _current = brand_id
            else:
                details = None
        if details is None:
            _wake.wait()
            _wake.clear()
            continue
        try:
            price, reason = check_brand(details)
            if price:
                with _db() as conn, conn.cursor() as cur:
                    save_price(cur, brand_id, price)
                _failed.pop(brand_id, None)
                if price["via"] == "name":
                    print(f"[live price] {brand_id}: found by name at {price['url']}")
            else:
                _failed[brand_id] = (reason, time.time())
                print(f"[live price] {brand_id}: {reason}")
        except Exception as exc:  # database down and so on: keep the worker alive
            _failed[brand_id] = (f"{type(exc).__name__}: {exc}", time.time())
            print(f"[live price] {brand_id}: {type(exc).__name__}: {exc}")
        finally:
            with _lock:
                _current = None


def _ensure_worker():
    global _worker
    with _lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_work, name="live-price-worker", daemon=True)
            _worker.start()


def _clean_ids(brand_ids) -> list[int]:
    return list(dict.fromkeys(int(b) for b in brand_ids))[:MAX_PER_CALL]


def enqueue(brand_ids: list[int], priority: int = 0) -> dict:
    """Queue brands for a live check and return their status at once.

    brand_ids are checked in the order given. The first `priority` of them
    (for example the Cheapest, Best and Recommended picks) jump ahead of
    everything already waiting.
    """
    ids = _clean_ids(brand_ids)
    with _db() as conn, conn.cursor() as cur:
        fresh = fresh_ids(cur, ids)
        todo = [i for i in ids if i not in fresh and not _recently_failed(i)]
        with _lock:
            todo = [i for i in todo if i != _current]
        details = {d["brand_id"]: d for d in brand_details(cur, todo)}
    urgent = set(ids[:max(priority, 0)])
    with _lock:
        for i in todo:
            if i not in _queue and len(_queue) < MAX_QUEUE:
                _queue[i] = details.get(i, {"brand_id": i})
        for i in reversed([i for i in todo if i in urgent and i in _queue]):
            _queue.move_to_end(i, last=False)
    _ensure_worker()
    _wake.set()
    return status(ids)


def status(brand_ids: list[int]) -> dict:
    """Which of these brands have a live price, are still waiting, or failed."""
    ids = _clean_ids(brand_ids)
    with _db() as conn, conn.cursor() as cur:
        fresh = fresh_ids(cur, ids)
    with _lock:
        waiting = set(_queue) | ({_current} if _current is not None else set())
    pending = [i for i in ids if i in waiting and i not in fresh]
    failed = [i for i in ids if i not in fresh and i not in waiting and _recently_failed(i)]
    return {
        "total": len(ids),
        "done": sorted(fresh),
        "pending": pending,
        "failed": failed,
        "errors": {str(i): _failed[i][0] for i in failed},
        "queue_length": len(waiting),
    }


# ---------------------------------------------------------------------------
# Command line test
# ---------------------------------------------------------------------------

def _show(found, errors):
    for brand_id, p in found.items():
        print(f"{brand_id}: ৳ {p['unit_price']} ({p['unit_label']}) -> ৳ {p['compare_price']} "
              f"{p['compare_unit']}  [found by {p['via']}: {p['url']}]")
    if not found:
        print("No prices found. See the reasons above.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--name"]:
        name, strength, form = (args[1:] + ["", "", ""])[:3]
        hit = find_by_name(name, strength, form)
        print("Search result:", hit or "no match")
        if hit:
            p, reason = _price_from(hit[1], name)
            _show({hit[0]: {**p, "via": "name"}} if p else {}, {})
            if reason:
                print("Reason:", reason)
    else:
        ids = [int(x) for x in args] or [7630]
        brands = [{"brand_id": i} for i in ids]
        if os.getenv("DATABASE_URL"):
            import psycopg
            with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
                brands = brand_details(cur, ids)
        _show(*fetch_from_medex(brands))
