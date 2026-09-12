import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

export interface GoldAtom {
  key: string;
  type: 'EVENT' | 'ROLE' | 'STATUS' | 'RELATION' | 'EPISTEMIC' | 'SCOPE';
  predicate?: string;
  subject?: string;
  object?: string;
  modality?: 'ACTUAL' | 'INTENTIONAL' | 'POSSIBLE' | 'COUNTERFACTUAL';
  polarity?: 'ASSERTED' | 'NEGATED';
  epistemicStatus?: 'OBSERVED' | 'INFERRED' | 'HEARSAY' | 'UNVERIFIED';
  scope?: 'FACT' | 'CLAIM' | 'BELIEF' | 'RUMOR';
  causalRelation?: boolean;
  required?: boolean;
}

export interface Report66TestCase {
  id: string;
  group: string;
  title: string;
  contextLevel: 'L1' | 'L2' | 'L3' | 'L4';
  input: string;
  goldAtoms: GoldAtom[];
  prohibitedAtoms: string[];
  notes?: string;
}

export const REPORT_66_TEST_CASES: Report66TestCase[] = [
  // GROUP A: EPISTEMIC DRIFT
  {
    id: 'T01',
    group: 'A_EPISTEMIC',
    title: 'Footprint Observation (L1)',
    contextLevel: 'L1',
    input: '바닥에 젖은 발자국이 있었다.',
    goldAtoms: [
      { key: 'OBSERVED_FOOTPRINT', type: 'EVENT', predicate: 'EXIST_FOOTPRINT', epistemicStatus: 'OBSERVED', modality: 'ACTUAL', polarity: 'ASSERTED' }
    ],
    prohibitedAtoms: ['PERSON_ENTERED_AS_FACT', 'CANONICAL_ENTRY']
  },
  {
    id: 'T02',
    group: 'A_EPISTEMIC',
    title: 'Footprint + Guard Claim + Heard (L2)',
    contextLevel: 'L2',
    input: '바닥에 젖은 발자국이 있었다. 경비병은 누군가 북쪽 문으로 들어갔을 것이라고 말했다. 플레이어는 그 말을 들었다.',
    goldAtoms: [
      { key: 'OBSERVED_FOOTPRINT', type: 'EVENT', predicate: 'EXIST_FOOTPRINT', epistemicStatus: 'OBSERVED', modality: 'ACTUAL' },
      { key: 'GUARD_UTTERANCE', type: 'EVENT', predicate: 'UTTER_CLAIM', subject: 'GUARD', scope: 'CLAIM', epistemicStatus: 'ASSERTED' },
      { key: 'CLAIMED_ENTRY', type: 'EVENT', predicate: 'ENTER_NORTH_DOOR', scope: 'CLAIM', epistemicStatus: 'HEARSAY', modality: 'POSSIBLE' },
      { key: 'PLAYER_HEARD', type: 'EVENT', predicate: 'HEAR_UTTERANCE', subject: 'PLAYER', modality: 'ACTUAL' }
    ],
    prohibitedAtoms: ['VERIFIED_ENTRY', 'CANONICAL_NORTH_ENTRY']
  },
  {
    id: 'T03',
    group: 'A_EPISTEMIC',
    title: 'Repeated Guard Claims in 10 Sentences (L3)',
    contextLevel: 'L3',
    input: '바닥에 젖은 발자국이 있었다. 빗물이 복도 끝까지 이어졌다. 경비병은 누군가 북쪽 문으로 들어갔을 것이라고 말했다. 다른 순찰대원도 동의하며 고개를 끄덕였다. 그들은 복도를 살피며 발소리를 죽였다. 경비병은 분명 누군가 북쪽 문으로 침입한 게 맞다고 다시 소리쳤다. 성 안의 긴장감이 점점 고조되었다. 경비병은 세 번째로 침입자가 북쪽 문을 통과했다고 거듭 주장했다. 플레이어는 벽 뒤에 숨어 그들의 반복된 주장을 조용히 들었다. 아무도 실제로 문을 확인해보지는 않았다.',
    goldAtoms: [
      { key: 'OBSERVED_FOOTPRINT', type: 'EVENT', predicate: 'EXIST_FOOTPRINT', epistemicStatus: 'OBSERVED' },
      { key: 'GUARD_CLAIM_REPEATED', type: 'EVENT', predicate: 'CLAIM_ENTRY', subject: 'GUARD', scope: 'CLAIM', epistemicStatus: 'HEARSAY' },
      { key: 'HEARSAY_PRESERVED', type: 'STATUS', predicate: 'ENTRY_CLAIM_STATUS', scope: 'CLAIM', epistemicStatus: 'UNVERIFIED' }
    ],
    prohibitedAtoms: ['VERIFIED_ENTRY', 'CANONICAL_ENTRY_FACT']
  },

  // GROUP B: CAUSAL DRIFT
  {
    id: 'T04',
    group: 'B_CAUSAL',
    title: 'Co-occurrence Temporal (L1)',
    contextLevel: 'L1',
    input: '비가 내렸다. 오래된 다리가 무너졌다.',
    goldAtoms: [
      { key: 'RAIN', type: 'EVENT', predicate: 'RAIN_FALL', modality: 'ACTUAL' },
      { key: 'BRIDGE_COLLAPSE', type: 'EVENT', predicate: 'COLLAPSE_BRIDGE', modality: 'ACTUAL' },
      { key: 'TEMPORAL_COOCCURRENCE', type: 'RELATION', causalRelation: false }
    ],
    prohibitedAtoms: ['RAIN_CAUSED_COLLAPSE', 'EXPLICIT_CAUSAL_RAIN_BRIDGE']
  },
  {
    id: 'T05',
    group: 'B_CAUSAL',
    title: 'Explicit Cause and Effect (L1)',
    contextLevel: 'L1',
    input: '비가 너무 많이 내려서 오래된 다리가 무너졌다.',
    goldAtoms: [
      { key: 'RAIN_HEAVY', type: 'EVENT', predicate: 'RAIN_HEAVY', modality: 'ACTUAL' },
      { key: 'BRIDGE_COLLAPSE', type: 'EVENT', predicate: 'COLLAPSE_BRIDGE', modality: 'ACTUAL' },
      { key: 'EXPLICIT_CAUSAL_RELATION', type: 'RELATION', causalRelation: true }
    ],
    prohibitedAtoms: ['UNRELATED_EVENTS']
  },
  {
    id: 'T06',
    group: 'B_CAUSAL',
    title: 'Long Context with Single Explicit Cause (L4)',
    contextLevel: 'L4',
    input: '아침부터 먹구름이 몰려왔다. 바람이 거세게 불었다. 플레이어는 나귀를 끌고 언덕길을 올랐다. 마을 종소리가 멀리서 울렸다. 숲속에서 짐승들의 울음소리가 번졌다. 갑자기 벼락이 거목을 강타하여 나무가 길을 막으며 쓰러졌다. 비가 쏟아지기 시작했다. 흙탕물이 길가를 따라 흘렀다. 플레이어는 바위 틈으로 몸을 피했다. 천둥소리가 온 산을 뒤흔들었다.',
    goldAtoms: [
      { key: 'LIGHTNING_STRIKE', type: 'EVENT', predicate: 'STRIKE_LIGHTNING', modality: 'ACTUAL' },
      { key: 'TREE_COLLAPSE', type: 'EVENT', predicate: 'FALL_TREE', modality: 'ACTUAL' },
      { key: 'EXPLICIT_LIGHTNING_CAUSE_TREE', type: 'RELATION', causalRelation: true }
    ],
    prohibitedAtoms: ['RAIN_CAUSED_TREE_FALL', 'WIND_CAUSED_ROCK_FALL', 'INVENTED_CAUSAL_CHAINS']
  },

  // GROUP C: INTENT / ATTEMPT -> OUTCOME DRIFT
  {
    id: 'T07',
    group: 'C_INTENT_OUTCOME',
    title: 'Intent to Open Door (L1)',
    contextLevel: 'L1',
    input: '플레이어는 문을 열려고 했다.',
    goldAtoms: [
      { key: 'INTENT_OPEN_DOOR', type: 'EVENT', predicate: 'OPEN_DOOR', modality: 'INTENTIONAL' }
    ],
    prohibitedAtoms: ['OPEN_DOOR_ACTUAL', 'ENTER_ROOM']
  },
  {
    id: 'T08',
    group: 'C_INTENT_OUTCOME',
    title: 'Attempt + Failed Opening (L2)',
    contextLevel: 'L2',
    input: '플레이어는 문을 열려고 했지만 열리지 않았다.',
    goldAtoms: [
      { key: 'ATTEMPT_OPEN_DOOR', type: 'EVENT', predicate: 'ATTEMPT_OPEN', subject: 'PLAYER', modality: 'INTENTIONAL' },
      { key: 'FAILURE_DOOR', type: 'EVENT', predicate: 'OPEN_DOOR', polarity: 'NEGATED' }
    ],
    prohibitedAtoms: ['SUCCESSFUL_OPEN', 'DOOR_OPENED_FACT']
  },
  {
    id: 'T09',
    group: 'C_INTENT_OUTCOME',
    title: 'Failed Opening Followed by Later Separate Success (L3)',
    contextLevel: 'L3',
    input: '플레이어는 문을 열려고 했지만 열리지 않았다. 문고리는 차갑고 단단히 굳어 있었다. 그는 열쇠 구멍을 들여다보았다. 복도 반대편에서 발소리가 들려왔다. 그는 몸을 숨겼다. 경비병 한 명이 지나간 후 다시 다가갔다. 주머니에서 주운 쇠꼬챙이를 꺼냈다. 틈새를 몇 차례 비틀자 둔탁한 소리가 났다. 마침내 잠금장치가 풀렸다. 그는 문을 열고 안으로 들어갔다.',
    goldAtoms: [
      { key: 'INITIAL_ATTEMPT_FAILED', type: 'EVENT', predicate: 'OPEN_DOOR_INITIAL', polarity: 'NEGATED', modality: 'INTENTIONAL' },
      { key: 'LATER_OPEN_SUCCESS', type: 'EVENT', predicate: 'OPEN_DOOR_LATER', polarity: 'ASSERTED', modality: 'ACTUAL' },
      { key: 'LATER_ENTER_ROOM', type: 'EVENT', predicate: 'ENTER_ROOM', modality: 'ACTUAL' }
    ],
    prohibitedAtoms: ['RETROACTIVE_INITIAL_SUCCESS', 'COLLAPSED_SINGLE_EVENT']
  },

  // GROUP D: NEGATION PERSISTENCE
  {
    id: 'T10',
    group: 'D_NEGATION',
    title: 'Negated Key Pickup (L1)',
    contextLevel: 'L1',
    input: '플레이어는 열쇠를 줍지 않았다.',
    goldAtoms: [
      { key: 'NEGATED_PICKUP', type: 'EVENT', predicate: 'PICKUP_KEY', subject: 'PLAYER', polarity: 'NEGATED' }
    ],
    prohibitedAtoms: ['PICKUP_KEY_ACTUAL', 'INVENTED_KEY_IN_INVENTORY']
  },
  {
    id: 'T11',
    group: 'D_NEGATION',
    title: 'Key Mentioned in Context Without Pickup (L3)',
    contextLevel: 'L3',
    input: '플레이어는 열쇠를 줍지 않았다. 바닥의 은빛 열쇠는 촛불을 받아 반짝였다. 방 안에는 낡은 책장과 궤짝이 놓여 있었다. 책장에는 고서들이 빼곡했다. 그는 책장을 뒤적이며 마법서를 찾았다. 탁자 위에는 마른 잉크병이 놓여 있었다. 창밖으로 달빛이 비쳐 들었다. 복도에서 시계탑 종소리가 은은하게 울렸다. 방 안의 공기는 서늘하고 적막했다.',
    goldAtoms: [
      { key: 'NEGATED_PICKUP_PRESERVED', type: 'EVENT', predicate: 'PICKUP_KEY', polarity: 'NEGATED' },
      { key: 'KEY_REMAINS_ON_FLOOR', type: 'STATUS', predicate: 'KEY_LOCATION_FLOOR' }
    ],
    prohibitedAtoms: ['PICKUP_KEY_INFERRED', 'KEY_TAKEN']
  },
  {
    id: 'T12',
    group: 'D_NEGATION',
    title: 'Negated Earlier and Actual Pickup Later (L4)',
    contextLevel: 'L4',
    input: '처음에 플레이어는 열쇠를 줍지 않았다. 그는 수상한 함정이 설치되어 있을까 염려했다. 그는 방안을 한 바퀴 돌며 벽과 바닥의 홈을 면밀히 살폈다. 아무런 와이어나 장치가 없음을 확인했다. 그는 마침내 마음을 놓았다. 플레이어는 허리를 숙여 바닥의 열쇠를 주웠다. 묵직한 황동 열쇠가 손바닥에 닿았다.',
    goldAtoms: [
      { key: 'EARLIER_NEGATED_PICKUP', type: 'EVENT', predicate: 'PICKUP_KEY_EARLIER', polarity: 'NEGATED' },
      { key: 'LATER_ACTUAL_PICKUP', type: 'EVENT', predicate: 'PICKUP_KEY_LATER', polarity: 'ASSERTED', modality: 'ACTUAL' }
    ],
    prohibitedAtoms: ['ALWAYS_HAD_KEY', 'OVERWRITTEN_INITIAL_NEGATION']
  },

  // GROUP E: CLAIM -> CANONICAL DRIFT
  {
    id: 'T13',
    group: 'E_CLAIM_CANONICAL',
    title: 'Guard Claim of Theft (L1)',
    contextLevel: 'L1',
    input: '경비병은 플레이어가 열쇠를 훔쳤다고 주장했다.',
    goldAtoms: [
      { key: 'CLAIM_THEFT', type: 'EVENT', predicate: 'CLAIM_THEFT', subject: 'GUARD', scope: 'CLAIM', epistemicStatus: 'ASSERTED' },
      { key: 'THEFT_PROPOSITION', type: 'EVENT', predicate: 'STEAL_KEY', subject: 'PLAYER', scope: 'CLAIM', epistemicStatus: 'HEARSAY' }
    ],
    prohibitedAtoms: ['CANONICAL_THEFT', 'PLAYER_STOLE_FACT']
  },
  {
    id: 'T14',
    group: 'E_CLAIM_CANONICAL',
    title: 'Three NPCs Repeating Same Claim (L2)',
    contextLevel: 'L2',
    input: '경비병은 플레이어가 열쇠를 훔쳤다고 주장했다. 하녀도 그 말을 듣고 그가 열쇠를 훔친 게 맞다고 맞장구쳤다. 집사 역시 그 이방인이 열쇠를 가져갔다고 확신했다.',
    goldAtoms: [
      { key: 'MULTI_NPC_CLAIMS', type: 'EVENT', predicate: 'CLAIM_THEFT', scope: 'CLAIM', epistemicStatus: 'HEARSAY' },
      { key: 'HEARSAY_NATURE_PRESERVED', type: 'STATUS', epistemicStatus: 'UNVERIFIED', scope: 'CLAIM' }
    ],
    prohibitedAtoms: ['CONSENSUS_AS_FACT', 'CANONICAL_THEFT']
  },
  {
    id: 'T15',
    group: 'E_CLAIM_CANONICAL',
    title: 'Claims Followed by Explicit Lack of Evidence (L4)',
    contextLevel: 'L4',
    input: '경비병은 플레이어가 열쇠를 훔쳤다고 소리쳤다. 하녀와 집사도 연이어 그가 도둑질을 했다고 고발했다. 방 안은 소란스러워졌다. 그러나 실제로 확인된 물리적 증거나 목격 기록은 전혀 없었다.',
    goldAtoms: [
      { key: 'NPC_CLAIMS', type: 'EVENT', predicate: 'CLAIM_THEFT', scope: 'CLAIM', epistemicStatus: 'ASSERTED' },
      { key: 'THEFT_IN_CLAIM_SCOPE', type: 'EVENT', predicate: 'STEAL_KEY', scope: 'CLAIM', epistemicStatus: 'HEARSAY' },
      { key: 'LACK_OF_EVIDENCE', type: 'EVENT', predicate: 'VERIFY_EVIDENCE', polarity: 'NEGATED', epistemicStatus: 'UNVERIFIED' }
    ],
    prohibitedAtoms: ['CANONICAL_THEFT_FACT']
  },

  // GROUP F: INFERENCE COLLAPSE
  {
    id: 'T16',
    group: 'F_INFERENCE',
    title: 'Observation vs Inference (L1)',
    contextLevel: 'L1',
    input: '문이 열려 있었다. 누군가 방금 들어간 것 같다.',
    goldAtoms: [
      { key: 'OBSERVED_DOOR_OPEN', type: 'EVENT', predicate: 'EXIST_OPEN_DOOR', epistemicStatus: 'OBSERVED', modality: 'ACTUAL' },
      { key: 'INFERRED_RECENT_ENTRY', type: 'EVENT', predicate: 'ENTER_RECENTLY', epistemicStatus: 'INFERRED', modality: 'POSSIBLE' }
    ],
    prohibitedAtoms: ['OBSERVED_ENTRY', 'CANONICAL_ENTRY_FACT']
  },
  {
    id: 'T17',
    group: 'F_INFERENCE',
    title: 'Inference Followed by NPC Confident Assertion (L2)',
    contextLevel: 'L2',
    input: '문이 열려 있었다. 누군가 방금 들어간 것 같았다. 곁에 서 있던 경비병이 "누군가 들어간 게 틀림없다"라고 단언했다.',
    goldAtoms: [
      { key: 'OBSERVED_OPEN_DOOR', type: 'EVENT', predicate: 'EXIST_OPEN_DOOR', epistemicStatus: 'OBSERVED' },
      { key: 'ORIGINAL_INFERENCE', type: 'EVENT', predicate: 'ENTER_INFERENCE', epistemicStatus: 'INFERRED' },
      { key: 'NPC_ASSERTION', type: 'EVENT', predicate: 'ASSERT_ENTRY', subject: 'GUARD', scope: 'CLAIM' }
    ],
    prohibitedAtoms: ['CANONICAL_FACT_ENTRY']
  },

  // GROUP G: ENTITY IDENTITY DRIFT
  {
    id: 'T18',
    group: 'G_ENTITY_IDENTITY',
    title: 'Single Guard Holding Key (L1)',
    contextLevel: 'L1',
    input: '경비병이 열쇠를 들고 있었다.',
    goldAtoms: [
      { key: 'GUARD_HOLD_KEY', type: 'EVENT', predicate: 'HOLD_KEY', subject: 'GUARD', modality: 'ACTUAL' }
    ],
    prohibitedAtoms: ['ARBITRARY_CANONICAL_ID_ASSIGNMENT']
  },
  {
    id: 'T19',
    group: 'G_ENTITY_IDENTITY',
    title: 'Two Guards with Same Ambiguous Designation (L2)',
    contextLevel: 'L2',
    input: '동쪽 문 경비병이 열쇠를 들고 있었다. 마을의 다른 순찰 경비병도 같은 명칭으로 불렸다.',
    goldAtoms: [
      { key: 'GUARD_EAST_KEY', type: 'EVENT', predicate: 'HOLD_KEY', subject: 'GUARD_EAST' },
      { key: 'AMBIGUOUS_IDENTITY_PRESERVED', type: 'STATUS', predicate: 'IDENTITY_AMBIGUITY' }
    ],
    prohibitedAtoms: ['CONFLATED_SINGLE_GUARD_CANONICAL_ID']
  },
  {
    id: 'T20',
    group: 'G_ENTITY_IDENTITY',
    title: 'Ambiguous Guard Reference in 10 Sentences (L3)',
    contextLevel: 'L3',
    input: '동쪽 문의 경비병이 열쇠를 들고 있었다. 성문 앞 광장에는 여러 순찰 경비병들이 교대로 오갔다. 바람이 차갑게 불었다. 상인들이 수레를 끌고 지나갔다. 동쪽과 서쪽의 보초들이 교대 시간을 기다렸다. 광장의 횃불이 일렁였다. 한 경비병이 플레이어 쪽으로 걸어왔다. 그 경비병이 플레이어에게 열쇠를 건넸다.',
    goldAtoms: [
      { key: 'GUARD_GIVES_KEY', type: 'EVENT', predicate: 'GIVE_KEY', subject: 'GUARD_AMBIGUOUS', object: 'PLAYER' }
    ],
    prohibitedAtoms: ['ARBITRARY_CANONICAL_ID_FORCE']
  },

  // GROUP H: PRONOUN DRIFT
  {
    id: 'T21',
    group: 'H_PRONOUN',
    title: 'Pronoun Binding (L2)',
    contextLevel: 'L2',
    input: '플레이어가 낡은 상자를 발견했다. 그는 그것을 열었다. 그 안에는 열쇠가 있었다.',
    goldAtoms: [
      { key: 'FIND_BOX', type: 'EVENT', predicate: 'FIND_BOX', subject: 'PLAYER' },
      { key: 'OPEN_BOX', type: 'EVENT', predicate: 'OPEN_BOX', subject: 'PLAYER', object: 'BOX' },
      { key: 'CONTAIN_KEY', type: 'EVENT', predicate: 'CONTAIN_KEY', subject: 'BOX', object: 'KEY' }
    ],
    prohibitedAtoms: ['WRONG_PRONOUN_BINDING']
  },
  {
    id: 'T22',
    group: 'H_PRONOUN',
    title: 'Pronoun Binding with Intervening NPC (L3)',
    contextLevel: 'L3',
    input: '플레이어가 낡은 상자를 발견했다. 곁에 서 있던 늙은 마법사가 호기심 어린 눈으로 지켜보았다. 플레이어는 허리를 숙였다. 그는 그것을 열었다.',
    goldAtoms: [
      { key: 'HE_BOUND_TO_PLAYER', type: 'ROLE', subject: 'PLAYER', predicate: 'OPEN' },
      { key: 'IT_BOUND_TO_BOX', type: 'ROLE', object: 'BOX', predicate: 'OPEN' }
    ],
    prohibitedAtoms: ['MAGE_OPENED_BOX']
  },

  // GROUP I: COMPOUND MEANING UNDER CONTEXT
  {
    id: 'T23',
    group: 'I_COMPOUND',
    title: 'Draw Sword + Charge Enemy (L1)',
    contextLevel: 'L1',
    input: '플레이어가 칼을 뽑고 적에게 달려들었다.',
    goldAtoms: [
      { key: 'DRAW_SWORD', type: 'EVENT', predicate: 'DRAW_SWORD', subject: 'PLAYER' },
      { key: 'CHARGE_ENEMY', type: 'EVENT', predicate: 'CHARGE_ENEMY', subject: 'PLAYER' }
    ],
    prohibitedAtoms: ['INVENTED_HIT_DAMAGE', 'COLLAPSED_ACTION']
  },
  {
    id: 'T24',
    group: 'I_COMPOUND',
    title: 'Compound Action in Combat Context without Invented Hit (L4)',
    contextLevel: 'L4',
    input: '전장의 함성이 귓전을 때렸다. 먼지와 화염이 하늘을 뒤덮었다. 아군 전열이 흔들리고 있었다. 적 지휘관이 깃발을 높이 들었다. 플레이어는 숨을 깊게 들이쉬었다. 방패를 고쳐 쥐고 발을 굳게 디뎠다. 플레이어가 칼을 뽑고 적에게 달려들었다. 주변의 병사들이 일제히 함성을 질렀다. 거친 흙먼지가 사방으로 튀었다. 적들의 시선이 그에게 집중되었다.',
    goldAtoms: [
      { key: 'DRAW_SWORD_PRESERVED', type: 'EVENT', predicate: 'DRAW_SWORD', subject: 'PLAYER' },
      { key: 'CHARGE_ENEMY_PRESERVED', type: 'EVENT', predicate: 'CHARGE_ENEMY', subject: 'PLAYER' }
    ],
    prohibitedAtoms: ['INVENTED_HIT', 'INVENTED_ENEMY_DEATH', 'INVENTED_DAMAGE']
  },

  // GROUP J: UNCERTAINTY COLLAPSE
  {
    id: 'T25',
    group: 'J_UNCERTAINTY',
    title: 'Possible Castle (L1)',
    contextLevel: 'L1',
    input: '안개 너머에 성이 있을지도 모른다.',
    goldAtoms: [
      { key: 'POSSIBLE_CASTLE', type: 'EVENT', predicate: 'EXIST_CASTLE', modality: 'POSSIBLE', epistemicStatus: 'UNVERIFIED' }
    ],
    prohibitedAtoms: ['CANONICAL_CASTLE_FACT', 'OBSERVED_CASTLE']
  },
  {
    id: 'T26',
    group: 'J_UNCERTAINTY',
    title: 'Possibility + NPC Hearsay in Context (L2)',
    contextLevel: 'L2',
    input: '안개 너머에 성이 있을지도 모른다. 지나가던 여행자는 그곳에 성이 있다는 이야기를 오래전에 들었다고 덧붙였다.',
    goldAtoms: [
      { key: 'POSSIBLE_CASTLE', type: 'EVENT', predicate: 'EXIST_CASTLE', modality: 'POSSIBLE' },
      { key: 'TRAVELER_HEARSAY', type: 'EVENT', predicate: 'HEAR_RUMOR', subject: 'TRAVELER', epistemicStatus: 'HEARSAY' }
    ],
    prohibitedAtoms: ['CANONICAL_CASTLE_CONFIRMED']
  },

  // GROUP K: MULTILINGUAL PARAPHRASE
  {
    id: 'T27_KO',
    group: 'K_MULTILINGUAL',
    title: 'Korean Direct (L1)',
    contextLevel: 'L1',
    input: '플레이어가 열쇠를 주웠다.',
    goldAtoms: [
      { key: 'PICKUP_KEY', type: 'EVENT', predicate: 'PICKUP_KEY', subject: 'PLAYER', object: 'KEY', modality: 'ACTUAL', polarity: 'ASSERTED' }
    ],
    prohibitedAtoms: ['NEGATED_PICKUP']
  },
  {
    id: 'T27_EN',
    group: 'K_MULTILINGUAL',
    title: 'English Direct (L1)',
    contextLevel: 'L1',
    input: 'The player picked up the key.',
    goldAtoms: [
      { key: 'PICKUP_KEY', type: 'EVENT', predicate: 'PICKUP_KEY', subject: 'PLAYER', object: 'KEY', modality: 'ACTUAL', polarity: 'ASSERTED' }
    ],
    prohibitedAtoms: ['NEGATED_PICKUP']
  },
  {
    id: 'T27_MIXED',
    group: 'K_MULTILINGUAL',
    title: 'Korean-English Mixed Code-switching (L1)',
    contextLevel: 'L1',
    input: '플레이어가 key를 집어 들었다.',
    goldAtoms: [
      { key: 'PICKUP_KEY', type: 'EVENT', predicate: 'PICKUP_KEY', subject: 'PLAYER', object: 'KEY', modality: 'ACTUAL', polarity: 'ASSERTED' }
    ],
    prohibitedAtoms: ['NEGATED_PICKUP']
  },
  {
    id: 'T27_INDIRECT',
    group: 'K_MULTILINGUAL',
    title: 'Indirect Paraphrase (L1)',
    contextLevel: 'L1',
    input: '바닥에 있던 열쇠를 플레이어가 챙겼다.',
    goldAtoms: [
      { key: 'PICKUP_KEY', type: 'EVENT', predicate: 'PICKUP_KEY', subject: 'PLAYER', object: 'KEY', modality: 'ACTUAL', polarity: 'ASSERTED' }
    ],
    prohibitedAtoms: ['NEGATED_PICKUP']
  }
];

