# Product Specification: Provenance (VCS-to-GitHub Agentic Migration Platform)

| Field | Value |
|---|---|
| Document ID | SPEC-001 |
| Status | **Baseline v1.0 (Approved for Inception)** |
| Owner | Product Owner: [NAME] — **Formally designated: User/Initiator (2026-10-10)** |
| Approvers | Full hackathon team |
| Last updated | 2026-10-10 |
| Location | `docs/product-spec.md` |
| Phase | AI-DLC Inception. Product definition only. No technology decisions. |

---

## 1. Purpose and Authority

This document is the **single source of truth** for what Provenance must do, what it must not do, and how we know it is done. All AI-DLC stages (requirements analysis, user stories, application design, construction, verification) derive from this file.

### 1.1 Order of precedence

When two sources disagree, the higher one wins.

| Rank | Source | Role | Mutable? |
|---|---|---|---|
| 1 | **Hackathon problem statement** (Section 2, verbatim) | Defines the mandate | No |
| 2 | **Written organizer or mentor clarifications** (recorded in Section 14) | Interprets the mandate | Append only |
| 3 | **This specification** (`docs/product-spec.md`) | Team's authoritative interpretation and the build baseline | Via change control (Section 13) |
| 4 | `docs/provenance-design.md` | Supporting design rationale, personas, journeys, scoring | Informative only |
| 5 | Chat, verbal agreements, assistant suggestions | Discussion | **Not authoritative** until recorded here |

### 1.2 Rules of use

1. If it is not in this specification, it is not a requirement.
2. If the design document and this specification conflict, **this specification wins**, and the design document is corrected.
3. AI agents may propose changes but may not alter scope. Only the Product Owner approves changes.
4. Every requirement has a unique ID. Every user story, design element and test must trace back to one.

---

## 2. Mandate (Verbatim Problem Statement)

> **Build an agentic solution that can migrate VCS repo across various sources to GitHub.**
>
> **Business Context:** The organization is standardizing source-code management on GitHub. Repositories currently exist across SVN, TFS, local Git and GitHub, creating a need for a repeatable migration platform that preserves development history and collaboration context rather than performing a simple source-code copy.

### 2.1 Mandate decomposition

| Phrase in mandate | Interpretation | Requirements |
|---|---|---|
| "agentic solution" | AI agents plan, decide, act and recover, with humans approving key decisions | FR-05, FR-10, FR-11, FR-12 |
| "across various sources" | SVN, TFS, local Git and GitHub are all in scope as sources | FR-01, Section 7 |
| "to GitHub" | Single target: a GitHub organization | FR-01 |
| "repeatable migration platform" | Same flow works for repo 1 and repo 500, with no one-off scripts | FR-02, FR-09, NFR-04 |
| "preserves development history" | Commits, authorship, timestamps, branches, tags, ordering | FR-05, FR-06, FR-07 |
| "collaboration context" | Issues, tickets, work items, reviews and cross-references | FR-08 |
| "rather than a simple copy" | Verification proof and fidelity reporting are required | FR-13, FR-14 |

---

## 3. Product Vision and Positioning

**Vision.** A migration lead points Provenance at the whole repository estate, reviews and approves a plan, and watches repos arrive on GitHub with history, people and context intact, with evidence.

**Positioning.** *Do not just move your code. Move your history, your people and your context, and get proof that nothing was lost.*

**Differentiators**

1. **History fidelity:** authorship, branches, tags and traceability survive.
2. **Collaboration context:** code stays linked to the issues and tickets around it.
3. **Proof:** every repo ends with a verification report, a fidelity score and a Migration Certificate.

---

## 4. Goals, Non-Goals and Success Criteria

### 4.1 Goals

| ID | Goal |
|---|---|
| G1 | Migrate repositories from SVN, TFS, local Git and GitHub into a target GitHub organization |
| G2 | Preserve history and collaboration context, not just files |
| G3 | Demonstrate genuine agent autonomy, with humans approving only key decisions |
| G4 | Prove migration quality with measurable, explainable verification |
| G5 | Make the process repeatable and safe at estate scale |

### 4.2 Non-Goals

| ID | Out of scope |
|---|---|
| NG1 | Migrating build servers, artifact repositories or package registries |
| NG2 | Full permission and ACL parity for every legacy system |
| NG3 | Version control systems other than the four named sources |
| NG4 | Replacing or re-implementing GitHub features |
| NG5 | Data retention or legal archiving beyond the audit log and certificate |
| NG6 | Production-grade hardening beyond what the demonstration requires |

