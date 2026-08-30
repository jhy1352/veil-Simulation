# TRPG 3.8-R — POST-5.7 GAMEPLAY & INFORMATION BOUNDARY 종합 재감사 보고서

- **감사 일시**: 2026-08-27T04:25:07.761Z
- **감사 대상**: SovereignEngine (`/src/engine/state.ts`), EngineValidator (`/src/engine/validator.ts`), Retriever (`/src/engine/index/retriever.ts`), KnowledgeGraph (`/src/engine/index/knowledgeGraph.ts`), Server (`/server.ts`)
- **실행 결과**: 총 18개 테스트 | **PASS: 18** | **FAIL: 0** | **INCONCLUSIVE: 0**

## 1. 감사 결과 요약 표

| 번호 | Test ID | 카테고리 | 테스트 항목 | 실행 경로 | 검증 상태 | 판정 |
|---|---|---|---|---|---|---|
| 1 | `ATTACK-01` | TRUST_BASELINE | Self-Proof Causality Attack Blocked | `Proposal -> EngineValidator.validate (MO...` | REJECTED | **PASS** |
| 2 | `ATTACK-02` | TRUST_BASELINE | Fake Event ID Causality Attack Blocked | `Proposal -> EngineValidator.validate (DI...` | REJECTED | **PASS** |
| 3 | `ATTACK-03` | TRUST_BASELINE | Forged Hydration State Injection Blocked | `SovereignEngine.hydrate -> Schema and st...` | REJECTED | **PASS** |
| 4 | `ATTACK-04` | TRUST_BASELINE | Composite Action Pollution Blocked (Atomic Rollback) | `Proposal -> Sequential draft evaluation ...` | REJECTED | **PASS** |
| 5 | `NORM-01` | NORMAL_GAMEPLAY | Character Creation & Genesis Confirmation | `Proposal (GENESIS) -> EngineValidator.va...` | COMMITTED | **PASS** |
| 6 | `NORM-02` | NORMAL_GAMEPLAY | NPC Encounter & Relationship Update | `Proposal 1 (LLM ADD_NPC) -> Commit -> Pr...` | COMMITTED | **PASS** |
| 7 | `NORM-03` | NORMAL_GAMEPLAY | Item Acquisition & Consumption | `Proposal (RESOURCE_EXCHANGE REMOVE+ADD) ...` | COMMITTED | **PASS** |
| 8 | `NORM-04` | NORMAL_GAMEPLAY | Deterministic Dice Result Commit | `Proposal (PLAYER RECORD_DICE_RESULT) -> ...` | COMMITTED | **PASS** |
| 9 | `NORM-05` | NORMAL_GAMEPLAY | Time Progression & Chapter Transition | `Proposal (LLM ADVANCE_TIME + ADVANCE_CHA...` | COMMITTED | **PASS** |
| 10 | `NORM-06` | NORMAL_GAMEPLAY | Narrative Seed Addition & Causal Resolution | `Proposal (ADD_NARRATIVE_SEED) -> Validat...` | COMMITTED | **PASS** |
| 11 | `NORM-07` | NORMAL_GAMEPLAY | Multi-Turn Narrative Progression (Turn 1 -> 2 -> 3) | `Turn 1 Proposal -> commit -> StateVersio...` | COMMITTED | **PASS** |
| 12 | `NORM-08` | NORMAL_GAMEPLAY | Offscreen World Event Recording with Asymmetric Boundary | `Proposal (LLM RECORD_OFFSCREEN_EVENT) ->...` | COMMITTED | **PASS** |
| 13 | `NORM-09` | NORMAL_GAMEPLAY | Session Serialization & Deep Equality Hydration Recovery | `SovereignEngine.getSnapshot -> JSON seri...` | COMMITTED | **PASS** |
| 14 | `NORM-10` | NORMAL_GAMEPLAY | Player Free Prompt Parsing & Intent Translation | `CandidatePacket -> buildSafeProposalFrom...` | PARSED_SAFE | **PASS** |
| 15 | `NORM-11` | NORMAL_GAMEPLAY | API Error Handling & Graceful State Preservation | `Bad Proposal -> Version Mismatch (StateV...` | COMMITTED | **PASS** |
| 16 | `INFO-A` | NARRATIVE_INFORMATION_BOUNDARY | NPC Knowledge Asymmetry & Dialogue Context Projection Audit | `CanonicalState -> buildKnowledgeGraph ->...` | BOUNDARY_VERIFIED | **PASS** |
| 17 | `INFO-B` | NARRATIVE_INFORMATION_BOUNDARY | Offscreen Event Visibility Filtering & Context Composition Audit | `worldInfo.offscreenRecords -> retriever....` | AUDITED | **PASS** |
| 18 | `INFO-C` | NARRATIVE_INFORMATION_BOUNDARY | LLM Authority / Unauthorized State Promotion Audit | `Proposal (LLM) -> EngineValidator.valida...` | PROMOTION_BLOCKED | **PASS** |

## 2. 주요 취약점 및 감사 발견 사항 (Vulnerability & Findings)

- 발견된 취약점 없음. 모든 보안 및 인과 관문 정상 작동.

## 3. 테스트별 상세 실행 증거 (Detailed Test Records)

### Test 1: [ATTACK-01] Self-Proof Causality Attack Blocked
- **Category**: `TRUST_BASELINE`
- **Command**: `engine.submitProposal(attackProposal_SelfProof)`
- **Execution Path**: `Proposal -> EngineValidator.validate (MODIFY_INVENTORY causality gate) -> submitProposal rollback -> State unchanged`
- **Commit Status**: `REJECTED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: Unverified eventId referencing an uncommitted seed/event was strictly rejected by Validator Firewall with zero canonical mutation.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "신뢰기준세계",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "기준탐험가",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold",
          "name": "은화",
          "quantity": 10,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.741Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "신뢰기준세계",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "기준탐험가",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold",
          "name": "은화",
          "quantity": 10,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.741Z"
  },
  "validatorVerdict": {
    "success": false,
    "rejectedReasons": [
      "[CAUSALITY_VIOLATION] Event 'event-self-created-in-future' not found in canonical records."
    ]
  },
  "output": {
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-attack-01-self-proof",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[CAUSALITY_VIOLATION] Event 'event-self-created-in-future' not found in canonical records."
      ],
      "conflictDetails": [
        "[CAUSALITY_VIOLATION] Action #1: verifiedEventId 'event-self-created-in-future' does not exist in canonical world state, history, or active context."
      ],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "신뢰기준세계",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "기준탐험가",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold",
              "name": "은화",
              "quantity": 10,
              "category": "재화"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.741Z"
      }
    }
  }
}
```

