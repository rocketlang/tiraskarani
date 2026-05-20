import { describe, expect, it } from "bun:test";
import * as vm from "../visibility-map.ts";
import type { VisibilityEntry } from "../types.ts";

const PLACE_WP = { id: "whitepages", category: "data_broker" as const };
const PLACE_LI = { id: "linkedin", category: "social" as const };

function entry(
  place: { id: string; category: "data_broker" | "social" },
  intent: VisibilityEntry["intent"],
  updated_at = "2026-05-20T00:00:00Z",
): VisibilityEntry {
  return { place, intent, updated_at };
}

describe("visibility-map", () => {
  it("create + upsert + get", () => {
    let m = vm.create({ user_id: "u1" });
    m = vm.upsert(m, entry(PLACE_WP, "erase"));
    expect(vm.get(m, "whitepages")?.intent).toBe("erase");
    m = vm.upsert(m, entry(PLACE_WP, "minimize"));
    expect(vm.get(m, "whitepages")?.intent).toBe("minimize");
    expect(m.entries.length).toBe(1); // upsert not duplicate
  });

  it("setIntent rejects unknown places", () => {
    const m = vm.create({ user_id: "u1" });
    expect(() => vm.setIntent(m, "whitepages", "erase")).toThrow(/unknown place/);
  });

  it("diff: detects added/removed/changed_intent", () => {
    const base = vm.upsert(vm.create({ user_id: "u1" }), entry(PLACE_WP, "erase"));
    const cur = vm.upsert(
      vm.upsert(vm.create({ user_id: "u1" }), entry(PLACE_WP, "minimize")),
      entry(PLACE_LI, "keep"),
    );
    const d = vm.diff(base, cur);
    expect(d.added.length).toBe(1);
    expect(d.added[0]!.place.id).toBe("linkedin");
    expect(d.removed.length).toBe(0);
    expect(d.changed_intent.length).toBe(1);
    expect(d.changed_intent[0]!.from).toBe("erase");
    expect(d.changed_intent[0]!.to).toBe("minimize");
  });

  // @rule:ASD-RTBF-YK-005 — re-ingestion = present-now-absent-in-baseline AND user wanted gone
  it("flags re-ingestion only when intent was erase/minimize (YK-005)", () => {
    const base = vm.create({ user_id: "u1" });
    const curErase = vm.upsert(vm.create({ user_id: "u1" }), entry(PLACE_WP, "erase"));
    expect(vm.diff(base, curErase).re_ingested.length).toBe(1);

    const curKeep = vm.upsert(vm.create({ user_id: "u1" }), entry(PLACE_LI, "keep"));
    // present-but-keep is not a re-ingestion event
    expect(vm.diff(base, curKeep).re_ingested.length).toBe(0);
  });

  // @rule:ASD-RTBF-YK-007 — whitelist wins on conflict
  it("actionable filters out keep-intent places (YK-007)", () => {
    let m = vm.create({ user_id: "u1" });
    m = vm.upsert(m, entry(PLACE_LI, "keep"));
    m = vm.upsert(m, entry(PLACE_WP, "erase"));
    const discovered = [PLACE_WP, PLACE_LI, { id: "spokeo", category: "data_broker" as const }];
    const act = vm.actionable(m, discovered);
    expect(act.map((p) => p.id).sort()).toEqual(["spokeo", "whitepages"]);
    expect(act.find((p) => p.id === "linkedin")).toBeUndefined();
  });

  it("diff: user_id mismatch throws", () => {
    const a = vm.create({ user_id: "u1" });
    const b = vm.create({ user_id: "u2" });
    expect(() => vm.diff(a, b)).toThrow(/user_id mismatch/);
  });
});
