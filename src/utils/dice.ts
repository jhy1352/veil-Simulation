/**
 * CSPRNG Cryptographic Dice Engine
 * Uses window.crypto.getRandomValues() to guarantee unbiased, cryptographically secure randomness.
 */

export function getCryptoRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  if (range <= 0) return min;

  const array = new Uint32Array(1);
  const maxSafe = Math.floor(0xffffffff / range) * range;

  let randomVal: number;
  do {
    window.crypto.getRandomValues(array);
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
