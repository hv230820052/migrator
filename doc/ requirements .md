# Requirements Specification: Provenance

| Field | Value |
|---|---|
| Document ID | REQ-001 |
| Version | 1.0 |
| Status | Baseline for Inception |
| Location | `docs/requirements.md` |
| Governed by | `docs/product-spec.md` (SPEC-001). If they conflict, the product spec wins. |
| Last updated | 2026-10-10 |
| Stack (decided) | Python (backend, agents, migration engines), React (frontend), AI (LLM services) |

---

## 1. Purpose

This document turns the product spec into **testable requirements, user stories and acceptance criteria**. Every item has an ID. Every story, design element, architecture component and test must trace to an ID here.

## 2. Scope

**In scope:** discover, assess, plan, migrate and verify repositories from SVN, TFS (TFVC and TFS Git), local Git and GitHub into a target GitHub organization, preserving history and collaboration context, with agent autonomy, human approval gates, and verifiable proof.

**Out of scope:** build servers, package registries, artifact stores, full ACL parity, VCS sources beyond the four named, legal-hold archiving.

## 3. Stakeholders and Users

| ID | Role | Interest |
|---|---|---|
| P1 | Migration Lead / Platform Engineer | Runs the program, needs visibility and control |
| P2 | Repo Owner / Team Lead | Keeps history, needs clear action items |
| P3 | Security and Compliance Reviewer | No leaked secrets, evidence and audit |
| P4 | Engineering Manager / Executive | Status, risk, completion |
| P5 | Developer | Resume work fast after cutover |
| P6 | Hackathon Judge | Evaluates clarity, autonomy, proof and polish |

## 4. Definitions

| Term | Meaning |
|---|---|
| Source | A repo in SVN, TFS, local Git or GitHub |
| Target | A GitHub organization that receives repos |
| Fidelity score | Percent measure of how completely history and context were preserved |
| Review queue | Items needing a human decision |
| Decision Router | Component that resolves each decision by rules first, then AI, then human |
| Thin slice | Narrow but genuinely working version of a feature |

---

## 5. Functional Requirements

Priority: **M** = Must (MVP), **S** = Should, **C** = Could.

### 5.1 Discover

| ID | Requirement | Pri |
|---|---|---|
| FR-01 | The system shall connect to SVN, TFS, local Git and GitHub sources and to a target GitHub organization, validate access, and report what can and cannot be read. | M |
| FR-02 | The system shall build a searchable, filterable catalog of repos with source type, size, commit count, branches, tags, contributors, last activity and large files. | M |
| FR-21 | The system shall flag stale and duplicate repos and recommend migrate, archive or skip. | S |

### 5.2 Assess

| ID | Requirement | Pri |
|---|---|---|
| FR-03 | The system shall assign each repo a Low, Medium or High risk rating with specific reasons and an effort estimate, and summarize the estate by risk. | M |
| FR-04 | The system shall detect before migration: oversized files, large binaries, secrets in history, non-standard SVN layouts, unmapped authors. Each finding has a severity and recommended action. | M |

### 5.3 Plan

| ID | Requirement | Pri |
|---|---|---|
| FR-05 | The system shall map legacy identities to GitHub identities. High-confidence matches apply automatically, ambiguous ones go to the review queue, unmappable ones use a documented fallback identity. Coverage is reported. | M |
| FR-06 | The system shall map source structures (SVN trunk/branches/tags, TFVC branches and labels) to Git branches and tags, proposing a mapping for non-standard layouts. | M |
| FR-09 | The system shall run a dry run that produces a fidelity forecast without writing to the target. | M |
| FR-10 | The system shall require human approval at three gates: plan, mapping, cutover. No target write occurs before plan approval. | M |
| FR-20 | The system shall propose migration waves based on risk, dependencies and activity. | S |

### 5.4 Migrate

