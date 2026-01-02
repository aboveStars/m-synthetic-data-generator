/**
 * Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { StringGenerator } from '../src/generators/string.js';
import { IntGenerator, FloatGenerator } from '../src/generators/number.js';
import { DateTimeGenerator } from '../src/generators/datetime.js';
import { BooleanGenerator } from '../src/generators/boolean.js';
import { JsonGenerator } from '../src/generators/json.js';
import type { GenerationContext, Field, Model } from '../src/types.js';

// Helper to create a minimal context
function createContext(fieldName: string, fieldType: string, overrides?: Partial<Field>): GenerationContext {
  const field: Field = {
    name: fieldName,
    type: fieldType,
    isRequired: true,
    isUnique: false,
    isId: false,
    isList: false,
    isUpdatedAt: false,
    attributes: [],
    ...overrides,
  };

  const model: Model = {
    name: 'TestModel',
    fields: [field],
    relations: [],
    attributes: [],
  };

  return {
    config: {
      schema: '',
      output: { format: 'json', path: '', prettyPrint: true, includeStats: true },
      counts: {},
      distributions: {},
      dateRanges: {},
      fieldOverrides: {},
      privacy: {
        piiFieldPatterns: [],
        syntheticSuffix: '_test',
        clearlyFake: true,
        emailDomain: 'example.com',
      },
    },
    schema: { models: [model], enums: [] },
    currentModel: model,
    currentField: field,
    generatedData: new Map(),
    recordIndex: 0,
  };
}

describe('StringGenerator', () => {
  const generator = new StringGenerator();

  it('should generate email with synthetic suffix', () => {
    const ctx = createContext('email', 'String');
    const email = generator.generate(ctx);

    expect(email).toContain('@');
    expect(email).toContain('_test');
    expect(email).toContain('example.com');
  });

  it('should generate full name for name field', () => {
    const ctx = createContext('name', 'String');
    const name = generator.generate(ctx);

    expect(name).toBeTruthy();
    expect(name.split(' ').length).toBeGreaterThanOrEqual(1);
  });

  it('should generate firstName for firstName field', () => {
    const ctx = createContext('firstName', 'String');
    const firstName = generator.generate(ctx);

    expect(firstName).toBeTruthy();
    expect(firstName.split(' ').length).toBe(1);
  });

  it('should generate fake phone number', () => {
    const ctx = createContext('phone', 'String');
    const phone = generator.generate(ctx);

    expect(phone).toContain('555'); // Clearly fake prefix
  });

  it('should generate URL for avatarUrl field', () => {
    const ctx = createContext('avatarUrl', 'String');
    const url = generator.generate(ctx);

    expect(url).toContain('https://');
  });
});

describe('IntGenerator', () => {
  const generator = new IntGenerator();

  it('should generate age in realistic range', () => {
    const ctx = createContext('age', 'Int');

    for (let i = 0; i < 100; i++) {
      const age = generator.generate(ctx);
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(80);
    }
  });

  it('should generate quantity in reasonable range', () => {
    const ctx = createContext('quantity', 'Int');

    for (let i = 0; i < 100; i++) {
      const qty = generator.generate(ctx);
      expect(qty).toBeGreaterThanOrEqual(1);
      expect(qty).toBeLessThanOrEqual(100);
    }
  });

  it('should generate rating between 1-5', () => {
    const ctx = createContext('rating', 'Int');

    for (let i = 0; i < 100; i++) {
      const rating = generator.generate(ctx);
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(5);
    }
  });
});

describe('FloatGenerator', () => {
  const generator = new FloatGenerator();

  it('should generate price with common endings', () => {
    const ctx = createContext('price', 'Float');

    for (let i = 0; i < 50; i++) {
      const price = generator.generate(ctx);
      expect(price).toBeGreaterThan(0);

      // Check it has max 2 decimal places
      const decimals = price.toString().split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('should generate percentage between 0-100', () => {
    const ctx = createContext('percentage', 'Float');

    for (let i = 0; i < 100; i++) {
      const pct = generator.generate(ctx);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it('should generate valid latitude', () => {
    const ctx = createContext('latitude', 'Float');

    for (let i = 0; i < 50; i++) {
      const lat = generator.generate(ctx);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
  });
});

describe('DateTimeGenerator', () => {
  const generator = new DateTimeGenerator();

  it('should generate date in the past for createdAt', () => {
    const ctx = createContext('createdAt', 'DateTime');
    const date = generator.generate(ctx);

    expect(date).toBeInstanceOf(Date);
    expect(date.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should generate birth date for adult', () => {
    const ctx = createContext('birthDate', 'DateTime');
    const date = generator.generate(ctx);

    const now = new Date();
    const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);

    expect(age).toBeGreaterThanOrEqual(18);
    expect(age).toBeLessThanOrEqual(80);
  });

  it('should generate future date for expiration', () => {
    const ctx = createContext('expiresAt', 'DateTime');
    const date = generator.generate(ctx);

    expect(date.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('BooleanGenerator', () => {
  const generator = new BooleanGenerator();

  it('should generate mostly true for isActive', () => {
    const ctx = createContext('isActive', 'Boolean');
    let trueCount = 0;

    for (let i = 0; i < 1000; i++) {
      if (generator.generate(ctx)) trueCount++;
    }

    // Should be roughly 85% true
    expect(trueCount).toBeGreaterThan(750);
    expect(trueCount).toBeLessThan(950);
  });

  it('should generate mostly false for isDeleted', () => {
    const ctx = createContext('isDeleted', 'Boolean');
    let falseCount = 0;

    for (let i = 0; i < 1000; i++) {
      if (!generator.generate(ctx)) falseCount++;
    }

    // Should be roughly 95% false
    expect(falseCount).toBeGreaterThan(900);
  });
});

describe('JsonGenerator', () => {
  const generator = new JsonGenerator();

  it('should generate order items array', () => {
    const ctx = createContext('items', 'Json');
    const items = generator.generate(ctx) as object[];

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('product');
    expect(items[0]).toHaveProperty('qty');
  });

  it('should generate metadata object', () => {
    const ctx = createContext('metadata', 'Json');
    const metadata = generator.generate(ctx) as object;

    expect(typeof metadata).toBe('object');
    expect(metadata).toHaveProperty('source');
  });

  it('should generate settings object', () => {
    const ctx = createContext('settings', 'Json');
    const settings = generator.generate(ctx) as object;

    expect(typeof settings).toBe('object');
    expect(settings).toHaveProperty('theme');
    expect(settings).toHaveProperty('language');
  });
});
