import { afterEach, describe, expect, it } from "bun:test";
import * as brokers from "../broker-registry.ts";

afterEach(() => {
  brokers._resetOverlay();
});

describe("broker-registry", () => {
  it("seeds 10 brokers", () => {
    expect(brokers.all().length).toBeGreaterThanOrEqual(10);
  });

  it("get returns specific entries", () => {
    const wp = brokers.get("whitepages");
    expect(wp?.domain).toBe("whitepages.com");
    expect(wp?.active_jurisdictions).toContain("US-CA");
  });

  it("byJurisdiction filters correctly", () => {
    const us = brokers.byJurisdiction("US-CA");
    const uk = brokers.byJurisdiction("UK");
    expect(us.length).toBeGreaterThan(0);
    expect(uk.length).toBeGreaterThan(0);
    expect(us.find((b) => b.id === "whitepages")).toBeDefined();
    expect(uk.find((b) => b.id === "192.com")).toBeDefined();
  });

  it("Truecaller appears in IN + EU + UK (ANKR addition)", () => {
    const t = brokers.get("truecaller");
    expect(t?.active_jurisdictions).toEqual(["IN", "EU", "UK"]);
    expect(t?.source).toBe("ankr");
  });

  // @rule:ASD-RTBF-YK-008 — user contributions land as user-claimed, not verified
  // @rule:INF-ASD-RTBF-011 — promotion requires 3+ confirmations (upstream concern)
  it("contribute adds user-claimed entries (YK-008)", () => {
    const e = brokers.contribute({
      id: "newbroker",
      domain: "newbroker.example",
      display_name: "New Broker",
      category: "data_broker",
      opt_out_method: "form",
      id_requirement: "email_only",
      active_jurisdictions: ["EU"],
    });
    expect(e.verification).toBe("user-claimed");
    expect(e.source).toBe("user_contributed");
    expect(brokers.get("newbroker")?.verification).toBe("user-claimed");
  });

  it("contribute is idempotent for existing ids (no overwrite)", () => {
    brokers.contribute({
      id: "newbroker",
      domain: "newbroker.example",
      display_name: "First",
      category: "data_broker",
      opt_out_method: "form",
      id_requirement: "email_only",
      active_jurisdictions: ["EU"],
    });
    const second = brokers.contribute({
      id: "newbroker",
      domain: "newbroker.example",
      display_name: "Second", // attempt overwrite
      category: "data_broker",
      opt_out_method: "form",
      id_requirement: "email_only",
      active_jurisdictions: ["UK"],
    });
    expect(second.display_name).toBe("First");
  });

  it("reingestionCadenceDays defaults to 60 for unknown brokers", () => {
    expect(brokers.reingestionCadenceDays("totally-unknown")).toBe(60);
    expect(brokers.reingestionCadenceDays("mylife")).toBe(30); // MyLife is the 30-day hostile case
  });
});
