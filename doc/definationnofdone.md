PROVENANCE — Completion Criteria (Definition of Done)
Status: FROZEN · Version: 1.0 · Owner: [PO NAME]

The single question this doc answers: what must be true to call thisDONE? Not "features exist" — DONE is a demonstrated end-to-end result.

1. Three Levels of Done
Level	Meaning	Verified by
L1 · Feature-complete	Each FR passes its acceptance criteria	CP-1…CP-9 below
L2 · Golden-path-complete	The full scripted scenario passes with measurable fidelity	Golden Path Test
L3 · Demo-complete	5:00 demo executed twice under stopwatch, fallback recorded	Gate 2
The product is COMPLETE only at L3. L1 without L2 is parts, not aproduct. L2 without L3 is a product nobody has seen win.

2. The Golden Path Test (the heart of this doc)
Fixture (must exist under samples/):

samples/svn/messy-svn — SVN repo: standard trunk/branches/tags, ~50+commits, 1 planted secret (AWS-key-pattern string at a known revision),1 file of 410MB (or simulated oversized), ≥2 ambiguous authors(e.g., dev_ninja99), ≥1 dead branch, ≥1 tag
samples/localgit/dirty-local — local Git repo with full history
GitHub source org — with ≥3 issues, ≥1 PR, ≥1 commit referencing an issue key
samples/tfs/tfs-sample.json — canned TFVC catalog metadata
Execution: fresh DB → run the 8-screen flow (S1→S8) exactly as the demo.

PASS requires ALL of:

#	Criterion	Measured as
G-1	Catalog complete	All 4 sources connected; every fixture repo listed with all 8 metadata fields
G-2	Risk correct	messy-svn = HIGH; factors cite the secret, the 410MB file, unmapped authors
G-3	Author mapping	Ambiguous authors surfaced as cards with confidence; coverage % ≥ 95% after confirmation
G-4	History fidelity	Commit count target == source, EXACTLY (e.g., 5,210 == 5,210)
G-5	Structure fidelity	trunk→main ✓; branch parity list equal; tag present; ≥1 GitHub Release created
G-6	Secret gate held	Migration physically blocked until approval card clicked; secret displayed redacted; zero plaintext in any log
G-7	Self-heal works	Oversized push rejected → LFS conversion → retry succeeds; entire sequence visible in feed with "why" lines
G-8	Context migrated	Issues present with original-ID reference; commit↔issue link resolves on GitHub
G-9	Proof issued	Fidelity report: parity 100%, tag checksums all ✓, coverage %; certificate downloadable; hash-stamped
G-10	Audit complete	Every decision in log with {agent, tier, reason, outcome}; ≥ 99% of operations show tier T0
G-11	Budget respected	tokens_used ≤ budget; breaker functional (test trip once with tiny cap)
G-12	Sources untouched	Byte-check source dirs unchanged after full run
G-13	Live feed	Events render < 1s during migration
3. Per-Feature Completion Checks (L1)
CP	Feature	Done means
CP-1	F-01 Discovery	US-01 AC1–3 pass
CP-2	F-02 Risk	US-02 AC1–3 pass
CP-3	F-03 Authors	US-03 AC1–3 pass; exact matches produce NO card
CP-4	F-04 Structure	US-04 AC1–3 pass
CP-5	F-05 Secrets	US-05 AC1–3 pass; detection call-log shows 0 LLM
CP-6	F-06 Context	US-08 AC1–2 pass
CP-7	F-07+F-10*	US-06 AC1–3 pass; known-fix table hit logged as T0
CP-8	F-08 Proof	US-07 AC1–3 pass; Prover token usage == 0
CP-9	F-09 Gates	Every gate blocks without record; every approval is 1 click
4. NFR Verification
NFR-01: timing log captured during golden path
NFR-02: token report per run (in UI footer: "tokens used: X / budget")
NFR-03: re-run Assessor on same input → byte-identical output
NFR-07: WS latency spot-checks during G-13
All others: one explicit test each, listed in backend/tests/
5. Gate 1 Checklist (~40% of build time) — GO/NO-GO
 Golden path runs end-to-end UGLY (no styling required)
 G-4 and G-9 pass (history fidelity + certificate = the spine)
 G-7 passes (self-heal beat works)
 Kill rule ready: any failing item → demote per fallback order(F-05→one-line flag → before/after single repo → cross-links drop)
 NO promotion of P1 features to fill gaps. Shrink the demo, not the truth.
