Status: FROZEN · Version: 1.0 · Owner: [PO NAME]Stack: Python 3.11+ (FastAPI) · React 18 (Vite) · LLM (pluggable provider) · SQLite

1. Stack Decisions
Layer	Choice	Why
Backend	Python + FastAPI	Best-in-class git/svn tooling (git-svn, subprocess, GitPython), async + WebSockets native, fast to build
Frontend	React + Vite	Component model fits dashboard + live feed; Vite = zero-config HMR under time pressure
Realtime	WebSocket (FastAPI)	Agent activity feed must stream < 1s (NFR-07)
Storage	SQLite	Zero-ops, file-based, perfect for single-node hackathon; schema ports to Postgres later
LLM	Provider-agnostic client behind one interface	Swap OpenAI/Anthropic/Bedrock without touching agents; hackathon uses one provider
GitHub	REST + GraphQL API (PyGithub)	Issues/PR migration + repo creation
SVN	git svn + svn CLI via subprocess	Battle-tested conversion; we wrap, not replace
2. System Overview
┌─────────────────────────────────────────────────────────┐
│ REACT SPA — Mission Control │
│ Catalog · Risk Heatmap · Approvals · Live Feed │
│ Before/After · Fidelity Report · Certificate │
└───────────────┬──────────────── REST + WebSocket ───────┘
│
┌───────────────▼─────────────────────────────────────────┐
│ FASTAPI BACKEND │
│ │
│ ┌──────────────┐ ┌──────────────────────────────┐ │
│ │ ORCHESTRATOR │──▶│ AGENTS │ │
│ │ stage machine│ │ Scout·Assessor·Curator │ │
│ │ Discover→ │ │ Cartographer·Executor·Prover │ │
│ │ Assess→Plan→ │ └──────────┬───────────────────┘ │
│ │ Migrate→Prove│ │ │
│ └──────┬───────┘ ┌──────────▼───────────────────┐ │
│ │ │ DECISION CASCADE ROUTER │ │
│ ┌──────▼───────┐ │ T0 rules → T1 fast LLM │ │
│ │ CONNECTORS │ │ → T2 strong LLM → T3 human │ │
│ │ SVN·TFS-sample│ │ + escalation log = audit │ │
│ │ LocalGit·GH │ └──────────┬───────────────────┘ │
│ └──────┬───────┘ │ │
│ │ ┌──────────▼───────────────────┐ │
│ ┌──────▼───────┐ │ LLM CLIENT (pluggable) │ │
│ │ MIGRATION │ │ evidence packets · memoize │ │
│ │ ENGINE │ │ by content-hash · token │ │
│ │ git-svn·LFS· │ │ budget circuit breaker │ │
│ │ filter·push │ └──────────────────────────────┘ │
│ └──────┬───────┘ │
│ ┌──────▼───────┐ ┌──────────────────────────────┐ │
│ │ VERIFICATION │ │ SQLITE STORE │ │
│ │ ENGINE │ │ catalog·runs·decisions· │ │
│ │ pure compute │ │ mappings·reports │ │
│ │ ZERO LLM │ └──────────────────────────────┘ │
│ └──────────────┘ │
└─────────────────────────────────────────────────────────┘

text


**Design law (D-07):** Rails for the 99%, judgment for the 1%, proof for
100%. Verification consumes zero LLM tokens by construction.

## 3. Component Responsibilities

| Component | Owns | Never does |
|-----------|------|-----------|
| Orchestrator | Stage state machine, run lifecycle, event bus | LLM calls |
| Connectors | Source auth, metadata extraction, read-only access | Writes to sources |
| Agents | Domain decisions via cascade only | Direct subprocess/LLM calls |
| Cascade Router | Tier routing, escalation logging, memoization, budget | Domain logic |
| Migration Engine | git/svn/LFS/filter operations, pushes | Decisions — executes only |
| Verification Engine | Checksums, parity math, certificate rendering | Anything probabilistic |

