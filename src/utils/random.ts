/**
 * Utility functions for weighted random selection and distributions
 */

/**
 * Select a random value based on weighted probabilities
 */
export function weightedRandom<T>(values: T[], weights: number[]): T {
  if (values.length !== weights.length) {
    throw new Error('Values and weights must have the same length');
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < values.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return values[i];
    }
  }

  return values[values.length - 1];
}

/**
 * Generate a random date within a range with optional distribution bias
 */
export function weightedDate(
  from: Date,
  to: Date,
  distribution: 'uniform' | 'recent-biased' | 'old-biased' | 'normal' = 'uniform'
): Date {
  const fromTime = from.getTime();
  const toTime = to.getTime();
  const range = toTime - fromTime;

  let factor: number;

  switch (distribution) {
    case 'recent-biased':
      // Exponential distribution favoring recent dates
      factor = Math.pow(Math.random(), 0.5); // sqrt makes it bias towards 1 (recent)
      break;
    case 'old-biased':
      // Exponential distribution favoring old dates
      factor = Math.pow(Math.random(), 2); // square makes it bias towards 0 (old)
      break;
    case 'normal':
      // Normal distribution centered in the middle
      factor = (Math.random() + Math.random() + Math.random()) / 3;
      break;
    case 'uniform':
    default:
      factor = Math.random();
  }

  return new Date(fromTime + range * factor);
}

/**
 * Generate a random integer within a range (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float within a range
 */
export function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

/**
 * Generate a unique ID with a prefix
 */
export function generateId(prefix: string = '', index: number): string {
  const paddedIndex = String(index).padStart(6, '0');
  return prefix ? `${prefix}_${paddedIndex}` : `syn_${paddedIndex}`;
}

/**
 * Select random elements from an array
 */
export function randomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Generate null with given probability
 */
export function maybeNull<T>(value: T, nullProbability: number = 0): T | null {
  if (Math.random() < nullProbability) {
    return null;
  }
  return value;
}

/**
 * Create a seeded random number generator
 */
export function createSeededRandom(seed: number): () => number {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    return currentSeed / 0x7fffffff;
  };
}
