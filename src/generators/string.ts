/**
 * String field generators with smart PII-safe data generation
 */

import { faker } from '@faker-js/faker';
import { BaseGenerator } from './base.js';
import type { GenerationContext, Field } from '../types.js';

/**
 * Smart string generator that detects field purpose and generates appropriate data
 */
export class StringGenerator extends BaseGenerator<string> {
  constructor() {
    super(['String']);
  }

  generate(context: GenerationContext): string {
    const { currentField, config } = context;
    const fieldName = currentField.name.toLowerCase();

    // Smart detection based on field name
    if (this.isEmailField(fieldName)) {
      return this.generateEmail(context);
    }

    if (this.isNameField(fieldName)) {
      return this.generateName(fieldName);
    }

    if (this.isPhoneField(fieldName)) {
      return this.generatePhone();
    }

    if (this.isAddressField(fieldName)) {
      return this.generateAddress(fieldName);
    }

    if (this.isUrlField(fieldName)) {
      return this.generateUrl(fieldName);
    }

    if (this.isIdField(currentField)) {
      return this.generateStringId(context);
    }

    if (this.isDescriptionField(fieldName)) {
      return this.generateDescription();
    }

    if (this.isTitleField(fieldName)) {
      return this.generateTitle();
    }

    // Default: generate random text
    return faker.lorem.sentence();
  }

  // ============================================
  // Field Detection Methods
  // ============================================

  private isEmailField(name: string): boolean {
    return name.includes('email') || name.includes('mail');
  }

  private isNameField(name: string): boolean {
    return (
      name === 'name' ||
      name === 'fullname' ||
      name.includes('firstname') ||
      name.includes('lastname') ||
      name.includes('username') ||
      name === 'first_name' ||
      name === 'last_name'
    );
  }

  private isPhoneField(name: string): boolean {
    return name.includes('phone') || name.includes('mobile') || name.includes('tel');
  }

  private isAddressField(name: string): boolean {
    return (
      name.includes('address') ||
      name.includes('street') ||
      name.includes('city') ||
      name.includes('state') ||
      name.includes('country') ||
      name.includes('zip') ||
      name.includes('postal')
    );
  }

  private isUrlField(name: string): boolean {
    return (
      name.includes('url') ||
      name.includes('link') ||
      name.includes('website') ||
      name.includes('avatar') ||
      name.includes('image') ||
      name.includes('photo')
    );
  }

  private isIdField(field: Field): boolean {
    return field.isId || field.name.toLowerCase() === 'id';
  }

  private isDescriptionField(name: string): boolean {
    return (
      name.includes('description') ||
      name.includes('bio') ||
      name.includes('about') ||
      name.includes('content') ||
      name.includes('summary')
    );
  }

  private isTitleField(name: string): boolean {
    return name.includes('title') || name.includes('headline') || name.includes('subject');
  }

  // ============================================
  // Generator Methods
  // ============================================

  private generateEmail(context: GenerationContext): string {
    const firstName = faker.person.firstName().toLowerCase();
    const lastName = faker.person.lastName().toLowerCase();
    const domain = context.config.privacy?.emailDomain || 'example.com';
    const suffix = context.config.privacy?.syntheticSuffix || '_test';

    return `${firstName}.${lastName}${suffix}@${domain}`;
  }

  private generateName(fieldName: string): string {
    if (fieldName.includes('firstname') || fieldName === 'first_name') {
      return faker.person.firstName();
    }
    if (fieldName.includes('lastname') || fieldName === 'last_name') {
      return faker.person.lastName();
    }
    if (fieldName.includes('username')) {
      return faker.internet.username() + '_synthetic';
    }
    return faker.person.fullName();
  }

  private generatePhone(): string {
    // Generate clearly fake phone number
    return `555-${faker.string.numeric(3)}-${faker.string.numeric(4)}`;
  }

  private generateAddress(fieldName: string): string {
    if (fieldName.includes('street')) {
      return faker.location.streetAddress();
    }
    if (fieldName.includes('city')) {
      return faker.location.city();
    }
    if (fieldName.includes('state') || fieldName.includes('province')) {
      return faker.location.state();
    }
    if (fieldName.includes('country')) {
      return faker.location.country();
    }
    if (fieldName.includes('zip') || fieldName.includes('postal')) {
      return faker.location.zipCode();
    }
    return faker.location.streetAddress(true);
  }

  private generateUrl(fieldName: string): string {
    if (fieldName.includes('avatar') || fieldName.includes('image') || fieldName.includes('photo')) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${faker.string.alphanumeric(8)}`;
    }
    return faker.internet.url();
  }

  private generateStringId(context: GenerationContext): string {
    const modelName = context.currentModel.name.toLowerCase();
    const prefix = modelName.substring(0, 3);
    const index = context.recordIndex;

    // Check if default is uuid
    const defaultVal = context.currentField.default;
    if (defaultVal?.value?.includes('uuid')) {
      return `${prefix}_synthetic_${faker.string.uuid()}`;
    }

    return `${prefix}_syn_${String(index + 1).padStart(6, '0')}`;
  }

  private generateDescription(): string {
    return faker.lorem.paragraph();
  }

  private generateTitle(): string {
    return faker.lorem.sentence({ min: 3, max: 8 });
  }
}