| ID | Requirement | Pri |
|---|---|---|
| FR-07 | The system shall migrate history preserving commit order, messages, timestamps and mapped authorship, retain original revision or changeset numbers as metadata, and never modify the source. | M |
| FR-08 | The system shall migrate issues (labels, status) for at least one source and resolve commit references to ticket IDs to the corresponding GitHub issues, reporting anything not carried over. | M |
| FR-11 | The system shall diagnose and resolve at least two failure types end to end, log what and why, and require approval for risky or irreversible fixes. | M |
| FR-12 | The system shall show per-repo stage and progress plus a chronological activity feed with plain-language reasons. | M |
| FR-22 | The system shall support incremental sync and a cutover freeze workflow. | S |
| FR-27 | The system shall migrate pull requests, review discussion, work items and wikis. | S |

### 5.5 Prove and Hand Off

| ID | Requirement | Pri |
|---|---|---|
| FR-13 | The system shall verify each repo: commit count parity, branch and tag parity, content integrity at head and tags, author coverage, context link coverage. It produces a fidelity score and explains every gap. | M |
| FR-14 | The system shall produce an exportable Migration Certificate and a complete time-ordered audit log. | M |
| FR-15 | The system shall generate a copy-paste developer guide and mark the old repo read-only or provide a documented equivalent notice. | M |
| FR-23 | The system shall notify repo owners and teams before and after cutover. | S |
| FR-24 | The system shall support conversational control and explanation of decisions. | S |
| FR-25 | The system shall detect pipeline definitions and draft GitHub Actions starters. | S |
| FR-26 | The system shall present an executive summary dashboard with export. | S |

---

## 6. Non-Functional Requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-01 | Sources are read-only to the platform. | Zero writes to any source |
| NFR-02 | Every agent decision states its reason and the tier that made it (rule, AI, human). | 100% of decisions logged with tier and reason |
| NFR-03 | Approvals and actions are recorded and exportable. | Complete, ordered |
| NFR-04 | Migration is resumable and idempotent. | Re-run creates no duplicate commits or issues |
| NFR-05 | Unsupported or lost items are reported, never hidden. | Every unmigrated item appears in the report |
| NFR-06 | Credentials and secret values are never shown in UI or logs and never sent to an LLM. | Automated redaction test passes |
| NFR-07 | Plain-language UI; small human workload. | 3 or fewer human decisions per typical repo |
| NFR-08 | Demo is reliable. | Three consecutive clean rehearsals plus recorded backup |
| NFR-09 | Many repos are handled via queues and waves. | Estate view runs 10 or more repos concurrently in the demo |
| NFR-10 | AI cost governance. Decisions follow the escalation ladder (rules, heuristics, light LLM, strong LLM, human). Migration execution and verification never depend on an LLM. LLM calls are cached by signature, minimized and redacted, and capped by a per-repo budget; exhausted budget routes to the review queue. | Dashboard shows rule-resolved share, call count and cost |
| NFR-11 | Graceful degradation when the LLM is unavailable. | Rule-based flow completes; AI-dependent items queue for humans |
| NFR-12 | Accessibility basics: keyboard navigation, contrast, no color-only status. | Checklist pass |
| NFR-13 | Responsive for laptop and projector use (1280 px and up). | Visual check |

---

## 7. User Stories and Acceptance Criteria

Format: *As a [persona], I want [capability], so that [benefit].* Acceptance uses Given / When / Then.

### Discover

**US-01 Connect sources** (FR-01) *As P1, I want to register my sources and target org so that Provenance can see my estate.*
- Given valid credentials, when I register an SVN, TFS, local Git or GitHub source, then it shows Connected with a readable-scope summary.
- Given invalid credentials, when validation runs, then I see a plain-language reason and fix, and no secret is displayed.

**US-02 See my estate** (FR-02) *As P1, I want a catalog of all repos so that I know what I have.*
- Given connected sources, when discovery completes, then each repo lists source type, size, commits, branches, tags, contributors, last activity and large files.
- Given the catalog, when I filter by source or risk, then results update immediately.

### Assess

**US-03 Understand risk** (FR-03) *As P1, I want a risk rating with reasons so that I can plan effort.*
- Given an assessed repo, when I open it, then I see Low/Medium/High and at least one specific reason per contributing factor.

**US-04 Catch problems early** (FR-04) *As P3, I want pre-flight findings so that nothing dangerous reaches GitHub.*
- Given a repo with a planted secret and a large binary, when assessment runs, then both appear with severity and recommended action, and the secret value is masked.

