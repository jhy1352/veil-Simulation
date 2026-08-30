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
