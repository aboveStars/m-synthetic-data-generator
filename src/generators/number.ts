/**
 * Numeric field generators (Int, Float, BigInt, Decimal)
 */

import { faker } from '@faker-js/faker';
import { BaseGenerator } from './base.js';
import type { GenerationContext } from '../types.js';
import { randomInt, randomFloat } from '../utils/random.js';

/**
 * Integer generator
 */
export class IntGenerator extends BaseGenerator<number> {
  constructor() {
    super(['Int']);
  }

  generate(context: GenerationContext): number {
    const { currentField } = context;
    const fieldName = currentField.name.toLowerCase();

    // Smart detection based on field name
    if (this.isAgeField(fieldName)) {
      return randomInt(18, 80);
    }

    if (this.isQuantityField(fieldName)) {
      return randomInt(1, 100);
    }

    if (this.isYearField(fieldName)) {
      return randomInt(2000, new Date().getFullYear());
    }

    if (this.isCountField(fieldName)) {
      return randomInt(0, 1000);
    }

    if (this.isRatingField(fieldName)) {
      return randomInt(1, 5);
    }

    if (this.isOrderField(fieldName)) {
      return context.recordIndex + 1;
    }

    // Default: random positive integer
    return randomInt(1, 10000);
  }

  private isAgeField(name: string): boolean {
    return name === 'age';
  }

  private isQuantityField(name: string): boolean {
    return name.includes('quantity') || name.includes('qty') || name.includes('amount');
  }

  private isYearField(name: string): boolean {
    return name === 'year' || name.includes('year');
  }

  private isCountField(name: string): boolean {
    return name.includes('count') || name.includes('total');
  }

  private isRatingField(name: string): boolean {
    return name.includes('rating') || name.includes('score') || name.includes('stars');
  }

  private isOrderField(name: string): boolean {
    return name.includes('order') || name.includes('position') || name.includes('index');
  }
}

/**
 * Float generator for decimal numbers
 */
export class FloatGenerator extends BaseGenerator<number> {
  constructor() {
    super(['Float', 'Decimal']);
  }

  generate(context: GenerationContext): number {
    const { currentField } = context;
    const fieldName = currentField.name.toLowerCase();

    // Smart detection based on field name
    if (this.isPriceField(fieldName)) {
      return this.generatePrice();
    }

    if (this.isPercentageField(fieldName)) {
      return randomFloat(0, 100, 2);
    }

    if (this.isCoordinateField(fieldName)) {
      return this.generateCoordinate(fieldName);
    }

    // Default: random float
    return randomFloat(0, 1000, 2);
  }

  private isPriceField(name: string): boolean {
    return (
      name.includes('price') ||
      name.includes('cost') ||
      name.includes('total') ||
      name.includes('amount') ||
      name.includes('fee') ||
      name.includes('tax')
    );
  }

  private isPercentageField(name: string): boolean {
    return name.includes('percent') || name.includes('rate') || name.includes('ratio');
  }

  private isCoordinateField(name: string): boolean {
    return (
      name.includes('latitude') ||
      name.includes('lat') ||
      name.includes('longitude') ||
      name.includes('lng') ||
      name.includes('long')
    );
  }

  private generatePrice(): number {
    // Generate realistic price with common endings
    const basePrice = randomFloat(9.99, 999.99, 2);
    const endings = [0.99, 0.95, 0.00, 0.49, 0.50];
    const ending = faker.helpers.arrayElement(endings);

    return Number((Math.floor(basePrice) + ending).toFixed(2));
  }

  private generateCoordinate(fieldName: string): number {
    if (fieldName.includes('lat')) {
      return randomFloat(-90, 90, 6);
    }
    return randomFloat(-180, 180, 6);
  }
}

/**
 * BigInt generator
 */
export class BigIntGenerator extends BaseGenerator<bigint> {
  constructor() {
    super(['BigInt']);
  }

  generate(context: GenerationContext): bigint {
    const { currentField } = context;
    const fieldName = currentField.name.toLowerCase();

    // For IDs, generate sequential-ish bigints
    if (currentField.isId || fieldName === 'id') {
      return BigInt(context.recordIndex + 1);
    }

    // For timestamps, generate Unix timestamps
    if (fieldName.includes('timestamp')) {
      return BigInt(Date.now());
    }

    // Default: random bigint
    return BigInt(randomInt(1, 9999999999));
  }
}
