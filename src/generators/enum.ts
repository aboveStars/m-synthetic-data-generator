/**
 * Enum field generator
 */

import { faker } from '@faker-js/faker';
import { BaseGenerator } from './base.js';
import type { GenerationContext, Field } from '../types.js';
import { weightedRandom } from '../utils/random.js';

/**
 * Enum generator that handles enum fields with weighted distribution
 */
export class EnumGenerator extends BaseGenerator<string> {
  private enumTypes: Set<string> = new Set();

  constructor() {
    super([]);
  }

  /**
   * Register an enum type that this generator handles
   */
  registerEnumType(enumName: string): void {
    this.enumTypes.add(enumName);
  }

  canHandle(field: Field): boolean {
    // Can handle if field has enumValues or type is a registered enum
    return !!field.enumValues || this.enumTypes.has(field.type);
  }

  generate(context: GenerationContext): string {
    const { currentField, config } = context;
    const fieldName = currentField.name.toLowerCase();

    // Get enum values
    const enumValues = currentField.enumValues;

    if (!enumValues || enumValues.length === 0) {
      throw new Error(`No enum values found for field: ${currentField.name}`);
    }

    // Check for field-specific override
    const fieldPath = `${context.currentModel.name}.${currentField.name}`;
    const override = config.fieldOverrides?.[context.currentModel.name]?.[currentField.name];

    if (override?.weights && override.weights.length === enumValues.length) {
      return weightedRandom(enumValues, override.weights);
    }

    // Smart weighting based on common patterns
    if (this.isStatusField(fieldName, enumValues)) {
      return this.generateStatus(enumValues);
    }

    if (this.isRoleField(fieldName, enumValues)) {
      return this.generateRole(enumValues);
    }

    // Default: uniform distribution
    return faker.helpers.arrayElement(enumValues);
  }

  private isStatusField(name: string, values: string[]): boolean {
    const statusKeywords = ['status', 'state'];
    const statusValues = ['active', 'pending', 'completed', 'cancelled', 'draft', 'published'];

    return (
      statusKeywords.some((k) => name.includes(k)) ||
      values.some((v) => statusValues.includes(v.toLowerCase()))
    );
  }

  private isRoleField(name: string, values: string[]): boolean {
    const roleKeywords = ['role', 'type', 'tier'];
    const roleValues = ['admin', 'user', 'guest', 'moderator', 'owner'];

    return (
      roleKeywords.some((k) => name.includes(k)) ||
      values.some((v) => roleValues.includes(v.toLowerCase()))
    );
  }

  private generateStatus(values: string[]): string {
    // Common status distribution: mostly active/completed
    const normalizedValues = values.map((v) => v.toLowerCase());

    // Build weights based on common patterns
    const weights = values.map((_, i) => {
      const val = normalizedValues[i];
      if (['active', 'completed', 'approved', 'published'].includes(val)) return 0.4;
      if (['pending', 'processing', 'draft'].includes(val)) return 0.3;
      if (['cancelled', 'rejected', 'failed'].includes(val)) return 0.1;
      return 0.2;
    });

    // Normalize weights
    const total = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map((w) => w / total);

    return weightedRandom(values, normalizedWeights);
  }

  private generateRole(values: string[]): string {
    // Most users are regular users, few are admins
    const normalizedValues = values.map((v) => v.toLowerCase());

    const weights = values.map((_, i) => {
      const val = normalizedValues[i];
      if (['admin', 'superadmin', 'owner'].includes(val)) return 0.05;
      if (['moderator', 'manager', 'editor'].includes(val)) return 0.15;
      if (['user', 'member', 'viewer'].includes(val)) return 0.7;
      if (['guest', 'anonymous'].includes(val)) return 0.1;
      return 0.2;
    });

    // Normalize weights
    const total = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map((w) => w / total);

    return weightedRandom(values, normalizedWeights);
  }
}
