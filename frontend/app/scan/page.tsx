"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, Page } from "@/components/ui";
import ScanStart from "@/components/ScanStart";
import Scanning from "@/components/Scanning";
import ConfirmScreen from "@/components/ConfirmScreen";
import MedicineForm from "@/components/MedicineForm";
import PrescriptionViewer from "@/components/PrescriptionViewer";
import ResultsScreen from "@/components/ResultsScreen";
import {
  brandsToCheck,
  getAlternatives,
  refreshLivePrices,
  savePrescription,
  scanPrescription,
  type AlternativesResponse,
  type ScannedMedicine,
} from "@/lib/api";

type Step = "start" | "scanning" | "confirm" | "edit" | "view" | "loading" | "results";

const TITLES: Record<Step, string> = {
  start: "Scan prescription",
  scanning: "Scan prescription",
  confirm: "Check your medicines",
  edit: "Edit medicine",
  view: "Your prescription",
  loading: "Finding cheaper brands",
  results: "Your savings",
};

export default function ScanPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("start");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<ScannedMedicine[]>([]);
  const [editing, setEditing] = useState<number | null>(null); // null = adding a new one
  const [results, setResults] = useState<AlternativesResponse | null>(null);
  const [live, setLive] = useState<"idle" | "checking" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  // Free the photo from memory when leaving the page
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  function back() {
    if (step === "start") router.push("/");
    else if (step === "confirm") setStep("start");
    else if (step === "edit" || step === "view" || step === "results") setStep("confirm");
  }

  async function handlePhoto(file: File) {
    setError(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file)); // stays on the phone, used for "View prescription"
    setStep("scanning");
    try {
      const res = await scanPrescription(file);
      if (!res.ok) {
        setError(res.message);
        setStep("start");
        return;
      }
      setMedicines(res.medicines);
      setStep("confirm");
    } catch (e) {
      setError((e as Error).message);
      setStep("start");
    }
  }

  function saveMedicine(m: ScannedMedicine) {
    setMedicines(editing === null ? [...medicines, m] : medicines.map((x, i) => (i === editing ? m : x)));
    setStep("confirm");
  }

  async function handleConfirm() {
    setError(null);
    setStep("loading");
    try {
      const first = await getAlternatives(medicines);
      setResults(first);
      setStep("results");
      checkLivePrices(first);
    } catch (e) {
      setError(`Could not load alternatives. ${(e as Error).message}`);
      setStep("confirm");
    }
  }

  // Runs after the results are on screen, so the user never waits for it
  async function checkLivePrices(data: AlternativesResponse) {
    const ids = brandsToCheck(data);
    if (ids.length === 0) return;
    setLive("checking");
    try {
      const r = await refreshLivePrices(ids);
      if (r.updated.length || r.cached.length) {
        setResults(await getAlternatives(medicines));
        setLive("done");
      } else setLive("failed");
    } catch {
      setLive("failed");
    }
  }

  function restart() {
    setMedicines([]);
    setResults(null);
    setLive("idle");
    setError(null);
    setStep("start");
  }

  const canGoBack = step !== "scanning" && step !== "loading";

  return (
    <Page>
      <Header title={TITLES[step]} onBack={canGoBack ? back : undefined} />
      <section className="flex-1 p-5">
        {step === "start" && <ScanStart onPhoto={handlePhoto} error={error} />}
        {step === "scanning" && <Scanning imageUrl={imageUrl} />}
        {step === "confirm" && (
          <ConfirmScreen
            medicines={medicines}
            imageUrl={imageUrl}
            setMedicines={setMedicines}
            onEdit={(i) => { setEditing(i); setStep("edit"); }}
            onAdd={() => { setEditing(null); setStep("edit"); }}
            onViewImage={() => setStep("view")}
            onConfirm={handleConfirm}
            error={error}
          />
        )}
        {step === "edit" && (
          <MedicineForm
            key={editing ?? "new"}
            initial={editing === null ? null : medicines[editing]}
            onSave={saveMedicine}
          />
        )}
        {step === "view" && imageUrl && <PrescriptionViewer imageUrl={imageUrl} medicines={medicines} />}
        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-20 text-slate-600">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
            <p>Comparing brands...</p>
          </div>
        )}
        {step === "results" && results && (
          <ResultsScreen
            data={results}
            live={live}
            onSave={async () => { await savePrescription(medicines, results); }}
            onRestart={restart}
          />
        )}
      </section>
    </Page>
  );
}
