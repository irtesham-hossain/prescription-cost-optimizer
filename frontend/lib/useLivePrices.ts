"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  brandsToCheck,
  livePriceStatus,
  pickIds,
  startLivePrices,
  type AlternativesResponse,
  type LiveStatus,
} from "./api";

export type LiveProgress = {
  phase: "idle" | "checking" | "done" | "failed";
  done: number;
  total: number;
  failed: number;
};

export const LIVE_IDLE: LiveProgress = { phase: "idle", done: 0, total: 0, failed: 0 };

const POLL_MS = 3000; // ask the server for progress this often
const GIVE_UP_MS = 10 * 60 * 1000; // stop asking after 10 minutes
const MAX_ERRORS = 3; // stop after this many failed progress checks in a row

/**
 * Gets today's MedEx price for the Prescribed, Cheapest, Best and Recommended
 * brand of every medicine, in the background.
 * `reload` fetches the comparison again and returns it; it is called as prices arrive.
 * If a live price changes a pick, the new pick is checked too, so no pick is
 * left on an old dataset price.
 */
export function useLivePrices(reload: () => Promise<AlternativesResponse | null>) {
  const [progress, setProgress] = useState<LiveProgress>(LIVE_IDLE);
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const stop = useCallback(() => {
    run.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]); // stop when the page closes

  const start = useCallback(
    async (data: AlternativesResponse) => {
      stop();
      const me = run.current;
      const began = Date.now();
      let ids = brandsToCheck(data);
      if (ids.length === 0) {
        setProgress(LIVE_IDLE);
        return;
      }
      let doneAtReload = 0;
      let errors = 0;

      const fail = () => {
        if (me === run.current) setProgress((p) => ({ ...p, phase: p.done > 0 ? "done" : "failed" }));
      };

      const step = async (s: LiveStatus) => {
        if (me !== run.current) return;
        const finished = s.pending.length === 0 || Date.now() - began > GIVE_UP_MS;
        setProgress({
          phase: finished ? (s.done.length > 0 ? "done" : "failed") : "checking",
          done: s.done.length,
          total: s.total,
          failed: s.failed.length,
        });

        let more = false;
        // New prices arrived: show them, and check any brand that has just become a pick
        if (s.done.length > doneAtReload) {
          doneAtReload = s.done.length;
          try {
            const fresh = await reloadRef.current();
            if (me !== run.current) return;
            const added = fresh ? pickIds(fresh).filter((id) => !ids.includes(id)) : [];
            if (added.length && Date.now() - began < GIVE_UP_MS) {
              ids = [...ids, ...added];
              const next = await startLivePrices(added, added.length);
              more = next.pending.length > 0;
              setProgress((p) => ({ ...p, phase: "checking", total: ids.length }));
            }
          } catch {
            /* keep the prices already on screen */
          }
        }
        if ((finished && !more) || me !== run.current) return;
        poll();
      };

      // Ask the server for progress again in POLL_MS
      const poll = () => {
        timer.current = setTimeout(async () => {
          try {
            const next = await livePriceStatus(ids);
            errors = 0;
            await step(next);
          } catch {
            errors += 1;
            if (errors >= MAX_ERRORS) fail();
            else if (me === run.current) poll(); // try again
          }
        }, POLL_MS);
      };

      setProgress({ phase: "checking", done: 0, total: ids.length, failed: 0 });
      try {
        await step(await startLivePrices(ids, ids.length));
      } catch {
        fail();
      }
    },
    [stop],
  );

  return { progress, start, stop };
}