## 4. Decision Cascade — Formal Spec

query ─▶ T0 deterministic ── resolved? ──▶ outcome + log(T0)
│ ambiguous/low-conf
▼
T1 fast model (classify/rank) ── conf ≥ τ1? ──▶ outcome + log(T1)
│ conf < τ1
▼
T2 strong model (reason over evidence packet)
│ conf < τ2 OR blast-radius ≥ high
▼
T3 human approval card ──▶ outcome + log(T3)

text


- Thresholds: τ1 = 0.75, τ2 = 0.85 (config)
- **Evidence packet rule:** T1/T2 receive a compact bundle (entity + ≤5
  signals), never raw repo content
- **Memoization:** key = sha256(entity + evidence); repeat ambiguity =
  cache hit, zero cost
- **Circuit breaker:** per-run token cap (default 100k). On trip → new
  decisions degrade to T3 queue, run continues. Agent cannot spend
  unbounded money (NFR-02)
- **Escalation log schema:** `{id, ts, run_id, agent, tier, entity_hash,
  reason, outcome, confidence, tokens_used}` — this log IS the agent
  activity feed and the audit trail (NFR-04). One mechanism, two products.
- Hackathon simplification: T1 and T2 may share one model with different
  prompts; tiers remain logically distinct in the log

## 5. Agent Specifications

| Agent | Trigger | Cascade usage | Output |
|-------|---------|---------------|--------|
| **Scout** | Source connected | T0 only | Catalog rows (8 metadata fields) |
| **Assessor** | Catalog row ready | T0 formula → one T2 call for portfolio summary | Risk tier + top-3 factors |
| **Curator** | During assess | T0 (dead-branch stat, binary size, secret regex/entropy) | Findings; T2 only for secret false-positive triage; T3 for remediation choice |
| **Cartographer** | Plan stage | T0 exact author match; T2 for ambiguous authors | Mapping proposals + confidence |
| **Executor** | Migrate stage | T0 error-signature→known-fix table; T2 only for NOVEL errors; T3 before any destructive fix | Streamed actions; self-heal events |
| **Prover** | Post-migrate | **T0 only, forever** | Fidelity report + certificate |

Known-fix table (Executor T0) — seed entries:
| Error signature | Fix |
|---|---|
| `file exceeds 100MB` / GH size limit | Convert to Git LFS, retry push |
| non-fast-forward | Rebase/retry with force-with-lease after check |
| auth failure | Halt + T3 card |
| unknown | T2 diagnosis → proposed fix → T3 if destructive |

## 6. Pipeline State Machine

DISCOVER ──► ASSESS ──► PLAN ──► [GATE: plan+mappings+secrets] ──►
MIGRATE ──► (self-heal loop) ──► VERIFY ──► [GATE: cutover] ──►
COMPLETE ──► REPORT

text

Gates are hard: state machine cannot advance without an approval record
(NFR-05). Every transition emits events to the bus → WebSocket.

## 7. Data Model (SQLite)

sources(id, type, endpoint, status)
repos(id, source_id, name, size, commits, branches, tags,
contributors, last_activity, large_files, risk_tier,
risk_factors_json)
author_mappings(id, repo_id, legacy_name, proposed_login,
proposed_email, confidence, evidence_json, status[pending|
auto|confirmed|edited], tier)
findings(id, repo_id, kind[secret|binary|dead_branch|layout],
detail_json, severity, status)
runs(id, created_at, status, wave_json, token_budget, tokens_used)
events(id, run_id, ts, agent, action, reason, tier)
decisions(id, run_id, ts, agent, tier, entity_hash, reason,
outcome, confidence, tokens_used)
fidelity_reports(id, run_id, repo_id, commit_parity, branch_parity,
tag_checksums_json, author_coverage, verdict)
certificates(id, report_id, issued_at, signature_hash, artifact_path)

text


