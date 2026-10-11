# Feature Specification: Provenance (Final)

| Field | Value |
|---|---|
| Document ID | FEAT-001 |
| Version | 1.0 |
| Status | Baseline |
| Location | `docs/feature-spec.md` |
| Derives from | `docs/product-spec.md`, `docs/requirements.md`, `docs/design.md`, `docs/architecture.md` |
| Stack | Python (backend, agents, engines), React + TypeScript (UI), LLM provider API |
| Last updated | 2026-10-10 |

---

## 1. How to Read This Document

Each feature lists: **purpose, behavior and rules, decision tier, inputs and outputs, edge cases, UI, events, acceptance, dependencies.**

**Decision tier legend:** **R** = deterministic rule, **H** = heuristic, **AI-L** = light LLM, **AI-S** = strong LLM, **HU** = human. The Decision Router (CAP-01) always tries the lowest tier first.

**Priority:** M = Must (MVP), S = Should, C = Could.

---

## 2. Feature Map

| Pillar | Features |
|---|---|
| Platform | CAP-01 Decision Router and AI cost governance, CAP-02 Event and audit backbone, CAP-03 Demo mode |
| Discover | FR-01 Connect, FR-02 Inventory, FR-21 Stale and duplicates (S) |
| Assess | FR-03 Risk, FR-04 Pre-flight |
| Plan | FR-05 Author mapping, FR-06 Branch and tag mapping, FR-09 Dry run, FR-10 Approval gates, FR-20 Waves (S) |
| Migrate | FR-07 History migration, FR-08 Context, FR-11 Self-healing, FR-12 Live control room, FR-22 Incremental sync (S), FR-27 Full context (S) |
| Prove and hand off | FR-13 Verification, FR-14 Certificate and audit, FR-15 Developer guide |
| Experience (S) | FR-23 Notifications, FR-24 Assistant, FR-25 CI hints, FR-26 Executive dashboard |

---

## 3. Platform Capabilities

### CAP-01 Decision Router and AI Cost Governance (M, NFR-10, NFR-11)

**Purpose:** resolve every judgment by the cheapest sufficient method and make the cost visible.

| Aspect | Specification |
|---|---|
| Ladder | Cache, then rules (R), then heuristics (H), then light LLM (AI-L), then strong LLM (AI-S), then human (HU) |
| Confidence | Each tier returns an outcome and confidence; thresholds are configurable per decision type |
| Cache | Keyed by a signature of the minimized question; identical patterns across repos are answered once |
| Budget | Per-repo and global caps on calls and estimated cost; exhaustion routes to HU, never fails the run |
| Promotion | A human-approved AI resolution can be saved as a rule |
| Safety | Inputs minimized and redacted; allow-listed fields only; secrets and credentials never included |
| Degradation | LLM errors, timeouts or a tripped circuit breaker fall through to HU |
| Output | `Decision{outcome, tier, confidence, reason, cost, tokens, repo, time}` stored and emitted as an event |
| UI | TierBadge on every decision; CostChip in the top bar; AI cost report |

**Decision types covered:** author disambiguation, secret false-positive triage, non-standard layout mapping, unknown failure diagnosis, risk explanation for unusual combinations, wave proposal tuning, narrative summaries.

**Acceptance:** demo shows at least one rule-resolved and one AI-escalated decision with cost summary; with LLM disabled, the rule flow completes and AI-needed items appear in the queue.

### CAP-02 Event and Audit Backbone (M, NFR-02, NFR-03)

- Append-only `events` with time, repo, agent, action, reason, tier.
- Same stream feeds the live UI (SSE) and the audit log.
- Approvals recorded with actor and time.
- Certificates embed a hash of the event range they cover.

### CAP-03 Demo Mode (M, NFR-08)