### Plan

**US-05 Map authors** (FR-05) *As P2, I want legacy authors mapped to real identities so that credit is preserved.*
- Given 40 legacy identities, when mapping runs, then 85% or more map automatically, the rest appear in the review queue with suggestion and confidence, and none are dropped.

**US-06 Map branches and tags** (FR-06) *As P2, I want my structure converted correctly.*
- Given an SVN repo with trunk/branches/tags, when mapping runs, then each becomes a Git branch or tag. Given a non-standard layout, then a proposed mapping awaits approval.

**US-07 Rehearse safely** (FR-09) *As P1, I want a dry run so that I know the result before publishing.*
- Given an approved plan, when I run a dry run, then I see expected counts, items to be altered and a predicted fidelity score, and nothing is written to the target.

**US-08 Stay in control** (FR-10) *As P1, I want approval gates.*
- Given an unapproved plan, when execution is requested, then it is refused. Given each gate, then I can Approve, Adjust or Hold.

### Migrate

**US-09 Preserve history** (FR-07) *As P2, I want my history intact.*
- Given a migrated repo, then commit order, messages, timestamps and mapped authors match the source, original revision numbers are retrievable, and the source is unchanged.

**US-10 Keep context** (FR-08) *As P2, I want my tickets linked to code.*
- Given commits referencing ticket IDs and a set of issues, when migration completes, then references resolve to the new issues and anything not carried is listed.

**US-11 Recover automatically** (FR-11) *As P1, I want failures fixed without me.*
- Given a rejected push due to an oversized file, then the agent explains, proposes Git LFS, applies it after any required approval, resumes, and logs the action.
- Given a risky fix such as altering history to remove a secret, then it waits for explicit approval.

**US-12 Watch it work** (FR-12) *As P1, I want live progress and reasons.*
- Given a running migration, then each repo shows stage and progress and the feed shows each action with reason and tier.

### Prove and Hand Off

**US-13 Verify** (FR-13) *As P3, I want evidence.*
- Given a migrated repo, then commit, branch, tag and content checks run and a fidelity score is shown with every gap explained.

**US-14 Certificate** (FR-14) *As P3, I want a downloadable record.*
- Then I can export a Migration Certificate containing approvals, agent actions and verification results, and the audit log is complete.

**US-15 Hand off to developers** (FR-15) *As P5, I want to know what to do.*
- Then I receive a copy-paste guide with exact commands, and the old repo shows a pointer to the new URL.

### Platform

**US-16 Control AI cost** (NFR-10) *As P1, I want to see how much AI was used.*
- Then the dashboard shows the share of decisions resolved by rules, LLM call count and estimated cost, and a per-repo budget exhaustion routes items to the review queue.

**US-17 Work offline from AI** (NFR-11) *As P1, I want the system to keep working if the model API is down.*
- Given the LLM is unreachable, then rule-based steps complete and AI-dependent items appear in the review queue.

---

## 8. Data Requirements

| Entity | Key attributes |
|---|---|
| Source | id, type, connection ref (not the secret), status |
| Repo | id, source, name, size, commits, branches, tags, contributors, last activity, risk, state |
| Finding | repo, type, severity, recommendation, status |
| IdentityMapping | legacy id, github id, method, confidence, status |
| Plan | repo, mappings, waves, approval state |
| Decision | repo, question, tier, input summary, outcome, confidence, cost |
| Event | time, repo, agent, action, reason, tier |
| VerificationResult | repo, checks, score, gaps |
| Certificate | repo, approvals, actions, verification, generated at |
| Approval | gate, who, when, decision |

Retention: demo data only; no real credentials stored in plain text.

---

## 9. Constraints, Assumptions and Dependencies

- Time-boxed hackathon; feature freeze at 75% of time.
- Technology: Python, React, LLM provider API.
- Assumptions: GitHub target org or sandbox available (A2); sample estate can be seeded (A3); author emails or a directory available (A5).
- Dependencies: access to sample repos for each source type, a GitHub token with appropriate scopes, an LLM provider key.
- TFS: real if access exists, otherwise simulated and labeled (D-02).

---

## 10. Traceability Matrix

