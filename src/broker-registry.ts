// Broker registry — read-side API over the seed JSON + caller-supplied additions.
// Pure: no I/O after import; safe to run on-device.
//
// @rule:ASD-RTBF-010 — brokers re-ingest from public records on 30-90 day cycles
// @rule:ASD-RTBF-016 — user-contributed exposure-graph is anonymized-aggregate
// @rule:INF-ASD-RTBF-011 — registry promotion requires >=3 independent confirmations

import seedData from "../data/brokers.seed.json" with { type: "json" };
import type { BrokerEntry, JurisdictionCode } from "./types.ts";

interface SeedShape {
  _meta: Record<string, unknown>;
  brokers: BrokerEntry[];
}

const SEED = seedData as SeedShape;

// Mutable in-memory overlay for user-contributed entries (in-process; persisted
// by the upstream service, NOT by the engine).
const _overlay = new Map<string, BrokerEntry>();

export function all(): BrokerEntry[] {
  const out = SEED.brokers.slice();
  for (const e of _overlay.values()) {
    const idx = out.findIndex((x) => x.id === e.id);
    if (idx === -1) out.push(e);
    else out[idx] = e;
  }
  return out;
}

export function get(id: string): BrokerEntry | undefined {
  return _overlay.get(id) ?? SEED.brokers.find((b) => b.id === id);
}

export function byJurisdiction(j: JurisdictionCode): BrokerEntry[] {
  // active_jurisdictions=[] means global/unknown — include in every jurisdiction
  return all().filter(
    (b) => b.active_jurisdictions.length === 0 || b.active_jurisdictions.includes(j),
  );
}

/**
 * @rule:ASD-RTBF-YK-008 — when a user contribution names a place not in the
 * registry, the engine accepts it as `user-claimed` (NOT `registry-verified`).
 * Promotion to verified happens upstream after >=3 independent confirmations
 * per @rule:INF-ASD-RTBF-011.
 */
export function contribute(entry: Omit<BrokerEntry, "verification" | "source">): BrokerEntry {
  const existing = get(entry.id);
  if (existing) return existing;
  const e: BrokerEntry = {
    ...entry,
    source: "user_contributed",
    verification: "user-claimed",
  };
  _overlay.set(e.id, e);
  return e;
}

/**
 * Intended for tests + tooling — reset overlay state.
 */
export function _resetOverlay(): void {
  _overlay.clear();
}

/**
 * Re-ingestion cadence lookup — used by re-cloak scheduler to set per-broker
 * sweep intervals. Falls back to 60 days if unknown.
 *
 * @rule:ASD-RTBF-YK-005 — re-ingestion detection compares against the
 * last-90-day baseline; cadence here drives WHEN to re-scan, not WHETHER
 * to flag a re-ingestion event.
 */
export function reingestionCadenceDays(broker_id: string): number {
  const b = get(broker_id);
  if (!b) return 60;
  return b.reingestion_cadence_days ?? 60;
}