- Seed and reset a sample estate with planted problems: non-standard SVN layout, large binary, fake secret, unmapped authors, local-only branch and unpushed commits, GitHub repo with issues.
- "Replay failure" re-triggers the oversized-file scenario on demand.
- Simulated sources carry a visible "Simulated" label.
- A visible "Demo mode" environment indicator.

---

## 4. Discover

### FR-01 Source and Target Connection (M)

| Aspect | Specification |
|---|---|
| Purpose | Register sources and the target GitHub organization and verify access |
| Inputs | Source type (SVN, TFS, Local Git, GitHub), location, credential reference; target org and token |
| Behavior | Validate connectivity and permissions; report what can and cannot be read; store a credential **reference**, never display the secret |
| Tier | R |
| Outputs | `ConnectionReport{status, readable_scope, issues[], fixes[]}` |
| Edge cases | Partial access (some repos unreadable), expired token, unreachable host, insufficient target scope, TFS flavor unknown |
| UI | Source cards with status, scope summary and fix hints (Sources screen) |
| Events | `source.validated`, `source.failed` |
| Acceptance | US-01 |
| Dependencies | Connectors |

### FR-02 Estate Inventory (M)

| Aspect | Specification |
|---|---|
| Purpose | Build a complete catalog of repos |
| Behavior | Discover repos per source; collect type, size, commit count, branches, tags, contributors, last activity, large files, owner if known |
| Tier | R |
| Outputs | `repos` catalog; estate totals; source breakdown |
| Edge cases | Very large repos (sampled stats with exact counts deferred), unreachable repos listed as "unreadable", duplicate repos across sources |
| UI | Estate Overview and Repo Catalog with filters (source, risk, owner, activity), search, sort |
| Events | `discovery.started`, `repo.discovered`, `discovery.completed` |
| Acceptance | US-02 |

### FR-21 Stale and Duplicate Detection (S)

Flags repos inactive beyond a threshold and local repos that duplicate a central one (matching initial commit and history overlap). Recommends migrate, archive or skip. Tier R and H; human decides.

---

## 5. Assess

### FR-03 Risk and Complexity Assessment (M)

| Aspect | Specification |
|---|---|
| Purpose | Rate each repo Low, Medium or High with reasons and effort |
| Factors | History size, large or binary files, authors not resolvable, non-standard layout, branch complexity, secrets, context volume (open issues), source type |
| Scoring | Weighted rule score mapped to bands; each contributing factor stored as a reason sentence |
| Tier | R for scoring; templated sentences for common cases; AI-L only to phrase unusual combinations |
| Outputs | `risk{level, score, reasons[], effort_estimate}` |
| Edge cases | Missing data (rated "Unknown, needs scan"), conflicting factors |
| UI | RiskChip with reason tooltip; Risk tab; risk heatmap on Overview |
| Events | `risk.assessed` |
| Acceptance | US-03 |

### FR-04 Pre-flight Problem Detection (M)

| Check | Method | Tier |
|---|---|---|
| Oversized files and large binaries | Size thresholds over history | R |
| Secrets in history | Pattern and entropy scanner over history | R, then H for false-positive filtering, AI-L for ambiguous triage (redacted context only) |
| Non-standard SVN layout | Layout detection heuristics | R, H |
| Unmapped authors | Compare legacy identities with the directory | R |
| Special SVN or TFVC constructs | Detect externals, properties, shelvesets, empty directories | R |

| Aspect | Specification |
|---|---|
| Output | `finding{type, severity, location, fingerprint, recommendation, status}` |
| Secret handling | Value masked immediately; store type, location, fingerprint only |
| UI | Findings list per repo and estate-wide for compliance; severity filters |
| Events | `finding.created` |
| Acceptance | US-04 |

---

## 6. Plan

### FR-05 Author Identity Mapping (M)

