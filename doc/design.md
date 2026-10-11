# Design Document: Provenance Experience and Interaction Design

| Field | Value |
|---|---|
| Document ID | DES-001 |
| Version | 1.0 |
| Status | Baseline for Inception |
| Location | `docs/design.md` |
| Derives from | `docs/product-spec.md`, `docs/requirements.md` |
| Frontend | React (TypeScript) |
| Last updated | 2026-10-10 |

---

## 1. Design Intent

Provenance should feel like **mission control for a migration**: calm, transparent and evidential. The user is never wondering what the agents are doing, why, or whether anything was lost.

### 1.1 Principles

1. **Show the agents working.** Activity with reasons, never a blank spinner.
2. **Humans approve in one tap.** Decisions are cards (Approve, Adjust, Hold), not forms.
3. **Explain risk in a sentence.** Color plus words.
4. **Proof is a first-class screen.** Fidelity is never buried in logs.
5. **Honest by default.** Losses and unsupported items are visible, not hidden.
6. **Plain language.** VCS jargon gets tooltips.
7. **Label the source of every decision** as Rule, AI or Human, so the cost story is visible (NFR-02, NFR-10).

### 1.2 Tone of voice

Specific and calm, first person for agents.
- Yes: "I matched 41 of 43 authors. 2 need your help."
- No: "Operation successful."

---

## 2. Information Architecture

```
Provenance
|-- Overview (estate dashboard)
|-- Sources (connect and validate)
|-- Repos (catalog)
|     \-- Repo detail (tabs: Summary, Risk, Mappings, Plan, Timeline, Proof)
|-- Plan (waves and approvals)
|-- Review Queue (human decisions)
|-- Control Room (live migration)
|-- Proof (verification, certificates, before/after)
|-- Reports (executive summary, audit log, AI cost)
\-- Assistant panel (P1, chat, docked)
```

Global elements: top bar with environment label ("Demo mode"), approvals-pending badge, AI cost chip, and Review Queue count.

---

## 3. Primary Journeys

| Journey | Entry | Key steps | Success |
|---|---|---|---|
| **Migration Lead** | Sources | Connect, Discover, Assess, Plan, Resolve, Dry run, Migrate, Verify, Cutover, Report | Estate verified and certificate exported |
| **Repo Owner** | Notification link | Review repo summary, confirm mappings, see cutover time, get guide | Team is live on GitHub |
| **Compliance** | Findings view | Review secrets, approve remediation, download certificates | Evidence archived |
| **Developer** | Guide link | Copy three commands, push | Working in the new repo |
| **Failure recovery** | Feed alert | Read the reason, approve fix, see resume | Repo verified |

---

## 4. Screen Specifications

### 4.1 Sources
**Goal:** connect and validate. Cards per source type (SVN, TFS, Local Git, GitHub, Target org).
**Content:** status, scope summary ("Can read 38 repos, 2 need access"), fix hints.
**States:** empty, connecting, connected, partial, failed (plain reason).

### 4.2 Estate Overview
**Goal:** see everything at a glance.
**Content:** totals, source breakdown, risk heatmap, archive suggestions, pending approvals, AI cost chip.
**Primary action:** Generate plan.

```
+--------------------------------------------------------------+
| Provenance   [Demo mode]      Approvals 2 | Queue 7 | AI $0.31 |
+--------------------------------------------------------------+
| 142 repos   SVN 61 | TFS 28 | Local 19 | GitHub 34              |
|                                                              |
| Risk   [ 90 Low ][ 38 Medium ][ 14 High ]   14 suggested     |
|                                       for archive            |
|                                                              |
| Decisions   96% by rules | 31 AI calls | 3 human              |
|                                                              |
| [ Generate migration plan ]                                  |
+--------------------------------------------------------------+
```

### 4.3 Repo Catalog and Repo Detail
**Catalog:** table with filters (source, risk, owner, activity). Row shows risk chip, state and size.
**Detail tabs:**
- **Summary:** stats and state.
- **Risk:** reasons as sentences, each with severity.
- **Mappings:** authors, branches and tags (with confidence).
- **Plan:** what will happen, what will be altered.
- **Timeline:** every agent action with tier and reason.
- **Proof:** appears after verification.

### 4.4 Plan and Waves
**Goal:** review and approve.
**Content:** proposed waves (draggable cards), per-wave risk and effort, dependencies.
**Approval card:** "Approve plan" shows what will happen and what will not. Buttons: Approve, Adjust, Hold.

