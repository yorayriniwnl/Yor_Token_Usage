"use strict";
(() => {
  // src/overlay/overlay-position.ts
  var DEFAULT_PADDING = 12;
  var DEFAULT_GAP = 8;
  function finite(value, fallback) {
    return Number.isFinite(value) ? Number(value) : fallback;
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function getOverlayPosition(anchor, viewport, overlay, options = {}) {
    const padding = Math.max(0, finite(options.padding, DEFAULT_PADDING));
    const gap = Math.max(0, finite(options.gap, DEFAULT_GAP));
    const width = Math.max(0, finite(overlay?.width, 0));
    const height = Math.max(0, finite(overlay?.height, 0));
    const viewportWidth = Math.max(0, finite(viewport?.width, 0));
    const viewportHeight = Math.max(0, finite(viewport?.height, 0));
    const left = clamp(finite(anchor?.left, padding), padding, Math.max(padding, viewportWidth - width - padding));
    const belowTop = finite(anchor?.bottom, padding) + gap;
    const aboveTop = finite(anchor?.top, padding) - gap - height;
    const anchorVisible = anchor?.bottom > 0 && anchor?.top < viewportHeight;
    const fitsWidth = width <= viewportWidth - padding * 2;
    const fitsBelow = anchorVisible && fitsWidth && belowTop >= padding && belowTop + height <= viewportHeight - padding;
    const fitsAbove = anchorVisible && fitsWidth && aboveTop >= padding && aboveTop + height <= viewportHeight - padding;
    if (fitsBelow) {
      return { left, top: belowTop, placement: "below" };
    }
    if (fitsAbove) {
      return { left, top: aboveTop, placement: "above" };
    }
    return {
      left,
      top: clamp(belowTop, padding, Math.max(padding, viewportHeight - height - padding)),
      placement: "hidden"
    };
  }
  function applyOverlayPosition(element, anchor, viewport, overlay, options) {
    const position = getOverlayPosition(anchor, viewport, overlay, options);
    if (element?.style) {
      element.style.left = `${position.left}px`;
      element.style.top = `${position.top}px`;
      element.style.bottom = "auto";
      element.style.right = "auto";
      element.style.visibility = position.placement === "hidden" ? "hidden" : "";
    }
    if (element?.dataset) {
      element.dataset.placement = position.placement;
    }
    return position;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.YorOverlayPosition = { applyOverlayPosition, getOverlayPosition };
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { applyOverlayPosition, getOverlayPosition };
  }
})();
