import { describe, it, expect } from "vitest";
import { isRegularSession, nextRegularOpen } from "../session";

/** Sep 2026 is EDT, so the regular session is 13:30-20:00 UTC on weekdays. */
const at = (iso: string) => new Date(iso);

describe("isRegularSession", () => {
  it("is open inside the weekday window", () => {
    expect(isRegularSession(at("2026-09-21T13:30:00Z"))).toBe(true);
    expect(isRegularSession(at("2026-09-21T16:00:00Z"))).toBe(true);
    expect(isRegularSession(at("2026-09-21T19:59:00Z"))).toBe(true);
  });

  it("is closed at the boundaries", () => {
    expect(isRegularSession(at("2026-09-21T13:29:00Z"))).toBe(false);
    expect(isRegularSession(at("2026-09-21T20:00:00Z"))).toBe(false);
  });

  it("is closed all weekend", () => {
    expect(isRegularSession(at("2026-09-19T16:00:00Z"))).toBe(false); // Sat
    expect(isRegularSession(at("2026-09-20T16:00:00Z"))).toBe(false); // Sun
  });

  it("is closed on a known holiday even mid-window", () => {
    expect(isRegularSession(at("2026-09-07T16:00:00Z"))).toBe(false); // Labor Day
  });
});

describe("nextRegularOpen", () => {
  it("skips the weekend from Saturday to Monday", () => {
    const n = nextRegularOpen(at("2026-09-19T12:00:00Z"));
    expect(n.toISOString()).toBe("2026-09-21T13:30:00.000Z");
  });

  it("returns today's open when called before the bell", () => {
    const n = nextRegularOpen(at("2026-09-21T09:00:00Z"));
    expect(n.toISOString()).toBe("2026-09-21T13:30:00.000Z");
  });

  it("rolls to the next day when called after the close", () => {
    const n = nextRegularOpen(at("2026-09-21T21:00:00Z"));
    expect(n.toISOString()).toBe("2026-09-22T13:30:00.000Z");
  });

  it("never returns a weekend open", () => {
    for (let d = 14; d <= 28; d++) {
      const n = nextRegularOpen(at(`2026-09-${String(d).padStart(2, "0")}T21:00:00Z`));
      expect([0, 6]).not.toContain(n.getUTCDay());
    }
  });

  it("always returns a time in the future", () => {
    const from = at("2026-09-19T12:00:00Z");
    expect(nextRegularOpen(from).getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("US daylight-time handling", () => {
  it("uses 13:30 UTC open while on EDT", () => {
    // 21 Sep 2026 is inside DST.
    expect(isRegularSession(at("2026-09-21T13:30:00Z"))).toBe(true);
    expect(isRegularSession(at("2026-09-21T13:29:00Z"))).toBe(false);
  });

  it("uses 14:30 UTC open once on EST", () => {
    // DST ends Sun 1 Nov 2026, so 2 Nov is EST and the session shifts an hour later.
    expect(isRegularSession(at("2026-11-02T13:30:00Z"))).toBe(false);
    expect(isRegularSession(at("2026-11-02T14:30:00Z"))).toBe(true);
    expect(isRegularSession(at("2026-11-02T20:59:00Z"))).toBe(true);
    expect(isRegularSession(at("2026-11-02T21:00:00Z"))).toBe(false);
  });

  it("nextRegularOpen respects the EST shift", () => {
    expect(nextRegularOpen(at("2026-11-02T09:00:00Z")).toISOString()).toBe(
      "2026-11-02T14:30:00.000Z",
    );
  });
});
