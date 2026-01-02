/**
 * DateTime field generator with distribution support
 */

import { faker } from '@faker-js/faker';
import { BaseGenerator } from './base.js';
import type { GenerationContext } from '../types.js';
import { weightedDate } from '../utils/random.js';

/**
 * DateTime generator with smart distribution support
 */
export class DateTimeGenerator extends BaseGenerator<Date> {
  constructor() {
    super(['DateTime']);
  }

  generate(context: GenerationContext): Date {
    const { currentField, config } = context;
    const fieldName = currentField.name.toLowerCase();

    // Check for @updatedAt attribute
    if (currentField.isUpdatedAt) {
      return new Date();
    }

    // Check for field-specific date range configuration
    const fieldPath = `${context.currentModel.name}.${currentField.name}`;
    const dateRangeConfig = config.dateRanges?.[fieldPath];

    if (dateRangeConfig) {
      return weightedDate(
        new Date(dateRangeConfig.from),
        new Date(dateRangeConfig.to),
        dateRangeConfig.distribution || 'uniform'
      );
    }

    // Smart detection based on field name
    if (this.isCreatedAtField(fieldName)) {
      return this.generateCreatedAt();
    }

    if (this.isBirthDateField(fieldName)) {
      return this.generateBirthDate();
    }

    if (this.isExpirationField(fieldName)) {
      return this.generateExpirationDate();
    }

    if (this.isScheduledField(fieldName)) {
      return this.generateScheduledDate();
    }

    // Default: random date in the past year
    return faker.date.past({ years: 1 });
  }

  private isCreatedAtField(name: string): boolean {
    return (
      name === 'createdat' ||
      name === 'created_at' ||
      name === 'createdon' ||
      name === 'created'
    );
  }

  private isBirthDateField(name: string): boolean {
    return (
      name.includes('birth') ||
      name.includes('dob') ||
      name === 'dateofbirth' ||
      name === 'date_of_birth'
    );
  }

  private isExpirationField(name: string): boolean {
    return (
      name.includes('expir') ||
      name.includes('expires') ||
      name.includes('validuntil') ||
      name.includes('valid_until')
    );
  }

  private isScheduledField(name: string): boolean {
    return (
      name.includes('scheduled') ||
      name.includes('start') ||
      name.includes('begin')
    );
  }

  private generateCreatedAt(): Date {
    // Most records created in last 6 months, biased towards recent
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    return weightedDate(sixMonthsAgo, now, 'recent-biased');
  }

  private generateBirthDate(): Date {
    // Generate age between 18-80
    const now = new Date();
    const minAge = 18;
    const maxAge = 80;

    const minDate = new Date(now.getFullYear() - maxAge, 0, 1);
    const maxDate = new Date(now.getFullYear() - minAge, 11, 31);

    return faker.date.between({ from: minDate, to: maxDate });
  }

  private generateExpirationDate(): Date {
    // Future date, 1 month to 2 years from now
    const now = new Date();
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const twoYears = new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000);

    return faker.date.between({ from: oneMonth, to: twoYears });
  }

  private generateScheduledDate(): Date {
    // Could be past or future, within +/- 1 year
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oneYearFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return faker.date.between({ from: oneYearAgo, to: oneYearFuture });
  }
}
