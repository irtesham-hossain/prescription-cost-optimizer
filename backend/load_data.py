"""
Load the cleaned CSV files into the Supabase database.

Run once, after creating the tables with database/schema.sql:
    python load_data.py
It reads DATABASE_URL from the .env file.
"""
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()
DATA = Path(__file__).resolve().parent.parent / "data" / "clean"

# Order matters: a table must be loaded before the tables that point to it.
TABLES = ["manufacturer", "generic", "equivalence_group", "brand", "price_record"]

with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
    for table in TABLES:
        path = DATA / f"{table}.csv"
        header = path.open(encoding="utf-8").readline().strip()
        with path.open("rb") as f, cur.copy(
            f"COPY {table} ({header}) FROM STDIN WITH (FORMAT csv, HEADER true)"
        ) as copy:
            copy.write(f.read())
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"{table:20} {cur.fetchone()[0]:>6} rows")
    # keep the id counter in step with the loaded rows
    cur.execute("SELECT setval('price_record_price_id_seq', (SELECT MAX(price_id) FROM price_record))")
print("Done.")
