import type { LiveTabSession } from "../types/state.js";

/**
 * Keyed by compound key: `tabId:site` or `tabId`.
 * Guarantees that two tabs on the same provider (e.g. 2 ChatGPT tabs)
 * maintain completely independent live drafting and context states.
 */
export class SessionManager {
  private sessions = new Map<string, LiveTabSession>();

  private makeKey(tabId: number, site?: string): string {
    return site ? `${tabId}:${site}` : `${tabId}`;
  }

  setSession(session: LiveTabSession): void {
    const key = this.makeKey(session.tabId, session.site);
    this.sessions.set(key, session);
    // Also index by tabId alone for quick lookup by active tab
    this.sessions.set(this.makeKey(session.tabId), session);
  }

  getSession(tabId: number, site?: string): LiveTabSession | undefined {
    if (site) {
      return this.sessions.get(this.makeKey(tabId, site));
    }
    return this.sessions.get(this.makeKey(tabId));
  }

  getAllSessions(): LiveTabSession[] {
    // Return unique sessions by compound key
    const unique = new Map<string, LiveTabSession>();
    for (const [key, session] of this.sessions.entries()) {
      if (key.includes(":")) {
        unique.set(key, session);
      }
    }
    return Array.from(unique.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  removeTab(tabId: number): void {
    const prefix = `${tabId}`;
    for (const key of Array.from(this.sessions.keys())) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.sessions.delete(key);
      }
    }
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const sessionManager = new SessionManager();