6. Gate 2 Checklist (~85%) — GO/NO-GO
 Full demo ≤ 5:00 under stopwatch, TWICE consecutively
 Fallback screen-recording of the migration segment exists and is tested
 Certificate hash verifies; demo corpus regenerated from clean script
 Pitch line rehearsed aloud; cost slide numbers pulled from ACTUAL run logs
 Nobody on the team has touched a P2 feature. Check git history if unsure.
7. The "We Are Done" Signature
Provenance is DONE when a stranger can watch five minutes, see foursystems consolidate into GitHub, watch an agent heal its own failure,and hold a certificate that says NOTHING WAS LOST — twice, under astopwatch, with sources byte-identical to how we found them.

8. Anti-Criteria (NOT done, even if features exist)
Demo requires a developer typing commands off-stage → NOT done
Certificate numbers hand-entered rather than computed → NOT done
Self-heal failure staged by pre-fixing the file → NOT done
Any screen shows a spinner > 3s during demo → NOT done
Token report absent or budget exceeded in the final run → NOT done
9. Fallback Acceptance (if live demo fails on stage)
Recorded golden-path video counts as L3-pass ONLY if: recorded in onetake, shows the live token counter, and the team narrates it live.

# Definition of Done and Expected Results: Provenance

| Field | Value |
|---|---|
| Document ID | DOD-001 |
| Version | 1.0 |
| Status | Baseline |
| Location | `docs/definition-of-done.md` |
| Purpose | Defines exactly when Provenance is **complete**, what it must do, and how we verify it |
| Derives from | `docs/product-spec.md`, `docs/requirements.md` |
| Last updated | 2026-10-10 |

---

## 1. How to Use This Document

1. A **feature** is done when it meets Section 3.
2. The **product** is done when it meets Sections 4, 5 and 6.
3. The **submission** is ready when it meets Section 7.
4. The Product Owner signs the Go/No-Go checklist in Section 9.

Anything that fails a criterion is **not done**, regardless of how much work went into it. A mocked capability must be labeled as a mock.

---

## 2. The Result We Want (Outcome Statement)

> A migration lead connects a messy multi-source estate, reviews an AI-generated assessment and plan, approves it with one click, and watches agents migrate repos to GitHub with history, authorship and linked context preserved. Failures are healed automatically with explained reasons, humans decide only the few ambiguous cases, and every repo ends with a verification report, a fidelity score and a Migration Certificate. Most decisions are made by rules, with AI used only on exceptions, and the dashboard shows the cost.

If a reviewer can watch the demo and say all of the following, we are done:

1. "It handled different sources, not just Git."
2. "My history and my people survived."
3. "The agent decided and fixed things by itself, and told me why."
4. "I only had to decide a few things."
5. "It proved nothing was lost."
6. "It is cost-aware."

---

## 3. Feature-Level Definition of Done

A feature is done only when all are true:

| # | Criterion |
|---|---|
| 1 | Meets the acceptance criteria of its requirement and user stories (`docs/requirements.md`) |
| 2 | Works end to end on the seeded sample estate, not only on a mock |
| 3 | Every agent action emits an event with reason and tier (Rule / AI / Human) |
| 4 | Handles empty, loading, error and success states in the UI |
| 5 | Has unit tests for logic, plus an integration or scenario test where it touches an engine |
| 6 | No secrets or credentials appear in UI, logs, events or LLM prompts |
| 7 | Source is untouched (verified by a test) |
| 8 | Errors give a plain-language reason and a next step |
| 9 | Code reviewed, linted and type-checked (Python and TypeScript) |
| 10 | Documented in the feature spec and traceable to an FR ID |