| Aspect | Specification |
|---|---|
| Purpose | Preserve credit by mapping legacy identities to GitHub identities |
| Sources of evidence | Commit emails, org directory export, existing GitHub members, name similarity, commit-pattern overlap |
| Ladder | R: exact email or directory match (auto). H: normalized and fuzzy name or email-local-part match (auto above threshold). AI-L: disambiguate close candidates using redacted attributes. HU: remaining ambiguous. Fallback: documented placeholder identity |
| Rules | No author is ever dropped; fallback identity clearly marked; every mapping records method and confidence |
| Outputs | `identity_mappings{legacy, github, method, confidence, status}`; coverage percent |
| Edge cases | Multiple emails per person, shared accounts, bots, departed employees, mismatched case, two candidates with equal score |
| UI | Mappings tab and Review Queue DecisionCards (accept, choose other, skip to fallback) |
| Events | `identity.mapped`, `identity.escalated`, `identity.resolved` |
| Acceptance | US-05; 85% or more automatic on the seeded estate |

### FR-06 Branch, Tag and Layout Mapping (M)

| Aspect | Specification |
|---|---|
| Purpose | Convert source structure to Git branches and tags |
| Rules | SVN trunk to default branch; branches and tags directories to Git branches and tags; TFVC branches to branches, labels to tags; naming collisions get deterministic suffixes and are reported |
| Non-standard | Layout detector proposes a mapping (R, H); strong ambiguity may use AI-S; always requires human approval |
| Outputs | `mapping_plan{branches[], tags[], exclusions[], warnings[]}` |
| Edge cases | Missing trunk, nested projects, renamed branches, deleted branches |
| UI | Mappings tab and approval card |
| Events | `layout.detected`, `mapping.proposed` |
| Acceptance | US-06 |

### FR-09 Dry Run with Fidelity Forecast (M)

| Aspect | Specification |
|---|---|
| Purpose | Rehearse without publishing |
| Behavior | Execute conversion in the local workspace; compute expected counts and detect items to be altered; **no writes to the target** |
| Output | Forecast: commits, branches, tags, mapped authors, issues, alterations, predicted fidelity |
| Tier | R |
| UI | Forecast panel on the Plan screen |
| Events | `dryrun.started`, `dryrun.completed` |
| Acceptance | US-07 |

### FR-10 Approval Gates (M)

| Gate | Approves | Blocks if missing |
|---|---|---|
| Plan | Waves, mappings, remediation approach | Any write to the target |
| Mapping | Final identity and layout mapping | Execution of the repo |
| Cutover | Final switch and old-repo notice | Marking the repo Done |

Each gate shows consequences and offers Approve, Adjust, Hold. Approvals record actor and time. Execution requests without approval are refused with a reason (US-08).

### FR-20 Wave Planning (S)

Proposes order: pilot, low-risk, then critical. Uses risk, dependency hints and recent activity. Adjustable by drag. Tier R and H; AI-L optional for wording only.

---

## 7. Migrate

### FR-07 History-Preserving Migration (M)

| Aspect | Specification |
|---|---|
| Purpose | Move code and history faithfully |
| Process | Mirror source (read-only), convert to Git, rewrite authors per approved mapping, apply branch and tag mapping, record revision-to-commit map, apply LFS migration if approved, push to the target |
| Preserved | Commit order, messages, timestamps, mapped authorship |
| Metadata | Original revision or changeset number stored (commit trailer or note) and queryable |
| Tier | **R only. No LLM in the data path.** |
| Reliability | Checkpoints per phase; idempotent; resumable after failure |
| Edge cases | Huge histories, binary-heavy repos, rejected pushes, merge-info loss in SVN, empty directories (annotated), case-collisions on case-insensitive sources |
| Outputs | Target repo; `revision_map`; artifacts |
| Events | `migrate.started`, `migrate.checkpoint`, `migrate.pushed`, `migrate.completed` |
| Acceptance | US-09 |

### FR-08 Collaboration Context, Thin Slice (M)