## 8. API Surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/sources | Connect source (validate access) |
| GET | /api/catalog | Catalog with risk |
| GET | /api/repos/{id}/risk | Detail + factors |
| GET | /api/repos/{id}/mappings | Author mapping proposals |
| POST | /api/mappings/{id}/decide | Approve/edit (T3 resolution) |
| GET | /api/repos/{id}/findings | Secrets/binaries/dead branches |
| POST | /api/runs | Create migration run (from plan) |
| POST | /api/runs/{id}/approve/{gate} | Gate approval |
| WS | /api/runs/{id}/events | Live agent feed |
| GET | /api/runs/{id}/fidelity | Report data |
| GET | /api/runs/{id}/certificate | Download certificate |
| GET | /api/runs/{id}/beforeafter | Split-view comparison data |

## 9. Golden Path Sequence

POST /sources ×4 → Scout fills catalog (streamed)
Assessor runs → heatmap + portfolio summary (1 T2 call)
Cartographer → 450 authors auto (T0), ~5 cards (T3)
Curator → secret flagged (T0), oversized file (T0)
Human gates → 3 one-click cards
Executor → git-svn fetch, map authors, LFS convert,
push, migrate issues via GH API — streamed
└─ INJECTED: 410MB file → push rejected → T0 known-fix → LFS → retry ✓
Prover → parity + checksums + coverage (T0, 0 tokens)
Certificate issued → downloadable
text


## 10. Security & Isolation
- Sources opened read-only; no delete/write API exists on connectors
- Secrets: redacted at detection boundary (NFR-09); raw values never
  enter logs, events, or LLM context
- LLM egress allowlist: only evidence packets cross the boundary
- Migration workspace: isolated temp clone dir per run, cleaned post-run

## 11. Repository Layout

provenance/
├── docs/ # this suite
├── backend/
│ ├── app/
│ │ ├── main.py # FastAPI + WS
│ │ ├── orchestrator/ # state machine, event bus
│ │ ├── agents/ # scout/assessor/curator/cartographer/
│ │ │ # executor/prover
│ │ ├── cascade/ # router, tiers, memo, budget
│ │ ├── connectors/ # svn, tfs_sample, localgit, github
│ │ ├── engine/ # migration + verification
│ │ ├── models/ # SQLite entities
│ │ └── api/ # routes
│ └── tests/
├── frontend/
│ └── src/
│ ├── screens/ # 8 screens (see design.md)
│ ├── components/ # RiskPill, FidelityRing, AgentFeed...
│ └── ws/ # live feed client
└── samples/ # demo corpus: messy SVN, dirty local
# git, GH org, TFS sample

text


## 12. Hackathon Simplifications vs Production Path (honesty table)

| Now (hackathon) | Production path |
|---|---|
| SQLite, single node | Postgres + distributed workers |
| T1/T2 same model, two prompts | Distinct fast/strong models |
| TFS = canned sample import | Live TFS/TFVC connector |
| Single target org | Multi-org, enterprise policies |
| Token cap fixed at 100k | Per-tenant budgets + billing |



# Architecture Document: Provenance

| Field | Value |
|---|---|
| Document ID | ARCH-001 |
| Version | 1.0 |
| Status | Baseline for Construction planning |
| Location | `docs/architecture.md` |
| Derives from | `docs/product-spec.md`, `docs/requirements.md`, `docs/design.md` |
| Stack | Python (backend, agents, engines), React + TypeScript (frontend), LLM provider API (AI) |
| Last updated | 2026-10-10 |

> Tool and library names below are **recommended defaults** chosen for hackathon speed. Items marked **[SPIKE]** must be validated early because they carry integration risk.

---

## 1. Architecture Drivers