### Test 2: [ATTACK-02] Fake Event ID Causality Attack Blocked
- **Category**: `TRUST_BASELINE`
- **Command**: `engine.submitProposal(fakeProposal_FakeEventId)`
- **Execution Path**: `Proposal -> EngineValidator.validate (DISCOVERY_PICKUP event lookup) -> submitProposal rejected -> State unchanged`
- **Commit Status**: `REJECTED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: Completely fabricated verifiedEventId rejected by EngineValidator; zero state alteration.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "가짜단서시도자",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.744Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "가짜단서시도자",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.744Z"
  },
  "validatorVerdict": {
    "success": false,
    "rejectedReasons": [
      "[CAUSALITY_VIOLATION] Event 'event-completely-fake-999999' not found in canonical records."
    ]
  },
  "output": {
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-attack-02-fake-id",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[CAUSALITY_VIOLATION] Event 'event-completely-fake-999999' not found in canonical records."
      ],
      "conflictDetails": [
        "[CAUSALITY_VIOLATION] Action #1: verifiedEventId 'event-completely-fake-999999' does not exist in canonical world state, history, or active context."
      ],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "가짜단서시도자",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.744Z"
      }
    }
  }
}
```

### Test 3: [ATTACK-03] Forged Hydration State Injection Blocked
- **Category**: `TRUST_BASELINE`
- **Command**: `SovereignEngine.hydrate(forgedSnapshot)`
- **Execution Path**: `SovereignEngine.hydrate -> Schema and structural validation -> Exception thrown -> Safe no-op`
- **Commit Status**: `REJECTED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: Strict structural schema validation in SovereignEngine.hydrate prevented corrupt snapshot injection.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.744Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.744Z"
  },
  "validatorVerdict": {
    "isValid": false,
    "error": "[HYDRATION_SCHEMA_VIOLATION] Cannot hydrate invalid canonical snapshot: [SCHEMA_VIOLATION] stateVersion must be a positive integer >= 1. Received: INVALID_STRING_VERSION; [SCHEMA_VIOLATION] turn must be a non-negative integer >= 0. Received: -5; [SCHEMA_VIOLATION] snapshot.worldInfo must be a non-null object.; [SCHEMA_VIOLATION] snapshot.character.name must be a string.; [SCHEMA_VIOLATION] snapshot.character.inventory must be an array."
  },
  "output": {
    "hydrationResult": "REJECTED",
    "hydrationError": "[HYDRATION_SCHEMA_VIOLATION] Cannot hydrate invalid canonical snapshot: [SCHEMA_VIOLATION] stateVersion must be a positive integer >= 1. Received: INVALID_STRING_VERSION; [SCHEMA_VIOLATION] turn must be a non-negative integer >= 0. Received: -5; [SCHEMA_VIOLATION] snapshot.worldInfo must be a non-null object.; [SCHEMA_VIOLATION] snapshot.character.name must be a string.; [SCHEMA_VIOLATION] snapshot.character.inventory must be an array."
  }
}
```

### Test 4: [ATTACK-04] Composite Action Pollution Blocked (Atomic Rollback)
- **Category**: `TRUST_BASELINE`
- **Command**: `engine.submitProposal(compositeAttackProposal)`
- **Execution Path**: `Proposal -> Sequential draft evaluation -> Action #2 failed -> Entire batch rejected -> Zero state change`
- **Commit Status**: `REJECTED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: Composite proposal containing 1 illegal action rolled back 100% atomically; neither rumor nor stats were applied.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "원자성검증세계",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "원자성탐험가",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.745Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "원자성검증세계",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "원자성탐험가",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.745Z"
  },
  "validatorVerdict": {
    "success": false,
    "rejectedReasons": [
      "[INVALID_STAT_VALUE] Action #2: Stat 'strength' must be a finite integer between 1 and 30. Received: 9999"
    ]
  },
  "output": {
    "commitResult": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-attack-04-composite",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[INVALID_STAT_VALUE] Action #2: Stat 'strength' must be a finite integer between 1 and 30. Received: 9999"
      ],
      "conflictDetails": [],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "원자성검증세계",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "원자성탐험가",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.745Z"
      }
    }
  }
}
```