### 4.5 Review Queue
**Goal:** the only place a human must work. Kept short by design.
**Item types:** ambiguous author, secret finding, odd layout, failed fix, budget exhausted.
**Item card:** question, agent suggestion, confidence, tier that escalated, one-tap accept or edit.

```
+--------------------------------------------------------------+
| Ambiguous author       repo: billing-svc                     |
| 'jsmith' could be:                                           |
|   (o) John Smith <john.smith@corp.com>        confidence 82% |
|   ( ) Jane Smith <jane.smith@corp.com>        confidence 61% |
| Escalated: rules could not decide; AI suggested option 1.    |
| [ Accept ]  [ Choose other ]  [ Skip, use fallback ]         |
+--------------------------------------------------------------+
```

### 4.6 Control Room (live migration)
**Goal:** watch the agents.
**Layout:** left, repo rows with stage pipeline and progress; right, activity feed.
**Feed entry anatomy:** time, agent, action, reason, tier badge (Rule / AI / Human).

```
Repo               Stage pipeline                       Status
billing-svc        Scan > Map > Migrate > Verify        Healing...
legacy-portal      Scan > Map > Migrate > Verify        Verified 98%

Feed
10:42  Healer  Push rejected: file 214 MB exceeds the limit.        [Rule]
10:42  Healer  Proposing Git LFS for *.bin. Waiting for approval.   [AI]
10:43  You     Approved Git LFS.                                    [Human]
10:44  Migrator Resumed from commit 4,112 of 9,870.                 [Rule]
```

### 4.7 Proof and Before/After (signature screen)
**Goal:** show nothing was lost.
**Layout:** two columns, Source vs GitHub; rows for commits, branches, tags, authors, linked issues, content checksum. Each row shows match, converted or note. Fidelity ring on top.
**Gaps:** listed with explanation ("3 empty folders cannot be tracked in Git. Annotated.").
**Actions:** Download certificate, Export report.

```
            SOURCE            GITHUB             RESULT
Commits     9,870             9,870              Match
Branches    14                14                 Match
Tags        42                42                 Match
Authors     43                41 + 2 fallback    Converted
Issues      318               318                Match
Content     checksum ok       checksum ok        Match
                   Fidelity 98%  [ Download certificate ]
```

### 4.8 Reports
Executive summary (progress, risk burn-down, waves), audit log (filterable), AI cost (share by tier, calls, estimate).

### 4.9 Assistant Panel (P1)
Docked chat. Supports "Why is this High risk?" and "Migrate the Payments team's repos, pilot first." Every action it takes still goes through approval gates.

### 4.10 Developer Guide (generated)
Short page or markdown: new URL, three commands to re-point, what changed, who to contact.

---

## 5. Component Inventory

| Component | Use |
|---|---|
| RiskChip | Low / Medium / High with reason tooltip |
| TierBadge | Rule / AI / Human with color and icon (not color alone) |
| StagePipeline | Scan > Map > Migrate > Verify with status |
| ApprovalCard | Approve / Adjust / Hold with consequences |
| DecisionCard | Review queue item |
| FidelityRing | Percent with gap count |
| FeedItem | Time, agent, action, reason, tier |
| CompareTable | Before/after rows |
| CostChip | AI calls and estimated cost |
| EmptyState | Guides the next action |
| Toast and InlineAlert | Errors in plain language |

---

## 6. State Design

Every screen defines: **empty, loading, partial, error, success.**

| State | Treatment |
|---|---|
| Empty | One sentence plus primary action ("Connect your first source") |
| Loading | Skeleton rows; long tasks show the agent's current step |
| Partial | Inline notice listing what is missing and why |
| Error | Plain reason, fix, retry; never a stack trace |
| Success | Concrete numbers, not generic banners |
| LLM unavailable | Banner: "AI assistance unavailable. Rules continue. N items waiting for you." |

---

## 7. Visual Design Tokens

**Colors**

| Token | Use | Value |
|---|---|---|
| `--bg` | Base | `#0F1419` (dark) / `#FFFFFF` (light) |
| `--surface` | Cards | `#171D25` / `#F6F8FA` |
| `--text` | Primary text | `#E6EDF3` / `#1F2328` |
| `--accent` | Agent activity and primary action | `#7C5CFF` |
| `--ok` | Verified, low risk | `#2EA043` |
| `--warn` | Medium risk, attention | `#D29922` |
| `--danger` | High risk, failure | `#F85149` |
| `--rule` | Tier: rule | `#3FB950` |
| `--ai` | Tier: AI | `#7C5CFF` |
| `--human` | Tier: human | `#58A6FF` |