| Driver | Consequence |
|---|---|
| History fidelity and proof (core differentiator) | Migration and verification are deterministic code, never LLM-driven (NFR-10) |
| Agentic behavior with human approval | Workflow state machine with approval gates; agents act inside approved plans |
| AI cost governance | A Decision Router resolves by rules first and escalates to AI, then to humans |
| Source safety | Read-only connectors; all work happens on local mirrors |
| Resumable, idempotent runs | Checkpointed jobs and an event-sourced audit trail |
| Hackathon speed | Few moving parts: one API service, one worker, one database, one frontend |
| Demo reliability | Seeded sample estate, replayable failure, graceful LLM degradation |

---

## 2. System Context

```
 +---------+      +------------------------+       +-----------------+
 |  Users  | ---> |  Provenance (this      | ----> | Target GitHub   |
 | (React) |      |  system)               |       | Organization    |
 +---------+      |                        |       +-----------------+
                  |                        | ----> +-----------------+
                  |                        |       | LLM Provider    |
                  |                        |       +-----------------+
                  |                        | <---- +-----------------+
                  +------------------------+       | Sources: SVN,   |
                                                   | TFS, Local Git, |
                                                   | GitHub          |
                                                   +-----------------+
```

Sources are only read. The target is written only inside an approved plan. The LLM receives only minimized, redacted summaries.

---

## 3. Logical Architecture

```
+--------------------------------------------------------------------+
|                          React Frontend                            |
|  Overview | Repos | Plan | Review Queue | Control Room | Proof      |
+---------------------------+----------------------------------------+
                            | REST (JSON) + SSE (live events)
+---------------------------v----------------------------------------+
|                     API Layer (FastAPI)                            |
|  auth/session | sources | repos | plans | approvals | events | ... |
+---------------------------+----------------------------------------+
|                 Orchestrator (workflow state machine)              |
|   per-repo states, gates, checkpoints, retries, wave scheduling    |
+------+------------------+-------------------+----------------------+
       |                  |                   |
+------v------+   +-------v--------+   +------v--------------------+
|   Agents    |   | Decision Router|   |   Deterministic Engines   |
| Scout       |   | rules          |   | Connectors (SVN/TFS/Git/  |
| Assessor    |<->| heuristics     |   |   GitHub)                 |
| Planner     |   | light LLM      |   | HistoryEngine             |
| IdentityMap |   | strong LLM     |   | ScannerEngine             |
| Migrator    |   | human queue    |   | ContextMigrator           |
| Healer      |   | cache + budget |   | VerificationEngine        |
| Verifier    |   +-------+--------+   | ReportBuilder             |
| Communicator|           |            +------------+--------------+
+------+------+           |                         |
       |            +-----v------+            +-----v-------------+
       |            | LLM Gateway|            | Workspace (mirrors|
       |            | (provider  |            | artifacts, reports)|
       |            |  adapter)  |            +-------------------+
       |            +------------+
+------v--------------------------------------------------------------+
|              Persistence: Database + Event Log + Cache              |
+---------------------------------------------------------------------+
```

### 3.1 Layer responsibilities

| Layer | Responsibility | Rule |
|---|---|---|
| Frontend | Presentation, approvals, live views | No business logic beyond display |
| API | Validation, authN/Z, request handling | Thin; delegates to orchestrator |
| Orchestrator | Workflow state, gates, scheduling, checkpoints | The only component that advances repo state |
| Agents | Decide what to do next and why | Call engines as tools; consult the router |
| Decision Router | Resolves a question by the cheapest sufficient tier | Logs tier, confidence, cost |
| Engines | Do the actual work | Deterministic and testable; never call an LLM |
| LLM Gateway | Provider abstraction, caching, budget, redaction | Single exit point to any model |
| Persistence | State, events, decisions, certificates | Event log is append-only |

---

## 4. Key Design Decisions (ADRs)

