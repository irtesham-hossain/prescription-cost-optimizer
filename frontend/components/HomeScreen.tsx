"use client";

import { useRef } from "react";
import SearchBox from "./SearchBox";
import type { SearchResult } from "@/lib/api";

export default function HomeScreen({
  onPhoto,
  onTypeMedicine,
  error,
}: {
  onPhoto: (file: File) => void;
  onTypeMedicine: (r: SearchResult) => void;
  error: string | null;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPhoto(file);
    e.target.value = ""; // allow choosing the same photo again
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Find cheaper brands with the same generic, strength and form.
      </p>

      <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 text-center text-sm text-slate-500">
        Take a clear photo of the whole prescription,
        <br />
        in good light.
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {/* capture="environment" opens the back camera on phones */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />

      <button
        onClick={() => cameraRef.current?.click()}
        className="w-full rounded-xl bg-teal-700 py-3 font-semibold text-white hover:bg-teal-800"
      >
        Take photo
      </button>
      <button
        onClick={() => galleryRef.current?.click()}
        className="w-full rounded-xl border-2 border-teal-700 py-3 font-semibold text-teal-700 hover:bg-teal-50"
      >
        Upload from gallery
      </button>

      <div className="pt-2">
        <p className="mb-2 text-sm font-semibold text-slate-700">Or type a medicine</p>
        <SearchBox onPick={onTypeMedicine} />
      </div>

      <p className="text-xs text-slate-500">Your photo is not saved. It is read and then discarded.</p>
    </div>
  );
}