| Aspect | Specification |
|---|---|
| Purpose | Keep code linked to the tickets around it |
| In scope (MVP) | Issues with title, body, labels, milestone, state and author attribution note; mapping of ticket IDs referenced in commits to new issues; a loss list |
| Method | GitHub REST API; idempotency key (original ID stored in the issue body metadata) prevents duplicates; rate-limit aware with backoff |
| Reference rewriting | Original ticket ID retained in text and annotated with a link to the new issue where history is not rewritten; commit message rewriting only if explicitly planned |
| Tier | R |
| Edge cases | Attribution (cannot post as original author), attachments, deleted tickets, ID collisions, rate limits |
| Reporting | Anything not carried over is listed (NFR-05) |
| UI | Context section in the Proof screen; Mappings tab |
| Events | `context.issue.created`, `context.reference.linked`, `context.loss.recorded` |
| Acceptance | US-10 |

### FR-27 Full Collaboration Context (S)

Extends FR-08 to pull requests, review discussion, work items, wiki and releases. Same principles: idempotent, loss-listed.

### FR-11 Self-Healing and Remediation (M)

**Mechanism:** a playbook of known failures (R) with AI-assisted diagnosis for unknowns (AI-L, then AI-S), approval for risky actions.

| Failure | Detection | Remedy | Approval |
|---|---|---|---|
| Push rejected, file too large | Push error signature | Propose and apply Git LFS migration for the offending paths, resume | Required (alters history) |
| Unmapped author discovered mid-run | Rewrite step finds unknown identity | Router ladder, else queue, else fallback identity | Human only if ambiguous |
| Transient network or rate limit | Error class | Backoff and retry from checkpoint | None |
| Secret found | Scanner | Flag, mask, recommend rotation; optional history cleanup | Required |
| Unknown error | No signature match | AI-L diagnosis, then AI-S; suggestion goes to the queue | Required |

| Aspect | Specification |
|---|---|
| Output | `healing_action{failure, diagnosis, remedy, tier, approved_by}` |
| Safety | Never destructive to the source; irreversible or history-altering steps always wait for approval |
| Learning | Approved novel fixes can be promoted to playbook entries |
| UI | Feed entries plus ApprovalCards in the Review Queue |
| Events | `heal.detected`, `heal.proposed`, `heal.approved`, `heal.applied` |
| Acceptance | US-11; two failure types demonstrable on demand |

### FR-12 Live Control Room (M)

- Per-repo StagePipeline: Scan, Map, Migrate, Verify with progress and ETA.
- Activity feed with time, agent, action, reason and TierBadge.
- Alerts for items needing a human, linking to the queue.
- Updates via SSE with automatic reconnect; state recovers from the event log after a refresh.
- Acceptance: US-12.

### FR-22 Incremental Sync and Cutover (S)

Continuous catch-up of new commits while teams keep working, a short freeze, final sync, switch and notify. Requires FR-10 cutover gate.

---

## 8. Prove and Hand Off

### FR-13 Verification and Fidelity Score (M)

| Aspect | Specification |
|---|---|
| Purpose | Prove what was preserved |
| Tier | **R only. No LLM judges correctness.** (AI-L may phrase gap explanations from structured data.) |
| Checks | 1) Commit count and ordering via the revision map. 2) Branch set and tag set parity. 3) Content integrity: manifest of paths and checksums from the source at head, every tag and sampled revisions, compared to the Git tree at the mapped commit. 4) Author coverage (mapped, fallback, unresolved). 5) Context coverage (issues migrated, references resolved, losses listed) |
| Scoring | Weighted checks into a 0 to 100 score; each failed or partial check yields a gap with explanation and classification (Preserved, Converted, Annotated, Not supported) |
| States | `VERIFIED`, `VERIFIED_WITH_GAPS` (requires human sign-off), `FAILED` |
| Outputs | `verification{checks[], score, gaps[]}` |
| Edge cases | Empty directories, SVN properties, line-ending normalization, case collisions, large-file LFS pointers (compare pointer-resolved content) |
| UI | Before/after screen, FidelityRing, gap list |
| Events | `verify.started`, `verify.check`, `verify.completed` |
| Acceptance | US-13; score 95% or higher on demo repos |