| ID | Decision | Rationale | Alternative |
|---|---|---|---|
| ADR-01 | Python 3.12 backend | Best ecosystem for git tooling, scanning, LLM SDKs | Node |
| ADR-02 | FastAPI + Pydantic v2 | Fast to build, typed contracts, OpenAPI for the frontend, async SSE | Flask, Django |
| ADR-03 | React + TypeScript + Vite | Fast dev loop and typed API client | Next.js |
| ADR-04 | Engines are deterministic; LLM is advisory | Reproducibility and trustworthy proof | LLM-driven migration (rejected) |
| ADR-05 | Decision Router with escalation ladder | Cost control and resilience (NFR-10, NFR-11) | Always-LLM (rejected) |
| ADR-06 | Own lightweight workflow state machine, not a heavy agent framework | Predictable, debuggable, few dependencies. A framework such as LangGraph may be adopted later if needed | LangGraph, CrewAI |
| ADR-07 | SQLite for demo, PostgreSQL-ready via SQLAlchemy | Zero setup now, production path later | Postgres from day one |
| ADR-08 | DB-backed job queue with a worker process | Fewer moving parts than Redis plus Celery; adequate for demo scale | Celery + Redis, RQ, arq |
| ADR-09 | SSE for live feed | Simple, one-way, works through proxies | WebSocket |
| ADR-10 | Event-sourced audit log | Provides audit, replay and certificates for free | Mutable status only |
| ADR-11 | Work on local bare mirrors in an isolated workspace | Source safety and resumability | Direct remote operations |
| ADR-12 | Provider-agnostic LLM Gateway with model tiers | Cheap model for classification, strong model for hard cases | Hardwire one model |

---

## 5. Component Specifications

### 5.1 Connectors (adapters)

A common interface keeps agents source-agnostic.

```python
class SourceConnector(Protocol):
    def validate(self) -> ConnectionReport: ...
    def discover(self) -> list[RepoDescriptor]: ...
    def inspect(self, repo: RepoDescriptor) -> RepoStats: ...
    def export_to_git(self, repo: RepoDescriptor, plan: MappingPlan,
                      workdir: Path) -> GitExport: ...   # read-only on source
```

| Connector | Approach | Notes |
|---|---|---|
| **SvnConnector** | `svn` CLI for inspection; `git svn` (or a layout-aware import) for conversion with an authors file and layout flags | Handles trunk/branches/tags and custom layouts through the mapping plan. Revision numbers kept as commit metadata. **[SPIKE]** on throughput and non-standard layouts |
| **TfsGitConnector** | Standard git clone/mirror | Straightforward |
| **TfvcConnector** | `git-tfs` where runnable, otherwise a **simulated fixture** that mimics TFVC changesets and work items | Real TFVC tooling is Windows-oriented. **[SPIKE]** Decision D-02: simulated sources are labeled in the UI |
| **LocalGitConnector** | Scans paths for repositories; reads commits, branches, stashes and remotes | Detects unpushed and local-only work and duplicates |
| **GitHubConnector** | GitHub REST API (and GraphQL where needed) for repo, issue, PR and label data; git mirror for code | For org-to-org moves, GitHub's own migration tooling may be used as an accelerator **[SPIKE]**, but verification remains ours |

Target operations go through a `GitHubTarget` client (repo creation, push, issues, labels, milestones), using a least-privilege token.

### 5.2 Engines (deterministic)

| Engine | Responsibility | Tools and methods |
|---|---|---|
| **HistoryEngine** | Convert, rewrite authors, apply branch/tag mapping, push to target | git, `git-filter-repo` (mailmap-based author rewrite, path filtering), Git LFS migration for oversized files |
| **ScannerEngine** | Size and binary detection, secret scanning, layout detection | Size thresholds; a secrets scanner such as gitleaks or detect-secrets over history (**[SPIKE]** choose by speed and false-positive rate); layout heuristics |
| **ContextMigrator** | Issues, labels, milestones, ticket-ID reference rewriting, optional PRs | GitHub REST; idempotency keys (original ID stored in issue metadata) to prevent duplicates |
| **VerificationEngine** | Parity checks and fidelity scoring | Commit count and ordering, branch and tag sets, per-tag and head tree comparison (source export checksum vs Git tree), author coverage, link coverage |
| **ReportBuilder** | Certificate, audit export, developer guide | Templates (Jinja2) rendered to Markdown, HTML and PDF |

