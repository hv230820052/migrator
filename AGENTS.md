# AGENTS.md

Canonical IDs: `requirements.md` (FR), `feature-spec.md` (F), `definationnofdone.md` (G/US/CP). See `docs/decision-log.md` D-08 (R1…R8 binding).
Frozen docs in `doc/` are never edited. Additions require PO approval. Superseded texts are resolved by reference to D-08, not by editing.

API contract: `doc/arch.md` §8 (12 REST + WS `/api/runs/{id}/events`) — OpenAPI must match verbatim.
Transport: WebSocket only (no SSE).
Cascade: T0 → T2 → T3 (T1 reserved, log vocab T0/T2/T3 only).
