/**
 * JSON field generator for complex structured data
 */

import { faker } from '@faker-js/faker';
import { BaseGenerator } from './base.js';
import type { GenerationContext } from '../types.js';
import { randomInt, randomFloat } from '../utils/random.js';

/**
 * JSON generator that creates realistic structured data
 */
export class JsonGenerator extends BaseGenerator<object | unknown[]> {
  constructor() {
    super(['Json']);
  }

  generate(context: GenerationContext): object | unknown[] {
    const { currentField } = context;
    const fieldName = currentField.name.toLowerCase();

    // Smart detection based on field name
    if (this.isItemsField(fieldName)) {
      return this.generateOrderItems();
    }

    if (this.isMetadataField(fieldName)) {
      return this.generateMetadata();
    }

    if (this.isSettingsField(fieldName)) {
      return this.generateSettings();
    }

    if (this.isTagsField(fieldName)) {
      return this.generateTags();
    }

    if (this.isAddressField(fieldName)) {
      return this.generateAddressObject();
    }

    if (this.isPreferencesField(fieldName)) {
      return this.generatePreferences();
    }

    // Default: generic metadata object
    return this.generateMetadata();
  }

  private isItemsField(name: string): boolean {
    return name === 'items' || name.includes('lineitem') || name.includes('orderitem');
  }

  private isMetadataField(name: string): boolean {
    return name === 'metadata' || name === 'meta' || name === 'data';
  }

  private isSettingsField(name: string): boolean {
    return name === 'settings' || name === 'config' || name === 'options';
  }

  private isTagsField(name: string): boolean {
    return name === 'tags' || name === 'labels' || name === 'categories';
  }

  private isAddressField(name: string): boolean {
    return name === 'address' || name === 'shippingaddress' || name === 'billingaddress';
  }

  private isPreferencesField(name: string): boolean {
    return name === 'preferences' || name === 'prefs' || name === 'notifications';
  }

  private generateOrderItems(): object[] {
    const itemCount = randomInt(1, 5);
    const items: object[] = [];

    const products = [
      { name: 'Pro Plan', basePrice: 29.99 },
      { name: 'Enterprise Plan', basePrice: 99.99 },
      { name: 'Basic Add-on', basePrice: 9.99 },
      { name: 'Premium Support', basePrice: 49.99 },
      { name: 'Extra Storage', basePrice: 14.99 },
      { name: 'API Access', basePrice: 39.99 },
      { name: 'Team License', basePrice: 79.99 },
    ];

    for (let i = 0; i < itemCount; i++) {
      const product = faker.helpers.arrayElement(products);
      const qty = randomInt(1, 3);

      items.push({
        product: product.name,
        qty,
        unitPrice: product.basePrice,
        total: randomFloat(product.basePrice * qty * 0.9, product.basePrice * qty * 1.1, 2),
      });
    }

    return items;
  }

  private generateMetadata(): object {
    return {
      source: faker.helpers.arrayElement(['web', 'mobile', 'api', 'import']),
      version: faker.system.semver(),
      createdBy: faker.internet.username() + '_synthetic',
      tags: this.generateTags(),
    };
  }

  private generateSettings(): object {
    return {
      theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
      language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'ja']),
      timezone: faker.location.timeZone(),
      notifications: {
        email: faker.datatype.boolean(),
        push: faker.datatype.boolean(),
        sms: faker.datatype.boolean(),
      },
      features: {
        beta: faker.datatype.boolean(),
        analytics: faker.datatype.boolean(),
      },
    };
  }

  private generateTags(): string[] {
    const possibleTags = [
      'important',
      'urgent',
      'review',
      'approved',
      'pending',
      'archived',
      'featured',
      'draft',
      'published',
      'internal',
    ];

    const count = randomInt(0, 4);
    return faker.helpers.arrayElements(possibleTags, count);
  }

  private generateAddressObject(): object {
    return {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      postalCode: faker.location.zipCode(),
      country: faker.location.country(),
    };
  }

  private generatePreferences(): object {
    return {
      newsletter: faker.datatype.boolean(),
      marketing: faker.datatype.boolean(),
      productUpdates: faker.datatype.boolean(),
      frequency: faker.helpers.arrayElement(['daily', 'weekly', 'monthly', 'never']),
    };
  }
}
