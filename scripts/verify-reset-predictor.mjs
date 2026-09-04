import { readFile } from "node:fs/promises";
import vm from "node:vm";

process.env.TZ = "Asia/Kolkata";

const source = await readFile(new URL("../content/index.js", import.meta.url), "utf8");
const parseStart = source.indexOf("  function parseAnchor(");
const dailyStart = source.indexOf("  function getUtcDailyWindowBounds", parseStart);
const weeklyStart = source.indexOf("  function getUtcWeeklyWindowBounds", dailyStart);
const windowStart = source.indexOf("  function getCurrentWindowBounds", weeklyStart);
if ([parseStart, dailyStart, weeklyStart, windowStart].some((index) => index < 0)) {
  throw new Error("content/index.js: reset predictor helpers could not be located");
}

const helperSource = [source.slice(parseStart, dailyStart), source.slice(weeklyStart, windowStart)].join("\n");
const getUtcWeeklyWindowBounds = vm.runInNewContext(`(() => { ${helperSource} return getUtcWeeklyWindowBounds; })()`, { Date, Number });
const dayMs = 864e5;
const mondayMorning = Date.parse("2026-08-31T08:00:00.000Z");
const beforeAnchor = getUtcWeeklyWindowBounds({ dayOfWeek: 1, anchorLocalTime: "09:15" }, mondayMorning);
const previousMonday = Date.parse("2026-08-24T09:15:00.000Z");
if (beforeAnchor.start !== previousMonday || beforeAnchor.end !== previousMonday + 7 * dayMs) {
  throw new Error(`weekly UTC window failed before anchor: ${JSON.stringify(beforeAnchor)}`);
}

const thursdayNight = Date.parse("2026-09-03T23:30:00.000Z");
const currentWindow = getUtcWeeklyWindowBounds({ dayOfWeek: 1, anchorLocalTime: "09:15" }, thursdayNight);
const currentMonday = Date.parse("2026-08-31T09:15:00.000Z");
if (currentWindow.start !== currentMonday || currentWindow.end !== currentMonday + 7 * dayMs) {
  throw new Error(`weekly UTC window failed after anchor: ${JSON.stringify(currentWindow)}`);
}

console.log("reset-predictor-check=pass");
