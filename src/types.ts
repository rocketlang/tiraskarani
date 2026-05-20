// Shared types for Tiraskaraṇī engine modules.
// @rule:ASD-RTBF-013 — AGPL-3.0 OSS engine; types stay public surface.

// ── Jurisdictions ───────────────────────────────────────────────────────────
// @rule:ASD-RTBF-001 → ASD-RTBF-009 — each jurisdiction below corresponds to a
// statute row in the LOGICS doc.

export type JurisdictionCode =
  | "EU" // ASD-RTBF-001 — GDPR Art. 17
  | "US-CA" // ASD-RTBF-002 — CCPA / CPRA
  | "IN" // ASD-RTBF-003 — DPDP Act 2023 §13
  | "BR" // ASD-RTBF-004 — LGPD Art. 18 VI
  | "CA" // ASD-RTBF-005 — PIPEDA / Quebec Law 25
  | "UK" // ASD-RTBF-006 — UK GDPR + Data Protection Act 2018
  | "KR" // ASD-RTBF-007 — PIPA Art. 36
  | "JP" // ASD-RTBF-008 — APPI 2022 amendment
  | "CH"; // ASD-RTBF-009 — revFADP Art. 32

export interface JurisdictionMeta {
  code: JurisdictionCode;
  name: string;
  statute: string; // canonical citation
  rule_id: string; // ASD-RTBF-NNN that anchors this jurisdiction
  language_default: string; // ISO 639-1 + region (used for letter language unless overridden)
  // Strictness for stricter-law tie-breaking — higher = more demanding on controllers.
  // Indicative ordinal used by jurisdictions.pickStricter(); NOT a legal ranking.
  strictness_ord: number;
}

// ── Visibility map ─────────────────────────────────────────────────────────
// @rule:ASD-RTBF-011 — selective visibility = user-declared whitelist of platforms
// where presence is deliberately preserved. Distinct from binary erasure.

export type VisibilityIntent = "keep" | "erase" | "minimize" | "unknown";

export interface PlaceRef {
  id: string; // stable place id (e.g. broker domain or platform slug)
  category: PlaceCategory;
  display_name?: string;
}

export type PlaceCategory =
  | "data_broker"
  | "social"
  | "search_engine"
  | "public_record"
  | "breach_corpus"
  | "professional"
  | "marketplace"
  | "other";

export interface VisibilityEntry {
  place: PlaceRef;
  intent: VisibilityIntent;
  // Optional fine-grained controls — populated by user via UI / API.
  preserve_fields?: string[]; // e.g. ["display_name", "city"] (kept) vs everything else (erased)
  notes?: string;
  updated_at: string; // ISO 8601
}

export interface VisibilityMap {
  user_id: string;
  entries: VisibilityEntry[];
  // Map-level metadata
  generated_at: string;
  source: "user" | "discovery" | "import";
}

// @rule:ASD-RTBF-YK-007 — whitelist conflicts reconciled in favor of the whitelist
export interface VisibilityDiff {
  added: VisibilityEntry[]; // new places that appeared since baseline
  removed: VisibilityEntry[]; // places no longer present (deletion confirmed)
  changed_intent: Array<{
    place: PlaceRef;
    from: VisibilityIntent;
    to: VisibilityIntent;
  }>;
  // @rule:ASD-RTBF-YK-005 — re-ingestion event: in current but absent in baseline,
  // AND the user's intent was 'erase' or 'minimize'.
  re_ingested: VisibilityEntry[];
}

// ── Broker registry ────────────────────────────────────────────────────────
// @rule:ASD-RTBF-010 — brokers re-ingest from public records on 30-90 day cycles

export type IdRequirement =
  | "none"
  | "email_only"
  | "email_plus_address"
  | "government_id"
  | "ssn"
  | "in_person";

export interface BrokerEntry {
  id: string; // domain-derived stable id
  domain: string;
  display_name: string;
  category: PlaceCategory;
  opt_out_url?: string;
  opt_out_method: "form" | "email" | "phone" | "letter" | "unknown";
  id_requirement: IdRequirement;
  // Approximate re-ingestion cadence in days. Used by re-cloak scheduler.
  reingestion_cadence_days?: number;
  // Jurisdictions where the broker has a notable presence (for letter-routing).
  // Empty array = unknown / global.
  active_jurisdictions: JurisdictionCode[];
  // Where the registry entry came from (attribution discipline).
  source: "justdeleteme" | "ankr" | "user_contributed" | "external";
  source_note?: string;
  // Status: "registry-verified" requires >=3 independent confirmations per
  // @rule:INF-ASD-RTBF-011.
  verification: "registry-verified" | "user-claimed" | "deprecated";
}

// ── Letter generation ──────────────────────────────────────────────────────
// @rule:ASD-RTBF-001 → ASD-RTBF-009 — per-jurisdiction templates

export interface LetterContext {
  // Identity of the data subject (operator OR principal in B2B flow).
  // @rule:ASD-RTBF-YK-009 — operator NEVER conflated with protected-person.
  subject_full_name: string;
  subject_email_alias?: string; // SimpleLogin alias for reply routing
  subject_residence: JurisdictionCode; // controls statute citation
  broker: BrokerEntry;
  // Optional override for letter language (defaults to broker's primary language
  // per ASD-RTBF-YK-010 — match broker's operating language, not subject's).
  language_override?: string;
  // ID-verification preference per ASD-RTBF-YK-006.
  idv_preference?: "zk" | "redacted" | "refuse";
  // Free-form details the user supplies — addresses, dates, evidence URLs.
  // Engine does NOT validate these; they get embedded verbatim into the body.
  user_provided?: Record<string, string>;
}

export interface GeneratedLetter {
  subject_line: string;
  body: string;
  citations: string[]; // statute references included in the body
  language: string; // ISO 639-1 actually used
  jurisdiction: JurisdictionCode;
  rule_ids: string[]; // ASD-RTBF-NNN rules implemented by this letter
  // @rule:ASD-RTBF-018 — every letter is a Merkle-anchored event source.
  // The engine returns a stable hash of canonical content for chaining upstream.
  content_hash: string;
}
