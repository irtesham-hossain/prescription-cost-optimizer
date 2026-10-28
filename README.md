# Prescription Cost Optimizer

Scan a prescription photo and see cheaper medicine brands with the same generic, strength and form. Built for Bangladesh. CSE398 Capstone Project, Independent University, Bangladesh.

## Team

| Member | Role |
|---|---|
| Irtesham Hossain 2420891 | Backend, database, scanner, price fetcher |
| Maliha Rahman 2420913 | Frontend screens, results logic, testing |

## How it works

1. The user takes a photo of a prescription.
2. The backend sends it to Gemini, which reads the medicine names.
3. Each name is matched to a real brand in the database and marked green, amber or red.
4. The user checks and confirms the list.
5. The backend finds all brands with the same generic, strength and form, and picks Cheapest, Best and Recommended.
6. The app shows the total saving and where each price came from.

## Folders

| Folder | What is inside |
|---|---|
| `backend/` | FastAPI app: scanner, alternatives, price fetcher |
| `frontend/` | Next.js app (screens) |
| `database/` | `schema.sql` to create the tables |
| `data/` | `clean.py` and the cleaned CSV files |
| `docs/` | ERD, UML, wireframes, survey |

## Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your keys
python load_data.py             # only once, to fill the database
uvicorn scanner:app --reload
```

Open http://127.0.0.1:8000/docs to try the API.

## API formats

### POST /scan

Send a photo as form data with the field name `file`. Response:

```json
{
  "ok": true,
  "image_quality": "good",
  "needs_review": true,
  "medicines": [
    {
      "raw_text": "Tab. Napa 500mg 1+1+1",
      "brand_name": "Napa",
      "matched_brand": "Napa",
      "match_score": 100.0,
      "strength": "500 mg",
      "dosage_form": "tablet",
      "dose_pattern": "1+1+1",
      "meal_timing": "after_meal",
      "duration": "5 days",
      "confidence": 0.95,
      "status": "green"
    }
  ]
}
```

`status` is `green` (sure), `amber` (user should check) or `red` (user must pick the medicine).

### POST /alternatives (to build)

Request:

```json
{ "medicines": [ { "brand_name": "Napa", "strength": "500 mg", "dosage_form": "tablet" } ] }
```

Response:

```json
{
  "total_saving": 148.0,
  "medicines": [
    {
      "prescribed":  { "brand": "Napa", "price": 1.2 },
      "cheapest":    { "brand": "Ace",  "price": 1.0, "manufacturer": "Square" },
      "best":        { "brand": "Napa", "price": 1.2, "manufacturer": "Beximco" },
      "recommended": { "brand": "Fast", "price": 1.1, "manufacturer": "Healthcare" },
      "no_substitute": false,
      "price_source": "dataset",
      "price_date": "2023-01-01"
    }
  ]
}
```

The brands and prices above are examples only.

## Data source

Medicine data comes from a public Kaggle dataset collected from MedEx (medex.com.bd). Prices are a past snapshot; every price in the app shows its source and date.

## Rules for working together

1. Never work directly on `main`. Make a branch for each task.
2. Open a pull request and ask your teammate to review it.
3. Never commit `.env` or API keys.
