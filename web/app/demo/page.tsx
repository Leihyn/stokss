import Link from "next/link";
import type { Metadata } from "next";

/**
 * A page whose only job is to play the demo.
 *
 * The submission form wants a video URL, not a file, and hosting it here rather than on a
 * third-party account means the link cannot rot independently of the product it shows.
 */
export const metadata: Metadata = {
  title: "Closing Bell — demo",
  description:
    "78-second walkthrough: live Pyth equity data, the 168-hour week, the weekend window where nothing prices these assets, and a non-custodial exit.",
};

export default function DemoPage() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-(--gutter) py-14 sm:py-20">
      <p className="mb-4 font-mono text-micro uppercase text-shut-400">
        demo · 78 seconds · recorded from the live site
      </p>
      <h1 className="max-w-2xl text-display font-semibold">Closing Bell, in 78 seconds.</h1>
      <p className="mt-5 max-w-2xl text-read text-ink-300">
        Everything on screen is the deployed application reading mainnet. The only thing
        simulated is the clock, in the segment that says so on screen.
      </p>

      <video
        className="mt-10 w-full rounded-card border border-base-700"
        controls
        playsInline
        preload="metadata"
        poster="/demo-poster.jpg"
      >
        <source src="/demo.mp4" type="video/mp4" />
        Your browser cannot play this video.{" "}
        <a className="underline" href="/demo.mp4">
          Download it instead
        </a>
        .
      </video>

      <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-3">
        {[
          ["0:00", "Live Pyth SPY feed against the SPYx implied share price"],
          ["0:27", "The 168-hour week, 32.5 hours of it priced"],
          ["0:45", "The weekend window, with the simulated-clock banner on screen"],
        ].map(([t, l]) => (
          <div key={l}>
            <dd className="tnum font-mono text-[1.5rem] font-semibold leading-none text-ink-100">
              {t}
            </dd>
            <dt className="mt-2 text-body text-ink-500">{l}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-body">
        <Link className="text-shut-400 underline underline-offset-4" href="/">
          Open the live app
        </Link>
        <Link className="text-shut-400 underline underline-offset-4" href="/positions">
          Check a position
        </Link>
        <a
          className="text-shut-400 underline underline-offset-4"
          href="https://github.com/Leihyn/stokss"
        >
          Source
        </a>
        <a className="text-ink-500 underline underline-offset-4" href="/demo.mp4">
          Direct MP4
        </a>
      </p>
    </main>
  );
}