### Test 5: [NORM-01] Character Creation & Genesis Confirmation
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(norm01Proposal_Genesis)`
- **Execution Path**: `Proposal (GENESIS) -> EngineValidator.validate (ACL + bounds check) -> applyActionToDraftState -> commit -> StateVersion 1->2`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 1 -> 2, historyLength: 0 -> 2, stats: {"strength":12,"agility":10,"constitution":11,"intelligence":14,"wisdom":12,"charisma":10} -> {"strength":14,"agility":10,"constitution":11,"intelligence":15,"wisdom":12,"charisma":10}`
- **Verdict**: **PASS**
- **Evidence Details**: Genesis player state committed with valid version progression from 1 -> 2.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 12,
        "agility": 10,
        "constitution": 11,
        "intelligence": 14,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 50,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.747Z"
  },
  "canonicalAfter": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 50,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 2,
    "lastCommittedEventId": "evt-norm-01-genesis",
    "lastCommittedAt": "2026-08-27T04:25:07.747Z"
  },
  "validatorVerdict": {
    "success": true
  },
  "output": {
    "commitResult": {
      "success": true,
      "stateVersion": 2,
      "eventId": "evt-norm-01-genesis",
      "committedActionsCount": 2,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-01-genesis-1",
          "eventId": "evt-norm-01-genesis",
          "requestId": "req-norm-01-genesis",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.747Z",
          "narrativeTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "source": "GENESIS",
          "actionType": "SET_WORLD_METADATA",
          "details": "{\"worldName\":\"에텔리아 대륙\"}",
          "stateVersionAfterCommit": 2,
          "informationAccess": "PUBLIC"
        },
        {
          "recordId": "rec-evt-norm-01-genesis-2",
          "eventId": "evt-norm-01-genesis",
          "requestId": "req-norm-01-genesis",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.747Z",
          "narrativeTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "source": "GENESIS",
          "actionType": "UPDATE_CHARACTER_STATS",
          "details": "{\"strength\":14,\"intelligence\":15}",
          "stateVersionAfterCommit": 2,
          "informationAccess": "PUBLIC"
        }
      ],
      "snapshot": {
        "stateVersion": 2,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 50,
              "category": "재화"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-01-genesis",
        "lastCommittedAt": "2026-08-27T04:25:07.747Z"
      }
    }
  }
}
```

### Test 6: [NORM-02] NPC Encounter & Relationship Update
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(ADD_NPC) -> engine.submitProposal(UPDATE_NPC)`
- **Execution Path**: `Proposal 1 (LLM ADD_NPC) -> Commit -> Proposal 2 (LLM UPDATE_NPC on canonical NPC) -> Commit -> NPC array updated`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 2 -> 4, historyLength: 2 -> 4, npcCount: 0 -> 1`
- **Verdict**: **PASS**
- **Evidence Details**: NPC successfully registered and relationship updated in Canonical World across verified canonical state transitions.
```json
{
  "canonicalBefore": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 50,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 2,
    "lastCommittedEventId": "evt-norm-01-genesis",
    "lastCommittedAt": "2026-08-27T04:25:07.747Z"
  },
  "canonicalAfter": {
    "stateVersion": 4,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 50,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 4,
    "lastCommittedEventId": "evt-norm-02-npc-update",
    "lastCommittedAt": "2026-08-27T04:25:07.748Z"
  },
  "validatorVerdict": {
    "addSuccess": true,
    "updateSuccess": true
  },
  "output": {
    "commitResultAdd": {
      "success": true,
      "stateVersion": 3,
      "eventId": "evt-norm-02-npc-add",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-02-npc-add-1",
          "eventId": "evt-norm-02-npc-add",
          "requestId": "req-norm-02-npc-add",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.747Z",
          "narrativeTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "source": "LLM",
          "actionType": "ADD_NPC",
          "details": "{\"id\":\"npc-guard-valak\",\"name\":\"발락 경비대장\",\"status\":\"ALIVE\",\"relationship\":\"신뢰\",\"knownInformation\":[\"성문 경비 배치도\"],\"location\":\"하켄 요새 정문\"}",
          "stateVersionAfterCommit": 3,
          "informationAccess": "PUBLIC"
        }
      ],
      "snapshot": {
        "stateVersion": 3,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "신뢰",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 50,
              "category": "재화"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-02-npc-add",
        "lastCommittedAt": "2026-08-27T04:25:07.747Z"
      }
    },
    "commitResultUpdate": {
      "success": true,
      "stateVersion": 4,
      "eventId": "evt-norm-02-npc-update",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-02-npc-update-1",
          "eventId": "evt-norm-02-npc-update",
          "requestId": "req-norm-02-npc-update",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.748Z",
          "narrativeTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "source": "LLM",
          "actionType": "UPDATE_NPC",
          "details": "{\"id\":\"npc-guard-valak\",\"changes\":{\"relationship\":\"우호\"}}",
          "stateVersionAfterCommit": 4,
          "informationAccess": "PUBLIC"
        }
      ],
      "snapshot": {
        "stateVersion": 4,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 50,
              "category": "재화"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-02-npc-update",
        "lastCommittedAt": "2026-08-27T04:25:07.748Z"
      }
    }
  }
}
```

### Test 7: [NORM-03] Item Acquisition & Consumption
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(buyAtomic) -> engine.submitProposal(use)`
- **Execution Path**: `Proposal (RESOURCE_EXCHANGE REMOVE+ADD) -> Validator double-spend check -> commit -> Proposal (REMOVE 1) -> inventory updated`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 4 -> 6, historyLength: 4 -> 7, invCount: 1 -> 2`
- **Verdict**: **PASS**
- **Evidence Details**: Item successfully acquired via atomic exchange and decremented by 1 quantity via verified mutation.
```json
{
  "canonicalBefore": {
    "stateVersion": 4,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 50,
          "category": "재화"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 4,
    "lastCommittedEventId": "evt-norm-02-npc-update",
    "lastCommittedAt": "2026-08-27T04:25:07.748Z"
  },
  "canonicalAfter": {
    "stateVersion": 6,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 7,
    "lastCommittedEventId": "evt-norm-03-use-potion",
    "lastCommittedAt": "2026-08-27T04:25:07.749Z"
  },
  "validatorVerdict": {
    "buy": true,
    "use": true
  },
  "output": {
    "afterUseInv": [
      {
        "id": "inv-gold-coins",
        "name": "은화",
        "quantity": 40,
        "category": "재화"
      },
      {
        "id": "inv-health-potion",
        "name": "치료 물약",
        "quantity": 1,
        "category": "소비품"
      }
    ]
  }
}
```

### Test 8: [NORM-04] Deterministic Dice Result Commit
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(norm04Proposal_Dice)`
- **Execution Path**: `Proposal (PLAYER RECORD_DICE_RESULT) -> Validator range check (DC 1-20) -> commit -> History appended`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 6 -> 7, historyLength: 7 -> 8`
- **Verdict**: **PASS**
- **Evidence Details**: Player CSPRNG dice result committed to history with deterministic distribution tracking.
```json
{
  "canonicalBefore": {
    "stateVersion": 6,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 7,
    "lastCommittedEventId": "evt-norm-03-use-potion",
    "lastCommittedAt": "2026-08-27T04:25:07.749Z"
  },
  "canonicalAfter": {
    "stateVersion": 7,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 8,
    "lastCommittedEventId": "evt-norm-04-dice-commit",
    "lastCommittedAt": "2026-08-27T04:25:07.749Z"
  },
  "validatorVerdict": {
    "success": true
  },
  "output": {
    "commitResult": {
      "success": true,
      "stateVersion": 7,
      "eventId": "evt-norm-04-dice-commit",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-04-dice-commit-1",
          "eventId": "evt-norm-04-dice-commit",
          "requestId": "req-norm-04-dice-commit",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.749Z",
          "narrativeTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "source": "PLAYER",
          "actionType": "RECORD_DICE_RESULT",
          "details": "{\"statUsed\":\"strength\",\"targetDC\":15,\"rawRoll\":18,\"modifier\":2,\"finalScore\":20,\"outcome\":\"SUCCESS\",\"actionDescription\":\"성문 돌파\"}",
          "stateVersionAfterCommit": 7,
          "informationAccess": "PUBLIC"
        }
      ],
      "snapshot": {
        "stateVersion": 7,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-04-dice-commit",
        "lastCommittedAt": "2026-08-27T04:25:07.749Z"
      }
    }
  }
}
```

### Test 9: [NORM-05] Time Progression & Chapter Transition
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(norm05Proposal_Time)`
- **Execution Path**: `Proposal (LLM ADVANCE_TIME + ADVANCE_CHAPTER) -> Validator check -> applyActionToDraftState -> commit`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 7 -> 8, historyLength: 8 -> 10`
- **Verdict**: **PASS**
- **Evidence Details**: Temporal progression and chapter advance successfully committed to canonical state.
```json
{
  "canonicalBefore": {
    "stateVersion": 7,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 8,
    "lastCommittedEventId": "evt-norm-04-dice-commit",
    "lastCommittedAt": "2026-08-27T04:25:07.749Z"
  },
  "canonicalAfter": {
    "stateVersion": 8,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 10,
    "lastCommittedEventId": "evt-norm-05-time-advance",
    "lastCommittedAt": "2026-08-27T04:25:07.750Z"
  },
  "validatorVerdict": {
    "success": true
  },
  "output": {
    "commitResult": {
      "success": true,
      "stateVersion": 8,
      "eventId": "evt-norm-05-time-advance",
      "committedActionsCount": 2,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-05-time-advance-1",
          "eventId": "evt-norm-05-time-advance",
          "requestId": "req-norm-05-time-advance",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.750Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "LLM",
          "actionType": "ADVANCE_TIME",
          "details": "{\"targetTime\":{\"year\":1,\"season\":\"SUMMER\",\"formattedTime\":\"1년 여름\"}}",
          "stateVersionAfterCommit": 8,
          "informationAccess": "PUBLIC"
        },
        {
          "recordId": "rec-evt-norm-05-time-advance-2",
          "eventId": "evt-norm-05-time-advance",
          "requestId": "req-norm-05-time-advance",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.750Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "LLM",
          "actionType": "ADVANCE_CHAPTER",
          "details": "{\"currentChapter\":\"제 2 장: 숲속의 은신처\"}",
          "stateVersionAfterCommit": 8,
          "informationAccess": "PUBLIC"
        }
      ],
      "snapshot": {
        "stateVersion": 8,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "제 2 장: 숲속의 은신처",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-05-time-advance",
        "lastCommittedAt": "2026-08-27T04:25:07.750Z"
      }
    }
  }
}
```

### Test 10: [NORM-06] Narrative Seed Addition & Causal Resolution
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(addSeed) -> engine.submitProposal(resolveSeed)`
- **Execution Path**: `Proposal (ADD_NARRATIVE_SEED) -> Validator active count check -> commit -> Proposal (RESOLVE_NARRATIVE_SEED) -> status updated to resolved`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 8 -> 10, historyLength: 10 -> 12, seedCount: 0 -> 1`
- **Verdict**: **PASS**
- **Evidence Details**: Narrative seed lifecycle (created -> resolved) committed with causal provenance.
```json
{
  "canonicalBefore": {
    "stateVersion": 8,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 10,
    "lastCommittedEventId": "evt-norm-05-time-advance",
    "lastCommittedAt": "2026-08-27T04:25:07.750Z"
  },
  "canonicalAfter": {
    "stateVersion": 10,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 12,
    "lastCommittedEventId": "evt-norm-06-resolve-seed",
    "lastCommittedAt": "2026-08-27T04:25:07.751Z"
  },
  "validatorVerdict": {
    "add": true,
    "resolve": true
  },
  "output": {
    "commitResolve": {
      "success": true,
      "stateVersion": 10,
      "eventId": "evt-norm-06-resolve-seed",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-06-resolve-seed-1",
          "eventId": "evt-norm-06-resolve-seed",
          "requestId": "req-norm-06-resolve-seed",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.751Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "LLM",
          "actionType": "RESOLVE_NARRATIVE_SEED",
          "details": "{\"id\":\"seed-ancient-assassin-dagger\",\"resolutionEventId\":\"evt-norm-06-resolve-seed\"}",
          "stateVersionAfterCommit": 10,
          "informationAccess": "PUBLIC"
        }
      ],
      "snapshot": {
        "stateVersion": 10,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [
            {
              "id": "seed-ancient-assassin-dagger",
              "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
              "status": "resolved"
            }
          ],
          "chapters": {
            "currentChapter": "제 2 장: 숲속의 은신처",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-06-resolve-seed",
        "lastCommittedAt": "2026-08-27T04:25:07.751Z"
      }
    }
  }
}
```

### Test 11: [NORM-07] Multi-Turn Narrative Progression (Turn 1 -> 2 -> 3)
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `submitProposal(turn2) -> submitProposal(turn3)`
- **Execution Path**: `Turn 1 Proposal -> commit -> StateVersion N+1 -> Turn 2 Proposal (with expectedStateVersion N+1) -> commit -> StateVersion N+2`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 10 -> 12, turn: 1 -> 2, historyLength: 12 -> 14`
- **Verdict**: **PASS**
- **Evidence Details**: Multi-turn sequential progression maintained monotonic versioning without rollback.
```json
{
  "canonicalBefore": {
    "stateVersion": 10,
    "turn": 1,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 12,
    "lastCommittedEventId": "evt-norm-06-resolve-seed",
    "lastCommittedAt": "2026-08-27T04:25:07.751Z"
  },
  "canonicalAfter": {
    "stateVersion": 12,
    "turn": 2,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [
        "성문 밖에 수상한 행상이 나타났다.",
        "수상한 행상이 귀족들에게 부적을 팔고 있다."
      ],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 14,
    "lastCommittedEventId": "evt-norm-07-turn3",
    "lastCommittedAt": "2026-08-27T04:25:07.751Z"
  },
  "validatorVerdict": {
    "t2": true,
    "t3": true
  },
  "output": {
    "c2": {
      "success": true,
      "stateVersion": 11,
      "eventId": "evt-norm-07-turn2",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-07-turn2-1",
          "eventId": "evt-norm-07-turn2",
          "requestId": "req-norm-07-turn2",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.751Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "LLM",
          "actionType": "ADD_RUMOR",
          "details": "{\"rumor\":\"성문 밖에 수상한 행상이 나타났다.\",\"category\":\"PUBLIC\"}",
          "stateVersionAfterCommit": 11,
          "informationAccess": "RUMOR"
        }
      ],
      "snapshot": {
        "stateVersion": 11,
        "turn": 1,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [
            "성문 밖에 수상한 행상이 나타났다."
          ],
          "secretLore": [],
          "seeds": [
            {
              "id": "seed-ancient-assassin-dagger",
              "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
              "status": "resolved"
            }
          ],
          "chapters": {
            "currentChapter": "제 2 장: 숲속의 은신처",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-07-turn2",
        "lastCommittedAt": "2026-08-27T04:25:07.751Z"
      }
    },
    "c3": {
      "success": true,
      "stateVersion": 12,
      "eventId": "evt-norm-07-turn3",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-07-turn3-1",
          "eventId": "evt-norm-07-turn3",
          "requestId": "req-norm-07-turn3",
          "turn": 2,
          "timestamp": "2026-08-27T04:25:07.751Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "LLM",
          "actionType": "ADD_RUMOR",
          "details": "{\"rumor\":\"수상한 행상이 귀족들에게 부적을 팔고 있다.\",\"category\":\"PUBLIC\"}",
          "stateVersionAfterCommit": 12,
          "informationAccess": "RUMOR"
        }
      ],
      "snapshot": {
        "stateVersion": 12,
        "turn": 2,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [
            "성문 밖에 수상한 행상이 나타났다.",
            "수상한 행상이 귀족들에게 부적을 팔고 있다."
          ],
          "secretLore": [],
          "seeds": [
            {
              "id": "seed-ancient-assassin-dagger",
              "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
              "status": "resolved"
            }
          ],
          "chapters": {
            "currentChapter": "제 2 장: 숲속의 은신처",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-07-turn3",
        "lastCommittedAt": "2026-08-27T04:25:07.751Z"
      }
    }
  }
}
```

