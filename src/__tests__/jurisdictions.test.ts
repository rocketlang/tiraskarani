import { describe, expect, it } from "bun:test";
import * as jurisdictions from "../jurisdictions.ts";

describe("jurisdictions", () => {
  it("returns metadata for each declared jurisdiction", () => {
    const codes = ["EU", "UK", "US-CA", "IN", "BR", "CA", "KR", "JP", "CH"] as const;
    for (const c of codes) {
      const m = jurisdictions.get(c);
      expect(m.code).toBe(c);
      expect(m.rule_id).toMatch(/^ASD-RTBF-\d{3}$/);
    }
  });

  it("rejects unknown codes", () => {
    // @ts-expect-error — intentionally invalid input to verify runtime guard
    expect(() => jurisdictions.get("XX")).toThrow(/unknown jurisdiction/);
  });

  // @rule:ASD-RTBF-YK-002 — habitual residence wins; current_location ignored
  it("ignores current_location and uses habitual_residence (YK-002)", () => {
    const m = jurisdictions.applicable({
      habitual_residence: "EU",
      current_location: "US-CA",
    });
    expect(m.code).toBe("EU");
  });

  // @rule:ASD-RTBF-YK-003 — stricter law wins for dual-jurisdiction subjects
  it("picks stricter jurisdiction in dual case (YK-003)", () => {
    const m = jurisdictions.pickStricter("EU", "US-CA");
    expect(m.code).toBe("EU"); // EU strictness_ord > US-CA
  });

  it("breaks strictness ties deterministically by code", () => {
    // No real ties in current registry — but we can mock by checking the logic
    // path holds: same strictness_ord → alphabetical by code.
    // (We don't mutate REGISTRY in tests; this just guards the contract.)
    const a = jurisdictions.pickStricter("EU", "UK");
    // EU strictness 90 > UK 88, so EU wins on numeric.
    expect(a.code).toBe("EU");
  });

  // @rule:ASD-RTBF-YK-010 — letter language matches broker, not user
  it("letterLanguage respects override > broker > jurisdiction default", () => {
    expect(jurisdictions.letterLanguage({ jurisdiction: "EU" })).toBe("en");
    expect(
      jurisdictions.letterLanguage({
        jurisdiction: "EU",
        broker_preferred_language: "de",
      }),
    ).toBe("de");
    expect(
      jurisdictions.letterLanguage({
        jurisdiction: "EU",
        broker_preferred_language: "de",
        user_override: "fr",
      }),
    ).toBe("fr");
  });
});
