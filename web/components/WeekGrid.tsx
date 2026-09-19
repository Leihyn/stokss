"use client";

import { useSyncExternalStore } from "react";

/**
 * The week, at one cell per hour.
 *
 * 168 cells, Monday to Sunday, in UTC. The US regular session prices the underlying for
 * 13:30-20:00 on weekdays, so 32.5 cells are lit and 135.5 are not. Hour 13 is lit from
 * the half hour only, and is drawn half-lit for exactly that reason. The picture makes
 * the argument before any sentence does.
 *
 * The current hour is marked from the viewer's clock, so it is computed after mount:
 * rendering it on the server would hand the client a different hour to hydrate against.
 */

interface WeekGridProps {
  marketOpen: boolean; // from the live issuer feed
  period?: string | null; // "market" | "extended" | "overnight" | "closed"
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const pad = (n: number) => String(n).padStart(2, "0");

type CellState = "priced" | "half" | "dark";

/** Regular session: 13:30-20:00 UTC, Monday to Friday. 6.5 h x 5 = 32.5 h of 168. */
function cellState(dayIndex: number, hour: number): CellState {
  if (dayIndex > 4) return "dark";
  if (hour >= 14 && hour <= 19) return "priced";
  if (hour === 13) return "half";
  return "dark";
}

/**
 * 24 labels never fit a phone. The columns stay put either way: labels are hidden with
 * visibility, not display, so every ruler slot keeps its grid column and the ruler stays
 * registered to the cells beneath it.
 *   < 640px   00 06 12 18
 *   >= 640px  every second hour
 *   >= 1024px all 24
 */
function rulerVisibility(hour: number): string {
  if (hour % 6 === 0) return "";
  if (hour % 2 === 0) return "invisible sm:visible";
  return "invisible lg:visible";
}

/** Rail + grid share one column template so the ruler, the days and the cells all line up. */
const RAILED = "grid grid-cols-[30px_1fr] gap-x-2 sm:grid-cols-[38px_1fr]";
const COLS_24 = "grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]";

/**
 * One 60-second clock, shared by every mounted grid and read through the external-store
 * hook. The snapshot is cached so React can compare it by identity, and the server
 * snapshot is null, so nothing clock-dependent exists to hydrate against. The interval is
 * torn down when the last grid unmounts.
 */
let clockSnapshot: number | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function subscribeToClock(onChange: () => void): () => void {
  clockListeners.add(onChange);
  clockSnapshot = Date.now();
  clockTimer ??= setInterval(() => {
    clockSnapshot = Date.now();
    clockListeners.forEach((listener) => listener());
  }, 60_000);

  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

const readClock = () => clockSnapshot;
const readClockOnServer = () => null;

export default function WeekGrid({ marketOpen, period }: WeekGridProps) {
  const nowMs = useSyncExternalStore(subscribeToClock, readClock, readClockOnServer);
  const now = nowMs === null ? null : new Date(nowMs);

  // getUTCDay is 0=Sunday; this grid begins on Monday.
  const nowDay = now ? (now.getUTCDay() + 6) % 7 : -1;
  const nowHour = now ? now.getUTCHours() : -1;

  return (
    <section
      aria-labelledby="week-grid-title"
      className="w-full bg-base-950 px-[var(--gutter)] py-10 sm:py-14"
    >
      <h2 id="week-grid-title" className="sr-only">
        The week: 168 hours, 32.5 of them priced
      </h2>

      {/* eyebrow + legend */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4">
        <p className="text-micro uppercase text-ink-500">
          One cell = one hour · UTC · week begins Monday
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2 text-micro uppercase text-ink-300">
            <span aria-hidden="true" className="h-[10px] w-[14px] shrink-0 rounded-[2px] bg-open-400/80" />
            Priced <span className="tnum font-mono text-open-400">32.5</span>
          </span>
          <span className="flex items-center gap-2 text-micro uppercase text-ink-300">
            <span
              aria-hidden="true"
              className="h-[10px] w-[14px] shrink-0 rounded-[2px] border border-base-700 bg-base-850"
            />
            Unpriced <span className="tnum font-mono text-ink-300">135.5</span>
          </span>
          <span className="flex items-center gap-2 text-micro uppercase text-ink-300">
            <span
              aria-hidden="true"
              className="h-[10px] w-[14px] shrink-0 rounded-[2px] bg-base-850 outline-2 outline-offset-[-1px] outline-solid outline-shut-400"
            />
            Now
          </span>
        </div>
      </div>

      {/* hour ruler */}
      <div className={`${RAILED} pb-1.5`} aria-hidden="true">
        <span />
        <div className={COLS_24}>
          {HOURS.map((h) => (
            <span
              key={h}
              className={`tnum text-center font-mono text-[9px] leading-none text-ink-500 ${rulerVisibility(h)}`}
            >
              {pad(h)}
            </span>
          ))}
        </div>
      </div>

      {/* day rail + 168 cells */}
      <div className={`${RAILED} h-[clamp(148px,24vw,308px)]`}>
        <div className="grid grid-rows-[repeat(7,minmax(0,1fr))] gap-[2px]" aria-hidden="true">
          {DAYS.map((d, di) => (
            <span
              key={d}
              className={`flex items-center gap-[5px] font-mono text-[9px] tracking-[0.06em] sm:text-[10px] ${
                di > 4 ? "text-shut-400" : "text-ink-300"
              }`}
            >
              <i className={`w-[2px] self-stretch ${di > 4 ? "bg-shut-400/55" : "bg-transparent"}`} />
              {d.toUpperCase()}
            </span>
          ))}
        </div>

        <div
          role="img"
          aria-label="The 168 hours of one week. 32.5 are priced by the US regular session; the other 135.5, including all of Saturday and Sunday, are not."
          className={`${COLS_24} grid-rows-[repeat(7,minmax(0,1fr))]`}
        >
          {DAYS.map((d, di) =>
            HOURS.map((h) => {
              const state = cellState(di, h);
              const isNow = di === nowDay && h === nowHour;
              const label =
                state === "priced"
                  ? "priced"
                  : state === "half"
                    ? "priced from 13:30"
                    : "no price";
              return (
                <span
                  key={`${di}-${h}`}
                  title={`${d} ${pad(h)}:00 UTC · ${label}`}
                  className={`relative rounded-[1px] ${
                    state === "priced" ? "bg-open-400/80" : "bg-base-850"
                  } ${
                    isNow
                      ? "z-[2] outline-2 outline-offset-[-1px] outline-solid outline-shut-400"
                      : ""
                  }`}
                >
                  {state === "half" ? (
                    <i className="absolute inset-y-0 left-1/2 right-0 rounded-r-[1px] bg-open-400/80" />
                  ) : null}
                </span>
              );
            }),
          )}
        </div>
      </div>

      {/* the grid is one image to a screen reader; this is its long description */}
      <p className="sr-only">
        Every hour of the week is one cell, Monday through Sunday, in UTC. The United States
        regular session prices the underlying from 13:30 to 20:00 on weekdays, so 32.5 of the
        168 hours are lit: 14:00 through 19:59 in full, and 13:00 through 13:59 from the half
        hour onward. The remaining 135.5 hours carry no price at all, and neither Saturday nor
        Sunday contains a single priced hour.
      </p>

      {/* readouts */}
      <dl className="mt-3.5 grid grid-cols-2 gap-x-3.5 gap-y-4 border-t border-base-800 pt-4 sm:flex sm:flex-wrap sm:items-center sm:gap-[18px]">
        <div className="flex flex-col gap-[3px]">
          <dt className="text-micro uppercase text-ink-500">Market state</dt>
          <dd
            className={`tnum font-mono text-value ${marketOpen ? "text-open-400" : "text-shut-400"}`}
          >
            {marketOpen ? "Open" : "Closed"}
            {period ? (
              <span className="ml-2 font-sans text-micro uppercase text-ink-500">{period}</span>
            ) : null}
          </dd>
        </div>

        <span aria-hidden="true" className="hidden h-[30px] w-px bg-base-800 sm:block" />

        <div className="flex flex-col gap-[3px]">
          <dt className="text-micro uppercase text-ink-500">Now (UTC)</dt>
          <dd className="tnum font-mono text-value text-ink-100">
            {now ? `${pad(nowHour)}:${pad(now.getUTCMinutes())} ${DAYS[nowDay]}` : "--:-- ---"}
          </dd>
        </div>

        <span aria-hidden="true" className="hidden h-[30px] w-px bg-base-800 sm:block" />

        <div className="flex flex-col gap-[3px]">
          <dt className="text-micro uppercase text-ink-500">Priced per week</dt>
          <dd className="tnum font-mono text-value text-open-400">32.5 h</dd>
        </div>

        <span aria-hidden="true" className="hidden h-[30px] w-px bg-base-800 sm:block" />

        <div className="flex flex-col gap-[3px]">
          <dt className="text-micro uppercase text-ink-500">Traded per week</dt>
          <dd className="tnum font-mono text-value text-ink-100">168 h</dd>
        </div>

        <p className="tnum col-span-2 max-w-[38ch] text-micro text-ink-500 sm:ml-auto">
          Regular session 13:30&ndash;20:00 UTC, weekdays. The half-lit column is
          13:00&ndash;14:00, priced only from the half hour.
        </p>
      </dl>
    </section>
  );
}
