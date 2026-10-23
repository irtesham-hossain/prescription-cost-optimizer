"""
Clean the Kaggle (MedEx-derived) medicine dataset and produce tables that
match the project ERD: manufacturer, generic, equivalence_group, brand,
price_record.

Usage:
    python clean.py raw_folder output_folder
"""
import re
import sys
from pathlib import Path

import pandas as pd

RAW = Path(sys.argv[1] if len(sys.argv) > 1 else "raw")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "clean")
OUT.mkdir(exist_ok=True)
DATASET_DATE = "2023-01-01"  # TODO: replace with the collection date from the Kaggle page

# Medicines where switching brand is not advised (narrow therapeutic index)
NO_SUBSTITUTE = ["warfarin", "levothyroxine", "phenytoin", "carbamazepine",
                 "digoxin", "lithium", "tacrolimus", "cyclosporine", "theophylline"]

NUM = r"([\d,]+(?:\.\d+)?)"


def to_num(s):
    return float(s.replace(",", "")) if s else None


def parse_price(text):
    """Return unit_price, pack_price, pack_size, unit_label from MedEx price text."""
    if not isinstance(text, str):
        return None, None, None, None
    unit = re.search(r"Unit Price:\s*৳\s*" + NUM, text)
    pack = re.search(r"\((\d+)'s pack:\s*৳\s*" + NUM, text)
    other = re.search(r"^([^:(]+?):\s*৳\s*" + NUM, text)  # e.g. "100 ml bottle: ৳ 45.00"
    unit_price = to_num(unit.group(1)) if unit else None
    pack_size = int(pack.group(1)) if pack else None
    pack_price = to_num(pack.group(2)) if pack else None
    label = "unit"
    if unit_price is None and other and "Unit Price" not in other.group(1):
        label = other.group(1).strip()          # bottle, tube, ampoule ...
        unit_price = to_num(other.group(2))
    return unit_price, pack_price, pack_size, label


def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip() if pd.notna(s) else ""


def norm_strength(s):
    s = norm(s).lower()
    s = re.sub(r"\s*(mg|mcg|gm|g|ml|iu|%)\b", r" \1", s)   # "500mg" to "500 mg"
    return re.sub(r"\s+", " ", s).strip()


# 1. Load
med = pd.read_csv(RAW / "medicine.csv")
gen = pd.read_csv(RAW / "generic.csv")
man = pd.read_csv(RAW / "manufacturer.csv")
start = len(med)

# 2. Keep allopathic only, tidy text columns
med = med[med["type"] == "allopathic"].copy()
for c in ["brand name", "dosage form", "generic", "manufacturer"]:
    med[c] = med[c].map(norm)
med["strength"] = med["strength"].map(norm_strength)

# 3. Parse prices (price text sits in "package container", sometimes "Package Size")
price_text = med["package container"].fillna("") + " " + med["Package Size"].fillna("")
parsed = price_text.map(parse_price)
med[["unit_price", "pack_price", "pack_size", "unit_label"]] = pd.DataFrame(parsed.tolist(), index=med.index)

# 4. Drop rows we cannot use, and duplicates
no_price = med["unit_price"].isna().sum()
no_strength = (med["strength"] == "").sum()
med = med[med["unit_price"].notna() & (med["unit_price"] > 0)]
med["needs_review"] = med["strength"] == ""            # keep, but not grouped
dupes = med.duplicated("slug").sum()
med = med.drop_duplicates("slug")

# 5. Manufacturer table (quality tier by size: tier 1 = top 20 by brand count)
man = man.rename(columns={"manufacturer id": "manufacturer_id", "manufacturer name": "name",
                          "brand names count": "brand_count"})
man["name"] = man["name"].map(norm)
man = man.sort_values("brand_count", ascending=False).reset_index(drop=True)
man["quality_tier"] = [1 if i < 20 else 2 if i < 60 else 3 for i in range(len(man))]
man["size_class"] = man["quality_tier"].map({1: "large", 2: "medium", 3: "small"})
man[["manufacturer_id", "name", "quality_tier", "size_class"]].to_csv(OUT / "manufacturer.csv", index=False)

