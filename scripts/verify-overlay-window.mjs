import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getOverlayPosition } = require("../content/overlay-position.js");

const belowPosition = getOverlayPosition(
  { left: 100, top: 400, right: 500, bottom: 440, width: 400, height: 40 },
  { width: 1280, height: 800 },
  { width: 250, height: 44 }
);
assert.deepEqual(belowPosition, { left: 100, top: 448, placement: "below" });

const horizontalClamp = getOverlayPosition(
  { left: 1200, top: 400, right: 1280, bottom: 440, width: 80, height: 40 },
  { width: 1280, height: 800 },
  { width: 250, height: 44 }
);
assert.equal(horizontalClamp.left, 1018);
assert.equal(horizontalClamp.placement, "below");

const abovePosition = getOverlayPosition(
  { left: 100, top: 720, right: 500, bottom: 760, width: 400, height: 40 },
  { width: 1280, height: 800 },
  { width: 250, height: 60 }
);
assert.deepEqual(abovePosition, { left: 100, top: 652, placement: "above" });

console.log("overlay-window-check=pass");
