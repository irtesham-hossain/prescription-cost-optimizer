"use client";

import { useEffect, useState } from "react";
import { BottomNav, Header, Icon, Page } from "@/components/ui";
import { featuredPharmacies, type FeaturedPharmacy } from "@/lib/api";

// Optional. With a key the map shows inside the app; without one, a button opens Google Maps.
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

type Coords = { lat: number; lng: number };

export default function PharmacyPage() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState(false);
  const [featured, setFeatured] = useState<FeaturedPharmacy[]>([]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setLocError(true),
      { timeout: 10000 },
    );
    featuredPharmacies().then(setFeatured).catch(() => {});
  }, []);

  const mapsSearch = coords
    ? `https://www.google.com/maps/search/pharmacy/@${coords.lat},${coords.lng},15z`
    : "https://www.google.com/maps/search/pharmacy+near+me";
  const embed = MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/search?key=${MAPS_KEY}&q=pharmacy${
        coords ? `&center=${coords.lat},${coords.lng}&zoom=15` : ""}`
    : null;

  return (
    <Page>
      <Header title="Nearby pharmacies" backHref="/" />

      {embed ? (
        <iframe title="Pharmacies near you on Google Maps" src={embed} className="h-72 w-full border-0"
          loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      ) : (
        <div className="flex h-48 flex-col items-center justify-center gap-2 bg-teal-50 px-6 text-center text-sm text-slate-700">
          <Icon name="pin" size={32} className="text-teal-700" />
          See pharmacies around you on Google Maps.
        </div>
      )}

      <section className="flex flex-1 flex-col gap-3 p-5">
        {locError && (
          <p className="text-xs text-slate-600">Location is off, so the map shows a general search. Allow location for nearer results.</p>
        )}
        <a href={mapsSearch} target="_blank" rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 font-semibold text-white">
          <Icon name="route" size={18} /> Open pharmacies in Google Maps
        </a>

        {featured.map((p) => (
          <article key={p.pharmacy_id} className="flex flex-col gap-2 rounded-2xl border-2 border-amber-400 bg-white p-3.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{p.name}</h2>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Sponsored</span>
            </div>
            {p.address && <p className="text-xs text-slate-600">{p.address}</p>}
            <div className="flex gap-2">
              {p.phone && (
                <a href={`tel:${p.phone}`}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-700 text-sm font-semibold text-teal-700">
                  <Icon name="phone" size={16} /> Call
                </a>
              )}
              {p.latitude !== null && p.longitude !== null && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                  target="_blank" rel="noreferrer"
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-700 text-sm font-semibold text-white">
                  <Icon name="route" size={16} /> Directions
                </a>
              )}
            </div>
          </article>
        ))}

        <p className="text-xs text-slate-500">
          Sponsored pharmacies pay to be shown here. They never change the medicine prices or rankings.
        </p>
      </section>
      <BottomNav />
    </Page>
  );
}
