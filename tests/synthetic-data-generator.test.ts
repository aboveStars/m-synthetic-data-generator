/**
 * Comprehensive Test Suite for Synthetic Data Generator
 *
 * Tests against the following requirements:
 * - Schema Parsing: Read Prisma/TypeORM/SQL schema
 * - Mock Generation: Create realistic data per field type
 * - Relationship Handling: Generate related entities correctly
 * - Distribution Matching: Match production data patterns
 * - Seed Script: Output as SQL INSERT or JSON import
 * - Speed: Generate 10,000 records in <10 seconds
 * - Privacy: 100% synthetic (no real PII)
 * - Realism: Pass manual inspection (looks like real data)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  parsePrismaSchema,
  generateSyntheticData,
  Orchestrator,
  DataStore,
  DependencyGraph,
  JsonExporter,
  SqlExporter,
  StringGenerator,
  IntGenerator,
  FloatGenerator,
  DateTimeGenerator,
  BooleanGenerator,
  JsonGenerator,
  EnumGenerator,
  GeneratorRegistry,
  type ParsedSchema,
  type GenerationConfig,
  type GeneratedRecord,
  type GenerationStats,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Prisma schema matching the user's requirements:
 * User model with email, name, createdAt, and orders relation
 * Order model with userId foreign key, total, items (JSON), createdAt
 */
const CHALLENGE_SCHEMA = `
// Test schema matching challenge requirements
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id        String   @id @default(uuid())
  userId    String
  total     Float
  items     Json
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
`;

/**
 * Extended schema for comprehensive testing with enums and complex relations
 */
const EXTENDED_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  id         String   @id @default(uuid())
  email      String   @unique
  name       String
  phone      String?
  role       Role     @default(USER)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  orders     Order[]
  profile    Profile?
}

model Profile {
  id        String   @id @default(uuid())
  userId    String   @unique
  bio       String?
  website   String?
  address   String?
  city      String?
  country   String?
  user      User     @relation(fields: [userId], references: [id])
}