**Typography:** Inter (UI), JetBrains Mono (commit hashes, commands). Scale 12, 14, 16, 20, 28.
**Spacing:** 4 px base grid. **Radius:** 8 px cards.
**Motion:** subtle (150 to 200 ms); progress animates; no decorative motion.
**Theme:** dark first (looks strong on a projector), light supported.

---

## 8. Accessibility

- Keyboard reachable approvals and queue actions.
- Never color alone: status uses icon plus text.
- Contrast at least WCAG AA for text.
- Live regions announce feed updates politely.

---

## 9. Content Design Samples

| Moment | Copy |
|---|---|
| Discovery done | "Found 142 repos across 4 sources. 14 look inactive." |
| Risk reason | "High: 4.2 GB history, 3 files over 100 MB, 17 authors not found in your directory." |
| Author queue | "I matched 41 of 43 authors. 2 need you." |
| Healing | "Push rejected: file exceeds GitHub's limit. I propose Git LFS. Approve?" |
| Verified | "Verified. 9,870 of 9,870 commits, 14 of 14 branches, 42 of 42 tags." |
| Gap | "3 empty folders cannot be stored in Git. Annotated in the certificate." |
| LLM down | "AI assistance is unavailable. Rule-based steps continue." |

---

## 10. Demo Mode Design

- A visible "Demo mode" label and seeded sample estate, so judges know it is controlled.
- A "Replay" control that reruns the seeded failure so the healing moment is reliable.
- Simulated sources labeled "Simulated" (for example TFS), never disguised.
- Presenter-friendly: large text, dark theme, no tiny controls.

---

## 11. Design Acceptance Checklist

- [ ] All 10 screens have empty, loading, error and success states.
- [ ] Every agent action in the UI shows reason and tier.
- [ ] Approval cards state consequences clearly.
- [ ] Before/after screen renders from real verification data.
- [ ] Gaps are visible and explained.
- [ ] No secret values appear anywhere.
- [ ] Keyboard-only run through the main journey works.
- [ ] Readable on a projector at 1280 px.



PROVENANCE — UX / UI Design Document
Status: FROZEN · Version: 1.0 · Owner: [PO NAME]Aesthetic: MISSION CONTROL — dark, calm, live. Judges must SEE agents think.

1. Design Principles
Agents must be visible — every decision surfaces as feed entry with a one-line "why"
Risk is color, not prose — green/amber/red instantly readable
Human effort is one click — approval cards, never forms
Proof is the hero — fidelity ring and certificate get the biggest pixels
No jargon walls — plain language everywhere a human reads
2. Information Architecture
Connect ──► Catalog ──► Risk Heatmap ──► Plan & Mappings ──►
Approval Queue ──► Live Migration ──► Before/After ──► Certificate
└────────── persistent: Stage Tracker (top) + Agent Feed (right) ──────────┘

text


## 3. Screen Specs

### S1 · Connect
Purpose: add sources, feel the system validate you.
Elements: 4 source cards (SVN / TFS sample / Local Git / GitHub) with
status dot (● green connected / ○ pending). Inline credential errors.
Empty state: "Connect your first source" + the four ghost cards.

### S2 · Catalog (Discover)
Purpose: the estate materializing live.
Elements: table — name, source badge, size, commits, branches, tags,
contributors, last activity, large-file ⚠. Rows stream in as Scout works
(feed pulses on the right). Summary bar: "142 repos · 4 systems".

### S3 · Risk Heatmap (Assess) ★
┌────────────────────────────────────────────────────┐
│ PORTFOLIO 142 repos: 90 easy · 38 attention · │
│ 14 archive-candidates │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│ │ ███ LOW│ │ ██ MED │ │ █ HIGH │ │ ░ ARCH │ grid │
│ │ 90 │ │ 38 │ │ 14 │ │ 14 │ │
│ └────────┘ └────────┘ └────────┘ └────────┘ │
│ ── repo detail drawer ────────────────────────────│
│ payments-svn ● HIGH │
│ ▸ 2 binaries >100MB (largest: 410MB) │
│ ▸ 37 authors unmapped │
│ ▸ 1 possible secret at r4821 (redacted) │
└────────────────────────────────────────────────────┘