| Mandate phrase | Requirements | Stories |
|---|---|---|
| Agentic | FR-05, FR-10, FR-11, FR-12, NFR-02, NFR-10 | US-05, US-08, US-11, US-12, US-16 |
| Various sources | FR-01, FR-02 | US-01, US-02 |
| To GitHub | FR-01, FR-07 | US-01, US-09 |
| Repeatable platform | FR-09, NFR-04, NFR-09 | US-07 |
| Preserves history | FR-05, FR-06, FR-07 | US-05, US-06, US-09 |
| Collaboration context | FR-08, FR-27 | US-10 |
| Not a simple copy | FR-13, FR-14 | US-13, US-14 |

---

## 11. Change Control

Changes to Must requirements need Product Owner approval, a recorded reason, and a stated trade-off. This file follows `docs/product-spec.md`.

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-10 | Initial baseline |

Status: FROZEN · Version: 1.0 · Owner: [PO NAME]Precedence: product-spec.md > this doc > AIDLC-generated artifacts > working memoryStack constraint (frozen): Python (backend) · React (frontend) · LLM via Decision Cascade

1. Purpose
Defines WHAT the system must do to satisfy the hackathon problem statement(Appendix A of product-spec.md). Elaborates the frozen MVP (F-01…F-09 +LFS self-heal path). Anything not listed here is out of scope.

2. Product Summary
Provenance is an agentic platform migrating repositories from SVN, TFS,local Git, and GitHub into a target GitHub organization — preservinghistory, identity, structure, and collaboration context — and producingmachine-verified proof (Fidelity Certificate) that nothing was lost.

Pipeline: DISCOVER → ASSESS → PLAN → MIGRATE → PROVE

3. Functional Requirements
ID	Requirement	Priority	Source	Demo beat
FR-01	System connects to SVN, local Git paths, and a GitHub org (live) and a TFS sample (catalog-level), validates access, and auto-builds a catalog: repo name, source type, size, commit count, branch/tag count, contributor count, last activity, large-file flags	P0	F-01	0:30
FR-02	System computes a per-repo risk tier (low/med/high) via deterministic weighted formula and displays top-3 plain-language risk factors	P0	F-02	1:00
FR-03	System proposes GitHub identities for legacy authors: exact-match by rule; ambiguous cases reasoned by LLM with confidence %; human confirms flagged cases only; coverage % displayed	P0	F-03	1:00–1:45
FR-04	System translates structure: SVN trunk→main, branches→branches, tags→tags/releases; local/GitHub repos preserved with full history; TFVC sample shown at catalog level	P0	F-04	2:15–3:15
FR-05	System scans full history for secrets (regex + entropy) BEFORE migration, flags file+commit, blocks migration until human acknowledges at gate	P0	F-05	1:00, 1:45
FR-06	GitHub→GitHub: issues, PRs, labels migrate with original IDs referenced and commit↔issue cross-links functional	P0	F-06	3:15
FR-07	Migration executes with live streamed agent events; on failure the agent diagnoses, applies known-fix table (incl. oversized-file→LFS), retries, and logs every action	P0	F-07, F-10*	2:15
FR-08	System generates Fidelity Report: commit-count parity, per-tag file checksums, branch parity, author coverage % — plus downloadable Migration Certificate and before/after view	P0	F-08	4:00
FR-09	Human-in-the-loop approval gates at plan, author mappings, secrets, and cutover — each a one-click approve/adjust card	P0	F-09	1:45
*F-10 scope edge: ONLY the LFS self-heal path is in MVP. No curation UI.