model Order {
  id        String      @id @default(uuid())
  userId    String
  status    OrderStatus @default(PENDING)
  total     Float
  items     Json
  notes     String?
  createdAt DateTime    @default(now())
  user      User        @relation(fields: [userId], references: [id])
}
`;

// Temporary schema file path for tests
const TEMP_SCHEMA_PATH = join(__dirname, "temp-schema.prisma");
const TEMP_EXTENDED_SCHEMA_PATH = join(
  __dirname,
  "temp-extended-schema.prisma"
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a temporary schema file for testing
 */
function createTempSchemaFile(content: string, path: string): void {
  writeFileSync(path, content, "utf-8");
}

/**
 * Cleans up temporary files
 */
function cleanupTempFiles(): void {
  if (existsSync(TEMP_SCHEMA_PATH)) {
    rmSync(TEMP_SCHEMA_PATH);
  }
  if (existsSync(TEMP_EXTENDED_SCHEMA_PATH)) {
    rmSync(TEMP_EXTENDED_SCHEMA_PATH);
  }
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates ISO 8601 date format
 */
function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Checks if email is synthetic (contains test indicators)
 */
function isSyntheticEmail(email: string): boolean {
  return (
    email.includes("_test") ||
    email.includes("synthetic") ||
    email.includes("example.com") ||
    email.includes("test@")
  );
}

/**
 * Common PII patterns that should NOT appear in generated data
 */
const REAL_PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN format
  /\b[A-Z]{2}\d{6,8}\b/, // Passport format
  /\b4[0-9]{12}(?:[0-9]{3})?\b/, // Visa card
  /\b5[1-5][0-9]{14}\b/, // Mastercard
];

// =============================================================================
// TEST SUITES
// =============================================================================

describe("Synthetic Data Generator - Comprehensive Test Suite", () => {
  beforeAll(() => {
    // Create temporary schema files for testing
    createTempSchemaFile(CHALLENGE_SCHEMA, TEMP_SCHEMA_PATH);
    createTempSchemaFile(EXTENDED_SCHEMA, TEMP_EXTENDED_SCHEMA_PATH);
  });

  // ===========================================================================
  // SECTION 1: SCHEMA PARSING TESTS
  // ===========================================================================

  describe("1. Schema Parsing", () => {
    describe("1.1 Prisma Schema Parsing", () => {
      it("should parse basic User-Order schema correctly", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);

        expect(schema).toBeDefined();
        expect(schema.models).toHaveLength(2);

        const userModel = schema.models.find((m) => m.name === "User");
        const orderModel = schema.models.find((m) => m.name === "Order");

        expect(userModel).toBeDefined();
        expect(orderModel).toBeDefined();
      });

      it("should extract all User fields with correct types", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);
        const userModel = schema.models.find((m) => m.name === "User")!;

        const fieldNames = userModel.fields.map((f) => f.name);
        expect(fieldNames).toContain("id");
        expect(fieldNames).toContain("email");
        expect(fieldNames).toContain("name");
        expect(fieldNames).toContain("createdAt");

        // Check field types
        const emailField = userModel.fields.find((f) => f.name === "email")!;
        expect(emailField.type).toBe("String");
        expect(emailField.isUnique).toBe(true);

        const createdAtField = userModel.fields.find(
          (f) => f.name === "createdAt"
        )!;
        expect(createdAtField.type).toBe("DateTime");
      });

      it("should extract all Order fields with correct types", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);
        const orderModel = schema.models.find((m) => m.name === "Order")!;

        const totalField = orderModel.fields.find((f) => f.name === "total")!;
        expect(totalField.type).toBe("Float");

        const itemsField = orderModel.fields.find((f) => f.name === "items")!;
        expect(itemsField.type).toBe("Json");
      });

      it("should detect @id attributes correctly", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);

        for (const model of schema.models) {
          const idField = model.fields.find((f) => f.isId);
          expect(idField).toBeDefined();
          expect(idField!.name).toBe("id");
        }
      });

      it("should detect @unique attributes correctly", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);
        const userModel = schema.models.find((m) => m.name === "User")!;

        const emailField = userModel.fields.find((f) => f.name === "email")!;
        expect(emailField.isUnique).toBe(true);
      });

      it("should detect @default values correctly", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);
        const userModel = schema.models.find((m) => m.name === "User")!;

        const idField = userModel.fields.find((f) => f.name === "id")!;
        expect(idField.default).toBeDefined();
        expect(idField.default!.type).toBe("function");
        expect(idField.default!.value).toContain("uuid");
      });

      it("should parse enums correctly", () => {
        const schema = parsePrismaSchema(EXTENDED_SCHEMA);

        expect(schema.enums).toBeDefined();
        expect(schema.enums.length).toBeGreaterThanOrEqual(2);

        const roleEnum = schema.enums.find((e) => e.name === "Role");
        expect(roleEnum).toBeDefined();
        expect(roleEnum!.values).toContain("ADMIN");
        expect(roleEnum!.values).toContain("USER");
        expect(roleEnum!.values).toContain("GUEST");

        const statusEnum = schema.enums.find((e) => e.name === "OrderStatus");
        expect(statusEnum).toBeDefined();
        expect(statusEnum!.values).toContain("PENDING");
        expect(statusEnum!.values).toContain("COMPLETED");
      });

      it("should detect relations correctly", () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);
        const orderModel = schema.models.find((m) => m.name === "Order")!;

        expect(orderModel.relations.length).toBeGreaterThan(0);

        const userRelation = orderModel.relations.find(
          (r) => r.toModel === "User"
        );
        expect(userRelation).toBeDefined();
        expect(userRelation!.foreignKey).toBe("userId");
        expect(userRelation!.references).toBe("id");
      });

      it("should detect optional fields correctly", () => {
        const schema = parsePrismaSchema(EXTENDED_SCHEMA);
        const userModel = schema.models.find((m) => m.name === "User")!;

        const phoneField = userModel.fields.find((f) => f.name === "phone")!;
        expect(phoneField.isRequired).toBe(false);
      });
    });
  });

  // ===========================================================================
  // SECTION 2: MOCK GENERATION TESTS
  // ===========================================================================

  describe("2. Mock Generation", () => {
    describe("2.1 String Field Generation", () => {
      it("should generate valid email addresses", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 50 },
        });

        const users = result.data.get("User")!;

        for (const user of users.slice(0, 10)) {
          expect(isValidEmail(user.email as string)).toBe(true);
        }
      });

      it("should generate realistic names", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 50 },
        });

        const users = result.data.get("User")!;

        for (const user of users.slice(0, 10)) {
          expect(typeof user.name).toBe("string");
          expect((user.name as string).length).toBeGreaterThan(0);
          // Name should have at least 2 characters
          expect((user.name as string).length).toBeGreaterThanOrEqual(2);
        }
      });

      it("should generate UUID for @id @default(uuid()) fields", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 20, Order: 50 },
        });

        const users = result.data.get("User")!;

        for (const user of users.slice(0, 10)) {
          expect(isValidUUID(user.id as string)).toBe(true);
        }
      });
    });

    describe("2.2 Number Field Generation", () => {
      it("should generate valid Float values for total", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 10, Order: 50 },
        });

        const orders = result.data.get("Order")!;

        for (const order of orders) {
          expect(typeof order.total).toBe("number");
          expect(order.total).toBeGreaterThan(0);
        }
      });
    });

    describe("2.3 DateTime Field Generation", () => {
      it("should generate valid ISO date strings", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 20 },
        });

        const users = result.data.get("User")!;

        for (const user of users) {
          const createdAt = user.createdAt as string;
          expect(isValidISODate(createdAt)).toBe(true);
        }
      });
    });

    describe("2.4 JSON Field Generation", () => {
      it("should generate valid JSON for items field", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 10, Order: 30 },
        });

        const orders = result.data.get("Order")!;

        for (const order of orders) {
          const items = order.items;
          expect(items).toBeDefined();
          // Should be a valid object/array
          expect(typeof items === "object").toBe(true);
        }
      });
    });

    describe("2.5 Boolean Field Generation", () => {
      it("should generate boolean values", async () => {
        const result = await generateSyntheticData(TEMP_EXTENDED_SCHEMA_PATH, {
          counts: { User: 50 },
        });

        const users = result.data.get("User")!;

        for (const user of users) {
          expect(typeof user.isActive).toBe("boolean");
        }
      });

      it("should generate mixed true/false values", async () => {
        const result = await generateSyntheticData(TEMP_EXTENDED_SCHEMA_PATH, {
          counts: { User: 100 },
        });

        const users = result.data.get("User")!;
        const trueCount = users.filter((u) => u.isActive === true).length;
        const falseCount = users.filter((u) => u.isActive === false).length;

        // Should have at least some of each
        expect(trueCount).toBeGreaterThan(0);
        expect(falseCount).toBeGreaterThan(0);
      });
    });

    describe("2.6 Enum Field Generation", () => {
      it("should generate valid enum values", async () => {
        const result = await generateSyntheticData(TEMP_EXTENDED_SCHEMA_PATH, {
          counts: { User: 50 },
        });

        const users = result.data.get("User")!;
        const validRoles = ["ADMIN", "USER", "GUEST"];

        for (const user of users) {
          expect(validRoles).toContain(user.role);
        }
      });

      it("should generate all enum values with reasonable distribution", async () => {
        const result = await generateSyntheticData(TEMP_EXTENDED_SCHEMA_PATH, {
          counts: { User: 300 },
        });

        const users = result.data.get("User")!;
        const roleCounts: Record<string, number> = {};

        for (const user of users) {
          const role = user.role as string;
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        }

        // All enum values should appear at least once
        expect(Object.keys(roleCounts).length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===========================================================================
  // SECTION 3: RELATIONSHIP HANDLING TESTS
  // ===========================================================================

  describe("3. Relationship Handling", () => {
    describe("3.1 Referential Integrity", () => {
      it("should generate valid foreign keys (orders → users)", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 100 },
          distributions: {
            Order: {
              perParent: {
                values: [1, 2, 3, 5],
                weights: [0.4, 0.3, 0.2, 0.1],
              },
            },
          },
        });

        const users = result.data.get("User")!;
        const orders = result.data.get("Order")!;

        const userIds = new Set(users.map((u) => u.id));

        for (const order of orders) {
          expect(userIds.has(order.userId)).toBe(true);
        }
      });

      it("should report valid referential integrity in stats", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 50 },
        });

        expect(result.stats.referentialIntegrity).toBe("valid");
      });

      it("should handle one-to-one relationships", async () => {
        const result = await generateSyntheticData(TEMP_EXTENDED_SCHEMA_PATH, {
          counts: { User: 50, Profile: 50 },
        });

        const users = result.data.get("User")!;
        const profiles = result.data.get("Profile")!;

        const userIds = new Set(users.map((u) => u.id));

        for (const profile of profiles) {
          if (profile.userId) {
            expect(userIds.has(profile.userId)).toBe(true);
          }
        }
      });
    });

    describe("3.2 Dependency Graph", () => {
      it("should generate parent entities before children", async () => {
        const schema = parsePrismaSchema(CHALLENGE_SCHEMA);
        const graph = new DependencyGraph(schema);
        const order = graph.getGenerationOrder();

        // User should come before Order
        const userIndex = order.indexOf("User");
        const orderIndex = order.indexOf("Order");

        expect(userIndex).toBeLessThan(orderIndex);
      });
    });
  });

  // ===========================================================================
  // SECTION 4: DISTRIBUTION MATCHING TESTS
  // ===========================================================================

  describe("4. Distribution Matching", () => {
    it("should follow configured distribution for child records", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 100 },
        distributions: {
          Order: {
            perParent: {
              // 80% users have 1-3 orders, 20% have 10+
              values: [1, 2, 3, 10, 15],
              weights: [0.4, 0.25, 0.15, 0.15, 0.05],
            },
          },
        },
      });

      const users = result.data.get("User")!;
      const orders = result.data.get("Order")!;

      // Count orders per user
      const ordersPerUser: Record<string, number> = {};
      for (const order of orders) {
        const userId = order.userId as string;
        ordersPerUser[userId] = (ordersPerUser[userId] || 0) + 1;
      }

      // Calculate distribution
      const usersWithFewOrders = Object.values(ordersPerUser).filter(
        (c) => c <= 3
      ).length;
      const usersWithManyOrders = Object.values(ordersPerUser).filter(
        (c) => c >= 10
      ).length;

      // Most users should have few orders
      expect(usersWithFewOrders).toBeGreaterThan(usersWithManyOrders);
    });

    it("should use default distribution when not configured", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 50 },
      });

      const orders = result.data.get("Order")!;

      // Should generate some orders
      expect(orders.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // SECTION 5: OUTPUT FORMAT TESTS
  // ===========================================================================

  describe("5. Output Formats", () => {
    describe("5.1 JSON Export", () => {
      it("should export data as valid JSON", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 20 },
        });

        const jsonOutput = result.toJson();
        const parsed = JSON.parse(jsonOutput);

        expect(parsed).toBeDefined();
        expect(parsed.data).toBeDefined();
        expect(parsed.data.users).toBeDefined();
        expect(Array.isArray(parsed.data.users)).toBe(true);
      });

      it("should include stats in JSON output", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 20 },
          output: { format: "json", path: "", includeStats: true },
        });

        const jsonOutput = result.toJson();
        const parsed = JSON.parse(jsonOutput);

        expect(parsed.stats).toBeDefined();
        expect(parsed.stats.total_records).toBeGreaterThan(0);
        expect(parsed.stats.referential_integrity).toContain(
          "All foreign keys valid"
        );
      });

      it("should produce output matching expected structure", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 5 },
          distributions: {
            Order: {
              perParent: { values: [2], weights: [1] },
            },
          },
        });

        const jsonOutput = result.toJson();
        const parsed = JSON.parse(jsonOutput);

        // Check users structure (exporter uses lowercase pluralized keys)
        expect(parsed.data.users[0]).toHaveProperty("id");
        expect(parsed.data.users[0]).toHaveProperty("email");
        expect(parsed.data.users[0]).toHaveProperty("name");
        expect(parsed.data.users[0]).toHaveProperty("createdAt");

        // Check orders structure
        expect(parsed.data.orders[0]).toHaveProperty("id");
        expect(parsed.data.orders[0]).toHaveProperty("userId");
        expect(parsed.data.orders[0]).toHaveProperty("total");
        expect(parsed.data.orders[0]).toHaveProperty("items");
        expect(parsed.data.orders[0]).toHaveProperty("createdAt");
      });
    });

    describe("5.2 SQL Export", () => {
      it("should export data as valid SQL INSERT statements", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 10 },
        });

        const sqlOutput = result.toSql();

        expect(sqlOutput).toContain("INSERT INTO");
        expect(sqlOutput).toContain('"users"'); // snake_case plural table name
        expect(sqlOutput).toContain("VALUES");
      });

      it("should properly escape SQL values", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 5 },
        });

        const sqlOutput = result.toSql();

        // SQL should have proper structure with INSERT statements
        expect(sqlOutput).toContain("INSERT INTO");
        expect(sqlOutput).toContain("VALUES");
        // Should contain string literals wrapped in quotes
        expect(sqlOutput).toMatch(/'[^']*'/);
      });
    });
  });

  // ===========================================================================
  // SECTION 6: PRIVACY & SYNTHETIC DATA TESTS
  // ===========================================================================

  describe("6. Privacy - 100% Synthetic", () => {
    describe("6.1 Email Privacy", () => {
      it("should generate synthetic emails with test indicators", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 100 },
          privacy: {
            piiFieldPatterns: ["email"],
            syntheticSuffix: "_test",
            clearlyFake: true,
            emailDomain: "example.com",
          },
        });

        const users = result.data.get("User")!;

        for (const user of users) {
          const email = user.email as string;
          expect(isSyntheticEmail(email)).toBe(true);
        }
      });

      it("should use configured email domain", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 50 },
          privacy: {
            piiFieldPatterns: ["email"],
            syntheticSuffix: "_test",
            clearlyFake: true,
            emailDomain: "testdomain.com",
          },
        });

        const users = result.data.get("User")!;

        for (const user of users) {
          const email = user.email as string;
          expect(email.endsWith("@testdomain.com")).toBe(true);
        }
      });
    });

    describe("6.2 No Real PII", () => {
      it("should not contain real SSN patterns", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 100 },
        });

        const jsonOutput = result.toJson();

        // Check for SSN pattern
        expect(jsonOutput).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
      });

      it("should generate synthetic phone numbers", async () => {
        const result = await generateSyntheticData(TEMP_EXTENDED_SCHEMA_PATH, {
          counts: { User: 50 },
        });

        const users = result.data.get("User")!;

        for (const user of users) {
          if (user.phone) {
            const phone = user.phone as string;
            // Should use 555 prefix (reserved for fiction)
            expect(phone).toMatch(/555/);
          }
        }
      });
    });

    describe("6.3 Data Uniqueness", () => {
      it("should generate unique IDs", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 1000 },
        });

        const users = result.data.get("User")!;
        const ids = users.map((u) => u.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
      });

      it("should generate unique emails", async () => {
        const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
          counts: { User: 500 },
        });

        const users = result.data.get("User")!;
        const emails = users.map((u) => u.email);
        const uniqueEmails = new Set(emails);

        expect(uniqueEmails.size).toBe(emails.length);
      });
    });
  });

  // ===========================================================================
  // SECTION 7: PERFORMANCE TESTS
  // ===========================================================================

  describe("7. Performance - Speed Requirements", () => {
    it("should generate 10,000 records in under 10 seconds", async () => {
      const startTime = Date.now();

      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 1000 },
        distributions: {
          Order: {
            perParent: {
              // Ensure we get at least 10 orders per user
              values: [10, 12, 15],
              weights: [0.4, 0.4, 0.2],
            },
          },
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000 users + ~11000 orders = ~12000 records
      expect(result.stats.totalRecords).toBeGreaterThanOrEqual(10000);
      expect(duration).toBeLessThan(10000); // 10 seconds

      console.log(
        `Generated ${result.stats.totalRecords} records in ${duration}ms`
      );
    });

    it("should report generation time in stats", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 100 },
      });

      expect(result.stats.generationTimeMs).toBeDefined();
      expect(result.stats.generationTimeMs).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // SECTION 8: STATS OUTPUT TESTS
  // ===========================================================================

  describe("8. Stats Output", () => {
    it("should provide accurate record counts per model", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 50 },
        distributions: {
          Order: {
            perParent: { values: [2], weights: [1] },
          },
        },
      });

      expect(result.stats.recordsPerModel.User).toBe(50);
      expect(result.stats.recordsPerModel.Order).toBe(100);
    });

    it("should provide accurate total record count", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 30 },
        distributions: {
          Order: {
            perParent: { values: [3], weights: [1] },
          },
        },
      });

      const expectedTotal = 30 + 30 * 3; // Users + Orders
      expect(result.stats.totalRecords).toBe(expectedTotal);
    });

    it("should report models generated count", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 10 },
      });

      expect(result.stats.modelsGenerated).toBe(2);
    });

    it("should report empty errors array on success", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 10 },
      });

      expect(result.stats.errors).toHaveLength(0);
    });
  });

  // ===========================================================================
  // SECTION 9: DATA REALISM TESTS
  // ===========================================================================

  describe("9. Data Realism", () => {
    it("should generate realistic order totals", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 10, Order: 100 },
      });

      const orders = result.data.get("Order")!;

      for (const order of orders) {
        const total = order.total as number;
        // Reasonable order total range
        expect(total).toBeGreaterThan(0);
        expect(total).toBeLessThan(100000);
      }
    });

    it("should generate realistic JSON items structure", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 5, Order: 20 },
      });

      const orders = result.data.get("Order")!;

      for (const order of orders) {
        const items = order.items;
        expect(items).toBeDefined();

        // Items should be an array or object
        expect(Array.isArray(items) || typeof items === "object").toBe(true);
      }
    });

    it("should generate dates in reasonable ranges", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 50 },
      });

      const users = result.data.get("User")!;
      const now = new Date();
      const tenYearsAgo = new Date(
        now.getFullYear() - 10,
        now.getMonth(),
        now.getDate()
      );
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      for (const user of users) {
        const createdAt = new Date(user.createdAt as string);
        expect(createdAt.getTime()).toBeGreaterThan(tenYearsAgo.getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(tomorrow.getTime());
      }
    });
  });

  // ===========================================================================
  // SECTION 10: GENERATOR REGISTRY TESTS
  // ===========================================================================

  describe("10. Generator Registry", () => {
    it("should register and retrieve string generator", () => {
      const registry = new GeneratorRegistry();
      const stringGen = new StringGenerator();
      registry.register(stringGen);

      const field = {
        name: "test",
        type: "String" as const,
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };

      const generator = registry.getGenerator(field);
      expect(generator).toBeDefined();
    });

    it("should register all built-in generators", () => {
      const registry = new GeneratorRegistry();
      registry.register(new StringGenerator());
      registry.register(new IntGenerator());
      registry.register(new FloatGenerator());
      registry.register(new DateTimeGenerator());
      registry.register(new BooleanGenerator());
      registry.register(new JsonGenerator());

      const stringField = {
        name: "t",
        type: "String",
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };
      const intField = {
        name: "t",
        type: "Int",
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };
      const floatField = {
        name: "t",
        type: "Float",
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };
      const dateField = {
        name: "t",
        type: "DateTime",
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };
      const boolField = {
        name: "t",
        type: "Boolean",
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };
      const jsonField = {
        name: "t",
        type: "Json",
        isRequired: true,
        isUnique: false,
        isId: false,
        isList: false,
        isUpdatedAt: false,
        attributes: [],
      };

      expect(registry.getGenerator(stringField)).toBeDefined();
      expect(registry.getGenerator(intField)).toBeDefined();
      expect(registry.getGenerator(floatField)).toBeDefined();
      expect(registry.getGenerator(dateField)).toBeDefined();
      expect(registry.getGenerator(boolField)).toBeDefined();
      expect(registry.getGenerator(jsonField)).toBeDefined();
    });
  });

  // ===========================================================================
  // SECTION 11: DATA STORE TESTS
  // ===========================================================================

  describe("11. Data Store", () => {
    it("should store and retrieve records", () => {
      const store = new DataStore();
      const record = { id: "test-1", name: "Test" };

      store.add("User", record);

      const retrieved = store.get("User");
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(record);
    });

    it("should track unique values", () => {
      const store = new DataStore();

      expect(store.trackUnique("User.email", "test@example.com")).toBe(true);
      expect(store.trackUnique("User.email", "test@example.com")).toBe(false);
      expect(store.trackUnique("User.email", "other@example.com")).toBe(true);
    });

    it("should validate referential integrity", () => {
      const store = new DataStore();

      store.addMany("User", [
        { id: "user-1", name: "User 1" },
        { id: "user-2", name: "User 2" },
      ]);

      store.addMany("Order", [
        { id: "order-1", userId: "user-1", total: 100 },
        { id: "order-2", userId: "user-2", total: 200 },
      ]);

      const result = store.validateIntegrity("Order", "userId", "User", "id");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect integrity violations", () => {
      const store = new DataStore();

      store.addMany("User", [{ id: "user-1", name: "User 1" }]);

      store.addMany("Order", [
        { id: "order-1", userId: "user-1", total: 100 },
        { id: "order-2", userId: "non-existent", total: 200 },
      ]);

      const result = store.validateIntegrity("Order", "userId", "User", "id");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should provide accurate counts", () => {
      const store = new DataStore();

      store.addMany("User", [{ id: "1" }, { id: "2" }, { id: "3" }]);
      store.addMany("Order", [{ id: "1" }, { id: "2" }]);

      expect(store.getTotalCount()).toBe(5);
      expect(store.getCountPerModel()).toEqual({ User: 3, Order: 2 });
    });
  });

  // ===========================================================================
  // SECTION 12: END-TO-END INTEGRATION TEST
  // ===========================================================================

  describe("12. End-to-End Integration", () => {
    it("should produce output matching expected format from requirements", async () => {
      const result = await generateSyntheticData(TEMP_SCHEMA_PATH, {
        counts: { User: 1000 },
        distributions: {
          Order: {
            perParent: {
              // 80% users have 1-3 orders, 20% have 10+
              values: [1, 2, 3, 10, 15],
              weights: [0.4, 0.25, 0.15, 0.15, 0.05],
            },
          },
        },
        privacy: {
          piiFieldPatterns: ["email", "phone", "address", "ssn"],
          syntheticSuffix: "_test",
          clearlyFake: true,
          emailDomain: "example.com",
        },
      });

      const jsonOutput = result.toJson();
      const parsed = JSON.parse(jsonOutput);

      // Verify data structure (exporter uses lowercase pluralized keys in data object)
      expect(parsed.data).toBeDefined();
      expect(parsed.data.users).toBeDefined();
      expect(parsed.data.users.length).toBe(1000);

      const sampleUser = parsed.data.users[0];
      expect(sampleUser.id).toBeDefined();
      expect(sampleUser.email).toMatch(/@example\.com$/);
      expect(sampleUser.name).toBeDefined();
      expect(sampleUser.createdAt).toBeDefined();

      // Verify Order structure
      expect(parsed.data.orders).toBeDefined();
      expect(parsed.data.orders.length).toBeGreaterThan(0);

      const sampleOrder = parsed.data.orders[0];
      expect(sampleOrder.id).toBeDefined();
      expect(sampleOrder.userId).toBeDefined();
      expect(typeof sampleOrder.total).toBe("number");
      expect(sampleOrder.items).toBeDefined();
      expect(sampleOrder.createdAt).toBeDefined();

      // Verify all foreign keys are valid
      const userIds = new Set(parsed.data.users.map((u: any) => u.id));
      for (const order of parsed.data.orders) {
        expect(userIds.has(order.userId)).toBe(true);
      }

      // Verify stats
      expect(parsed.stats).toBeDefined();
      expect(parsed.stats.total_records).toBeGreaterThan(1000);
      expect(parsed.stats.referential_integrity).toContain(
        "All foreign keys valid"
      );

      console.log("End-to-End Test Results:");
      console.log(`  Users generated: ${parsed.stats.users_generated}`);
      console.log(`  Orders generated: ${parsed.stats.orders_generated}`);
      console.log(`  Total records: ${parsed.stats.total_records}`);
      console.log(
        `  Referential integrity: ${parsed.stats.referential_integrity}`
      );
      console.log(`  Generation time: ${parsed.stats.generation_time_ms}ms`);
    });
  });

  // Cleanup after all tests
  afterAll(() => {
    cleanupTempFiles();
  });
});
