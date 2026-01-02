/**
 * Prisma Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parsePrismaSchema } from '../src/parser/prisma-parser.js';

describe('PrismaParser', () => {
  it('should parse a simple model', () => {
    const schema = `
      model User {
        id    String @id @default(uuid())
        email String @unique
        name  String
      }
    `;

    const result = parsePrismaSchema(schema);

    expect(result.models).toHaveLength(1);
    expect(result.models[0].name).toBe('User');
    expect(result.models[0].fields).toHaveLength(3);
  });

  it('should parse field attributes correctly', () => {
    const schema = `
      model User {
        id        String   @id @default(uuid())
        email     String   @unique
        name      String?
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }
    `;

    const result = parsePrismaSchema(schema);
    const fields = result.models[0].fields;

    // Check id field
    const idField = fields.find(f => f.name === 'id');
    expect(idField?.isId).toBe(true);
    expect(idField?.default?.type).toBe('function');
    expect(idField?.default?.value).toContain('uuid');

    // Check email field
    const emailField = fields.find(f => f.name === 'email');
    expect(emailField?.isUnique).toBe(true);

    // Check name field (optional)
    const nameField = fields.find(f => f.name === 'name');
    expect(nameField?.isRequired).toBe(false);

    // Check updatedAt field
    const updatedAtField = fields.find(f => f.name === 'updatedAt');
    expect(updatedAtField?.isUpdatedAt).toBe(true);
  });

  it('should parse enums', () => {
    const schema = `
      enum Role {
        ADMIN
        USER
        GUEST
      }

      model User {
        id   String @id
        role Role   @default(USER)
      }
    `;

    const result = parsePrismaSchema(schema);

    expect(result.enums).toHaveLength(1);
    expect(result.enums[0].name).toBe('Role');
    expect(result.enums[0].values).toEqual(['ADMIN', 'USER', 'GUEST']);

    // Check that field has enum values
    const roleField = result.models[0].fields.find(f => f.name === 'role');
    expect(roleField?.enumValues).toEqual(['ADMIN', 'USER', 'GUEST']);
  });

  it('should parse relations', () => {
    const schema = `
      model User {
        id     String  @id
        orders Order[]
      }

      model Order {
        id     String @id
        userId String
        user   User   @relation(fields: [userId], references: [id])
      }
    `;

    const result = parsePrismaSchema(schema);

    // Check Order model relations
    const orderModel = result.models.find(m => m.name === 'Order');
    expect(orderModel?.relations).toHaveLength(1);
    expect(orderModel?.relations[0].toModel).toBe('User');
    expect(orderModel?.relations[0].foreignKey).toBe('userId');
  });

  it('should parse list fields', () => {
    const schema = `
      model User {
        id    String   @id
        tags  String[]
      }
    `;

    const result = parsePrismaSchema(schema);
    const tagsField = result.models[0].fields.find(f => f.name === 'tags');

    expect(tagsField?.isList).toBe(true);
  });

  it('should handle multiple models', () => {
    const schema = `
      model User {
        id   String @id
        name String
      }

      model Post {
        id    String @id
        title String
      }

      model Comment {
        id      String @id
        content String
      }
    `;

    const result = parsePrismaSchema(schema);
    expect(result.models).toHaveLength(3);
    expect(result.models.map(m => m.name)).toEqual(['User', 'Post', 'Comment']);
  });
});
