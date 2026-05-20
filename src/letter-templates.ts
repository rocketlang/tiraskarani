// Letter generation for erasure requests.
// Pure functions: given (subject, broker, jurisdiction), return a letter.
// No network, no I/O. Upstream service is responsible for sending via mailer.
//
// @rule:ASD-RTBF-001 — GDPR Art. 17 erasure for EU/EEA data subjects
// @rule:ASD-RTBF-002 — CCPA / CPRA deletion for California residents
// @rule:ASD-RTBF-006 — UK GDPR Art. 17 erasure for UK data subjects

import { createHash } from "node:crypto";
import type {
  GeneratedLetter,
  JurisdictionCode,
  LetterContext,
} from "./types.ts";
import * as jurisdictions from "./jurisdictions.ts";

// ── Public API ──────────────────────────────────────────────────────────────

const SUPPORTED: JurisdictionCode[] = ["EU", "UK", "US-CA"];

export function supported(): JurisdictionCode[] {
  return SUPPORTED.slice();
}

export function template(jurisdiction: JurisdictionCode): string {
  // Returns the canonical template text for inspection / tooling.
  // The actual letter generation uses fill() below.
  switch (jurisdiction) {
    case "EU":
      return EU_GDPR;
    case "UK":
      return UK_GDPR;
    case "US-CA":
      return CCPA;
    default:
      throw new Error(
        `letter template not yet implemented for ${jurisdiction} — Phase 2 expanding to IN/BR/CA/KR/JP/CH next`,
      );
  }
}

export function fill(ctx: LetterContext): GeneratedLetter {
  const jur = ctx.subject_residence;
  if (!SUPPORTED.includes(jur)) {
    throw new Error(
      `letter generation for jurisdiction ${jur} pending — supported: ${SUPPORTED.join(", ")}`,
    );
  }
  const language = jurisdictions.letterLanguage({
    jurisdiction: jur,
    user_override: ctx.language_override,
  });
  const meta = jurisdictions.get(jur);

  const body = renderBody(jur, ctx, meta);
  const subject_line = renderSubject(jur, ctx);
  const citations = citationsFor(jur);
  const rule_ids = ruleIdsFor(jur, ctx);

  // @rule:ASD-RTBF-018 — Merkle-anchor source: hash canonical content for chaining
  const content_hash = createHash("sha256")
    .update(
      JSON.stringify({
        jurisdiction: jur,
        language,
        broker_id: ctx.broker.id,
        subject: ctx.subject_full_name,
        body,
      }),
    )
    .digest("hex");

  return {
    subject_line,
    body,
    citations,
    language,
    jurisdiction: jur,
    rule_ids,
    content_hash,
  };
}

// ── Internal rendering ─────────────────────────────────────────────────────

function renderSubject(jur: JurisdictionCode, ctx: LetterContext): string {
  switch (jur) {
    case "EU":
      return `GDPR Article 17 Erasure Request — ${ctx.subject_full_name}`;
    case "UK":
      return `UK GDPR Article 17 Erasure Request — ${ctx.subject_full_name}`;
    case "US-CA":
      return `CCPA Deletion Request — ${ctx.subject_full_name}`;
    default:
      return `Erasure Request — ${ctx.subject_full_name}`;
  }
}

function renderBody(
  jur: JurisdictionCode,
  ctx: LetterContext,
  meta: ReturnType<typeof jurisdictions.get>,
): string {
  const tpl = template(jur);
  // Tiny placeholder substitution. Intentionally minimal — engine never
  // validates user_provided fields (those are user-supplied facts).
  const replacements: Record<string, string> = {
    "{{subject_full_name}}": ctx.subject_full_name,
    "{{subject_email_alias}}": ctx.subject_email_alias ?? "[reply-via-SimpleLogin-alias-on-record]",
    "{{broker_display_name}}": ctx.broker.display_name,
    "{{broker_domain}}": ctx.broker.domain,
    "{{statute}}": meta.statute,
    "{{jurisdiction_name}}": meta.name,
    "{{idv_clause}}": idvClause(ctx.idv_preference),
    "{{today_iso}}": new Date().toISOString().slice(0, 10),
    "{{escalation_clause}}": escalationClause(jur),
  };
  let body = tpl;
  for (const [k, v] of Object.entries(replacements)) {
    body = body.split(k).join(v);
  }
  // Append any extra user-provided facts (verbatim — engine NEVER validates)
  if (ctx.user_provided) {
    const extras = Object.entries(ctx.user_provided)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n");
    if (extras) body += `\n\nAdditional details supplied by the data subject:\n${extras}`;
  }
  return body;
}

// @rule:ASD-RTBF-YK-006 — IDV resolution order: ZK → redacted → refuse
function idvClause(pref: LetterContext["idv_preference"]): string {
  switch (pref) {
    case "zk":
      return "If identity verification is required, I am willing to provide a zero-knowledge proof of identity on request. I will not upload unredacted government identification.";
    case "redacted":
      return "If identity verification is required, I am willing to provide a copy of government-issued ID with all fields not strictly necessary for verification redacted. I will not provide an unredacted copy.";
    case "refuse":
      return "I do not consent to any identity-verification step that requires me to upload personal documents beyond what the applicable law strictly requires for this erasure request. Please confirm in writing what verification (if any) is required under the statute cited above.";
    default:
      return "If identity verification is required, please specify the minimum lawful basis for the verification, what documents are required, and how they will be processed and retained.";
  }
}