4. Non-Functional Requirements
ID	Category	Requirement	Verifiable by
NFR-01	Performance	Rule-tier (T0) decisions resolve < 50ms; catalog build for demo corpus < 60s	Timing log
NFR-02	Cost	≥ 99% of operations complete with zero LLM cost; hard token budget per run with graceful degradation to human queue	Token counter + circuit breaker trip test
NFR-03	Determinism	T0 outputs reproducible byte-identical on re-run; verification (FR-08) uses zero LLM calls	Re-run diff; call log
NFR-04	Auditability	Every agent decision logged: {timestamp, agent, tier, input hash, reason, outcome}	Decision log inspection
NFR-05	Safety	Source repositories are strictly read-only; no destructive operation executes without a prior approval record	Code review + gate test
NFR-06	Usability	Every approval ≤ 1 click; every risk explanation ≤ 3 plain-language bullets	UI inspection
NFR-07	Liveness	Migration events stream to UI < 1s after occurrence	WebSocket latency test
NFR-08	Demo-ability	Full golden path ≤ 5:00	Two stopwatch runs
NFR-09	Security	Detected secrets display redacted (file + commit only); never logged in plaintext	Log scan
NFR-10	Recoverability	A failed run leaves the target in a flagged, identifiable state — never silently partial	Failure injection test
5. Constraints
C-01: Hackathon timeframe; team of [N]; demo capped ~5 minutes
C-02: Stack frozen — Python backend, React frontend, LLM API access
C-03: No live TFS server available → TFS represented by canned sample at discovery level; full TFS pipeline shown as architecture only
C-04: MVP freeze rules apply: amendments go OUT or DOWN only (see product-spec.md §13 / MVP-FREEZE)
6. Explicitly Out of Scope (frozen)
CI translation (F-11) · chat Q&A (F-12) · wave-planning UI (F-13) ·dead-branch curation UI · permissions/team mapping · incremental sync ·rollback engine · notifications · dev-guide automation · bidirectional sync ·real AD integration.

7. User Stories & Acceptance Criteria
US-01 (FR-01) — As a Migration Lead, I connect sources so all repos areauto-discovered.AC1: catalog row exists per repo with all 8 metadata fieldsAC2: invalid credentials produce a clear inline error, no crashAC3: TFS sample appears in catalog marked "sample"

US-02 (FR-02) — As a Migration Lead, I see per-repo risk with reasons.AC1: each repo shows tier color + top-3 factors in plain languageAC2: the repo containing a planted secret and oversized file scores HIGHAC3: factors reference concrete evidence (file name, count, date)

US-03 (FR-03) — As a Migration Lead, I confirm only ambiguous authors.AC1: exact org-directory matches auto-resolve with no card shownAC2: ambiguous author shows proposed identity + confidence % + evidenceAC3: coverage % updates after each confirmation

US-04 (FR-04) — As a Repo Owner, my branches and tags survive.AC1: SVN trunk → main; every branch present by equivalent nameAC2: tags present; at least one becomes a GitHub ReleaseAC3: git log on target shows full original commit count

US-05 (FR-05) — As Security, secrets are flagged pre-migration.AC1: planted secret detected with file + commit, redacted displayAC2: migration blocked until gate card approvedAC3: detection uses zero LLM calls (T0)

US-06 (FR-07) — As a Migration Lead, I watch agents execute and self-heal.AC1: activity feed streams agent actions liveAC2: injected oversized-file failure → agent states diagnosis, converts toLFS, retries, succeeds — all visible in feedAC3: every action has a one-line "why"

US-07 (FR-08) — As anyone, I receive a fidelity certificate.AC1: commit parity = 100% (N in = N out) for golden-path reposAC2: per-tag checksum verification passes and is displayedAC3: certificate downloadable as file

US-08 (FR-06) — As a Repo Owner, my GitHub issues/PRs reappear linked.AC1: issues migrate with original ID referenced (#orig → new)AC2: a commit referencing an issue key links to the migrated issue

US-09 (FR-04/FR-08) — As a Developer, I get Monday-morning instructions.AC1: per-repo "switch" panel shows exact git remote set-url command

8. Traceability Matrix
FR	US	Feature spec §	DoD check	Gate
FR-01	US-01	F-01	CP-1	G1
FR-02	US-02	F-02	CP-2	G1
FR-03	US-03	F-03	CP-3	G1
FR-04	US-04, US-09	F-04	CP-4	G1
FR-05	US-05	F-05	CP-5	G1
FR-06	US-08	F-06	CP-6	G1
FR-07	US-06	F-07 + F-10*	CP-7	G1
FR-08	US-07	F-08	CP-8	G1+G2
FR-09	all	F-09	CP-9	G1+G2
9. Change Control
Per product-spec.md governance: PO-amended, OUT/DOWN only, logged.Phrase of the weekend: "Logged. Not built."

