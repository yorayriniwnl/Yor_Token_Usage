export interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right?: number;
  width: number;
  height: number;
}

export interface PositionOptions {
  padding?: number;
  gap?: number;
  obstacles?: RectLike[];
}

export interface OverlayPositionResult {
  left: number;
  top: number;
  placement: "below" | "above" | "hidden";
}

const DEFAULT_PADDING = 12;
const DEFAULT_GAP = 8;

function finite(value: any, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function overlapsObstacle(
  left: number,
  top: number,
  width: number,
  height: number,
  obstacle: RectLike,
  gap: number
): boolean {
  const obstacleLeft = finite(obstacle?.left, 0);
  const obstacleTop = finite(obstacle?.top, 0);
  const obstacleWidth = Math.max(0, finite(obstacle?.width, 0));
  const obstacleHeight = Math.max(0, finite(obstacle?.height, 0));
  if (!obstacleWidth || !obstacleHeight) return false;

  const obstacleRight = finite(obstacle?.right, obstacleLeft + obstacleWidth);
  const obstacleBottom = finite(obstacle?.bottom, obstacleTop + obstacleHeight);
  return left < obstacleRight + gap && left + width > obstacleLeft - gap &&
    top < obstacleBottom + gap && top + height > obstacleTop - gap;
}

export function getOverlayPosition(
  anchor: RectLike,
  viewport: { width: number; height: number },
  overlay: { width: number; height: number },
  options: PositionOptions = {}
): OverlayPositionResult {
  const padding = Math.max(0, finite(options.padding, DEFAULT_PADDING));
  const gap = Math.max(0, finite(options.gap, DEFAULT_GAP));
  const width = Math.max(0, finite(overlay?.width, 0));
  const height = Math.max(0, finite(overlay?.height, 0));
  const viewportWidth = Math.max(0, finite(viewport?.width, 0));
  const viewportHeight = Math.max(0, finite(viewport?.height, 0));
  const maxLeft = Math.max(padding, viewportWidth - width - padding);
  const left = clamp(finite(anchor?.left, padding), padding, maxLeft);
  const anchorRight = finite(anchor?.right, finite(anchor?.left, padding) + finite(anchor?.width, 0));
  const leftCandidates = [
    left,
    clamp(anchorRight - width, padding, maxLeft),
    padding,
    maxLeft
  ].filter((candidate, index, candidates) => candidates.findIndex((other) => Math.abs(other - candidate) < 1) === index);
  const belowTop = finite(anchor?.bottom, padding) + gap;
  const aboveTop = finite(anchor?.top, padding) - gap - height;
  const anchorVisible = anchor?.bottom > 0 && anchor?.top < viewportHeight;
  const fitsWidth = width <= viewportWidth - padding * 2;
  const fitsBelow = anchorVisible && fitsWidth && belowTop >= padding && belowTop + height <= viewportHeight - padding;
  const fitsAbove = anchorVisible && fitsWidth && aboveTop >= padding && aboveTop + height <= viewportHeight - padding;
  const verticalCandidates = [
    { top: belowTop, placement: "below" as const, fits: fitsBelow },
    { top: aboveTop, placement: "above" as const, fits: fitsAbove }
  ].filter((candidate) => candidate.fits);

  for (const candidateLeft of leftCandidates) {
    for (const candidate of verticalCandidates) {
      const blocked = (options.obstacles || []).some((obstacle) =>
        overlapsObstacle(candidateLeft, candidate.top, width, height, obstacle, 4)
      );
      if (!blocked) {
        return { left: candidateLeft, top: candidate.top, placement: candidate.placement };
      }
    }
  }
  return {
    left,
    top: clamp(belowTop, padding, Math.max(padding, viewportHeight - height - padding)),
    placement: "hidden"
  };
}

export function applyOverlayPosition(
  element: HTMLElement,
  anchor: RectLike,
  viewport: { width: number; height: number },
  overlay: { width: number; height: number },
  options?: PositionOptions
): OverlayPositionResult {
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

// Browser global and CommonJS exposure
if (typeof globalThis !== "undefined") {
  (globalThis as any).YorOverlayPosition = { applyOverlayPosition, getOverlayPosition };
}
declare const module: any;
if (typeof module !== "undefined" && module.exports) {
  module.exports = { applyOverlayPosition, getOverlayPosition };
}