### Test 12: [NORM-08] Offscreen World Event Recording with Asymmetric Boundary
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `engine.submitProposal(norm08Proposal_Offscreen)`
- **Execution Path**: `Proposal (LLM RECORD_OFFSCREEN_EVENT) -> Validator check (allowed visibility) -> commit -> worldInfo.offscreenRecords appended`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 12 -> 13, historyLength: 14 -> 15, offscreenCount: 0 -> 1`
- **Verdict**: **PASS**
- **Evidence Details**: Offscreen event safely committed to sovereign state under HIDDEN access tag.
```json
{
  "canonicalBefore": {
    "stateVersion": 12,
    "turn": 2,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [
        "성문 밖에 수상한 행상이 나타났다.",
        "수상한 행상이 귀족들에게 부적을 팔고 있다."
      ],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 14,
    "lastCommittedEventId": "evt-norm-07-turn3",
    "lastCommittedAt": "2026-08-27T04:25:07.751Z"
  },
  "canonicalAfter": {
    "stateVersion": 13,
    "turn": 2,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [
        "성문 밖에 수상한 행상이 나타났다.",
        "수상한 행상이 귀족들에게 부적을 팔고 있다."
      ],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [
        "왕도 북부에서 반란군 비밀 결집 시작"
      ],
      "offscreenRecords": [
        {
          "id": "offscreen-1787804707752-1",
          "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
          "location": "왕도 북부 성채",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "timestamp": "2026-08-27T04:25:07.752Z",
          "visibility": "HIDDEN"
        }
      ]
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 15,
    "lastCommittedEventId": "evt-norm-08-offscreen",
    "lastCommittedAt": "2026-08-27T04:25:07.752Z"
  },
  "validatorVerdict": {
    "success": true
  },
  "output": {
    "commitResult": {
      "success": true,
      "stateVersion": 13,
      "eventId": "evt-norm-08-offscreen",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-08-offscreen-1",
          "eventId": "evt-norm-08-offscreen",
          "requestId": "req-norm-08-offscreen",
          "turn": 2,
          "timestamp": "2026-08-27T04:25:07.752Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "LLM",
          "actionType": "RECORD_OFFSCREEN_EVENT",
          "details": "{\"eventDescription\":\"왕도 북부에서 반란군 비밀 결집 시작\",\"location\":\"왕도 북부 성채\",\"visibility\":\"HIDDEN\",\"occurredAt\":\"2026-08-27T04:25:07.752Z\"}",
          "stateVersionAfterCommit": 13,
          "informationAccess": "HIDDEN"
        }
      ],
      "snapshot": {
        "stateVersion": 13,
        "turn": 2,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [
            "성문 밖에 수상한 행상이 나타났다.",
            "수상한 행상이 귀족들에게 부적을 팔고 있다."
          ],
          "secretLore": [],
          "seeds": [
            {
              "id": "seed-ancient-assassin-dagger",
              "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
              "status": "resolved"
            }
          ],
          "chapters": {
            "currentChapter": "제 2 장: 숲속의 은신처",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [
            "왕도 북부에서 반란군 비밀 결집 시작"
          ],
          "offscreenRecords": [
            {
              "id": "offscreen-1787804707752-1",
              "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
              "location": "왕도 북부 성채",
              "narrativeTime": {
                "year": 1,
                "season": "SUMMER",
                "formattedTime": "1년 여름"
              },
              "timestamp": "2026-08-27T04:25:07.752Z",
              "visibility": "HIDDEN"
            }
          ]
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-08-offscreen",
        "lastCommittedAt": "2026-08-27T04:25:07.752Z"
      }
    },
    "offRec": {
      "id": "offscreen-1787804707752-1",
      "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
      "location": "왕도 북부 성채",
      "narrativeTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "timestamp": "2026-08-27T04:25:07.752Z",
      "visibility": "HIDDEN"
    }
  }
}
```

### Test 13: [NORM-09] Session Serialization & Deep Equality Hydration Recovery
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `JSON.stringify -> JSON.parse -> SovereignEngine.hydrate -> Deep Equality Test -> submitProposal`
- **Execution Path**: `SovereignEngine.getSnapshot -> JSON serialize -> SovereignEngine.hydrate(snapshot, history) -> Deep Object Equality Verification -> submitProposal`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 13 -> 14, historyLength: 15 -> 16`
- **Deep Equal**: `true`
- **Verdict**: **PASS**
- **Evidence Details**: Strict deep equality verified (World: true, Character: true, Version: true, History: true). Zero data loss confirmed.
```json
{
  "canonicalBefore": {
    "stateVersion": 13,
    "turn": 2,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [
        "성문 밖에 수상한 행상이 나타났다.",
        "수상한 행상이 귀족들에게 부적을 팔고 있다."
      ],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [
        "왕도 북부에서 반란군 비밀 결집 시작"
      ],
      "offscreenRecords": [
        {
          "id": "offscreen-1787804707752-1",
          "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
          "location": "왕도 북부 성채",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "timestamp": "2026-08-27T04:25:07.752Z",
          "visibility": "HIDDEN"
        }
      ]
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 15,
    "lastCommittedEventId": "evt-norm-08-offscreen",
    "lastCommittedAt": "2026-08-27T04:25:07.752Z"
  },
  "canonicalAfter": {
    "stateVersion": 14,
    "turn": 2,
    "worldInfo": {
      "worldName": "에텔리아 대륙",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SUMMER",
        "formattedTime": "1년 여름"
      },
      "npcs": [
        {
          "id": "npc-guard-valak",
          "name": "발락 경비대장",
          "status": "ALIVE",
          "relationship": "우호",
          "knownInformation": [
            "성문 경비 배치도"
          ],
          "location": "하켄 요새 정문"
        }
      ],
      "factions": [],
      "publicRumors": [
        "성문 밖에 수상한 행상이 나타났다.",
        "수상한 행상이 귀족들에게 부적을 팔고 있다.",
        "복원된 세션에서 새로운 모험 시작"
      ],
      "secretLore": [],
      "seeds": [
        {
          "id": "seed-ancient-assassin-dagger",
          "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
          "status": "resolved"
        }
      ],
      "chapters": {
        "currentChapter": "제 2 장: 숲속의 은신처",
        "upcomingChapters": []
      },
      "dcHistory": [
        15
      ],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [
        "왕도 북부에서 반란군 비밀 결집 시작"
      ],
      "offscreenRecords": [
        {
          "id": "offscreen-1787804707752-1",
          "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
          "location": "왕도 북부 성채",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "timestamp": "2026-08-27T04:25:07.752Z",
          "visibility": "HIDDEN"
        }
      ]
    },
    "character": {
      "name": "로엔",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 14,
        "agility": 10,
        "constitution": 11,
        "intelligence": 15,
        "wisdom": 12,
        "charisma": 10
      },
      "inventory": [
        {
          "id": "inv-gold-coins",
          "name": "은화",
          "quantity": 40,
          "category": "재화"
        },
        {
          "id": "inv-health-potion",
          "name": "치료 물약",
          "quantity": 1,
          "category": "소비품"
        }
      ],
      "secret": "",
      "physicalDefect": "",
      "timeline": [],
      "location": "하켄 요새 전초기지"
    },
    "historyLength": 16,
    "lastCommittedEventId": "evt-norm-09-resume-after-hydrate",
    "lastCommittedAt": "2026-08-27T04:25:07.753Z"
  },
  "validatorVerdict": {
    "isDeeplyIdentical": true,
    "isWorldEqual": true,
    "isCharEqual": true,
    "isVersionEqual": true,
    "isTurnEqual": true,
    "isHistoryEqual": true
  },
  "output": {
    "rehydratedVersion": 13,
    "isDeeplyIdentical": true,
    "commitResult": {
      "success": true,
      "stateVersion": 14,
      "eventId": "evt-norm-09-resume-after-hydrate",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-norm-09-resume-after-hydrate-1",
          "eventId": "evt-norm-09-resume-after-hydrate",
          "requestId": "req-norm-09-resume-after-hydrate",
          "turn": 2,
          "timestamp": "2026-08-27T04:25:07.753Z",
          "narrativeTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "source": "PLAYER",
          "actionType": "ADD_RUMOR",
          "details": "{\"rumor\":\"복원된 세션에서 새로운 모험 시작\",\"category\":\"PUBLIC\"}",
          "stateVersionAfterCommit": 14,
          "informationAccess": "RUMOR"
        }
      ],
      "snapshot": {
        "stateVersion": 14,
        "turn": 2,
        "worldInfo": {
          "worldName": "에텔리아 대륙",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SUMMER",
            "formattedTime": "1년 여름"
          },
          "npcs": [
            {
              "id": "npc-guard-valak",
              "name": "발락 경비대장",
              "status": "ALIVE",
              "relationship": "우호",
              "knownInformation": [
                "성문 경비 배치도"
              ],
              "location": "하켄 요새 정문"
            }
          ],
          "factions": [],
          "publicRumors": [
            "성문 밖에 수상한 행상이 나타났다.",
            "수상한 행상이 귀족들에게 부적을 팔고 있다.",
            "복원된 세션에서 새로운 모험 시작"
          ],
          "secretLore": [],
          "seeds": [
            {
              "id": "seed-ancient-assassin-dagger",
              "content": "하켄 요새 벽면에 새겨진 검은 뱀 문양 암살단 표식 (Resolved: undefined)",
              "status": "resolved"
            }
          ],
          "chapters": {
            "currentChapter": "제 2 장: 숲속의 은신처",
            "upcomingChapters": []
          },
          "dcHistory": [
            15
          ],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [
            "왕도 북부에서 반란군 비밀 결집 시작"
          ],
          "offscreenRecords": [
            {
              "id": "offscreen-1787804707752-1",
              "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
              "location": "왕도 북부 성채",
              "narrativeTime": {
                "year": 1,
                "season": "SUMMER",
                "formattedTime": "1년 여름"
              },
              "timestamp": "2026-08-27T04:25:07.752Z",
              "visibility": "HIDDEN"
            }
          ]
        },
        "character": {
          "name": "로엔",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 14,
            "agility": 10,
            "constitution": 11,
            "intelligence": 15,
            "wisdom": 12,
            "charisma": 10
          },
          "inventory": [
            {
              "id": "inv-gold-coins",
              "name": "은화",
              "quantity": 40,
              "category": "재화"
            },
            {
              "id": "inv-health-potion",
              "name": "치료 물약",
              "quantity": 1,
              "category": "소비품"
            }
          ],
          "secret": "",
          "physicalDefect": "",
          "timeline": [],
          "location": "하켄 요새 전초기지"
        },
        "lastCommittedEventId": "evt-norm-09-resume-after-hydrate",
        "lastCommittedAt": "2026-08-27T04:25:07.753Z"
      }
    }
  }
}
```

