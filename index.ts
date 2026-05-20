// Tiraskaraṇī (तिरस्करणी) — public API surface.
// AGPL-3.0 — see LICENSE.
//
// @rule:ASD-RTBF-013 — OSS engine, AGPL-3.0
// @rule:ASD-RTBF-020 — engine name independent of product brand
//                       (xShieldAI.me / AnkrShield desktop / xShieldAI B2B all wrap this)

export * as jurisdictions from "./src/jurisdictions.ts";
export * as visibilityMap from "./src/visibility-map.ts";
export * as brokerRegistry from "./src/broker-registry.ts";
export * as letterTemplates from "./src/letter-templates.ts";
export type {
  BrokerEntry,
  GeneratedLetter,
  IdRequirement,
  JurisdictionCode,
  JurisdictionMeta,
  LetterContext,
  PlaceCategory,
  PlaceRef,
  VisibilityDiff,
  VisibilityEntry,
  VisibilityIntent,
  VisibilityMap,
} from "./src/types.ts";

export const VERSION = "0.1.0";
export const NAME = "@xshieldai/tiraskarani";

// Module metadata for caller introspection (e.g. ankrshield-desktop-rtbf
// Forja STATE can include engine version when wired).
export const ENGINE_META = {
  name: NAME,
  version: VERSION,
  license: "AGPL-3.0",
  supported_jurisdictions_letters: ["EU", "UK", "US-CA"] as const,
  supported_jurisdictions_metadata: [
    "EU",
    "UK",
    "CH",
    "BR",
    "US-CA",
    "CA",
    "KR",
    "JP",
    "IN",
  ] as const,
  rules_doc:
    "/root/proposals/ankrshield-desktop-rtbf--logics--formal--2026-05-19.md",
};
