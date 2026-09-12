(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.YorOverlayPosition = api;
  }
})(typeof globalThis === "object" ? globalThis : window, () => {
  const DEFAULT_PADDING = 12;
  const DEFAULT_GAP = 8;

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getOverlayPosition(anchor, viewport, overlay, options = {}) {
    const padding = Math.max(0, finite(options.padding, DEFAULT_PADDING));
    const gap = Math.max(0, finite(options.gap, DEFAULT_GAP));
    const width = Math.max(0, finite(overlay?.width, 0));
    const height = Math.max(0, finite(overlay?.height, 0));
    const viewportWidth = Math.max(width + padding * 2, finite(viewport?.width, width + padding * 2));
    const viewportHeight = Math.max(height + padding * 2, finite(viewport?.height, height + padding * 2));
    const left = clamp(finite(anchor?.left, padding), padding, Math.max(padding, viewportWidth - width - padding));
    const belowTop = finite(anchor?.bottom, padding) + gap;
    const aboveTop = finite(anchor?.top, padding) - gap - height;
    const fitsBelow = belowTop + height <= viewportHeight - padding;
    const fitsAbove = aboveTop >= padding;

    if (fitsBelow) {
      return { left, top: belowTop, placement: "below" };
    }
    if (fitsAbove) {
      return { left, top: aboveTop, placement: "above" };
    }
    return {
      left,
      top: clamp(belowTop, padding, Math.max(padding, viewportHeight - height - padding)),
      placement: "below"
    };
  }

  function applyOverlayPosition(element, anchor, viewport, overlay, options) {
    const position = getOverlayPosition(anchor, viewport, overlay, options);
    if (element?.style) {
      element.style.left = `${position.left}px`;
      element.style.top = `${position.top}px`;
      element.style.right = "auto";
    }
    if (element?.dataset) element.dataset.placement = position.placement;
    return position;
  }

  return { applyOverlayPosition, getOverlayPosition };
});