**Verification method (important):** author rewriting changes commit hashes but not file content. Therefore content parity is checked by comparing **tree contents** (file-path-and-checksum manifests) between the source at a given revision and the Git tree at the mapped commit, for head, every tag and a sampled set of intermediate revisions. Commit-count and ordering parity use the revision-to-commit map recorded during conversion.

### 5.3 Agents

An agent is a small Python class: it reads state, calls tools (engines), asks the Decision Router for judgments, and emits events. Agents never mutate the repo state directly; they return results to the Orchestrator.

| Agent | Tools | Decisions (via router) |
|---|---|---|
| Scout | Connectors | None |
| Assessor | ScannerEngine | Explanation wording for unusual risk combinations |
| Planner | Inventory, risk | Wave proposal, odd layout mapping |
| IdentityMapper | Directory data, fuzzy matcher | Ambiguous author resolution |
| Migrator | HistoryEngine, ContextMigrator | Plan deviation |
| Healer | Playbook, engines | Unknown failure diagnosis |
| Verifier | VerificationEngine | Gap explanation text |
| Communicator | ReportBuilder, notifier | Narrative summary (optional) |

### 5.4 Decision Router (core of cost governance)

```
resolve(question, context):
    sig = signature(question, minimized(context))
    if cached(sig):                    return cached          # free
    r = rules.evaluate(question, ctx)  # Tier 0
    if r.confident:                    return log(r, "rule")
    h = heuristics.evaluate(...)       # Tier 1 (fuzzy match, error signatures)
    if h.confidence >= T_h:            return log(h, "rule")
    if budget.available(repo):         # per-repo AI budget
        a = llm.light(question, redacted(ctx))      # Tier 2
        if a.confidence >= T_a:        return log(a, "ai-light")
        s = llm.strong(question, redacted(ctx))     # Tier 3
        if s.confidence >= T_s:        return log(s, "ai-strong")
    return enqueue_human(question, best_suggestion)  # Tier 4
```

| Aspect | Design |
|---|---|
| Output | `Decision{outcome, tier, confidence, reason, cost, tokens}` stored and emitted as an event |
| Cache | Keyed by signature so identical patterns across repos cost one call |
| Budget | Per-repo and global caps; exhausted budget routes to human queue (never fails the run) |
| Promotion | Human-approved AI resolutions can be saved as new rules |
| Safety | Inputs are redacted and minimized; secret values and credentials never leave the process (NFR-06) |
| Degradation | LLM errors or timeouts fall through to Tier 4 (NFR-11) |

### 5.5 LLM Gateway

- Provider adapter interface with model tiers (`light`, `strong`).
- Structured output: responses validated against Pydantic schemas; invalid output is retried once, then escalated.
- Prompt templates versioned in the repo.
- Cost tracking per call (tokens, estimated cost) written to the decision record.
- Timeouts, retries with backoff, and a circuit breaker.

### 5.6 Orchestrator and State Machine

```
DISCOVERED -> ASSESSED -> PLANNED -> PLAN_APPROVED -> DRY_RUN_DONE
   -> MIGRATING -> VERIFYING -> VERIFIED -> CUTOVER_APPROVED -> DONE
                \-> HEALING -> MIGRATING
Any state -> NEEDS_HUMAN (review queue) -> resumes
Any state -> FAILED (with reason, resumable)
```

| Rule | Detail |
|---|---|
| Gates | `PLAN_APPROVED` is required before any target write; `CUTOVER_APPROVED` before switching |
| Checkpoints | Migration progress saved in steps so a restart resumes from the last checkpoint |
| Idempotency | Each step has an idempotency key; re-runs detect existing target objects |
| Concurrency | Worker pool processes several repos in parallel, bounded by a configured limit |
| Events | Every transition emits an event to the log and to the SSE stream |