// @rule:ASD-RTBF-YK-004 — at most 2 follow-ups in 30 days before escalating to regulator
function escalationClause(jur: JurisdictionCode): string {
  switch (jur) {
    case "EU":
      return "If this request is not fulfilled within one month per GDPR Article 12(3), I will exercise my right to lodge a complaint with the supervisory authority in my Member State of habitual residence.";
    case "UK":
      return "If this request is not fulfilled within one month per UK GDPR Article 12(3), I will exercise my right to lodge a complaint with the Information Commissioner's Office (ICO).";
    case "US-CA":
      return "Per CCPA §1798.130 and the regulations of the California Privacy Protection Agency (CPPA), please confirm receipt within 10 business days and complete the request within 45 days. If unaddressed, I will file a complaint with the CPPA and the California Attorney General.";
    default:
      return "";
  }
}

function citationsFor(jur: JurisdictionCode): string[] {
  switch (jur) {
    case "EU":
      return [
        "GDPR Art. 17 (Right to erasure)",
        "GDPR Art. 12(3) (Time limit)",
        "GDPR Recital 23 (Habitual residence)",
      ];
    case "UK":
      return [
        "UK GDPR Art. 17 (Right to erasure)",
        "UK GDPR Art. 12(3) (Time limit)",
        "Data Protection Act 2018 §45 (Right to erasure)",
      ];
    case "US-CA":
      return [
        "CCPA §1798.105 (Consumer right to deletion)",
        "CCPA §1798.130 (Notice / response timeline)",
        "CPRA / Cal. Civ. Code §1798.140",
      ];
    default:
      return [];
  }
}

function ruleIdsFor(
  jur: JurisdictionCode,
  ctx: LetterContext,
): string[] {
  const out = [`@rule:${jurisdictions.get(jur).rule_id}`];
  // IDV preference cites YK-006 unconditionally — the letter ALWAYS surfaces
  // the dilemma, even when the user has not picked a preference.
  out.push("@rule:ASD-RTBF-YK-006");
  // Letter language selection
  out.push("@rule:ASD-RTBF-YK-010");
  // Escalation cadence
  out.push("@rule:ASD-RTBF-YK-004");
  // ID-expansion-resistance
  out.push("@rule:ASD-RTBF-015");
  void ctx;
  return out;
}

// ── Templates ──────────────────────────────────────────────────────────────
// Letters are intentionally direct, no boilerplate filler. They cite statute,
// state the request, identify the subject, and surface the IDV dilemma upfront.

const EU_GDPR = `Date: {{today_iso}}

To: {{broker_display_name}} ({{broker_domain}}) — Data Protection Officer / Privacy Team

Subject: GDPR Article 17 Erasure Request

I am a data subject within the European Union / EEA, exercising my right to erasure of personal data under Article 17 of the General Data Protection Regulation (Regulation (EU) 2016/679) and the applicable national implementing law of {{jurisdiction_name}}.

Statute: {{statute}}.

Identity (for record matching ONLY — not as authorisation to retain):
  - Name: {{subject_full_name}}
  - Reply-to: {{subject_email_alias}}

I request:
  1. Erasure of all personal data you hold concerning me, including but not limited to: name, contact details, biographical data, location data, behavioural data, derived inferences, and any data shared with downstream recipients.
  2. Confirmation in writing of the erasure, the categories of data erased, and any recipients to whom you have communicated the erasure (Article 19).
  3. A copy of the personal data being erased BEFORE deletion, for my records (Article 15, if I have not previously exercised this).

{{idv_clause}}

{{escalation_clause}}

Yours sincerely,
{{subject_full_name}}
`;

const UK_GDPR = `Date: {{today_iso}}

To: {{broker_display_name}} ({{broker_domain}}) — Data Protection Officer / Privacy Team

Subject: UK GDPR Article 17 Erasure Request

I am a data subject in the United Kingdom, exercising my right to erasure of personal data under Article 17 of the UK GDPR and the Data Protection Act 2018.

Statute: {{statute}}.

Identity (for record matching ONLY — not as authorisation to retain):
  - Name: {{subject_full_name}}
  - Reply-to: {{subject_email_alias}}

I request:
  1. Erasure of all personal data you hold concerning me, including but not limited to: name, contact details, biographical data, location data, behavioural data, derived inferences, and any data shared with downstream recipients.
  2. Confirmation in writing of the erasure, the categories of data erased, and any recipients to whom you have communicated the erasure (UK GDPR Article 19).
  3. A copy of the personal data being erased BEFORE deletion, for my records (UK GDPR Article 15).

{{idv_clause}}

{{escalation_clause}}

Yours sincerely,
{{subject_full_name}}
`;

const CCPA = `Date: {{today_iso}}

To: {{broker_display_name}} ({{broker_domain}}) — Privacy Officer / CCPA Designated Contact

Subject: CCPA Right-to-Delete Request

I am a California resident, exercising my right to delete personal information under the California Consumer Privacy Act, as amended by the California Privacy Rights Act (CCPA §1798.105 / CPRA).

Statute: {{statute}}.

Identity (for matching ONLY — provided under §1798.130 authentication, not as a basis for ongoing retention):
  - Name: {{subject_full_name}}
  - Reply-to: {{subject_email_alias}}

I request:
  1. Deletion of all personal information you collect, maintain, or sell concerning me, and direction to your service providers and contractors to do the same (§1798.105(c)).
  2. Confirmation in writing within 45 days, and notification within 10 business days of receipt (§1798.130).
  3. Disclosure of the categories of personal information collected and the categories of third parties to whom it was disclosed in the 12 months preceding this request (§1798.110).

I am NOT requesting deletion for any of the statutory exceptions in §1798.105(d) (e.g., completing a transaction I requested, security incident detection, legal obligations). If you intend to retain any category of personal information citing one of these exceptions, please specify which exception and which data, and erase everything else.

{{idv_clause}}

{{escalation_clause}}

Sincerely,
{{subject_full_name}}
`;
