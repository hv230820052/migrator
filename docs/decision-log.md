# Decision Log — Provenance

Owner: PO (User/Initiator) · Append-only · Precedence: product-spec.md > requirements.md > architecture.md > this log > all else
Frozen docs in `docs/` are never edited. Conflicts are resolved by reference to this log.

## D-08 — Canonical ID, contract, transport, cascade, budget, corpus, verification, and gates adjudication (R1…R8 binding) — 2026-10-10

**Status:** Approved (PO adjudication 2026-10-10) · Supersedes conflicting text in any other file.

### R1 — Canonical IDs
`requirements.md` is SOLE authority for FR IDs. `feature-spec.md` for F-IDs. `definationnofdone.md` / `completion-criteria.md` for G-IDs/US-IDs/CP. No other file's FR numbering may appear in code, commits, or traces. FR-13/FR-14 are void.

Canonical mapping (binding):

| Phase | FR (requirements.md) | F / US | G / CP |
|---|---|---|---|
| 0 Foundation | — | — | — |
| 1 Scout & Catalog | FR-01 | F-01 / US-01 | G-1 |
| 2 Assessor & Curator | FR-02, FR-05 | F-02, F-05 / US-02, US-05 | G-2, G-6 |
| 3 Cascade + Cartographer + Gates | FR-03, FR-09 | F-03, F-09 / US-03 | G-3, G-11, CP-9 |
| 4 Executor + LFS path | FR-04, FR-07, F-10* | F-04, F-07 / US-04, US-06 | G-4, G-5, G-7, G-12, G-13 |
| 5 Context Migration | FR-06 | F-06 / US-08 | G-8 |
| 6 Prover & Certificate | FR-08 | F-08 / US-07 | G-9, G-10 |

### R2 — Contract
Frozen API contract is `arch.md` §8 verbatim — 12 endpoints under `/api` + WebSocket `WS /api/runs/{id}/events`. OpenAPI published at Phase 0 must match exactly. Every other endpoint list is superseded.

### R3 — Transport
WebSocket ONLY. No SSE code. Fallback on failure is the pre-recorded segment per DoD, not a second transport.

### R4 — Cascade
Three physical tiers: T0 (rules) → T2 (single LLM, evidence packets ≤5 signals, sha256 memo) → T3 (human). T1 reserved in log schema but unimplemented. Log vocabulary: `T0`/`T2`/`T3` only. G-10 ≥99%-T0 measured over T0/T2/T3. Prover is T0 forever, zero LLM calls (assert in code).

### R5 — Budget
Per-RUN token budget, default 100k, configurable. On trip: new decisions route to T3 queue, run continues, one event to feed. Must NOT trip during golden path. Test once with tiny cap for G-11.

### R6 — Corpus (approved with refinements)
Synthesize via `svnadmin`/`git` scripts under `samples/`. Generator is committed, deterministic (fixed seed 42), byte-identical on twin runs (proven by checksum manifests). Oversized blob ~110MB from repeating pattern (compressible, tiny on-disk pack, logical size >100MB triggers failure). Planted AWS-key pattern at pinned revision (recorded). `dev_ninja99` ambiguous author with header email as T2 evidence. Standard `trunk/branches/tags`, ~50+ commits, one dead branch, one tag. Emit pre/post manifests for G-12 harness.

### R7 — Verification
Per-tag tree manifest `path → sha256(content bytes)` — source export vs target tree, LFS pointers resolved before hashing, per-tag ✓/✗, zero LLM.

### R8 — Gates
Four gates: `PLAN`, `MAPPINGS`, `SECRETS`, `CUTOVER`. `CUTOVER` gates `MIGRATE → COMPLETE`. Demo shows three cards + final cutover click. State machine cannot advance without approval record.

### Traceability
Cite as `D-08` in commits. Frozen docs remain unedited; conflicts resolved by reference to this entry.

## D-09 — Real GitHub source + target orgs replace simulation (D-08/R1 enforcement) — 2026-10-11

**Status:** Approved (PO directive) · Supersedes any suggestion that simulated JSON org data satisfies G-8.

### Ruling
A canned JSON source org cannot satisfy G-8. The golden path requires **real GitHub→GitHub issue migration** with a commit↔issue link resolving on github.com. Within Phase 0:

- **SOURCE org** (free, GitHub): ≥1 repo with ≥3 issues (varied labels/states), ≥1 PR, ≥1 commit referencing an issue number.
- **TARGET org** (free, GitHub): empty, ready to receive migrated repos.
- **PAT** with `repo` scope written to `.env` — gitignored, never committed, never printed, never sent to an LLM.
- The canned JSON org data (`samples/github-org/info.json`) survives **only** as an offline fallback for tests and the recorded-backup scenario.
- Config carries **target org name + PAT** from Phase 0 so the Executor (Phase 4) and Prover (Phase 6) point at the real target with zero rework.

### Verdict
Phase 1 approved conditionally: blocking R1 fix (relabeling + void-ID lint) lands now; real GitHub orgs configured via the GitHub API; `.env.example` and target-org config added to the repo.

### Next actions
Recorded at D-09 — proceed to Phase 1 only after `verify_phase0.py` full output shows lint pass + determinism pass.