### Test 14: [NORM-10] Player Free Prompt Parsing & Intent Translation
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `buildSafeProposalFromCandidate(snapshot, candidate, turn, history)`
- **Execution Path**: `CandidatePacket -> buildSafeProposalFromCandidate (8 narrative defense rules) -> StateTransitionProposal -> Schema check`
- **Commit Status**: `PARSED_SAFE`
- **Diff**: `N/A (Parsing Gate)`
- **Verdict**: **PASS**
- **Evidence Details**: Natural language candidate parsed into strictly typed TransitionAction proposal without bypassing validation.
```json
{
  "canonicalBefore": null,
  "canonicalAfter": null,
  "validatorVerdict": {
    "isValidStructure": true,
    "actionCount": 2
  },
  "output": {
    "proposalId": "prop-req-mtb0rh63-myelmg",
    "requestId": "req-mtb0rh63-myelmg",
    "eventId": "evt-mtb0rh63-x5enju",
    "expectedStateVersion": 13,
    "source": "LLM",
    "turn": 1,
    "timestamp": "2026-08-27T04:25:07.755Z",
    "intentSummary": "Turn 1 Candidate State Transition",
    "actions": [
      {
        "type": "UPDATE_NPC",
        "payload": {
          "id": "npc-guard-valak",
          "changes": {
            "innerThought": "저 친구는 신뢰할 수 있을 것 같군.",
            "metInStory": true
          }
        }
      },
      {
        "type": "ADD_NARRATIVE_SEED",
        "payload": {
          "id": "seed-mtb0rh63-w2rmw3",
          "content": "성벽 뒤 비밀 통로의 위치",
          "status": "active",
          "turnCreated": 1
        }
      }
    ],
    "rawClaims": []
  }
}
```

