// Accessibility audit of the main pages in both themes (axe-core, WCAG 2 A and AA).
//   node e2e/a11y.mjs          exits 1 when a serious or critical problem is found
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const base = process.env.AYZO_WEB_URL || "http://localhost:3000";
const api = process.env.AYZO_API_URL || "http://127.0.0.1:8000/api/v1";

const scans = await (await fetch(`${api}/campaigns`)).json();
const targets = await (await fetch(`${api}/targets`)).json();
const scan = scans.find((s) => s.status === "completed") ?? scans[0];

const pages = [
  "/dashboard",
  "/scans",
  "/scans/new",
  "/targets",
  "/agentic",
  "/library",
  "/settings",
  ...(scan ? [`/scans/${scan.id}`] : []),
  ...(targets[0] ? [`/targets/${targets[0].id}`] : []),
];

const browser = await chromium.launch();
let blocking = 0;
for (const theme of ["dark", "light"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((t) => localStorage.setItem("ayzo-theme", t), theme);
  const page = await context.newPage();
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of violations) {
      if (v.impact === "serious" || v.impact === "critical") blocking += 1;
      console.log(`${theme} ${path} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
      for (const node of v.nodes.slice(0, 2)) console.log(`    ${node.target.join(" ")}  ${(node.failureSummary || "").split("\n")[1]?.trim() ?? ""}`.slice(0, 260));
    }
  }
  await context.close();
}
await browser.close();
console.log(blocking ? `${blocking} serious or critical problems` : "no serious or critical problems");
process.exit(blocking ? 1 : 0);
