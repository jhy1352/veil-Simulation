/**
 * CSPRNG Cryptographic Dice Engine
 * Uses window.crypto.getRandomValues() to guarantee unbiased, cryptographically secure randomness.
 */

export function getCryptoRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  if (range <= 0) return min;

  const array = new Uint32Array(1);
  const maxSafe = Math.floor(0xffffffff / range) * range;
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;

  let randomVal: number;
  do {
    cryptoObj.getRandomValues(array);
    randomVal = array[0];
  } while (randomVal >= maxSafe);

  return min + (randomVal % range);
}

export function rollCryptoDie(sides: number = 20): number {
  return getCryptoRandomInt(1, sides);
}

export function rollDice(count: number, sides: number): { rolls: number[]; total: number } {
  const rolls: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const val = rollCryptoDie(sides);
    rolls.push(val);
    total += val;
  }
  return { rolls, total };
}

/**
 * 4d6 Drop Lowest generator for TRPG character stat creation
 */
export function roll4d6DropLowest(): { rolls: number[]; dropped: number; total: number } {
  const { rolls } = rollDice(4, 6);
  const sorted = [...rolls].sort((a, b) => a - b);
  const dropped = sorted[0];
  const total = sorted[1] + sorted[2] + sorted[3];
  return { rolls, dropped, total };
}

/**
 * Result analysis against target DC
 */
export interface RollCheckResult {
  rawRoll: number;
  modifier: number;
  total: number;
  targetDC: number;
  isCritSuccess: boolean;
  isCritFailure: boolean;
  isSuccess: boolean;
  degree: 'critical_success' | 'great_success' | 'normal_success' | 'narrow_success' | 'narrow_failure' | 'normal_failure' | 'great_failure' | 'critical_failure';
  descriptionKo: string;
}

export function evaluateCheck(rawRoll: number, modifier: number, targetDC: number): RollCheckResult {
  const isCritSuccess = rawRoll === 20;
  const isCritFailure = rawRoll === 1;
  const total = rawRoll + modifier;
  const diff = total - targetDC;
  const isSuccess = isCritSuccess || (!isCritFailure && total >= targetDC);

  let degree: RollCheckResult['degree'];
  let descriptionKo = '';

  if (isCritSuccess) {
    degree = 'critical_success';
    descriptionKo = '기적적인 대성공 (자연 20)';
  } else if (isCritFailure) {
    degree = 'critical_failure';
    descriptionKo = '치명적인 대실패 (자연 1)';
  } else if (isSuccess) {
    if (diff >= 7) {
      degree = 'great_success';
      descriptionKo = '압도적인 대성공 (차이 +7 이상)';
    } else if (diff >= 4) {
      degree = 'normal_success';
      descriptionKo = '일반적인 성공 (차이 +4~6)';
    } else {
      degree = 'narrow_success';
      descriptionKo = '아슬아슬한 성공 (차이 +1~3)';
    }
  } else {
    const negDiff = Math.abs(diff);
    if (negDiff >= 7) {
      degree = 'great_failure';
      descriptionKo = '참혹한 대실패 (차이 -7 이상)';
    } else if (negDiff >= 4) {
      degree = 'normal_failure';
      descriptionKo = '일반적인 실패 (차이 -4~6)';
    } else {
      degree = 'narrow_failure';
      descriptionKo = '아슬아슬한 실패 (차이 -1~3)';
    }
  }

  return {
    rawRoll,
    modifier,
    total,
    targetDC,
    isCritSuccess,
    isCritFailure,
    isSuccess,
    degree,
    descriptionKo
  };
}

// Roll 3d6 for character generation (range 3 - 18)
export const roll3d6 = (): number => {
  return rollCryptoDie(6) + rollCryptoDie(6) + rollCryptoDie(6);
};

export const generateAllStatsCSPRNG = () => {
  return {
    strength: roll3d6(),
    agility: roll3d6(),
    vitality: roll3d6(),
    intellect: roll3d6(),
    insight: roll3d6(),
    willpower: roll3d6(),
  };
};

export const calculateModifier = (statValue: number): number => {
  return Math.floor((statValue - 10) / 2);
};

export const getOutcomeType = (
  rawRoll: number,
  diffWithDC: number
): {
  outcome: 'critical_failure' | 'narrow_failure' | 'normal_failure' | 'major_failure' | 'narrow_success' | 'normal_success' | 'major_success' | 'miraculous_success';
  description: string;
} => {
  if (rawRoll === 20) {
    return {
      outcome: 'miraculous_success',
      description: '✨ 기적적인 성공 (Natural 20): 주변 환경의 극적인 행운과 압도적인 서사적 성취가 주어집니다.',
    };
  }
  if (rawRoll === 1) {
    return {
      outcome: 'critical_failure',
      description: '💀 치명적 실패 (Natural 1): 보정치와 무관하게 즉각적인 위기와 혹독한 대가가 발생합니다.',
    };
  }

  if (diffWithDC >= 7) {
    return {
      outcome: 'major_success',
      description: '대성공 (목표 DC +7 이상): 손실이나 부작용 없이 목표를 완벽하게 완수합니다.',
    };
  }
  if (diffWithDC >= 4) {
    return {
      outcome: 'normal_success',
      description: '성공 (목표 DC +4 ~ +6): 안정적으로 행동에 성공합니다.',
    };
  }
  if (diffWithDC >= 0) {
    return {
      outcome: 'narrow_success',
      description: '아슬아슬한 성공 (목표 DC 0 ~ +3): 목표는 달성하나 경미한 피해나 소음 등 서사적 대가가 뒤따릅니다.',
    };
  }
  if (diffWithDC >= -3) {
    return {
      outcome: 'narrow_failure',
      description: '아슬아슬한 실패 (목표 DC -1 ~ -3): 행동은 실패하나 재도전의 기회나 탈출로가 주어집니다.',
    };
  }
  if (diffWithDC >= -6) {
    return {
      outcome: 'normal_failure',
      description: '실패 (목표 DC -4 ~ -6): 시도가 좌절되며 상황이 불리해집니다.',
    };
  }
  return {
    outcome: 'major_failure',
    description: '대실패 (목표 DC -7 이하): 큰 부상, 무기 손실 등 심각한 위기 상황에 직면합니다.',
  };
};

export const rollD20WithModifier = (
  modifier: number,
  targetDC: number = 10,
  statName: string = '능력'
) => {
  const rawRoll = rollCryptoDie(20);
  const total = rawRoll + modifier;
  const diff = total - targetDC;
  const outcomeInfo = getOutcomeType(rawRoll, diff);

  return {
    sides: 20,
    rawRoll,
    modifier,
    total,
    targetDC,
    statName,
    outcome: outcomeInfo.outcome,
    description: outcomeInfo.description,
  };
};

