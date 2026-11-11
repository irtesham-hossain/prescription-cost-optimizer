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

export async function refreshLivePrices(brandIds: number[]) {
  return check(
    await fetch(`${API}/live-prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_ids: brandIds }),
    }),
  ) as Promise<{ cached: number[]; updated: number[]; failed: number[] }>;
}

// Which brands to check live: prescribed and recommended first, then cheapest and best
export function brandsToCheck(data: AlternativesResponse, max = 6): number[] {
  const found = data.medicines.filter((m) => m.found) as Extract<MedicineResult, { found: true }>[];
  const order = [
    ...found.map((m) => m.prescribed.brand_id),
    ...found.map((m) => m.recommended.brand_id),
    ...found.map((m) => m.cheapest.brand_id),
    ...found.map((m) => m.best.brand_id),
  ];
  return [...new Set(order)].slice(0, max);
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

// ---------------------------------------------------------------------------
// Saved prescriptions (no login yet: each phone has an anonymous id)
// ---------------------------------------------------------------------------

export type SavedPrescription = {
  id: string;
  title: string;
  created_at: string;
  total_saving: number;
  medicines: ScannedMedicine[];
  results: AlternativesResponse;
};

export function deviceId(): string {
  const KEY = "pco_device_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function savePrescription(medicines: ScannedMedicine[], results: AlternativesResponse) {
  return check(
    await fetch(`${API}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId(), medicines, results }),
    }),
  ) as Promise<{ id: string; created_at: string }>;
}

export async function listPrescriptions(): Promise<SavedPrescription[]> {
  const data = await check(await fetch(`${API}/prescriptions?device_id=${deviceId()}`));
  return data.prescriptions;
}

export async function deletePrescription(id: string) {
  return check(await fetch(`${API}/prescriptions/${id}?device_id=${deviceId()}`, { method: "DELETE" }));
}

// ---------------------------------------------------------------------------
// Featured (sponsored) pharmacies
// ---------------------------------------------------------------------------

export type FeaturedPharmacy = {
  pharmacy_id: number;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function featuredPharmacies(): Promise<FeaturedPharmacy[]> {
  const data = await check(await fetch(`${API}/featured-pharmacies`));
  return data.pharmacies;
}

// ---------------------------------------------------------------------------
// Dose helpers
// ---------------------------------------------------------------------------

export const MEAL_LABEL: Record<string, string> = {
  before_meal: "before meal",
  after_meal: "after meal",
  with_meal: "with meal",
  unknown: "",
};

export function describeDose(m: ScannedMedicine) {
  return [m.dosage_form, m.dose_pattern, MEAL_LABEL[m.meal_timing] ?? "", m.duration]
    .filter(Boolean)
    .join(" · ");
}

/** "5 days" -> 5, "2 weeks" -> 14, "1 month" -> 30; null when not a fixed length */
export function durationDays(duration: string): number | null {
  const m = /(\d+)\s*(day|week|month)/i.exec(duration || "");
  if (!m) return null;
  return Number(m[1]) * ({ day: 1, week: 7, month: 30 } as Record<string, number>)[m[2].toLowerCase()];
}
