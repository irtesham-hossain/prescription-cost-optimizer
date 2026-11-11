"use client";

import { useRef } from "react";
import { Icon } from "./ui";

export default function ScanStart({ onPhoto, error }: { onPhoto: (file: File) => void; error: string | null }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPhoto(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-52 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 text-center text-sm text-slate-600">
        <Icon name="image" size={36} />
        Take a clear photo of the whole prescription, in good light.
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />

      <button type="button" onClick={() => cameraRef.current?.click()}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 font-semibold text-white hover:bg-teal-800">
        <Icon name="scan" size={20} /> Take photo
      </button>
      <button type="button" onClick={() => galleryRef.current?.click()}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-teal-700 font-semibold text-teal-700 hover:bg-teal-50">
        <Icon name="image" size={20} /> Upload from gallery
      </button>

      <p className="text-xs text-slate-500">Your photo is only used to read the medicines. It is not saved on our server.</p>
    </div>
  );
}
