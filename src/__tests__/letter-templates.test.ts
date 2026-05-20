import { describe, expect, it } from "bun:test";
import * as letters from "../letter-templates.ts";
import * as brokers from "../broker-registry.ts";
import type { LetterContext } from "../types.ts";

function ctx(
  override: Partial<LetterContext> = {},
): LetterContext {
  return {
    subject_full_name: "Asha Patel",
    subject_email_alias: "asha.rtbf+xx@simplelogin.example",
    subject_residence: "EU",
    broker: brokers.get("192.com")!,
    ...override,
  };
}

describe("letter-templates", () => {
  it("supports EU + UK + US-CA at Phase 2 start", () => {
    expect(letters.supported().sort()).toEqual(["EU", "UK", "US-CA"]);
  });

  it("throws for unsupported jurisdiction (BR pending in Phase 2 expansion)", () => {
    expect(() =>
      letters.fill(ctx({ subject_residence: "BR" })),
    ).toThrow(/letter generation for jurisdiction BR pending/);
  });

  it("EU GDPR letter cites Art. 17 + Art. 12(3) + Recital 23", () => {
    const out = letters.fill(ctx());
    expect(out.jurisdiction).toBe("EU");
    expect(out.subject_line).toContain("GDPR Article 17");
    expect(out.body).toContain("Article 17");
    expect(out.body).toContain("Asha Patel");
    expect(out.body).toContain("192.com");
    expect(out.citations).toContain("GDPR Art. 17 (Right to erasure)");
    expect(out.citations).toContain("GDPR Recital 23 (Habitual residence)");
  });

  it("UK GDPR letter cites UK GDPR + DPA 2018", () => {
    const out = letters.fill(ctx({ subject_residence: "UK" }));
    expect(out.jurisdiction).toBe("UK");
    expect(out.body).toContain("UK GDPR");
    expect(out.body).toContain("Data Protection Act 2018");
    expect(out.body).toContain("Information Commissioner");
  });

  it("CCPA letter cites §1798.105 + §1798.130 + ID-narrowing", () => {
    const out = letters.fill(
      ctx({
        subject_residence: "US-CA",
        broker: brokers.get("whitepages")!,
      }),
    );
    expect(out.jurisdiction).toBe("US-CA");
    expect(out.body).toContain("California Consumer Privacy Act");
    expect(out.body).toContain("§1798.105");
    expect(out.body).toContain("45 days");
    expect(out.body).toContain("statutory exceptions");
  });

  // @rule:ASD-RTBF-YK-006 — IDV resolution order surfaced in every letter
  it("IDV clause matches preference (YK-006)", () => {
    const zk = letters.fill(ctx({ idv_preference: "zk" }));
    expect(zk.body).toContain("zero-knowledge proof");

    const red = letters.fill(ctx({ idv_preference: "redacted" }));
    expect(red.body).toContain("redacted");

    const refuse = letters.fill(ctx({ idv_preference: "refuse" }));
    expect(refuse.body).toMatch(/do not consent/i);

    const noPref = letters.fill(ctx());
    expect(noPref.body).toContain("minimum lawful basis");
  });

  // @rule:ASD-RTBF-018 — content_hash is stable for identical inputs
  it("content_hash is deterministic given identical inputs", () => {
    const a = letters.fill(ctx({ idv_preference: "zk" }));
    const b = letters.fill(ctx({ idv_preference: "zk" }));
    // body contains {{today_iso}} which is current date — same day = same hash
    expect(a.content_hash).toBe(b.content_hash);
    expect(a.content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rule_ids include jurisdiction statute + cross-cutting YUKTI rules", () => {
    const out = letters.fill(ctx());
    expect(out.rule_ids).toContain("@rule:ASD-RTBF-001");
    expect(out.rule_ids).toContain("@rule:ASD-RTBF-YK-006");
    expect(out.rule_ids).toContain("@rule:ASD-RTBF-YK-004");
  });

  it("appends user_provided facts verbatim (no validation)", () => {
    const out = letters.fill(
      ctx({ user_provided: { previous_address: "12 High St, London" } }),
    );
    expect(out.body).toContain("Additional details");
    expect(out.body).toContain("12 High St, London");
  });
});