### FR-14 Migration Certificate and Audit Log (M)

| Aspect | Specification |
|---|---|
| Content | Repo identity (source and target), summary, approvals (who, when), agent actions and tiers, verification results and score, gaps, AI usage and cost, content hash |
| Formats | Markdown, HTML and PDF export (templated) |
| Audit | Full time-ordered event export, filterable |
| Tier | R (templates). No LLM-written claims of correctness |
| Acceptance | US-14 |

### FR-15 Developer Guide and Old-Repo Notice (M)

| Aspect | Specification |
|---|---|
| Guide | New URL, three copy-paste commands to re-point remotes, branch and tag notes, what changed (authors, LFS, annotations), contact |
| Old repo | Mark read-only where the source supports it, otherwise place a clearly documented notice (for example a final commit or banner file in the source if permitted by policy and approved at the cutover gate) |
| Tier | R (templates) |
| Edge cases | Sources where read-only cannot be applied, multiple remotes in local Git |
| Acceptance | US-15 |

---

## 9. Experience Features (Should)

| ID | Feature | Spec summary |
|---|---|---|
| FR-23 | Notifications | Templated messages to owners before and after cutover with exact action items; channels by configuration (email, Slack, Teams); approvals required for cutover announcements |
| FR-24 | Assistant panel | Natural-language Q&A on decisions ("Why is this High risk?") and requests ("Migrate the Payments team's repos, pilot first"). Actions still pass approval gates. Tier AI-L or AI-S with strict tool allow-list and redaction. Disabled gracefully when the LLM is unavailable |
| FR-25 | CI hints | Detects pipeline definitions and drafts a GitHub Actions starter labeled "Draft". Tier R for detection, AI-S for drafting. Never auto-enabled |
| FR-26 | Executive dashboard | Progress, risk burn-down, waves, pending approvals, AI cost, one-page export |

---

## 10. Cross-Cutting Rules

| Rule | Applies to |
|---|---|
| Sources are read-only | All connectors |
| Every decision logs tier, confidence, reason, cost | All agents |
| No LLM in migration or verification | FR-07, FR-13, FR-14 |
| Secrets and credentials never displayed, logged or sent to an LLM | All |
| Unsupported or lost items are reported | FR-07, FR-08, FR-13 |
| Idempotent and resumable | Migration, context, verification |
| Plain-language errors with a next step | UI |
| Simulated or mocked capability is labeled | UI and README |

---

## 11. Fidelity Matrix by Source

| Concept | SVN | TFS (TFVC) | TFS Git | Local Git | GitHub |
|---|---|---|---|---|---|
| History | Revisions to commits (Converted) | Changesets to commits (Converted) | Preserved | Preserved | Preserved |
| Authors | Username mapped (Converted) | Account mapped (Converted) | Mapped (Converted) | Name and email normalized | Identity retained |
| Branches | trunk/branches to branches (Converted) | Branches to branches (Converted) | Preserved | Preserved, local-only included | Preserved |
| Tags | tags/ to tags (Converted) | Labels to tags (Converted) | Preserved | Preserved | Preserved |
| Revision numbers | Annotated | Annotated | Not applicable | Not applicable | Not applicable |
| Empty directories | Annotated | Annotated | Not applicable | Not applicable | Not applicable |
| SVN properties and externals | Annotated or Not supported (reported) | Not applicable | Not applicable | Not applicable | Not applicable |
| Shelvesets | Not applicable | Annotated or Not supported (reported) | Not applicable | Not applicable | Not applicable |
| Tickets and work items | Parsed from messages, linked | Work-item associations, linked | Linked | Parsed from messages | Issues and PRs |
| Uncommitted or stashed work | Not applicable | Not applicable | Not applicable | Not supported (reported, owner warned) | Not applicable |

