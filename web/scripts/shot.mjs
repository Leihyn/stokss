/**
 * Render the site headlessly and assert it does not scroll sideways.
 *
 * This exists because I shipped a landing page for days without looking at it, then
 * "fixed" a mobile bug that was an artefact of my own screenshot flags: Chrome's
 * --window-size does not emulate a device, so the capture clipped text that the page
 * lays out correctly. Real viewport emulation is the difference between measuring the
 * page and measuring the screenshot.
 *
 *   npm run shot            # writes PNGs to /tmp/cb-shots and prints overflow per view
 *   CHROME=/path/to/chrome  # override the binary (defaults to the puppeteer cache)
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import puppeteer from "puppeteer-core";

const OUT = "/tmp/cb-shots";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const chrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  const found = execSync(
    `find ${homedir()}/.cache/puppeteer/chrome -name 'Google Chrome for Testing' -type f | head -1`,
    { encoding: "utf8" },
  ).trim();
  if (!found) throw new Error("No Chrome found. Set CHROME=/path/to/chrome.");
  return found;
};

const VIEWS = [
  ["live", "/", 1440, 900, false],
  ["live-mobile", "/", 390, 844, true],
  ["dark", "/?dark=1", 1440, 900, false],
  ["dark-mobile", "/?dark=1", 390, 844, true],
  ["positions", "/positions", 1440, 900, false],
  ["positions-mobile", "/positions", 390, 844, true],
];

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome(),
  headless: "new",
  args: ["--no-sandbox"],
});

let failed = 0;
for (const [name, path, width, height, isMobile] of VIEWS) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, isMobile, deviceScaleFactor: 2 });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 2_200));

  // Elements wider than the viewport are fine INSIDE an overflow-x container (the data
  // tables are deliberately scrollable). Only the document scrolling sideways is a bug.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const bad = overflow > 1;
  if (bad) failed++;
  console.log(`${bad ? "FAIL" : "ok  "}  ${name.padEnd(17)} overflow=${overflow}px`);
  await page.close();
}
await browser.close();
console.log(`\n${VIEWS.length - failed}/${VIEWS.length} views free of horizontal scroll → ${OUT}`);
process.exit(failed ? 1 : 0);