---

## 4. Product-Level Completion: Must-Have Capabilities

The product is complete only when **every** item below passes. This is the MVP boundary.

| ID | Capability | Pass condition | Verified by |
|---|---|---|---|
| FR-01 | Connect sources and target | SVN, local Git and GitHub real; TFS real or labeled simulated; validation reports readable scope | Scenario step 1 |
| FR-02 | Inventory | Catalog shows all required fields for every repo and filters work | Scenario step 2 |
| FR-03 | Risk assessment | Every repo has a rating with specific reasons and an effort estimate | Scenario step 2 |
| FR-04 | Pre-flight detection | Planted oversized file, secret and unmapped authors are all detected | Scenario step 2 |
| FR-05 | Author mapping | 85% or more mapped automatically; rest in queue; none dropped | Scenario step 4 |
| FR-06 | Branch and tag mapping | SVN layout becomes branches and tags; custom layout gets an approvable proposal | Scenario step 4 |
| FR-07 | History migration | Counts, order, messages, timestamps and mapped authors match; revision numbers retrievable; source unchanged | Verification report |
| FR-08 | Context thin slice | Issues migrated and ticket references resolve for one source; losses listed | Verification report |
| FR-09 | Dry run | Forecast produced and nothing written to target | Scenario step 3 |
| FR-10 | Approval gates | Execution is refused before plan approval; three gates work | Scenario step 3 |
| FR-11 | Self-healing | At least two failure types resolved end to end with reasons; risky fixes wait for approval | Scenario step 5 |
| FR-12 | Live progress and feed | Stage, progress and reasoned feed update live | Scenario step 5 |
| FR-13 | Verification and score | All check types run; score computed; every gap explained | Scenario step 6 |
| FR-14 | Certificate and audit | Exportable certificate; complete ordered audit log | Scenario step 6 |
| FR-15 | Developer guide and notice | Guide generated with exact commands; old repo marked read-only or documented equivalent | Scenario step 7 |
| NFR-10 | AI cost governance | Rule-resolved share, call count and cost visible; budget exhaustion routes to humans | Scenario step 8 |
| NFR-11 | LLM-down resilience | With the LLM disabled, rule flow completes and AI-needed items queue | Failure test |

---

## 5. Quantitative Targets

| Metric | Target | How measured |
|---|---|---|
| Fidelity score per repo | 95% or higher; all gaps explained | VerificationEngine |
| Commit parity | 100% (counts and order) for repos in the demo | VerificationEngine |
| Branch and tag parity | 100% (or documented exceptions) | VerificationEngine |
| Content integrity | 100% at head and every tag | Tree manifest comparison |
| Authors mapped automatically | 85% or higher | Mapping report |
| Human decisions per typical repo | 3 or fewer | Decision log |
| Failures resolved without a human | Majority of injected failures | Failure test |
| Decisions resolved by rules | 80% or higher in the demo estate | AI cost report |
| LLM calls on the demo estate | Small and visible (target under 50) | AI cost report |
| Secret values exposed anywhere | 0 | Redaction test |
| Source writes | 0 | Source immutability test |
| Demo runtime | 5 minutes or less end to end | Rehearsal timing |

Targets are verified on the seeded demo estate. Real-world results may differ and must not be claimed beyond what was measured.

---

## 6. End-to-End Acceptance Scenario

The product is accepted when this runs start to finish without any manual terminal work.

