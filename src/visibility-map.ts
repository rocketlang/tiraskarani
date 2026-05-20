// Visibility map — the canonical record of user intent across the places
// where the user (or protected principal in B2B flow) exists on the net.
//
// @rule:ASD-RTBF-011 — selective visibility is a user-declared whitelist of
// platforms where presence is deliberately preserved, distinct from binary erasure.
// @rule:ASD-RTBF-YK-007 — when a broker responds with partial removal, compare
// actual broker state against THIS map (not against deletion-time state); partial
// removal that aligns with the user's whitelist is a success, not a failure.

import type {
  PlaceRef,
  VisibilityDiff,
  VisibilityEntry,
  VisibilityIntent,
  VisibilityMap,
} from "./types.ts";

export function create(args: {
  user_id: string;
  source?: VisibilityMap["source"];
}): VisibilityMap {
  return {
    user_id: args.user_id,
    entries: [],
    generated_at: new Date().toISOString(),
    source: args.source ?? "user",
  };
}

export function upsert(
  map: VisibilityMap,
  entry: Omit<VisibilityEntry, "updated_at"> & { updated_at?: string },
): VisibilityMap {
  const now = entry.updated_at ?? new Date().toISOString();
  const e: VisibilityEntry = { ...entry, updated_at: now };
  const idx = map.entries.findIndex((x) => x.place.id === e.place.id);
  const next = idx === -1
    ? [...map.entries, e]
    : map.entries.map((x, i) => (i === idx ? e : x));
  return { ...map, entries: next, generated_at: now };
}

export function get(map: VisibilityMap, place_id: string): VisibilityEntry | undefined {
  return map.entries.find((e) => e.place.id === place_id);
}

export function setIntent(
  map: VisibilityMap,
  place_id: string,
  intent: VisibilityIntent,
): VisibilityMap {
  const existing = get(map, place_id);
  if (!existing) {
    throw new Error(`cannot set intent on unknown place: ${place_id}`);
  }
  return upsert(map, { ...existing, intent });
}

/**
 * @rule:ASD-RTBF-YK-005 — re-ingestion detection rule: compare current scan
 * against the last-90-day baseline. A presence-record absent in the baseline
 * but present now AND with user intent `erase`/`minimize` = a re-ingestion event.
 *
 * @rule:ASD-RTBF-YK-007 — partial removal that aligns with whitelist is a
 * success, not a failure (intent `keep` places do NOT count as re-ingested).
 */
export function diff(
  baseline: VisibilityMap,
  current: VisibilityMap,
): VisibilityDiff {
  if (baseline.user_id !== current.user_id) {
    throw new Error(
      `visibility-map.diff: user_id mismatch — baseline=${baseline.user_id} current=${current.user_id}`,
    );
  }
  const baseIds = new Map(baseline.entries.map((e) => [e.place.id, e]));
  const curIds = new Map(current.entries.map((e) => [e.place.id, e]));

  const added: VisibilityEntry[] = [];
  const removed: VisibilityEntry[] = [];
  const changed_intent: VisibilityDiff["changed_intent"] = [];
  const re_ingested: VisibilityEntry[] = [];

  for (const [id, curEntry] of curIds) {
    const baseEntry = baseIds.get(id);
    if (!baseEntry) {
      added.push(curEntry);
      // @rule:ASD-RTBF-YK-005 — newly-present + user wanted gone = re-ingestion
      if (curEntry.intent === "erase" || curEntry.intent === "minimize") {
        re_ingested.push(curEntry);
      }
      continue;
    }
    if (baseEntry.intent !== curEntry.intent) {
      changed_intent.push({
        place: curEntry.place,
        from: baseEntry.intent,
        to: curEntry.intent,
      });
    }
  }
  for (const [id, baseEntry] of baseIds) {
    if (!curIds.has(id)) removed.push(baseEntry);
  }

  return { added, removed, changed_intent, re_ingested };
}

/**
 * @rule:ASD-RTBF-YK-007 — reconcile a discovery scan against the user's
 * declared whitelist. Returns the entries that should be ACTIONED (letters sent,
 * re-cloaks scheduled), filtering out those the user explicitly wants kept.
 */
export function actionable(
  map: VisibilityMap,
  discovered: PlaceRef[],
): PlaceRef[] {
  const intentByPlace = new Map(map.entries.map((e) => [e.place.id, e.intent]));
  return discovered.filter((p) => {
    const intent = intentByPlace.get(p.id);
    // No declared intent OR declared erase/minimize = act on it.
    // intent === 'keep' → skip (whitelist wins).
    if (intent === "keep") return false;
    return true;
  });
}