---

## 12. Feature Prioritization (Scored)

Weights: alignment 25, judge impact 20, feasibility 20, demo-ability 15, differentiation 15, low risk 5. Scores 1 to 5. Cut: 3.6 or higher is Must.

| Feature | Score | Priority |
|---|---|---|
| FR-13, FR-14 Verification and certificate | 4.75 | M |
| FR-05 Author mapping | 4.40 | M |
| FR-08 Context (thin slice) | 4.25 | M (full is S) |
| FR-03, FR-04 Risk and pre-flight | 4.15 | M |
| FR-11 Self-healing | 4.00 | M |
| FR-02 Inventory | 3.75 | M |
| FR-06, FR-07 History, branches, tags | 3.75 | M |
| FR-15 Developer guide | 3.75 | M |
| FR-09, FR-10 Dry run and gates | 3.65 | M |
| FR-20 Waves | 3.25 | S |
| FR-24 Assistant | 3.00 | S |
| FR-25 CI hints | 3.00 | S |
| FR-22 Incremental sync | 3.00 | S |
| Permission mapping | 2.25 | Roadmap |

---

## 13. Roadmap (Not in this release)

1. Full context migration (PRs, reviews, work items, wiki) at scale.
2. Permission, team and branch-protection mapping and CODEOWNERS suggestions.
3. Enterprise concerns: SSO, role-based access, multi-tenant, large-scale queues.
4. Learning loop that grows the rule base from approved AI decisions.
5. Pre-built connectors for more sources.

---

## 14. Traceability

| Feature | Requirements | Stories | Architecture component |
|---|---|---|---|
| CAP-01 | NFR-02, NFR-10, NFR-11 | US-16, US-17 | Decision Router, LLM Gateway |
| FR-01 | FR-01 | US-01 | Connectors |
| FR-02 | FR-02 | US-02 | Scout, connectors |
| FR-03, FR-04 | FR-03, FR-04 | US-03, US-04 | Assessor, ScannerEngine |
| FR-05 | FR-05 | US-05 | IdentityMapper, router |
| FR-06, FR-07 | FR-06, FR-07 | US-06, US-09 | HistoryEngine, connectors |
| FR-08 | FR-08 | US-10 | ContextMigrator |
| FR-09, FR-10 | FR-09, FR-10 | US-07, US-08 | Orchestrator |
| FR-11 | FR-11 | US-11 | Healer, playbook |
| FR-12 | FR-12 | US-12 | Events, SSE, Control Room |
| FR-13, FR-14 | FR-13, FR-14 | US-13, US-14 | VerificationEngine, ReportBuilder |
| FR-15 | FR-15 | US-15 | Communicator, ReportBuilder |


