# Temporal Long-Term Memory & Dynamic World State Protocol

## 1. Provenance & Temporal Indexing (Constitution Article 52 & 53)
Every canonical event recorded by the Engine contains:
- `recordId`: Cryptographic identifier (`rec-xxx`)
- `recordType`: `NPC_REGISTERED`, `NPC_STATE_CHANGED`, `OFFSCREEN_WORLD_EVENT`, `NARRATIVE_SEED_CREATED`, `DC_RECORDED`, etc.
- `turn`: Turn sequence integer
- `narrativeDate`: Current in-world calendar year/season/month
- `createdAt`: ISO 8601 wall-clock timestamp
- `informationAccess`: `PUBLIC`, `FACTION`, `PRIVATE`, `PROTAGONIST_KNOWN`, `UNKNOWN`
- `status`: `CANONICAL`

## 2. Anti-Retcon & Memory Mutation Rules
- Past historical records are never mutated or silently overwritten.
- When an entity changes state (e.g. an NPC is wounded or dies), a new transition record is appended.
- If a contradiction is detected, the Engine Firewall catches and sanitizes the proposal before commit.

## 3. Deferred Off-Screen World Materialization
The world must not be simulated turn-by-turn solely to preserve the illusion of continuity. Unobserved time may remain deferred until historical detail becomes causally necessary.

### 3.1 Separation of Spatial Discovery, World State, and Narrative Materialization
The following concerns are explicitly independent:

- **Spatial Discovery**: The player reveals or enters a map/region. Discovery alone does not require an LLM call or historical generation.
- **Materialized World State**: Canonical State and Historical Records already contain authoritative facts. Reading or revealing an existing fact does not require an LLM call.
- **Deferred Historical State**: A time interval whose detailed off-screen consequences have not yet been materialized. It may remain deferred until a causal or narrative need arises.
- **Narrative Generation**: LLM generation is invoked only when deferred history must be materialized or interpreted for a meaningful narrative purpose.

Therefore:
`Spatial Discovery ≠ Historical Materialization ≠ Narrative Generation`

### 3.2 Wake Necessity Gate
Time passage alone MUST NOT trigger LLM generation.

The Engine first determines whether an off-screen interval actually requires materialization. If the existing Canonical State, WorldPack, History, and known information are sufficient, the interval remains deferred and no LLM call is made.

Conceptual flow:

```text
TIME ADVANCES
    ↓
OFF-SCREEN INTERVAL EXISTS
    ↓
WAKE NECESSITY CHECK
    ├── NOT NEEDED → no LLM call
    └── NEEDED
          ↓
      WAKE AGGREGATION
          ↓
      bounded causal context
          ↓
      LLM generation
```

### 3.3 Region/ Causal-Cluster Aggregation
Wake generation MUST NOT be coupled one-to-one with map tiles, NPC discovery, or individual anchors.

When materialization is required, related entities and events should be aggregated into the smallest useful **region or causal cluster** so that one generation can explain multiple connected changes.

Example:

```text
City A re-entered
    ↓
Mira + merchant + guard faction + local event
    ↓
one bounded Wake Context
    ↓
one generation request
    ↓
multiple candidate historical transitions
```

The objective is to prevent:

```text
map discovery → LLM
NPC discovery → LLM
item discovery → LLM
```

from becoming the runtime architecture.

### 3.4 Materialization Cursor / Re-generation Prevention
Each deferred region or causal cluster should conceptually maintain a materialization boundary indicating the latest interval already resolved into authoritative history.

Once an interval has been materialized and committed, later observation of the same interval MUST reuse Canonical State/History rather than regenerate it.

```text
T100 ─────────────── T600
      deferred

Wake at T600
      ↓
materialize T100→T600
      ↓
Canonical History
      ↓
materializedThrough = T600
```

A later map visit at T601 does not imply regeneration of T100→T600.

### 3.5 Causal Skeleton First
When a deferred interval requires generation, the LLM should generate the minimum causal skeleton necessary to explain the resulting state rather than narrating every unseen turn.

The intended resolution pipeline is:

```text
Deferred Interval
    ↓
Causal Skeleton
    ↓
Regional History (when needed)
    ↓
Detailed Scene/NPC Narrative (when directly relevant)
```

Higher narrative resolution must not require regeneration of already committed lower-resolution history.

### 3.6 LLM / Engine Boundary
The LLM proposes possible off-screen developments; it does not establish their truth.

```text
Offscreen Context
    ↓
LLM Candidate(s)
    ↓
existing Recovery / PreAuth / Proposal validation
    ↓
existing Sovereign Commit Gate
    ↓
Canonical State + Historical Record
```

The existing Canonical Commit path remains the sole authority for turning a generated wake into world reality. No separate Plausibility Authority or parallel World Simulation Authority is introduced by this protocol.