# 6. Generic table
gen = gen.rename(columns={"generic id": "generic_id", "generic name": "generic_name", "drug class": "drug_class"})
gen["generic_name"] = gen["generic_name"].map(norm)
gen["no_substitute"] = gen["generic_name"].str.lower().apply(lambda g: any(w in g for w in NO_SUBSTITUTE))
gen[["generic_id", "generic_name", "no_substitute", "drug_class"]].to_csv(OUT / "generic.csv", index=False)

# 7. Link brands to ids
med = med.merge(gen[["generic_id", "generic_name"]], left_on="generic", right_on="generic_name", how="left")
med = med.merge(man[["manufacturer_id", "name"]], left_on="manufacturer", right_on="name", how="left")
unmatched_generic = med["generic_id"].isna().sum()

# 8. Equivalence groups: same generic + strength + dosage form
ok = med["generic_id"].notna() & ~med["needs_review"]
groups = (med[ok][["generic_id", "strength", "dosage form"]].drop_duplicates()
          .reset_index(drop=True))
groups["group_id"] = groups.index + 1
groups = groups.rename(columns={"dosage form": "dosage_form"})
groups["generic_id"] = groups["generic_id"].astype(int)
groups[["group_id", "generic_id", "strength", "dosage_form"]].to_csv(OUT / "equivalence_group.csv", index=False)
med = med.merge(groups, left_on=["generic_id", "strength", "dosage form"],
                right_on=["generic_id", "strength", "dosage_form"], how="left")

# 9. Brand table
brand = pd.DataFrame({
    "brand_id": med["brand id"],
    "brand_name": med["brand name"],
    "slug": med["slug"],
    "manufacturer_id": med["manufacturer_id"].astype("Int64"),
    "group_id": med["group_id"].astype("Int64"),
    "package_size": med["pack_size"].astype("Int64"),
    "dgda_registered": True,          # listed on MedEx; verify against DGDA later
    "availability_score": 1.0,        # placeholder until pharmacy survey
    "needs_review": med["needs_review"],
})
brand.to_csv(OUT / "brand.csv", index=False)

# 9b. Comparable price: per tablet for units, per ml or per gm for bottles and tubes
def compare_price(row):
    if row["unit_label"] == "unit":
        return row["unit_price"], "per unit"
    m = re.match(r"([\d.]+)\s*(ml|gm|g|mg)\b", str(row["unit_label"]))
    if m and float(m.group(1)) > 0:
        return round(row["unit_price"] / float(m.group(1)), 4), "per " + m.group(2)
    return row["unit_price"], "per " + str(row["unit_label"])
cp = med.apply(compare_price, axis=1, result_type="expand")
med["compare_price"], med["compare_unit"] = cp[0], cp[1]

# 10. Price records (source = dataset)
price = pd.DataFrame({
    "price_id": range(1, len(med) + 1),
    "brand_id": med["brand id"],
    "unit_price": med["unit_price"],
    "pack_price": med["pack_price"],
    "unit_label": med["unit_label"],
    "compare_price": med["compare_price"],
    "compare_unit": med["compare_unit"],
    "source": "dataset",
    "source_url": "https://www.kaggle.com/ (MedEx derived)",
    "fetched_at": DATASET_DATE,
})
price.to_csv(OUT / "price_record.csv", index=False)

# 11. Report
sizes = brand.dropna(subset=["group_id"]).groupby("group_id").size()
print(f"Rows in raw file:              {start}")
print(f"Removed herbal:                {start - len(med) - dupes - no_price}  (approx)")
print(f"No price found:                {no_price}")
print(f"Duplicate slugs removed:       {dupes}")
print(f"Missing strength (flagged):    {no_strength}")
print(f"Generic not matched:           {unmatched_generic}")
print(f"Brands kept:                   {len(brand)}")
print(f"Equivalence groups:            {len(groups)}")
print(f"Groups with 2 or more brands:  {(sizes >= 2).sum()}")
print(f"No substitute generics:        {gen['no_substitute'].sum()}")
print(f"Files written to:              {OUT.resolve()}")