📄 FILE: docs/feature-spec.md
PROVENANCE — Feature Specification (Final, Pro)
Status: FROZEN · Version: 1.0 · Owner: [PO NAME]Behavioral spec for every in-scope feature. Each feature defines:Behavior rules (B#) · Cascade mapping · Acceptance criteria (AC) ·Scope edge (what is deliberately NOT built).

F-01 · Discovery & Catalog
Value: the entire estate becomes visible in one place, automatically.

Behavior

B1: On source connect, validate credentials; failure → inline error, source marked failed, others proceed
B2: Scout extracts per repo: name, type, size, commits, branches, tags, contributors, last activity, large-file flag (>100MB)
B3: Catalog rows stream to UI as discovered (not batch-at-end)
B4: TFS connector reads canned sample JSON; rows badged "sample"
B5: Local Git connector takes a filesystem path, scans recursively for .git
Cascade: T0 only. Zero LLM.AC: US-01 AC1–3; discovery of demo corpus < 60s.Scope edge: No org-wide crawling auth flows, no scheduling, no re-sync.

F-02 · Risk Assessment
Value: the lead knows WHERE the danger is before touching anything.

Behavior

B1: Deterministic weighted formula: size, binary count, unmapped-authorcount, secret findings, staleness, layout deviation → tier L/M/H
B2: Top-3 factors shown, each with concrete evidence ("largest: 410MB", "37 unmapped", "r4821")
B3: ONE portfolio summary sentence generated by a single T2 call("142 repos: 90 easy · 38 attention · 14 archive-candidates")
B4: Re-run on same input → byte-identical result (NFR-03)
Cascade: T0 formula + 1 T2 call per portfolio (not per repo).AC: US-02 AC1–3; messy-svn = HIGH.Scope edge: No per-repo LLM narrative. No historical trend analysis.

F-03 · Author Identity Mapping ★ differentiator
Value: git blame keeps meaning. Contribution graphs stay real.

Behavior

B1 (T0): legacy name exact-matches a unique org-directory entry → auto-resolve, log, NO card
B2 (T2): ambiguous names → evidence packet {name, commit cadence, code regions, any header emails} → proposal + confidence %
B3 (T3): confidence < τ2 OR conflicting evidence → approval card [Confirm]/[Edit identity]
B4: Coverage % = resolved / total authors, live-updating
B5: Mapping memoized by content hash — same author across repos = one decision
B6: Unresolvable at cutover → commit keeps identity with [unmapped] prefix + logged
Cascade: full T0→T2→T3 demonstration. This feature IS the cascade showcase.AC: US-03 AC1–3; exact matches produce zero cards.Scope edge: No Active Directory integration. No ML training. No bulk CSV import UI.

F-04 · Structure Fidelity
Value: branches and tags survive as first-class Git objects, not folders.

Behavior

B1: SVN trunk → main; branches/* → branches; tags/* → tags, top tag → GitHub Release
B2: Non-standard layout (missing trunk etc.) → T0 heuristic detects → T2 proposes interpretation → T3 confirm
B3: Local Git / GitHub sources: full history preserved as-is
B4: TFVC sample: catalog-level only; mapping shown on architecture slide
AC: US-04 AC1–3; branch parity list equal source vs target.Scope edge: No merge-history rewriting, no branch-graph surgery, no TFVC live conversion.

F-05 · Secrets Pre-Flight
Value: compliance sleeps at night; nothing leaks by accident.

Behavior

B1 (T0): full-history scan — secret regex families (AWS, GitHub tokens, private keys, generic high-entropy strings)
B2: finding = {file, commit, redacted preview} — raw value never rendered, logged, or sent to LLM (NFR-09)
B3 (T2, optional): false-positive triage ("real key vs test fixture") — may skip in hackathon, flag everything
B4 (T3): migration BLOCKED at gate until human acknowledges
B5: history cleaning / rotation = roadmap, surfaced as card footnote only
AC: US-05 AC1–3; detection uses 0 LLM calls.Scope edge: DETECT AND GATE ONLY. No BFG/filter-repo cleaning in MVP.

F-06 · Collaboration Context (GitHub→GitHub)
Value: tickets and discussions don't vanish — the repo's memory moves too.

Behavior

B1: Issues migrate with body, labels, state; original ID referenced in title suffix or body ("migrated from #123")
B2: PRs migrate as issues (GitHub API cannot create merged PRs with original review history — we preserve the discussion, not the merge event); document this honestly
B3: Commit messages containing issue keys → GitHub auto-links to migrated issue
B4: Migration via GraphQL/REST in dependency order (issues before cross-links)
AC: US-08 AC1–2; a commit's issue-reference resolves on target.Scope edge: GitHub→GitHub ONLY. TFS work items = roadmap slide. No comments threading beyond issue body+labels.

F-07 · Agentic Execution + Self-Healing ★ the "agentic" proof
Value: the migration babysitter is a machine; humans only approve.

Behavior

B1: Executor streams every action: {action, why, tier} via WS < 1s
B2 (T0): error signature matched in known-fix table → fix applied → retry → logged
B3 (T2): NOVEL error → diagnosis + proposed fix in plain language
B4 (T3): any destructive fix (history rewrite, force ops) requires approval card BEFORE execution
B5: retry policy: max 3, then halt with clean flagged state (NFR-10)
B6: source repos strictly read-only (connector layer has no write path)
AC: US-06 AC1–3; injected oversized-file failure recovers on camera.Scope edge: No multi-node parallelism, no pause/resume across restarts.

F-10* · LFS Self-Heal Path (the promoted sliver)
Value: the demo's most memorable beat — and a real GitHub limit solved.

Behavior

B1: push rejected for file >100MB → T0 signature hit → convert file to LFS via git lfs migrate → retry → succeed
B2: LFS objects verified present on target (.gitattributes + LFS API check)
B3: entire sequence logged and streamed
AC: G-7 in golden path.Scope edge: NO curation UI, no pre-migration LFS planning screen, no binary policy engine. Path only, on failure.

F-08 · Fidelity Report + Migration Certificate ★★ the moat
Value: the only migration tool that PROVES nothing was lost.

Behavior

B1 (T0, zero LLM, forever): compute — commit parity (N in == N out),per-tag file checksums (sha256 each side, compare), branch parity,author coverage %
B2: FidelityRing animates to final %; metric cards with ✓/✗ per check
B3: Certificate = {repo, run hash, date, metrics, verdict} rendereddownloadable (PDF/print view), hash-stamped
B4: Before/After view: split source vs target, matched entities highlighted in sync
B5: verdict logic: all checks pass → "NOTHING LOST"; any fail → explicit failing check (never silently green)
AC: US-07 AC1–3; Prover token usage == 0 (assert in code).Scope edge: No cryptographic signing keys, no third-party attestation. Hash-stamp only.

F-09 · Human-in-the-Loop Gates
Value: responsible autonomy — and a live safety net for the demo.

Behavior

B1: Gates: PLAN (structure+wave) · MAPPINGS (ambiguous authors) · SECRETS (acknowledge) · CUTOVER
B2: each gate = one-click ApprovalCard; state machine physically cannot advance without approval record
B3: approvals logged as T3 decisions in the audit trail
B4: queue empty state: "Nothing needs you. The agents are working."
AC: CP-9; every gate demonstrably blocks.Scope edge: No multi-approver workflows, no roles/permissions, no email routing.

Cross-Feature Rules
Log schema is universal — every agent decision uses the §4 cascade log format; the feed, the audit trail, and the cost report are three views of ONE table
Tier badges on everything — feed entries and decisions always show T0/T1/T2/T3; this is how the cascade stays visible to judges
Token counter always on-screen (footer): "tokens: {used}/{budget}" — the cost story is a live UI element, not a slide claim
Plain-language law — any string a human reads passes the "would a non-engineer manager understand this?" test
Frozen OUT (reminder — "Logged. Not built.")
F-11 CI translation · F-12 chat Q&A · F-13 wave-planning UI · curationUI · permissions mapping · incremental sync · rollback · notifications ·dev-guide automation.

Ship these docs (15 minutes)
bash

# 1. Save the five files into docs/
# 2. Commit
git add docs/
git commit -m "docs: freeze requirements, architecture, design, DoD, feature-spec v1.0"

# 3. Onboard into AIDLC (inside opencode)
/aidlc knowledge onboard     # point at docs/ — all five files
/aidlc knowledge list        # verify
Then feed AIDLC this prompt:

Read docs/product-spec.md, requirements.md, architecture.md, design.md, completion-criteria.md, feature-spec.md — these are FROZEN (v1.0). Proceed through Inception using requirements.md as the requirements baseline and feature-spec.md as behavioral truth. Do not add features; anything not in these docs is out of scope — log as candidate amendment, never implement. Architecture is decided: Python/FastAPI + React + Decision Cascade per architecture.md. Gate 1 kill rules per completion-criteria.md apply.

