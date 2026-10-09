// Captures the main pages in both themes for a visual check.
//   node e2e/shots.mjs <output folder>
import { chromium } from "@playwright/test";

const out = process.argv[2] || "shots";
const base = process.env.AYZO_WEB_URL || "http://localhost:3000";
const api = process.env.AYZO_API_URL || "http://127.0.0.1:8000/api/v1";

const scans = await (await fetch(`${api}/campaigns`)).json();
const targets = await (await fetch(`${api}/targets`)).json();
const scan = scans.find((s) => s.status === "completed") ?? scans[0];

const pages = [
  ["new-scan", "/scans/new"],
  ["agentic", "/agentic"],
  ["overview", "/dashboard"],
  ["library", "/library"],
  ["settings", "/settings"],
  ...(scan ? [["scan", `/scans/${scan.id}`]] : []),
  ...(targets[0] ? [["target", `/targets/${targets[0].id}`]] : []),
];

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((t) => localStorage.setItem("ayzo-theme", t), theme);
  const page = await context.newPage();
  for (const [name, path] of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}-${theme}.png`, fullPage: true });
  }
  await context.close();
}
await browser.close();
console.log(`saved ${pages.length * 2} screenshots to ${out}`);
