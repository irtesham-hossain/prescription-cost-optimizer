"use client";

import { useState } from "react";
import HomeScreen from "@/components/HomeScreen";
import ConfirmScreen from "@/components/ConfirmScreen";
import ResultsScreen from "@/components/ResultsScreen";
import {
  getAlternatives,
  manualMedicine,
  scanPrescription,
  type AlternativesResponse,
  type ScannedMedicine,
  type SearchResult,
} from "@/lib/api";

type Step = "home" | "scanning" | "confirm" | "loading" | "results";

const TITLES: Record<Step, string> = {
  home: "Prescription Cost Optimizer",
  scanning: "Reading your prescription",
  confirm: "Check what we read",
  loading: "Finding cheaper brands",
  results: "Your prescription",
};

export default function Page() {
  const [step, setStep] = useState<Step>("home");
  const [medicines, setMedicines] = useState<ScannedMedicine[]>([]);
  const [results, setResults] = useState<AlternativesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(file: File) {
    setError(null);
    setStep("scanning");
    try {
      const res = await scanPrescription(file);
      if (!res.ok) {
        setError(res.message);
        setStep("home");
        return;
      }
      setMedicines(res.medicines);
      setStep("confirm");
    } catch (e) {
      setError(`Could not reach the scanner. ${(e as Error).message}`);
      setStep("home");
    }
  }

  function handleTyped(r: SearchResult) {
    setError(null);
    setMedicines([manualMedicine(r)]);
    setStep("confirm");
  }

  async function handleConfirm() {
    setError(null);
    setStep("loading");
    try {
      setResults(await getAlternatives(medicines));
      setStep("results");
    } catch (e) {
      setError(`Could not load alternatives. ${(e as Error).message}`);
      setStep("confirm");
    }
  }

  function restart() {
    setMedicines([]);
    setResults(null);
    setError(null);
    setStep("home");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50">
      <header className="sticky top-0 z-10 bg-teal-900 px-4 py-3.5 text-white">
        <h1 className="font-semibold">{TITLES[step]}</h1>
      </header>

      <section className="p-4">
        {step === "home" && <HomeScreen onPhoto={handlePhoto} onTypeMedicine={handleTyped} error={error} />}

        {(step === "scanning" || step === "loading") && (
          <div className="flex flex-col items-center gap-4 py-20 text-center text-slate-600">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700" />
            <p>{step === "scanning" ? "Reading the medicines. This takes about 10 seconds." : "Comparing brands..."}</p>
          </div>
        )}

        {step === "confirm" && (
          <ConfirmScreen
            medicines={medicines}
            setMedicines={setMedicines}
            onConfirm={handleConfirm}
            onBack={restart}
            error={error}
          />
        )}

        {step === "results" && results && <ResultsScreen data={results} onRestart={restart} />}
      </section>
    </main>
  );
}
