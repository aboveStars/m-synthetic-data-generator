/**
 * Integration Tests - Full generation pipeline
 */

import { describe, it, expect } from 'vitest';
import { parsePrismaSchema } from '../src/parser/prisma-parser.js';
import { Orchestrator } from '../src/engine/orchestrator.js';
import type { GenerationConfig } from '../src/types.js';

const testSchema = `
  enum Role {
    ADMIN
    USER
    GUEST
  }

  enum OrderStatus {
    PENDING
    PROCESSING
    COMPLETED
    CANCELLED
  }

  model User {
    id        String   @id @default(uuid())
    email     String   @unique
    name      String
    role      Role     @default(USER)
    createdAt DateTime @default(now())
    orders    Order[]
  }

  model Order {
    id        String      @id @default(uuid())
    userId    String
    status    OrderStatus @default(PENDING)
    total     Float
    items     Json
    createdAt DateTime    @default(now())
    user      User        @relation(fields: [userId], references: [id])
  }
`;

const defaultConfig: GenerationConfig = {
  schema: '',
  output: {
    format: 'json',
    path: './test-output.json',
    prettyPrint: true,
    includeStats: true,
  },
  counts: {
    User: 100,
  },
  distributions: {
    Order: {
      perParent: {
        values: [1, 2, 3, 5],
        weights: [0.4, 0.3, 0.2, 0.1],
      },
    },
  },
  dateRanges: {},
  fieldOverrides: {},
  privacy: {
    piiFieldPatterns: ['email', 'phone'],
    syntheticSuffix: '_test',
    clearlyFake: true,
    emailDomain: 'test.example.com',
  },
};

describe('Integration: Full Generation Pipeline', () => {
  it('should generate data for all models', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data, stats } = await orchestrator.generate();

    expect(data.has('User')).toBe(true);
    expect(data.has('Order')).toBe(true);
    expect(data.get('User')?.length).toBe(100);
    expect(data.get('Order')?.length).toBeGreaterThan(0);
  });

  it('should maintain referential integrity', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data, stats } = await orchestrator.generate();

    // Get all user IDs
    const userIds = new Set(data.get('User')?.map(u => u.id));

    // Check that all order userIds reference valid users
    const orders = data.get('Order') || [];
    for (const order of orders) {
      expect(userIds.has(order.userId)).toBe(true);
    }

    expect(stats.referentialIntegrity).toBe('valid');
  });

  it('should generate unique emails', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data } = await orchestrator.generate();

    const emails = data.get('User')?.map(u => u.email) || [];
    const uniqueEmails = new Set(emails);

    expect(uniqueEmails.size).toBe(emails.length);
  });

  it('should generate synthetic (fake) emails', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data } = await orchestrator.generate();

    const users = data.get('User') || [];
    for (const user of users) {
      expect(user.email).toContain('_test');
      expect(user.email).toContain('@');
    }
  });

  it('should generate valid enum values', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data } = await orchestrator.generate();

    const validRoles = ['ADMIN', 'USER', 'GUEST'];
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

    const users = data.get('User') || [];
    for (const user of users) {
      expect(validRoles).toContain(user.role);
    }

    const orders = data.get('Order') || [];
    for (const order of orders) {
      expect(validStatuses).toContain(order.status);
    }
  });

  it('should generate valid JSON for items field', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data } = await orchestrator.generate();

    const orders = data.get('Order') || [];
    for (const order of orders) {
      const items = order.items as unknown[];
      expect(Array.isArray(items)).toBe(true);
      if (items.length > 0) {
        const firstItem = items[0] as Record<string, unknown>;
        expect(firstItem).toHaveProperty('product');
        expect(firstItem).toHaveProperty('qty');
      }
    }
  });

  it('should generate valid dates', async () => {
    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, defaultConfig);

    const { data } = await orchestrator.generate();

    const users = data.get('User') || [];
    for (const user of users) {
      expect(user.createdAt).toBeInstanceOf(Date);
    }
  });

  it('should complete generation within performance target', async () => {
    const largeConfig = {
      ...defaultConfig,
      counts: { User: 10000 },
    };

    const schema = parsePrismaSchema(testSchema);
    const orchestrator = new Orchestrator(schema, largeConfig);

    const startTime = Date.now();
    const { stats } = await orchestrator.generate();
    const duration = Date.now() - startTime;

    // Should complete 10k users in under 10 seconds
    expect(duration).toBeLessThan(10000);
    expect(stats.recordsPerModel['User']).toBe(10000);

    console.log(`Performance: ${stats.totalRecords} records in ${duration}ms`);
  });
});

describe('Integration: Edge Cases', () => {
  it('should handle empty schema gracefully', async () => {
    const emptySchema = parsePrismaSchema(`
      model Empty {
        id String @id
      }
    `);

    const orchestrator = new Orchestrator(emptySchema, {
      ...defaultConfig,
      counts: { Empty: 10 },
    });

    const { data } = await orchestrator.generate();
    expect(data.get('Empty')?.length).toBe(10);
  });

  it('should handle optional relations', async () => {
    const schema = parsePrismaSchema(`
      model User {
        id        String  @id
        referrerId String?
        referrer  User?   @relation("Referrals", fields: [referrerId], references: [id])
        referrals User[]  @relation("Referrals")
      }
    `);

    const orchestrator = new Orchestrator(schema, {
      ...defaultConfig,
      counts: { User: 50 },
    });

    const { data, stats } = await orchestrator.generate();

    expect(data.get('User')?.length).toBe(50);
    expect(stats.referentialIntegrity).toBe('valid');
  });
});
