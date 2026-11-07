// All calls to the backend live here.
// The backend address comes from frontend/.env.local (NEXT_PUBLIC_API_URL).

export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type CardStatus = "green" | "amber" | "red";

// One medicine line as the scanner reads it (POST /scan)
export type ScannedMedicine = {
  raw_text: string;
  brand_name: string;
  matched_brand: string;
  match_score: number;
  strength: string;
  dosage_form: string;
  dose_pattern: string;
  meal_timing: string;
  duration: string;
  confidence: number;
  status: CardStatus;
};

export type ScanResponse =
  | { ok: true; image_quality: string; needs_review: boolean; medicines: ScannedMedicine[] }
  | { ok: false; reason: string; message: string };

// One brand choice (POST /alternatives)
export type Option = {
  brand_id: number;
  brand: string;
  manufacturer: string;
  price: number;
  unit: string;
  pack_price: number;
  pack_label: string;
  source: string;
  date: string | null;
};

export type MedicineResult =
  | {
      input: string;
      found: true;
      generic: string;
      strength: string;
      dosage_form: string;
      no_substitute: boolean;
      quantity: number;
      prescribed: Option;
      cheapest: Option;
      best: Option;
      recommended: Option;
      all_options: Option[];
      saving: number;
    }
  | { input: string; found: false; reason?: string };

export type AlternativesResponse = { total_saving: number; medicines: MedicineResult[] };

export type SearchResult = {
  brand_name: string;
  strength: string;
  dosage_form: string;
  manufacturer: string;
};

async function check(res: Response) {
  if (!res.ok) {
    let detail = `Server error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function scanPrescription(file: File): Promise<ScanResponse> {
  const form = new FormData();
  form.append("file", file);
  return check(await fetch(`${API}/scan`, { method: "POST", body: form }));
}

export async function getAlternatives(medicines: ScannedMedicine[]): Promise<AlternativesResponse> {
  const body = {
    medicines: medicines.map((m) => ({
      brand_name: m.matched_brand || m.brand_name,
      strength: m.strength,
      dosage_form: m.dosage_form,
      dose_pattern: m.dose_pattern,
      duration: m.duration,
    })),
  };
  return check(
    await fetch(`${API}/alternatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function searchMedicine(q: string): Promise<SearchResult[]> {
  const data = await check(await fetch(`${API}/search?q=${encodeURIComponent(q)}`));
  return data.results;
}

// A blank medicine, used when the user adds one by hand
export function manualMedicine(r: SearchResult): ScannedMedicine {
  return {
    raw_text: "",
    brand_name: r.brand_name,
    matched_brand: r.brand_name,
    match_score: 100,
    strength: r.strength,
    dosage_form: r.dosage_form,
    dose_pattern: "",
    meal_timing: "unknown",
    duration: "",
    confidence: 1,
    status: "green",
  };
}

export const taka = (n: number) => `৳ ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
