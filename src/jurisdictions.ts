// Jurisdictions resolver — habitual-residence-first, stricter-law-second.
// Pure functions; safe to run on-device.

import type { JurisdictionCode, JurisdictionMeta } from "./types.ts";

// @rule:ASD-RTBF-001 → ASD-RTBF-009 — each statute row in the LOGICS doc
// is one entry below. Source citations stay verbatim from the LOGICS doc.
//
// strictness_ord is indicative — used only for stricter-law tie-breaking in
// dual-jurisdiction cases. Not a legal ranking.

const REGISTRY: Readonly<Record<JurisdictionCode, JurisdictionMeta>> =
  Object.freeze({
    EU: {
      code: "EU",
      name: "European Union / EEA",
      statute: "GDPR Art. 17 (Regulation 2016/679)",
      rule_id: "ASD-RTBF-001",
      language_default: "en",
      strictness_ord: 90,
    },
    UK: {
      code: "UK",
      name: "United Kingdom",
      statute: "UK GDPR Art. 17 + Data Protection Act 2018",
      rule_id: "ASD-RTBF-006",
      language_default: "en",
      strictness_ord: 88,
    },
    CH: {
      code: "CH",
      name: "Switzerland",
      statute: "revFADP Art. 32",
      rule_id: "ASD-RTBF-009",
      language_default: "en",
      strictness_ord: 80,
    },
    BR: {
      code: "BR",
      name: "Brazil",
      statute: "LGPD Art. 18 VI (Lei 13.709/2018)",
      rule_id: "ASD-RTBF-004",
      language_default: "pt-BR",
      strictness_ord: 70,
    },
    "US-CA": {
      code: "US-CA",
      name: "United States — California",
      statute: "CCPA §1798.105 / CPRA",
      rule_id: "ASD-RTBF-002",
      language_default: "en",
      strictness_ord: 60,
    },
    CA: {
      code: "CA",
      name: "Canada",
      statute: "PIPEDA Principle 9; Quebec Law 25",
      rule_id: "ASD-RTBF-005",
      language_default: "en",
      strictness_ord: 55,
    },
    KR: {
      code: "KR",
      name: "South Korea",
      statute: "PIPA Art. 36",
      rule_id: "ASD-RTBF-007",
      language_default: "ko",
      strictness_ord: 50,
    },
    JP: {
      code: "JP",
      name: "Japan",
      statute: "APPI 2022 amendment",
      rule_id: "ASD-RTBF-008",
      language_default: "ja",
      strictness_ord: 45,
    },
    IN: {
      code: "IN",
      name: "India",
      statute: "DPDP Act 2023 §13",
      rule_id: "ASD-RTBF-003",
      language_default: "en",
      strictness_ord: 40,
    },
  });

export function get(code: JurisdictionCode): JurisdictionMeta {
  const m = REGISTRY[code];
  if (!m) throw new Error(`unknown jurisdiction: ${String(code)}`);
  return m;
}

export function all(): JurisdictionMeta[] {
  return Object.values(REGISTRY);
}

/**
 * Resolve the applicable jurisdiction for a data subject.
 *
 * @rule:ASD-RTBF-YK-002 — selection follows habitual residence per GDPR
 * recital 23, NOT IP-detected location at request time. A traveling EU citizen
 * issuing requests from a US hotel WiFi remains GDPR-protected.
 *
 * The function therefore IGNORES `current_location` and returns the residence
 * jurisdiction. The parameter is accepted only so callers cannot accidentally
 * call a wrong-signature function — it must be passed but is not consulted.
 */
export function applicable(args: {
  habitual_residence: JurisdictionCode;
  current_location?: JurisdictionCode; // intentionally unused — see rule above
}): JurisdictionMeta {
  // @rule:ASD-RTBF-YK-002 — habitual residence is the contract.
  void args.current_location;
  return get(args.habitual_residence);
}

/**
 * @rule:ASD-RTBF-YK-003 — for dual-jurisdiction subjects (e.g. EU citizen
 * residing in US), invoke the stricter law in the erasure letter.
 *
 * Strictness is indicative (strictness_ord); ties resolved alphabetically
 * by code for determinism.
 */
export function pickStricter(
  a: JurisdictionCode,
  b: JurisdictionCode,
): JurisdictionMeta {
  const ma = get(a);
  const mb = get(b);
  if (ma.strictness_ord > mb.strictness_ord) return ma;
  if (mb.strictness_ord > ma.strictness_ord) return mb;
  return ma.code < mb.code ? ma : mb;
}

/**
 * @rule:ASD-RTBF-YK-010 — letter language matches the BROKER's primary
 * operating language, not the subject's. A US-based broker receiving a
 * request from an EU citizen gets the letter in English with explicit
 * GDPR-Art-17 citation. We expose a resolver here for callers that have
 * the broker's preferred language; default is the jurisdiction's language.
 */
export function letterLanguage(args: {
  jurisdiction: JurisdictionCode;
  broker_preferred_language?: string;
  user_override?: string;
}): string {
  if (args.user_override) return args.user_override;
  if (args.broker_preferred_language) return args.broker_preferred_language;
  return get(args.jurisdiction).language_default;
}