### 4.3 Success criteria

| ID | Criterion | Target |
|---|---|---|
| SC1 | End-to-end flow demonstrated with no manual terminal work | Pass |
| SC2 | Fidelity score per migrated repo | 95% or higher, every gap explained |
| SC3 | Authors mapped automatically | 85% or higher; remainder in a review queue |
| SC4 | Human decisions required per repo | 3 or fewer |
| SC5 | Failures resolved by agents without human help | Majority |
| SC6 | At least one live self-healing moment | Yes |
| SC7 | Verification report readable by a judge in 10 seconds | Yes |

---

## 5. Users and Personas

| ID | Persona | Primary need | Primary requirements |
|---|---|---|---|
| P1 | **Migration Lead / Platform Engineer** | Run the whole program with visibility and control | FR-02, FR-03, FR-09, FR-10, FR-12, FR-13 |
| P2 | **Repo Owner / Team Lead** | Keep history, know what to do and when | FR-05, FR-06, FR-10, FR-15 |
| P3 | **Security and Compliance Reviewer** | No leaked secrets; evidence and audit trail | FR-04, FR-11, FR-14 |
| P4 | **Engineering Manager / Executive** | Status, risk and completion confirmation | FR-12, FR-14, FR-26 |
| P5 | **Developer** | Resume work quickly after cutover | FR-15 |

---

## 6. Functional Requirements

Priority uses MoSCoW. **Must** is the MVP boundary.

### 6.1 Must Have (MVP)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| **FR-01** | **Source and target connection.** The system connects to SVN, TFS, local Git and GitHub sources, and to a target GitHub organization. | (a) Each source type can be registered. (b) Access is validated and the result states what can and cannot be read. (c) Failures give a plain-language fix. |
| **FR-02** | **Estate inventory.** The system builds a catalog of repositories across sources. | For each repo the catalog shows source type, size, commit count, branches, tags, contributors, last activity and large files. Catalog is searchable and filterable. |
| **FR-03** | **Risk and complexity assessment.** Each repo is rated Low, Medium or High with explanations. | (a) Every rating lists specific reasons. (b) Estimated effort is shown. (c) An estate summary groups repos by risk. |
| **FR-04** | **Pre-flight problem detection.** The system detects issues before migration. | Detects at least: oversized files, large binaries, secrets in history, non-standard SVN layouts, unmapped authors. Each finding has severity and a recommended action. |
| **FR-05** | **Author identity mapping.** Legacy identities are mapped to GitHub identities. | (a) High-confidence matches apply automatically. (b) Ambiguous matches go to a review queue with suggestion and confidence. (c) Unmappable authors are preserved with a documented fallback identity, never dropped. (d) Coverage percentage is reported. |
| **FR-06** | **Branch, tag and layout mapping.** Source structures convert to Git branches and tags. | SVN trunk, branches and tags map to Git; TFVC branches and labels map to Git; non-standard layouts get a proposed mapping for approval. |
| **FR-07** | **History-preserving migration.** Repos migrate with commit history intact. | Commit order, messages, timestamps and mapped authorship are preserved. Original revision or changeset numbers are retained as traceable metadata. The source is never modified. |
| **FR-08** | **Collaboration context (thin slice).** Issues and ticket cross-links carry over for at least one source. | (a) Issues migrate with labels and status. (b) Commit references to ticket IDs resolve to the corresponding GitHub issues. (c) Items that cannot be carried over are reported, not silently dropped. |
| **FR-09** | **Dry run with fidelity forecast.** The full plan runs without publishing. | Output shows expected commits, branches, tags, mapped authors, items to be altered, and a predicted fidelity score. |
| **FR-10** | **Approval gates.** Humans approve at key points. | Gates exist for plan, mapping and cutover. Each presents a summary with Approve, Adjust or Hold. No write to the target occurs before plan approval. |
| **FR-11** | **Self-healing and remediation.** Agents diagnose and resolve failures. | At least two failure types handled end to end (for example oversized file and unmapped author; secret as stretch). Each action logs what happened and why. Risky or irreversible fixes require human approval. |
| **FR-12** | **Live progress and agent activity feed.** Users see what agents are doing. | Per-repo stage, progress and status; a chronological feed with plain-language reasons. |
| **FR-13** | **Verification and fidelity score.** Each migrated repo is verified. | Checks commit count parity, branch and tag parity, content integrity at head and at tags, author mapping coverage, context link coverage. Produces a score and explains every gap. |
| **FR-14** | **Migration Certificate and audit log.** Evidence is exportable. | A downloadable per-repo report listing approvals, agent actions and verification results. The audit log is complete and time-ordered. |
| **FR-15** | **Post-migration developer guide and old-repo notice.** | A generated, copy-paste guide to re-point remotes. Old repo is marked read-only with a pointer to the new URL, or a clearly documented equivalent where read-only cannot be applied. |