text

Rule: ≤ 3 factors, each cites evidence (NFR-06).

### S4 · Plan & Mappings
Purpose: show the translation the agent will perform.
Left: structure map (trunk→main, branches list, tags→releases).
Right: author mapping table — auto-resolved rows collapsed ("450 auto ✓"),
expanded only the ~5 ambiguous cards with confidence % + evidence + [Confirm]/[Edit].

### S5 · Approval Queue (HITL)
Purpose: the ONLY human actions in the whole demo.
Stack of cards: secret acknowledgement, author confirmations, plan
approve, cutover. Each card: what / why it needs you / one-click action.
Empty state: "Nothing needs you. The agents are working."

### S6 · Live Migration ★
Purpose: agents visibly working; self-heal on camera.
┌───────────────────────────────────────────────────┐
│ payments-svn ████████░░ 74% [PAUSE] │
├───────────────────────────────────────────────────┤
│ ▸ Executor fetching r4821/r5210 T0 │
│ ▸ Executor mapping 37 authors… 34 auto T0 │
│ ▸ Executor PUSH REJECTED: file 410MB ⚠ │
│ ▸ Executor diagnosis: exceeds GH limit T0 │
│ ▸ Executor fix: converting → Git LFS T0 │
│ ▸ Executor retrying push… ✓ │
│ ▸ Prover queued — │
└───────────────────────────────────────────────────┘

text

Feed entries: agent · action · why · tier badge. The injected failure is
DESIGNED to happen here (demo beat 2:15).

### S7 · Before/After ★ (signature screen)
Split view: legacy left, GitHub right. Matched rows highlight in sync:
commits (blame shows REAL authors), branches, tags, migrated issue
cross-linked from a commit. This is the "we kept what others lose" shot.

### S8 · Fidelity Report + Certificate ★
Fidelity ring animating to 100%. Metric cards: commit parity 5,210/5,210 ·
tag checksums 12/12 ✓ · branch parity 18/18 ✓ · author coverage 98.4%.
Below: Migration Certificate (repo, date, hash, verdict: **NOTHING LOST**)
+ [Download].

## 4. Design System

**Palette (GitHub-dark adjacent)**
| Token | Value | Use |
|---|---|---|
| bg/base | #0D1117 | app background |
| bg/surface | #161B22 | cards |
| border | #30363D | hairlines |
| text/primary | #E6EDF3 | |
| text/muted | #8B949E | secondary |
| risk/low | #3FB950 | green |
| risk/med | #D29922 | amber |
| risk/high | #F85149 | red |
| accent | #58A6FF | actions, links, agent marks |
| ok/verify | #2EA043 | fidelity |

**Type:** Inter/system-ui. Scale: 20/16/14/12. Monospace (ui-mono) for
commit hashes, commands, feed timestamps.

**Core components**
- `StageTracker` — persistent 5-dot pipeline (Discover→Prove), active dot pulses
- `RiskPill` — colored tier chip
- `FidelityRing` — SVG ring, animated fill, % center
- `AgentFeedEntry` — agent icon · action · why · tier badge · ts (mono)
- `ApprovalCard` — finding + reason + 1-click CTA; slides away on approve
- `SourceBadge` — SVN/TFS/Git/GH glyph chips
- `CommandSnippet` — mono block with copy button (Monday-morning instructions)

## 5. States Policy
Every screen defines: empty (what to connect/do next), loading (skeleton +
feed pulse — never a frozen spinner), error (inline, plain language, retry
button). No dead ends anywhere.

## 6. Demo Choreography (screen ↔ script)

| Beat | Time | Screen | The moment |
|---|---|---|---|
| Hook | 0:00 | S1 | "200 repos. 4 systems. 14 years." |
| Discover | 0:30 | S2 | catalog streaming in |
| Assess | 1:00 | S3 | secret + 410MB + unmapped authors called out |
| Approve | 1:45 | S5 | three one-click cards — only human actions |
| Migrate | 2:15 | S6 | failure → LFS → retry ✓ (memorable beat) |
| Before/After | 3:15 | S7 | blame with real authors; linked issue |
| Prove | 4:00 | S8 | ring hits 100% · certificate · "NOTHING LOST" |
| Close | 4:45 | — | pitch line |

## 7. Accessibility quick rules
Risk never encoded by color alone (icon + label). Contrast ≥ 4.5:1 on all
text. All actions keyboard-reachable. Focus ring always visible.
