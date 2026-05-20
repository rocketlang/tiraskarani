# Tiraskaraṇī (तिरस्करणी)

> *The Mahabharata cloak of invisibility — worn by warriors and divine actors to enter hostile fields unseen.*

The right-to-be-forgotten engine. AGPL-3.0. Pure functions, on-device-safe, no runtime state.

Powers three product layers:
- **xShieldAI.me** — consumer SaaS
- **AnkrShield desktop** — open-core, local-first
- **xShieldAI** — B2B enterprise

The engine is **independent of product brand**. Forks are free to adopt the OSS path; the brands stay ours (see `NOTICE`).

## Status

**Phase 2 — initial scaffolding** (v0.1.0). What's in the box:

| Module | Status | Rules implemented |
|---|---|---|
| `jurisdictions` | ✅ all 9 jurisdictions (EU, UK, CH, BR, US-CA, CA, KR, JP, IN) | ASD-RTBF-001 to 009, YK-002, YK-003, YK-010 |
| `visibility-map` | ✅ create / upsert / diff / actionable | ASD-RTBF-011, YK-005, YK-007 |
| `broker-registry` | ✅ 10 seed brokers (JustDeleteMe-derived + ANKR additions) | ASD-RTBF-010, YK-008, INF-011 |
| `letter-templates` | ✅ EU GDPR + UK GDPR + CCPA | ASD-RTBF-001, 002, 006, 015, 018, YK-004, YK-006, YK-010 |
| `scan-engine` | ⬜ Phase 2.2 | ASD-RTBF-012 |
| `recloak-scheduler` | ⬜ Phase 2.3 | ASD-RTBF-017, YK-005 |
| `letter-templates` (DPDP/LGPD/PIPEDA/APPI/PIPA/revFADP) | ⬜ Phase 2.4 | ASD-RTBF-003 to 009 |

28 unit tests passing.

## Install

```bash
npm install @xshieldai/tiraskarani
# or
bun add @xshieldai/tiraskarani
```

## Use

```ts
import {
  jurisdictions,
  visibilityMap,
  brokerRegistry,
  letterTemplates,
} from "@xshieldai/tiraskarani";

// 1. Resolve applicable law — habitual residence wins (ASD-RTBF-YK-002)
const law = jurisdictions.applicable({
  habitual_residence: "EU",
  current_location: "US-CA", // ignored
});
// → { code: "EU", statute: "GDPR Art. 17 (Regulation 2016/679)", ... }

// 2. Pick the right broker
const broker = brokerRegistry.get("whitepages");

// 3. Generate the letter
const letter = letterTemplates.fill({
  subject_full_name: "Asha Patel",
  subject_email_alias: "asha.rtbf+xx@simplelogin.example",
  subject_residence: "EU",
  broker: broker!,
  idv_preference: "redacted", // ASD-RTBF-YK-006 — surface the dilemma upfront
});
// → { subject_line, body, citations, content_hash, rule_ids, ... }

// 4. Track user intent across discovered places
const map = visibilityMap.create({ user_id: "asha" });
const next = visibilityMap.upsert(map, {
  place: { id: "linkedin", category: "social" },
  intent: "keep", // ASD-RTBF-011 — selective visibility, not binary erasure
});
```

## License

AGPL-3.0. See [LICENSE](LICENSE).

**SaaS notice:** running modified Tiraskaraṇī as a network service requires you to release your modifications under the same license. Commercial license (no copyleft propagation) available — contact `captain@ankr.in`.

## Provenance

The broker registry seed leans on the MIT-licensed [JustDeleteMe](https://justdeleteme.xyz/) project for opt-out URLs and difficulty ratings. Where we have imported entries, MIT attribution stands. ANKR additions — jurisdiction tagging, ID-requirement classification, re-ingestion cadence estimates — are AGPL-3.0. See [NOTICE](NOTICE).

## Rules

Every public function carries `@rule:ASD-RTBF-NNN` annotations citing the LOGICS doc at `/root/proposals/ankrshield-desktop-rtbf--logics--formal--2026-05-19.md` (in the ANKR repo). The Forja `PROOF` endpoint at `http://localhost:4859/api/v2/forja/proof` scans this codebase as a downstream of the parent `ankrshield-desktop-rtbf` service and reports coverage.

## Spin-out gates

The engine remains under the `ankrshield-desktop-rtbf` substrate until any of:

1. First paid B2B contract
2. Live billing landing page
3. ≥1K npm monthly downloads OR ≥3 external maintainers

At any one of those, Tiraskaraṇī gets its own service-key + codex.json + GitHub org (`tiraskarani` or `@xshieldai/tiraskarani` standalone). Until then, file-as-index discipline keeps the `ankrshield-desktop-rtbf--` prefix on docs.

## Trademark

"xShieldAI", "AnkrShield", "Olvidito" — trademarks of ANKR Labs / PowerBox IT Solutions Pvt Ltd. AGPL grants code rights, not trademark rights. Forks must not use the marks to identify modified versions.

---

*तिरस्करणी — invisibility as disciplined, intentional, reversible — not opaque, not deceptive.*
