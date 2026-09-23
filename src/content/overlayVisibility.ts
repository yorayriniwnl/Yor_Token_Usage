export interface TabViewOverlaySettings {
  siteEnabled?: boolean;
  preferences?: {
    showOverlay?: boolean;
  };
}

export function isOverlayInitiallyVisible(view?: TabViewOverlaySettings | null): boolean {
  return view?.siteEnabled !== false && view?.preferences?.showOverlay !== false;
}
