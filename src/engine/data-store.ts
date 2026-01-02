/**
 * In-memory data store for generated records
 */

import type { GeneratedRecord, GenerationStats } from '../types.js';

export class DataStore {
  private data: Map<string, GeneratedRecord[]> = new Map();
  private uniqueValues: Map<string, Set<unknown>> = new Map();

  /**
   * Store a record for a model
   */
  add(modelName: string, record: GeneratedRecord): void {
    if (!this.data.has(modelName)) {
      this.data.set(modelName, []);
    }
    this.data.get(modelName)!.push(record);
  }

  /**
   * Store multiple records for a model
   */
  addMany(modelName: string, records: GeneratedRecord[]): void {
    if (!this.data.has(modelName)) {
      this.data.set(modelName, []);
    }
    this.data.get(modelName)!.push(...records);
  }

  /**
   * Get all records for a model
   */
  get(modelName: string): GeneratedRecord[] {
    return this.data.get(modelName) || [];
  }

  /**
   * Get a random record from a model
   */
  getRandom(modelName: string): GeneratedRecord | null {
    const records = this.get(modelName);
    if (records.length === 0) return null;
    return records[Math.floor(Math.random() * records.length)];
  }

  /**
   * Get a random ID from a model
   */
  getRandomId(modelName: string, idField: string = 'id'): unknown | null {
    const record = this.getRandom(modelName);
    return record?.[idField] ?? null;
  }

  /**
   * Get all data as a Map
   */
  getAll(): Map<string, GeneratedRecord[]> {
    return new Map(this.data);
  }

  /**
   * Get all data as a plain object
   */
  toObject(): Record<string, GeneratedRecord[]> {
    const result: Record<string, GeneratedRecord[]> = {};
    for (const [key, value] of this.data) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Track a unique value to prevent duplicates
   */
  trackUnique(key: string, value: unknown): boolean {
    if (!this.uniqueValues.has(key)) {
      this.uniqueValues.set(key, new Set());
    }

    const set = this.uniqueValues.get(key)!;
    if (set.has(value)) {
      return false; // Already exists
    }

    set.add(value);
    return true;
  }

  /**
   * Check if a unique value exists
   */
  hasUnique(key: string, value: unknown): boolean {
    return this.uniqueValues.get(key)?.has(value) ?? false;
  }

  /**
   * Get total record count
   */
  getTotalCount(): number {
    let total = 0;
    for (const records of this.data.values()) {
      total += records.length;
    }
    return total;
  }

  /**
   * Get record count per model
   */
  getCountPerModel(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [modelName, records] of this.data) {
      counts[modelName] = records.length;
    }
    return counts;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
    this.uniqueValues.clear();
  }

  /**
   * Validate referential integrity
   */
  validateIntegrity(
    modelName: string,
    foreignKey: string,
    referencedModel: string,
    referencedField: string = 'id'
  ): { valid: boolean; errors: string[] } {
    const records = this.get(modelName);
    const referencedRecords = this.get(referencedModel);
    const errors: string[] = [];

    // Build a set of valid reference values
    const validValues = new Set(
      referencedRecords.map((r) => r[referencedField])
    );

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const fkValue = record[foreignKey];

      // Skip null values for optional relations
      if (fkValue === null || fkValue === undefined) continue;

      if (!validValues.has(fkValue)) {
        errors.push(
          `${modelName}[${i}].${foreignKey} = ${fkValue} references non-existent ${referencedModel}.${referencedField}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
