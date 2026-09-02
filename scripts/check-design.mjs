import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = ["popup/popup.css", "dashboard/dashboard.css", "settings/settings.css"];
const required = [
  "--bg: #101011",
  "--surface: #171719",
  "--primary: #8fdcc4",
  "--danger: #ed7c61",
  "button:focus-visible",
  "@media (prefers-reduced-motion: reduce)"
];

for (const file of files) {
  const css = await readFile(new URL(file, root), "utf8");
  const missing = required.filter((token) => !css.toLowerCase().includes(token.toLowerCase()));
  if (missing.length) throw new Error(`${file}: missing ${missing.join(", ")}`);
}

const manifest = await readFile(new URL("manifest.json", root), "utf8");
if (!manifest.includes("Yor Token Usage")) throw new Error("manifest.json: product name is missing");
if (!manifest.includes("content/accuracy-engine.js")) throw new Error("manifest.json: accuracy engine is not loaded before the content adapter");

const content = await readFile(new URL("content/index.js", root), "utf8");
if (!content.includes("YorTokenAccuracy")) throw new Error("content/index.js: provider content is not wired to the shared accuracy engine");

console.log("YOR design contract: PASS");