### 6.2 Should Have (build if time permits)

| ID | Requirement |
|---|---|
| FR-20 | Wave planning and ordering of repos by risk and activity |
| FR-21 | Stale and duplicate repo detection with archive recommendations |
| FR-22 | Incremental sync and cutover freeze workflow |
| FR-23 | Notifications to repo owners and teams |
| FR-24 | Conversational control and explanation of agent decisions |
| FR-25 | CI pipeline detection with GitHub Actions starter drafts |
| FR-26 | Executive summary dashboard with export |
| FR-27 | Full collaboration context: pull requests, review discussion, work items, wiki |

### 6.3 Could Have and Won't Have

| Category | Items |
|---|---|
| Could | Permission, team and branch-protection mapping; CODEOWNERS suggestions; repo health checklist |
| **Won't (this release)** | Build server migration, package registries, artifact stores, legal-hold archiving, VCS sources beyond the four named |

---

## 7. Source Coverage and Fidelity Policy

### 7.1 Source status for the demonstration

| Source | Planned status | Rule |
|---|---|---|
| SVN | Real | Working end to end |
| Local Git | Real | Working end to end |
| GitHub to GitHub | Real | Working end to end, including issues for FR-08 |
| TFS (TFVC and TFS Git) | Real if access exists; otherwise **simulated and clearly labeled** | Never presented as real if simulated |

### 7.2 Fidelity classification

Every source concept maps to exactly one outcome and is reported honestly:

| Outcome | Meaning |
|---|---|
| **Preserved** | Carried over as is |
| **Converted** | Transformed by a documented rule |
| **Annotated** | Kept as metadata or note |
| **Not supported** | Not carried over; reported explicitly |

Hiding a loss is a defect. Reporting a loss is acceptable.

### 7.3 Key mappings (baseline)

| Concept | SVN | TFS (TFVC) | Local Git | GitHub |
|---|---|---|---|---|
| History | Revision to commit | Changeset to commit | Commit | Commit |
| Authors | Username mapped | Account mapped | Name and email normalized | Existing identity |
| Branches | trunk/branches to branches | Branch to branch | Includes local-only branches | Kept |
| Tags | tags/ to tags | Labels to tags | Kept | Kept |
| Traceability | Revision number as metadata | Changeset number as metadata | Not applicable | Not applicable |
| Ticket links | Parsed from messages | Work-item associations | Parsed from messages | Issues and PRs |

---

## 8. Non-Functional Requirements (Product Level)

| ID | Requirement | Measure |
|---|---|---|
| NFR-01 | **Source safety.** Sources are read-only to the platform. | Zero writes to any source |
| NFR-02 | **Explainability.** Every agent decision states its reason. | 100% of agent actions have a reason in the feed and log |
| NFR-03 | **Auditability.** Approvals and actions are recorded. | Complete, time-ordered, exportable |
| NFR-04 | **Resumability and repeatability.** A failed or interrupted migration can resume or re-run safely. | No duplicate commits or corrupted target on re-run |
| NFR-05 | **Honesty.** Unsupported items are reported, never hidden. | Every unmigrated item appears in the report |
| NFR-06 | **Credential and secret handling.** Credentials are never shown in logs or the UI; discovered secrets are handled as sensitive. | No secret values displayed in the clear |
| NFR-07 | **Usability.** Plain-language UI; human decisions kept small. | 3 or fewer decisions per repo (SC4) |
| NFR-08 | **Demo reliability.** The demo runs reliably. | Rehearsed run with seeded data and a recorded backup |
| NFR-09 | **Scale story.** The design clearly supports many repos via waves and queues. | Estate view demonstrates multi-repo handling |

---

## 9. Autonomy and Safety Policy

1. Reading is always permitted. Writing to the target occurs only inside an approved plan.
2. Irreversible actions, or actions that alter history content (for example removing a secret), require explicit human approval.
3. Agent confidence below the threshold routes to a human.
4. A repo is marked **Done** only if verification passes, or a human accepts documented gaps and signs off.
5. Agents may propose scope changes but cannot approve them.

---

## 10. Key Decisions (Baseline)