---

## 6. Data Architecture

### 6.1 Core tables

| Table | Purpose |
|---|---|
| `sources` | Registered sources (connection reference, not secrets) |
| `repos` | Catalog entries, stats, risk, state |
| `findings` | Pre-flight problems |
| `identity_mappings` | Legacy to GitHub identity, method, confidence, status |
| `plans` | Mapping plan and wave per repo |
| `approvals` | Gate approvals with actor and time |
| `decisions` | Router outputs: tier, confidence, reason, cost |
| `events` | Append-only audit and feed |
| `jobs` | Queue entries, status, checkpoint |
| `verifications` | Check results, score, gaps |
| `certificates` | Generated reports and hashes |
| `llm_cache` | Signature to response |

### 6.2 File workspace

```
workspace/
  mirrors/<repo_id>/        read-only mirrors of sources
  work/<repo_id>/           conversion and rewrite area
  artifacts/<repo_id>/      manifests, certificates, guides
  fixtures/                 seeded demo estate
```

---

## 7. API Design (summary)

| Area | Endpoints |
|---|---|
| Sources | `POST /sources`, `POST /sources/{id}/validate`, `GET /sources` |
| Discovery | `POST /discovery/run`, `GET /repos`, `GET /repos/{id}` |
| Assessment | `GET /repos/{id}/risk`, `GET /repos/{id}/findings` |
| Planning | `POST /plans/generate`, `GET /plans/{id}`, `POST /plans/{id}/dry-run` |
| Approvals | `POST /approvals` (gate, plan, decision) |
| Review queue | `GET /queue`, `POST /queue/{id}/resolve` |
| Execution | `POST /plans/{id}/execute`, `POST /repos/{id}/resume` |
| Live events | `GET /events/stream` (SSE), `GET /events` |
| Proof | `GET /repos/{id}/verification`, `GET /repos/{id}/certificate` |
| Reports | `GET /reports/summary`, `GET /reports/ai-cost`, `GET /audit` |
| Demo | `POST /demo/seed`, `POST /demo/replay-failure` |

The OpenAPI schema generates the TypeScript client for the frontend.

---

## 8. Frontend Architecture

| Concern | Choice |
|---|---|
| Build | Vite, React 18, TypeScript |
| Routing | React Router |
| Server state | TanStack Query (REST) plus an SSE hook feeding the activity feed |
| UI state | Zustand (minimal) |
| Styling | Tailwind CSS with design tokens from `docs/design.md` |
| Components | shadcn/ui primitives, custom RiskChip, TierBadge, ApprovalCard, FidelityRing |
| Charts | Recharts |
| API client | Generated from OpenAPI |

Structure: `src/features/{overview,repos,plan,queue,control-room,proof,reports}`, `src/components`, `src/api`, `src/styles`.

---

## 9. Security and Privacy

| Concern | Control |
|---|---|
| Credentials | Environment variables or a local secret store; never in logs, UI, events or LLM prompts |
| Secrets found in repos | Values masked immediately; only type, location and a fingerprint are stored |
| Token scope | Least privilege GitHub token; sources read-only |
| LLM data | Minimization and redaction before every call; allow-list of fields |
| Workspace | Isolated directories; cleaned after completion |
| Audit | Append-only events; certificates carry a content hash |
| Demo | Seeded data only; no real company code |

---

## 10. Reliability and Failure Handling

| Failure | Handling |
|---|---|
| Push rejected for size | Healer playbook: propose LFS migration, require approval, resume |
| Unmapped author | Router ladder; else review queue; fallback identity if skipped |
| Secret in history | Flag, mask, recommend rotation; history rewrite only with explicit approval |
| Network or rate limit | Backoff and retry with checkpoint |
| LLM down | Circuit breaker; rule flow continues; AI-needed items queued (NFR-11) |
| Worker crash | Resume from last checkpoint; idempotent steps |
| Verification gap | Mark `VERIFIED_WITH_GAPS`; require human sign-off |

