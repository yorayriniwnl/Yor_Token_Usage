import type { LiveTabSession } from "../types/state.js";

/**
 * Keyed by compound key: `tabId:site` or `tabId`.
 * Guarantees that two tabs on the same provider (e.g. 2 ChatGPT tabs)
 * maintain completely independent live drafting and context states.
 */
export class SessionManager {
  private sessions = new Map<number, LiveTabSession>();

  setSession(session: LiveTabSession): void {
    if (!Number.isSafeInteger(session.tabId) || session.tabId < 0) {
      throw new RangeError("A live tab session requires a non-negative safe integer tab id");
    }
    this.sessions.set(session.tabId, session);
  }

  getSession(tabId: number, site?: string): LiveTabSession | undefined {
    const session = this.sessions.get(tabId);
    return session && (!site || session.site === site) ? session : undefined;
  }

  getAllSessions(): LiveTabSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  removeTab(tabId: number): void {
    this.sessions.delete(tabId);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const sessionManager = new SessionManager();