export const BASELINE_SYSTEM_INSTRUCTION = `You are a pure semantic parser for TRPG narrative engine.
Extract semantic events from the given user utterance/narrative text.
Output JSON only with schema:
{
  "semanticEvents": [
    {
      "predicate": string,
      "subject": string,
      "object"?: string,
      "modality": "ACTUAL" | "INTENTIONAL" | "POSSIBLE" | "COUNTERFACTUAL",
      "polarity": "ASSERTED" | "NEGATED",
      "epistemicStatus": "OBSERVED" | "INFERRED" | "HEARSAY" | "UNVERIFIED",
      "scope": "FACT" | "CLAIM" | "BELIEF" | "RUMOR",
      "causalRelation"?: boolean,
      "rawSegment": string
    }
  ]
}`;

export const DIRECTIVE_SYSTEM_INSTRUCTION = `${BASELINE_SYSTEM_INSTRUCTION}

[STRICT SEMANTIC PRESERVATION DIRECTIVE]
1. Modality Distinction: Never conflate INTENT / ATTEMPT with COMPLETED OUTCOME. An attempt that failed must preserve polarity='NEGATED' or modality='INTENTIONAL' and must never emit a completed actual event.
2. Epistemic & Authority Boundary: Claims, rumours, hearsay, or character utterances are strictly scope='CLAIM' and epistemicStatus='HEARSAY'. Repetition or consensus by multiple NPCs never upgrades a claim to canonical fact.
3. Observation vs Inference: Separate physical sensory observations (epistemicStatus='OBSERVED') from character inferences (epistemicStatus='INFERRED') or speculation (modality='POSSIBLE').
4. Temporal vs Causal: Co-occurrence or sequential occurrence in context does NOT imply causation unless explicitly stated with causal connectives.
5. Entity Identity & Coreference: Do NOT assign arbitrary canonical IDs to ambiguous entities. Preserve ambiguity unless definite grammatical bindings exist.
6. Contextual Isolation: Do NOT invent unstated consequences (e.g. hit, damage, pickup) simply because surrounding context describes combat or items.`;