| Step | Action | Expected result |
|---|---|---|
| 0 | Seed the demo estate | Sample SVN, local Git, GitHub and TFS (real or labeled simulated) sources exist with planted problems |
| 1 | Connect sources and target | All show Connected with readable scope |
| 2 | Run discovery and assessment | Inventory complete; risk ratings with reasons; planted oversized file, secret and unmapped authors flagged; secret masked |
| 3 | Generate plan, dry run, approve plan | Forecast shown; target untouched until approval; execution before approval is refused |
| 4 | Resolve the review queue | Most authors auto-mapped; a few ambiguous ones decided in one tap each; layout mapping approved |
| 5 | Execute migration | Live progress; an injected failure appears; Healer explains, proposes a fix, waits for approval if risky, resumes; feed shows tier for each action |
| 6 | Verify | Fidelity score per repo; before/after screen matches the source; gaps explained; certificate downloadable |
| 7 | Hand off | Developer guide generated; old repo marked read-only or documented notice present |
| 8 | Review cost and audit | Dashboard shows the share resolved by rules, AI call count, estimated cost; audit log complete |
| 9 | Failure drills | (a) LLM disabled: rule flow completes and AI items queue. (b) Re-run of a finished repo creates no duplicates |

---

## 7. Submission Readiness

| Item | Criterion |
|---|---|
| Working demo | Runs from a single command (`docker compose up` or documented equivalent) |
| Seeded data | Reproducible and resettable; replay control for the failure |
| Recorded backup | A clean full-run recording exists |
| Pitch deck | Problem, insight, demo, architecture, AI cost story, roadmap |
| Documentation | `docs/` contains all six documents and they agree with each other |
| README | Setup, demo steps, limitations, and what is simulated |
| AI-DLC evidence | Inception artifacts and approval records retained |
| Honesty | Every simulated, mocked or unsupported capability is labeled in the UI and the README |
| Roadmap slide | Should-have and Could-have features presented as future work, not as done |

---

## 8. Quality Gates

| Gate | When | Exit criteria |
|---|---|---|
| **Gate 1: Scope** | End of Inception | Product spec, requirements and design approved; PO named; MVP boundary locked |
| **Gate 2: Foundations** | Before building widely | Architecture approved; spikes S1 to S6 resolved; seeded estate ready |
| **Gate 3: Vertical slice** | One repo from discover to certificate | Slice runs end to end |
| **Gate 4: Feature complete** | Feature freeze at 75% of time | All Must items pass Section 4; no new features after this |
| **Gate 5: Release candidate** | Before rehearsals | Scenario in Section 6 passes; targets in Section 5 measured |
| **Gate 6: Ready to present** | Final | Three clean rehearsals; backup recorded; submission checklist complete |

---

## 9. Go / No-Go Checklist (Product Owner signs)

**Functionality**
- [ ] All FR Must items pass (Section 4)
- [ ] Scenario in Section 6 passes end to end
- [ ] At least one visible self-healing moment works on demand
- [ ] Before/after screen shows real verification data

**Trust and safety**
- [ ] Source immutability test passes
- [ ] Redaction test passes (no secret or credential in UI, logs, events or prompts)
- [ ] Verification is deterministic and uses no LLM
- [ ] Migration engine uses no LLM

**AI and cost**
- [ ] Router tiers visible on every decision
- [ ] Cost dashboard shows rule share, calls and estimate
- [ ] LLM-down drill passes

**Presentation**
- [ ] Three consecutive clean rehearsals
- [ ] Recorded backup exists
- [ ] Simulated and mocked parts are labeled
- [ ] Questions in the Q&A prep list are answerable

**Documentation**
- [ ] `docs/` is consistent and committed
- [ ] README is accurate

Decision: **GO / NO-GO**  Signed: ______________  Date: __________

---

## 10. Cut Rules if Time Runs Short

1. Protect in this order (cut last to first): **Verification and certificate, History migration, Author mapping, Approval gates, Self-healing, Context thin slice, Dry run, Developer guide.**
2. If a Must item cannot work, replace it with a **clearly labeled mock** rather than hiding it, and protect the end-to-end flow.
3. No new features in the last 25% of time.
4. Should-have items never displace Must items.

---

## 11. What "Complete" Does Not Mean

- Not production certified or load tested at enterprise scale.
- Not full permission or ACL parity.
- Not support for sources beyond the four named.
- Not a replacement for GitHub's own tooling; Provenance orchestrates, decides and proves.

Stating these openly is part of the product's honesty principle (NFR-05).