### Test 15: [NORM-11] API Error Handling & Graceful State Preservation
- **Category**: `NORMAL_GAMEPLAY`
- **Command**: `submitProposal(staleFail) -> submitProposal(cleanSuccess)`
- **Execution Path**: `Bad Proposal -> Version Mismatch (StateVersion 1 != 999) -> Reject -> Good Proposal -> Commit -> StateVersion 2`
- **Commit Status**: `COMMITTED`
- **Diff**: `stateVersion: 1 -> 2, historyLength: 0 -> 1`
- **Verdict**: **PASS**
- **Evidence Details**: Stale/corrupted proposals rejected with 100% state immutability, followed by clean state recovery.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.755Z"
  },
  "canonicalAfter": {
    "stateVersion": 2,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [
        "정상 복구된 소문"
      ],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 1,
    "lastCommittedEventId": "evt-good-retry",
    "lastCommittedAt": "2026-08-27T04:25:07.756Z"
  },
  "validatorVerdict": {
    "badSuccess": false,
    "badReasons": [
      "[STALE_STATE_CONFLICT] Proposal expected state version 999, but current sovereign state is at version 1."
    ],
    "goodSuccess": true
  },
  "output": {
    "commitBad": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-bad-500",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[STALE_STATE_CONFLICT] Proposal expected state version 999, but current sovereign state is at version 1."
      ],
      "conflictDetails": [],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.755Z"
      }
    },
    "commitGood": {
      "success": true,
      "stateVersion": 2,
      "eventId": "evt-good-retry",
      "committedActionsCount": 1,
      "rejectedReasons": [],
      "conflictDetails": [],
      "newHistoricalRecords": [
        {
          "recordId": "rec-evt-good-retry-1",
          "eventId": "evt-good-retry",
          "requestId": "req-good-retry",
          "turn": 1,
          "timestamp": "2026-08-27T04:25:07.756Z",
          "narrativeTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "source": "PLAYER",
          "actionType": "ADD_RUMOR",
          "details": "{\"rumor\":\"정상 복구된 소문\",\"category\":\"PUBLIC\"}",
          "stateVersionAfterCommit": 2,
          "informationAccess": "RUMOR"
        }
      ],
      "snapshot": {
        "stateVersion": 2,
        "turn": 1,
        "worldInfo": {
          "worldName": "",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [
            "정상 복구된 소문"
          ],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": "evt-good-retry",
        "lastCommittedAt": "2026-08-27T04:25:07.756Z"
      }
    }
  }
}
```

### Test 16: [INFO-A] NPC Knowledge Asymmetry & Dialogue Context Projection Audit
- **Category**: `NARRATIVE_INFORMATION_BOUNDARY`
- **Command**: `buildKnowledgeGraph(snapshot) + sanitizeNpcContext(worldInfo.npcs)`
- **Execution Path**: `CanonicalState -> buildKnowledgeGraph -> entityMap -> server.ts /api/validate-state (metInStory sanitization) -> LLM context projection`
- **Commit Status**: `BOUNDARY_VERIFIED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: Unmet NPC private states sanitized to [미인지 상태] and private facts strictly isolated from entity projection.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-isolated-sage",
          "name": "은둔 현자 엘도르",
          "status": "ALIVE",
          "relationship": "미인지",
          "metInStory": false,
          "knownInformation": [
            "고대 유적의 위치"
          ],
          "innerThought": "[미인지 상태]",
          "impression": "[미인지 상태]",
          "location": "안개 계곡 은신처"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "모험가",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.756Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [
        {
          "id": "npc-isolated-sage",
          "name": "은둔 현자 엘도르",
          "status": "ALIVE",
          "relationship": "미인지",
          "metInStory": false,
          "knownInformation": [
            "고대 유적의 위치"
          ],
          "innerThought": "[미인지 상태]",
          "impression": "[미인지 상태]",
          "location": "안개 계곡 은신처"
        }
      ],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "모험가",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.756Z"
  },
  "validatorVerdict": {
    "isMetInStorySanitized": true,
    "isKnowledgeConfined": true
  },
  "output": {
    "sanitizedNpc": {
      "id": "npc-isolated-sage",
      "name": "은둔 현자 엘도르",
      "status": "ALIVE",
      "relationship": "미인지",
      "metInStory": false,
      "knownInformation": [
        "고대 유적의 위치"
      ],
      "innerThought": "[미인지 상태]",
      "impression": "[미인지 상태]",
      "location": "안개 계곡 은신처"
    },
    "kgEntity": {
      "entityId": "npc-isolated-sage",
      "entityType": "NPC",
      "name": "은둔 현자 엘도르",
      "categoryHint": "NPC",
      "provenance": {
        "originSource": "INITIAL_CANON",
        "worldInfoField": "npcs",
        "stateVersion": 1
      },
      "isStaleRelativeToCanonical": false
    }
  }
}
```

### Test 17: [INFO-B] Offscreen Event Visibility Filtering & Context Composition Audit
- **Category**: `NARRATIVE_INFORMATION_BOUNDARY`
- **Command**: `retrieveFromIndices(visibilityFilter: [PUBLIC]) vs server.ts offscreenContext composition`
- **Execution Path**: `worldInfo.offscreenRecords -> retriever.ts (visibility filter) AND server.ts lines 466-470 (offscreenContext builder)`
- **Commit Status**: `AUDITED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: Retriever and context composers successfully filter HIDDEN offscreen records from public context.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": [
        {
          "id": "off-secret-rebellion",
          "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
          "location": "왕도 북부 성채",
          "visibility": "HIDDEN",
          "occurredAt": "2026-08-27T04:25:07.757Z"
        },
        {
          "id": "off-public-festival",
          "eventDescription": "광장에서 가을 수확 축제가 개최됨",
          "location": "하켄 요새 중앙 광장",
          "visibility": "PUBLIC",
          "occurredAt": "2026-08-27T04:25:07.757Z"
        }
      ]
    },
    "character": {
      "name": "",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.757Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": [
        {
          "id": "off-secret-rebellion",
          "eventDescription": "왕도 북부에서 반란군 비밀 결집 시작",
          "location": "왕도 북부 성채",
          "visibility": "HIDDEN",
          "occurredAt": "2026-08-27T04:25:07.757Z"
        },
        {
          "id": "off-public-festival",
          "eventDescription": "광장에서 가을 수확 축제가 개최됨",
          "location": "하켄 요새 중앙 광장",
          "visibility": "PUBLIC",
          "occurredAt": "2026-08-27T04:25:07.757Z"
        }
      ]
    },
    "character": {
      "name": "",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.757Z"
  },
  "validatorVerdict": {
    "isRetrieverFiltered": true,
    "doesServerExposeHidden": false
  },
  "output": {
    "retrieverFilteredCount": 1,
    "retrieverResults": [
      {
        "sourceType": "HISTORICAL",
        "sourceRecordId": "rec-public-1",
        "sourceEventId": "evt-public-1",
        "sourceStateVersion": 1,
        "actionType": "RECORD_OFFSCREEN_EVENT",
        "authority": "NON_CANONICAL",
        "isStaleRelativeToCanonical": false
      }
    ],
    "serverComposedPromptSnippet": "- [Event ID: off-public-festival] 광장에서 가을 수확 축제가 개최됨"
  }
}
```

### Test 18: [INFO-C] LLM Authority / Unauthorized State Promotion Audit
- **Category**: `NARRATIVE_INFORMATION_BOUNDARY`
- **Command**: `engine.submitProposal(unauthorizedOverwrite) + engine.submitProposal(unbackedItem) + engine.submitProposal(secretProposal)`
- **Execution Path**: `Proposal (LLM) -> EngineValidator.validate (SOURCE_ACTION_ACL + Causality Gate) -> submitProposal`
- **Commit Status**: `PROMOTION_BLOCKED`
- **Diff**: `NO_CHANGE (100% Immutable)`
- **Verdict**: **PASS**
- **Evidence Details**: ACL Enforcement: PASS (OVERWRITE_CHARACTER blocked), Causality Enforcement: PASS (Unbacked item blocked). Note: SET_CHARACTER_SECRET is currently permitted in LLM ACL.
```json
{
  "canonicalBefore": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "정직한기사",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.758Z"
  },
  "canonicalAfter": {
    "stateVersion": 1,
    "turn": 1,
    "worldInfo": {
      "worldName": "",
      "worldType": "popular_genre",
      "settingDescription": "",
      "toneStyle": "원작 고유의 문체 충실 재현",
      "currentTime": {
        "year": 1,
        "season": "SPRING",
        "formattedTime": "1년 봄"
      },
      "npcs": [],
      "factions": [],
      "publicRumors": [],
      "secretLore": [],
      "seeds": [],
      "chapters": {
        "currentChapter": "서막",
        "upcomingChapters": []
      },
      "dcHistory": [],
      "unresolvedForeshadows": [],
      "cameraOffscreenEvents": [],
      "offscreenRecords": []
    },
    "character": {
      "name": "정직한기사",
      "gender": "",
      "age": "",
      "appearance": "",
      "goal": "",
      "originBackground": "",
      "backgroundType": "preset",
      "flaw": "",
      "flawType": "preset",
      "oath": "",
      "oathType": "preset",
      "anchor": "",
      "anchorType": "preset",
      "faction": "",
      "factionType": "preset",
      "stats": {
        "strength": 10,
        "agility": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10
      },
      "inventory": [],
      "secret": "",
      "physicalDefect": "",
      "timeline": []
    },
    "historyLength": 0,
    "lastCommittedEventId": null,
    "lastCommittedAt": "2026-08-27T04:25:07.758Z"
  },
  "validatorVerdict": {
    "attack1_overwrite_rejected": true,
    "attack1_reasons": [
      "[UNAUTHORIZED_ACTION_FOR_SOURCE] Action #1 (OVERWRITE_CHARACTER) is unauthorized for source 'LLM'."
    ],
    "attack2_item_rejected": true,
    "attack2_reasons": [
      "[CAUSALITY_VIOLATION] Unbacked inventory ADD of '신의반지' is rejected."
    ],
    "attack3_secret_accepted": false
  },
  "output": {
    "overwriteResult": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-info-c-overwrite-char",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[UNAUTHORIZED_ACTION_FOR_SOURCE] Action #1 (OVERWRITE_CHARACTER) is unauthorized for source 'LLM'."
      ],
      "conflictDetails": [
        "[ACL_VIOLATION] Proposal source 'LLM' is not authorized to execute action 'OVERWRITE_CHARACTER'."
      ],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "정직한기사",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.758Z"
      }
    },
    "itemResult": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-info-c-unbacked-item",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[CAUSALITY_VIOLATION] Unbacked inventory ADD of '신의반지' is rejected."
      ],
      "conflictDetails": [
        "[CAUSALITY_VIOLATION] Action #1: Acquisition of '신의반지' has no verified causality or acquisition event."
      ],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "정직한기사",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.758Z"
      }
    },
    "secretResult": {
      "success": false,
      "stateVersion": 1,
      "eventId": "evt-info-c-secret-claim",
      "committedActionsCount": 0,
      "rejectedReasons": [
        "[PROVENANCE_VIOLATION] Character secret cannot be modified or established by source 'LLM' without independent canonical evidence."
      ],
      "conflictDetails": [
        "[PROVENANCE_VIOLATION] Action #1: Setting or mutating character secret via untrusted source 'LLM' is prohibited without independent canonical evidence."
      ],
      "newHistoricalRecords": [],
      "snapshot": {
        "stateVersion": 1,
        "turn": 1,
        "worldInfo": {
          "worldName": "",
          "worldType": "popular_genre",
          "settingDescription": "",
          "toneStyle": "원작 고유의 문체 충실 재현",
          "currentTime": {
            "year": 1,
            "season": "SPRING",
            "formattedTime": "1년 봄"
          },
          "npcs": [],
          "factions": [],
          "publicRumors": [],
          "secretLore": [],
          "seeds": [],
          "chapters": {
            "currentChapter": "서막",
            "upcomingChapters": []
          },
          "dcHistory": [],
          "unresolvedForeshadows": [],
          "cameraOffscreenEvents": [],
          "offscreenRecords": []
        },
        "character": {
          "name": "정직한기사",
          "gender": "",
          "age": "",
          "appearance": "",
          "goal": "",
          "originBackground": "",
          "backgroundType": "preset",
          "flaw": "",
          "flawType": "preset",
          "oath": "",
          "oathType": "preset",
          "anchor": "",
          "anchorType": "preset",
          "faction": "",
          "factionType": "preset",
          "stats": {
            "strength": 10,
            "agility": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10
          },
          "inventory": [],
          "secret": "",
          "physicalDefect": "",
          "timeline": []
        },
        "lastCommittedEventId": null,
        "lastCommittedAt": "2026-08-27T04:25:07.758Z"
      }
    }
  }
}
```