### 3.7 Cost and Integrity Principles
- API efficiency MUST NOT be achieved by weakening causal or canonical validation.
- Map exploration volume MUST NOT directly determine LLM call volume.
- Turn count MUST NOT directly determine LLM wake call volume.
- Repeated observation of already-materialized history MUST NOT regenerate that history.
- A single wake should cover multiple causally connected anchors when possible.
- If no meaningful historical consequence is required, no LLM call should occur.

### 3.8 Deferred World Is Not Non-Existent World
A deferred interval represents **unmaterialized detail**, not permission for arbitrary retroactive invention.

Any later materialization remains constrained by the last authoritative state, immutable History, elapsed narrative time, identity continuity, information boundaries, and applicable World Rules.

The Engine must never use deferred status as an excuse to overwrite or contradict previously committed history.

### 3.9 Dynamic Narrative Role / Anchor Status
An entity's narrative role is NOT an immutable property of the entity.

The Engine MUST NOT permanently classify an entity as `MAIN`, `SUPPORTING`, `COMIC_RELIEF`, `COMPANION`, `ENEMY`, or another narrative role solely because that role was assigned at creation or during an earlier part of the story.

Narrative role is a **temporal and relational property derived from Canonical History and the current world context**.

The relevant evidence may include, where supported by authoritative history:

- causal importance to major events or state transitions;
- persistent relationship with the player, including companion, ally, rival, enemy, mentor, dependent, or comparable relationships;
- repeated meaningful interaction with the player or other established anchors;
- persistence of a relationship across distinct historical points rather than mere repeated co-presence;
- unresolved goals, promises, conflicts, dependencies, or other continuing narrative consequences;
- persistent connection to important entities, regions, factions, events, or narrative seeds.

Simple encounter count, co-presence, or historical fame MUST NOT by itself determine narrative rank.

An entity with low historical importance may nevertheless qualify as a persistent player-facing Anchor when its relationship and relevance to the player's lived history are durable. This includes recurring "seasoning" or "comic-relief" figures whose historical impact is small but whose continued relationship makes them relevant to future Wake Scope.

Conversely, an entity that was once a major figure may later cease to be a current major Anchor when its causal and relational relevance no longer supports that status. This does not erase its historical importance; it changes only its **current derived role**.

Conceptually:

```text
Immutable Entity Identity
        ↓
Canonical History + Current Context
        ↓
Causal Evidence
Relationship Evidence
Narrative Dependency
Regional / Factional Connections
        ↓
Current Anchor / Narrative Role
        ↓
Wake Scope
```

Therefore, `MAIN`, `SUPPORTING`, persistent player-facing roles, and contextual status are to be treated as **derived classifications**, not as immutable identity facts. The same entity may move between these roles over time while preserving one continuous identity and immutable historical lineage.

This principle exists to ensure that Wake Scope follows the player's lived world rather than a pre-authored cast hierarchy: **characters do not permanently possess narrative rank; narrative rank emerges and changes through history.**

## 3.10 Causal Authority & Narrative Anchor — Future Implementation Design

The Runtime requires a distinct **Causal Authority** layer so that historical existence and present causal authority are never conflated.

### 3.10.1 Core principle
A historical record proves that something occurred. It does **not** by itself prove that the record may currently be used as the cause of a new Canonical State mutation.

Therefore:

```text
Historical Truth
    ≠
Current Causal Authority
```

The Causal Authority layer answers one specific question:

> Can this candidate cause legitimately justify this requested world-state transition under the authoritative facts and relationships currently available to the Engine?

Causal authority is not determined by elapsed time or `stateVersion` alone. Old causes may remain valid when their causal dependency remains intact.

### 3.10.2 Causal jurisdiction
Causal judgment is deliberately split by the authority boundary between source and effect:

| Source → Effect | Final handling |
|---|---|
| Canon → Canon | Engine makes final `ALLOW` / `DENY` judgment. |
| Novel → Canon | Novel is a cause candidate; Engine makes final `ALLOW` / `DENY` judgment before Canonical mutation. |
| Novel → Novel | Recovery Gate checks causal consistency, but does not issue a world-state `DENY`. Unsupported or conflicting narrative causality becomes `RECONCILIATION_REQUIRED`. |

This preserves the constitutional rule that the Engine must not continuously police ordinary narrative causality. Engine intervention becomes mandatory only when a causal claim is being used to authorize a Canonical State mutation.

### 3.10.3 Causal Candidate → Causal Authority
Novel History may contain useful causal candidates, but an LLM-generated claim must never self-authorize itself.

Conceptual flow:

```text
Novel / Canonical Record
        ↓
Causal Candidate
        ↓
Causal Authority Resolver
        ↓
ALLOW / DENY / UNPROVEN
        ↓
Engine-issued Causal Witness (only when authorized)
        ↓
Canonical mutation validation
```

The Engine should issue a bounded **Causal Witness** only after deterministic checks establish that the relevant cause can support the requested effect. A Causal Witness is not a general truth certificate; it authorizes only the specific causal relationship/effect scope that was judged.

The witness should conceptually bind at least:

- cause record / claim identifier;
- causal relation type;
- subject and target;
- relevant object/item/state transition;
- dependency conditions where applicable;
- issuance context/version;
- current authority status;
- immutable provenance back to the underlying evidence.

### 3.10.4 No arbitrary expiration
Causal authority MUST NOT be invalidated merely because:

- a certain number of turns elapsed;
- the narrative year changed;
- the `stateVersion` increased.

Instead, authority is evaluated against actual causal dependencies and explicit invalidation conditions. For example, an NPC becoming unavailable only invalidates a causal promise when the specific causal contract actually depends on that NPC remaining available; blanket rules such as `NPC death = all prior promises invalid` are forbidden.

Historical records remain immutable even when their causal authority changes.

### 3.10.5 Novel → Novel reconciliation
Novel-to-Novel causality is a narrative concern, not a Canonical State verdict.

When the Gate cannot establish a coherent causal connection, it should preserve the records and return:

```text
RECONCILIATION_REQUIRED
```

The LLM may then repair or enrich the narrative explanation. It must not be instructed to delete, rewrite, or silently retcon the historical record.

A repaired explanation re-enters the normal Candidate → Recovery Gate → validation path.

### 3.10.6 UNPROVEN as a first-class epistemic state
`UNPROVEN` is distinct from `DENY`.

- `DENY`: the Engine has sufficient authoritative basis to refuse the requested causal authority for a Canonical mutation.
- `UNPROVEN`: the relevant causal relationship has not been established strongly enough to receive authority.
- `RECONCILIATION_REQUIRED`: a Novel-to-Novel narrative connection requires narrative repair rather than world-state rejection.

This distinction is especially important for Novel History because unresolved causality should remain usable as narrative material without being accidentally promoted into fact.

### 3.10.7 Narrative Anchor / Attention Hint
An unresolved causal claim may produce a **Narrative Anchor**. This is not a Canonical fact and does not itself grant authority. Its purpose is to prevent later narrative generation from silently treating an unresolved relationship as established fact.

Anchor states may conceptually include:

- `UNPROVEN`: important relationship/causality has insufficient support;
- `CONTRADICTED`: current authoritative material conflicts with the claim;
- `DEPENDENCY`: later narrative use depends on a known condition;
- `RECONCILIATION_REQUIRED`: Novel-to-Novel connection needs narrative repair;
- `RESOLVED`: the issue has been subsequently supported, reconciled, or otherwise closed.

Anchors are **attention constraints, not story instructions**. The LLM should not be told to resolve every Anchor or force it into the next scene. It should only be warned when the current scene is materially related to an unresolved Anchor.

### 3.10.8 Two-tier Anchor delivery for narrative quality and latency
To avoid making the LLM perform a second job while it is writing the actual scene, Anchor storage and relevance filtering remain Engine-side.

```text
All Narrative Anchors
        ↓
Engine-side relevance filter
        ↓
0~few relevant Anchors
        ↓
short Narrative Hint
        ↓
LLM narrative generation
```

The Engine should not inject the entire Anchor store into every prompt. Most turns should receive no Anchor at all. When a relevant Anchor exists, the runtime should project a compact hint rather than a long explanation.

Example:

```text
[ACTIVE NARRATIVE ANCHOR]
삼화상인 ↔ 은화단 전달 관계
Status: UNPROVEN
Do not treat the transfer as established fact unless supported by additional narrative evidence.
```

The Anchor is therefore a **safety rail**, not an additional task list. This is intended to protect long-term narrative coherence while minimizing token overhead, attention competition, and response latency.

### 3.10.9 Anchor resolution without retcon
An Anchor should evolve through new evidence rather than deletion of the old record:

```text
UNPROVEN
   ↓
new narrative evidence
   ↓
Recovery / Causal evaluation
   ├── supported → RESOLVED / Causal Witness when applicable
   ├── still insufficient → UNPROVEN
   └── contradicted → CONTRADICTED
```

The original Novel record remains part of immutable narrative history. Resolution changes the status of the unresolved relationship, not the historical existence of the prior claim.

### 3.10.10 Implementation order
This is a future design item, not an immediate code change. Before implementation, the following must be specified and tested:

1. Causal Constitution and formal definition of causal authority.
2. Causal relation taxonomy (e.g. transfer, promise, exchange, discovery, consequence, dependency) without allowing the LLM to self-certify the relation.
3. Causal Witness schema and scope boundaries.
4. Deterministic authority-issuance rules from trusted Canonical/Novel evidence.
5. Dependency and invalidation rules.
6. Jurisdiction matrix for Canon→Canon, Novel→Canon, and Novel→Novel.
7. Golden Cases covering normal, ambiguous, stale, contradictory, and adversarial causality.
8. Runtime/token-cost tests proving that Anchor filtering does not materially degrade narrative quality or response latency.
9. Re-attack of the historical R1-U provenance/causal-authority path after implementation.

Until these contracts are locked and independently tested, existing Causal Authority code must not be treated as the final implementation of this design.