| ID | Decision | Status |
|---|---|---|
| D-01 | Positioning is fidelity and proof, not speed | Approved |
| D-02 | Source status per Section 7.1 | Approved |
| D-03 | Collaboration context starts as a thin slice (FR-08); full coverage is Should (FR-27) | Approved |
| D-04 | Agents act within approved plans; humans approve plan, mapping and cutover | Approved |
| D-05 | Sources are never modified | Approved |
| D-06 | Dashboard is the primary interface; chat is Should (FR-24) | Approved |
| D-07 | Self-healing demo scenarios: oversized file and unmapped author; secret as stretch | Approved |
| D-08 | Product name: Provenance (placeholder) | Open |
| D-09 | Technology stack | **Deferred** until Inception outputs are approved |
| D-10 | MVP boundary authority rests with the Product Owner using weighted scoring (alignment 25, impact 20, feasibility 20, demo-ability 15, differentiation 15, low risk 5; 3.6 or above is Must) | Approved |

---

## 11. Assumptions, Constraints and Dependencies

### 11.1 Assumptions

| ID | Assumption | If wrong |
|---|---|---|
| A1 | Judges value fidelity and proof over breadth | Shift emphasis toward breadth |
| A2 | A GitHub organization or sandbox is available as target | Use a personal org for the demo |
| A3 | Sample data can be seeded to include realistic problems | Build a synthetic estate |
| A4 | Issue carry-over is achievable in the time available | Reduce to ticket-link annotation only |
| A5 | Author emails or a directory are available for matching | Rely on confidence-based review queue |

### 11.2 Constraints

- Time-boxed hackathon schedule with feature freeze at 75% of available time.
- Small team; one Product Owner with tie-break authority.
- Work follows the AI-DLC workflow with approval gates.

### 11.3 Dependencies

- Access to a GitHub target organization.
- Sample repositories for each source type (real or seeded).
- A model provider connected in the development environment.

---

## 12. Demonstration Scenario (Acceptance at Product Level)

The product is accepted when this scenario runs end to end without manual terminal work:

1. Connect a sample estate with SVN, local Git and GitHub sources (and TFS, real or labeled simulation).
2. Inventory and risk assessment display, with at least one oversized file, one secret finding and a set of unmapped authors.
3. User approves the plan.
4. Author mapping resolves most identities automatically; the user resolves the few ambiguous ones.
5. Migration runs; one failure occurs and the agent resolves it with an explained action.
6. Verification produces a fidelity score and a Migration Certificate.
7. A before and after view shows source versus GitHub.
8. A developer guide and old-repo notice are generated.

Traceability: this scenario exercises FR-01 to FR-15.

---

## 13. Change Control

1. Any change to Must requirements, non-goals or decisions requires Product Owner approval.
2. Each change records: ID, date, reason, impact, and what is traded off.
3. After the build gate, additions require removing equal or greater effort elsewhere.
4. No new features in the final 25% of time.
5. Verification (FR-13, FR-14) is the last Must to be cut.
6. This file is updated first; derived documents follow.

### 13.1 Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 1.0 | 2026-10-09 | Initial baseline | Product Owner |
| 1.1 | 2026-10-10 | Product Owner formally designated: User/Initiator. Confirmed D-07 implementation scope: oversized-file and unmapped-author self-healing scenarios. Confirmed FR-08 source: GitHub→GitHub per §7.1. Confirmed full dashboard scope per D-06. No scope change — clarifying approved decisions for Construction. | Product Owner |

---

## 14. Organizer Clarifications (Append Only)

Record any written answers from organizers or mentors here. These outrank this specification.

| Date | Question | Answer | Source |
|---|---|---|---|
| | What are the judging criteria and weights? | *Pending* | |
| | Is sample data or sandbox access provided? | *Pending* | |
| | Which TFS flavor is expected (TFVC or Git)? | *Pending* | |
| | Does collaboration context explicitly include pull requests, work items and wikis? | *Pending* | |
| | Is a live demo required, or is a recorded one acceptable? | *Pending* | |

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Agentic** | AI agents that plan, act and recover, with humans approving key decisions |
| **Fidelity score** | Percentage measure of how completely history and context were preserved |
| **Collaboration context** | Issues, tickets, work items, reviews and cross-references surrounding the code |
| **Migration Certificate** | Exportable evidence of what was migrated, approved and verified |
| **Wave** | A batch of repos migrated together |
| **TFVC** | Team Foundation Version Control, the centralized TFS source control |
| **Cutover** | The point where teams switch from the old repo to GitHub |
| **Thin slice** | A narrow but genuinely working version of a feature |

---

*End of specification. This file governs. Update it before updating anything derived from it.*