---

## 11. Observability

- Structured logs with repo ID and correlation ID.
- Event stream doubles as UI feed and audit.
- Metrics: decisions per tier, LLM calls, tokens, cost, time per stage, failures auto-healed vs escalated.
- `/reports/ai-cost` powers the dashboard chip.

---

## 12. Testing Strategy

| Level | Focus |
|---|---|
| Unit | Matchers, rules, router tiers, redaction, scoring |
| Engine integration | Convert seeded SVN, local Git and GitHub fixtures; verify parity |
| Contract | OpenAPI schema vs generated client |
| Scenario | Full demo scenario from `docs/definition-of-done.md` |
| Failure injection | Oversized file, rejected push, unmapped authors, LLM timeout |
| Redaction | Automated test that fake secrets never appear in prompts, logs or UI |
| Rehearsal | Three consecutive clean demo runs |

---

## 13. Deployment

- **Demo:** `docker compose up` runs API, worker and frontend; SQLite and a volume for the workspace.
- **Config:** `.env` for tokens and model names; a `DEMO_MODE` flag.
- **Production path (roadmap):** PostgreSQL, Redis-backed queue, containerized workers per wave, SSO.

---

## 14. Repository Layout

```
provenance/
  backend/
    app/
      api/            routers, schemas
      orchestrator/   state machine, gates, jobs
      agents/         scout, assessor, planner, identity, migrator, healer, ...
      router/         rules, heuristics, budget, cache, decision log
      llm/            gateway, providers, prompts, schemas
      connectors/     svn, tfs_git, tfvc, local_git, github
      engines/        history, scanner, context, verification, reports
      models/         SQLAlchemy models
      demo/           seeded estate, failure replay
    tests/
  frontend/
    src/
  docs/
    product-spec.md  requirements.md  design.md  architecture.md
    definition-of-done.md  feature-spec.md
  docker-compose.yml
```

---

## 15. Spikes (do first, time-boxed)

| Spike | Question | Time-box | Fallback |
|---|---|---|---|
| S1 | Can we convert a non-standard SVN layout with an authors file reliably? | 1 to 2 h | Restrict demo to standard plus one custom mapping |
| S2 | Can we run TFVC tooling, or do we simulate? | 1 h | Fixture-based simulation, labeled |
| S3 | Can we migrate issues idempotently via the GitHub API within rate limits? | 1 to 2 h | Reduce to ticket-link annotation |
| S4 | Which secrets scanner is fast enough on history? | 1 h | Simple pattern scan on seeded data |
| S5 | Author rewrite and tree-parity verification end to end | 2 h | Sampled checks |
| S6 | LLM structured output reliability and cost for author disambiguation | 1 h | Heuristics plus human queue |

---

## 16. Traceability

| Requirement | Component |
|---|---|
| FR-01, FR-02 | Connectors, Scout, `sources`, `repos` |
| FR-03, FR-04 | Assessor, ScannerEngine, `findings` |
| FR-05 | IdentityMapper, Decision Router, `identity_mappings` |
| FR-06, FR-07 | HistoryEngine, SvnConnector, TfvcConnector |
| FR-08 | ContextMigrator |
| FR-09, FR-10 | Orchestrator, `plans`, `approvals` |
| FR-11 | Healer, playbook, router |
| FR-12 | Events, SSE, Control Room |
| FR-13, FR-14 | Verifier, VerificationEngine, ReportBuilder |
| FR-15 | Communicator, ReportBuilder |
| NFR-02, NFR-10, NFR-11 | Decision Router, LLM Gateway, `decisions` |
| NFR-06 | Redaction layer, secret masking |