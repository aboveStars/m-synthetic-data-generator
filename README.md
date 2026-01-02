# Synthetic Data Generator

A GDPR-compliant synthetic data generator that creates realistic, privacy-safe test data from Prisma database schemas.

## Features

- 🔒 **Privacy-First**: Generates 100% synthetic data with no real PII
- 🎯 **Smart Generation**: Detects field types (email, phone, names) and generates appropriate fake data
- 🔗 **Relationship Handling**: Maintains referential integrity across related models
- 📊 **Configurable Distributions**: Match production data patterns with weighted distributions
- ⚡ **High Performance**: Generates 10,000+ records in seconds
- 📤 **Multiple Formats**: Export to JSON or SQL INSERT statements

## Installation

```bash
npm install
npm run build
```

## Quick Start

### CLI Usage

```bash
# Basic usage with Prisma schema
npm run generate -- --schema ./prisma/schema.prisma --count 1000

# With configuration file
npm run generate -- --config ./config.json

# Output as SQL
npm run generate -- --schema ./schema.prisma --format sql --output ./seed.sql

# Dry run to preview
npm run generate -- --schema ./schema.prisma --count 100 --dry-run
```

### Programmatic Usage

```typescript
import { generateSyntheticData } from 'synthetic-data-generator';

const result = await generateSyntheticData('./prisma/schema.prisma', {
  counts: {
    User: 1000,
    Order: 5000,
  },
  distributions: {
    Order: {
      perParent: {
        values: [1, 2, 3, 5, 10],
        weights: [0.4, 0.3, 0.15, 0.1, 0.05],
      },
    },
  },
  privacy: {
    emailDomain: 'test.yourcompany.com',
    syntheticSuffix: '_synthetic',
  },
});

// Export as JSON
const jsonOutput = result.toJson();

// Export as SQL
const sqlOutput = result.toSql();

// Access raw data
console.log(`Generated ${result.stats.totalRecords} records`);
```

## Configuration

Create a `config.json` file:

```json
{
  "schema": "./prisma/schema.prisma",
  "output": {
    "format": "both",
    "path": "./synthetic-data.json",
    "prettyPrint": true,
    "includeStats": true
  },
  "counts": {
    "User": 1000,
    "Organization": 50
  },
  "distributions": {
    "Order": {
      "perParent": {
        "values": [1, 2, 3, 5, 10],
        "weights": [0.40, 0.30, 0.15, 0.10, 0.05]
      }
    }
  },
  "dateRanges": {
    "User.createdAt": {
      "from": "2023-01-01",
      "to": "2024-12-31",
      "distribution": "recent-biased"
    }
  },
  "privacy": {
    "emailDomain": "synthetic.example.com",
    "syntheticSuffix": "_test",
    "clearlyFake": true
  }
}
```

## Smart Field Detection

The generator automatically detects field purposes and generates appropriate data:

| Field Pattern | Generated Data |
|---------------|----------------|
| `email` | `john.doe_test@example.com` |
| `name`, `firstName`, `lastName` | Realistic names |
| `phone` | `555-xxx-xxxx` (clearly fake) |
| `address`, `city`, `country` | Realistic addresses |
| `avatarUrl`, `imageUrl` | Placeholder image URLs |
| `createdAt` | Recent-biased dates |
| `birthDate` | Age 18-80 |
| `price`, `total`, `amount` | Realistic prices (e.g., $49.99) |
| `age` | 18-80 |
| `rating` | 1-5 |
| `isActive` | 85% true |
| `isDeleted` | 5% true |
| `role` enum with ADMIN/USER | 5% admin, 90% user |

## Handling Relationships

### One-to-Many
```prisma
model User {
  id     String  @id
  orders Order[]
}

model Order {
  id     String @id
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

Orders are automatically generated with valid `userId` references.

### Self-References
```prisma
model User {
  id         String  @id
  referrerId String?
  referrer   User?   @relation("Referrals", fields: [referrerId], references: [id])
}
```

Self-references are handled with a two-pass approach: generate users first, then update a portion with valid referrer IDs.

### Many-to-Many

Use junction table configuration to control the distribution.

## Output Formats

### JSON Output

```json
{
  "users": [
    {
      "id": "usr_syn_000001",
      "email": "alice.johnson_test@example.com",
      "name": "Alice Johnson",
      "role": "USER",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "orders": [
    {
      "id": "ord_syn_000001",
      "userId": "usr_syn_000001",
      "status": "COMPLETED",
      "total": 149.99,
      "items": [{"product": "Pro Plan", "qty": 1}]
    }
  ],
  "stats": {
    "users_generated": 1000,
    "orders_generated": 3500,
    "total_records": 4500,
    "generation_time_ms": 1234,
    "referential_integrity": "✅ All foreign keys valid"
  }
}
```

### SQL Output

```sql
BEGIN;

-- User records
INSERT INTO "users" ("id", "email", "name", "role", "created_at") VALUES
  ('usr_syn_000001', 'alice.johnson_test@example.com', 'Alice Johnson', 'USER', '2024-01-15T10:30:00.000Z'),
  ...;

-- Order records
INSERT INTO "orders" ("id", "user_id", "status", "total", "items", "created_at") VALUES
  ('ord_syn_000001', 'usr_syn_000001', 'COMPLETED', 149.99, '{"items":[...]}', '2024-01-16T14:20:00.000Z'),
  ...;

COMMIT;
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- parser

# Run with coverage
npm test -- --coverage
```

## Performance

| Records | Time |
|---------|------|
| 1,000 | ~100ms |
| 10,000 | ~1s |
| 100,000 | ~10s |

## Privacy Guarantees

- ✅ All emails use `_test` suffix and custom domain
- ✅ Phone numbers use `555` prefix (clearly fake)
- ✅ No production data or real PII is used
- ✅ Configurable synthetic markers
- ✅ Suitable for GDPR/CCPA compliance

## License

MIT
