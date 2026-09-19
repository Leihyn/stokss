"use client";

import { useEffect, useState } from "react";

/**
 * The signature element. One cell per hour of the week, 168 of them.
 *
 * Lit cells are hours in which the US equity market prices the underlying. Unlit cells
 * are hours in which it does not, and in which the issuer will not create or redeem. The
 * ratio is 32.5 to 135.5 and the picture makes the argument before any sentence does.
 */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Regular session is 13:30-20:00 UTC while the US is on EDT. */
const isOpenHour = (dayIdx: number, hour: number) => dayIdx < 5 && hour >= 13 && hour < 20;

export default function WeekBar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // JS getUTCDay is 0=Sun; our grid starts Monday.
  const curDay = now ? (now.getUTCDay() + 6) % 7 : -1;
  const curHour = now ? now.getUTCHours() : -1;

  return (
    <div className="rounded-card border border-base-700 bg-base-900 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-micro uppercase text-ink-500">One week, one cell per hour</h3>
        <div className="flex items-center gap-4 text-micro uppercase text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[2px] bg-open-400" />
            32.5h priced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-[2px] bg-base-700" />
            135.5h dark
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {DAYS.map((d, di) => (
          <div key={d} className="flex items-center gap-2">
            <span className="w-8 shrink-0 font-mono text-micro text-ink-500">{d}</span>
            <div className="flex flex-1 gap-[2px]">
              {Array.from({ length: 24 }, (_, h) => {
                const open = isOpenHour(di, h);
                const isNow = di === curDay && h === curHour;
                return (
                  <span
                    key={h}
                    title={`${d} ${String(h).padStart(2, "0")}:00 UTC — ${open ? "priced" : "no price"}`}
                    className={[
                      "h-4 flex-1 rounded-[2px]",
                      open ? "bg-open-400/80" : "bg-base-700",
                      isNow ? "ring-1 ring-ink-100 ring-offset-1 ring-offset-base-900" : "",
                    ].join(" ")}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-body text-ink-500">
        {now
          ? `Now: ${DAYS[curDay]} ${String(curHour).padStart(2, "0")}:00 UTC, marked above.`
          : " "}{" "}
        Solana trades every one of these 168 hours.
      </p>
    </div>
  );
}