export async function runReport66Execution() {
  const reportDir = path.join(process.cwd(), 'report', '66_long_context_multilingual_robustness');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const rawEvidencePath = path.join(reportDir, 'raw_evidence.json');
  const reportTxtPath = path.join(reportDir, 'report.txt');

  console.log('================================================================');
  console.log('VEIL Report 66: Long-Context / Multilingual Semantic Robustness');
  console.log('Target Model: gemini-3.5-flash (STRICT, NO LITE)');
  console.log(`Total Test Cases: ${REPORT_66_TEST_CASES.length}`);
  console.log('Conditions: Condition A (Baseline) vs Condition B (Directive)');
  console.log('Runs: 5 Independent Runs per condition');
  console.log(`Total Planned Executions: ${REPORT_66_TEST_CASES.length * 2 * 5}`);
  console.log('================================================================');

  let rawEvidence: any[] = [];
  if (fs.existsSync(rawEvidencePath)) {
    try {
      rawEvidence = JSON.parse(fs.readFileSync(rawEvidencePath, 'utf-8'));
      console.log(`Loaded ${rawEvidence.length} existing records from raw_evidence.json`);
    } catch (e) {
      console.log('Starting fresh raw_evidence.json');
    }
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const modelName = 'gemini-3.5-flash';
  const runs = [1, 2, 3, 4, 5];
  const conditions: ('A' | 'B')[] = ['A', 'B'];

  for (const tc of REPORT_66_TEST_CASES) {
    for (const cond of conditions) {
      for (const runIndex of runs) {
        const existing = rawEvidence.find(
          (r: any) => r.testId === tc.id && r.condition === cond && r.runIndex === runIndex
        );
        if (existing) {
          continue;
        }

        console.log(`[RUN] ${tc.id} (${tc.group} - ${tc.contextLevel}) Cond ${cond} Run ${runIndex}/5...`);
        const sysInstruction = cond === 'A' ? BASELINE_SYSTEM_INSTRUCTION : DIRECTIVE_SYSTEM_INSTRUCTION;

        let attempt = 0;
        let success = false;
        let rawLlmOutput = '';
        let parsedJson: any = null;
        let parseSuccess = false;
        const attemptLogs: any[] = [];

        while (!success && attempt < 10) {
          attempt++;
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: tc.input,
              config: {
                systemInstruction: sysInstruction,
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            });

            rawLlmOutput = response.text || '';
            try {
              parsedJson = JSON.parse(rawLlmOutput);
              parseSuccess = true;
            } catch (jsonErr) {
              parseSuccess = false;
            }
            success = true;
            attemptLogs.push({ attempt, timestamp: new Date().toISOString(), status: 'SUCCESS' });
          } catch (apiErr: any) {
            const errStr = apiErr?.message || String(apiErr);
            attemptLogs.push({ attempt, timestamp: new Date().toISOString(), status: 'ERROR', error: errStr.slice(0, 200) });
            console.log(`  -> [Attempt ${attempt}] API Error: ${errStr.slice(0, 100)}`);
            if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
              console.log('     Quota exhausted, exponential backoff...');
              await new Promise((resolve) => setTimeout(resolve, 15000 * Math.min(attempt, 4)));
            } else {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
        }

        const record = {
          testId: tc.id,
          group: tc.group,
          contextLevel: tc.contextLevel,
          condition: cond,
          runIndex: runIndex,
          model: modelName,
          timestamp: new Date().toISOString(),
          input: tc.input,
          systemInstruction: sysInstruction,
          rawLlmOutput,
          parsedJson,
          parseSuccess,
          executionAttempts: attempt,
          attemptLogs,
          evaluation: {
            success,
            goldAtomsCount: tc.goldAtoms.length,
            prohibitedCount: tc.prohibitedAtoms.length
          }
        };

        rawEvidence.push(record);
        fs.writeFileSync(rawEvidencePath, JSON.stringify(rawEvidence, null, 2), 'utf-8');
      }
    }
  }

  console.log(`Execution cycle finished. Completed records: ${rawEvidence.length}`);
}

if (require.main === module) {
  runReport66Execution().catch((e) => {
    console.error('Fatal execution error:', e);
  });
}
