/**
 * Core type definitions for the Synthetic Data Generator
 */

// ============================================
// Schema Types
// ============================================

export type FieldType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'DateTime'
  | 'Json'
  | 'Bytes'
  | 'BigInt'
  | 'Decimal'
  | string; // For enums and custom types

export interface Field {
  name: string;
  type: FieldType;
  isRequired: boolean;
  isUnique: boolean;
  isId: boolean;
  isList: boolean;
  isUpdatedAt: boolean;
  default?: DefaultValue;
  attributes: Attribute[];
  enumValues?: string[]; // If type is an enum
}

export interface DefaultValue {
  type: 'function' | 'literal';
  value: string;
}

export interface Attribute {
  name: string;
  args: string[];
}

export interface Relation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromModel: string;
  toModel: string;
  fromField: string;
  toField: string;
  foreignKey?: string;
  references?: string;
  isOptional: boolean;
}

export interface Model {
  name: string;
  fields: Field[];
  relations: Relation[];
  tableName?: string;
  attributes: Attribute[];
}

export interface EnumDef {
  name: string;
  values: string[];
}

export interface ParsedSchema {
  models: Model[];
  enums: EnumDef[];
}

// ============================================
// Configuration Types
// ============================================

export interface DistributionConfig {
  values: number[];
  weights: number[];
}

export interface DateRangeConfig {
  from: string;
  to: string;
  distribution?: 'uniform' | 'recent-biased' | 'old-biased' | 'normal';
}

export interface FieldOverride {
  pattern?: string;
  generator?: string;
  values?: unknown[];
  weights?: number[];
  nullProbability?: number;
}

export interface ModelConfig {
  count?: number;
  perParent?: DistributionConfig;
  fieldOverrides?: Record<string, FieldOverride>;
}

export interface PrivacyConfig {
  piiFieldPatterns: string[];
  syntheticSuffix: string;
  clearlyFake: boolean;
  emailDomain: string;
}

export interface OutputConfig {
  format: 'json' | 'sql' | 'both';
  path: string;
  prettyPrint?: boolean;
  includeStats?: boolean;
}

export interface GenerationConfig {
  schema: string;
  output: OutputConfig;
  counts: Record<string, number>;
  distributions: Record<string, ModelConfig>;
  dateRanges: Record<string, DateRangeConfig>;
  fieldOverrides: Record<string, Record<string, FieldOverride>>;
  privacy: PrivacyConfig;
  seed?: number;
}

// ============================================
// Generation Context Types
// ============================================

export interface GenerationContext {
  config: GenerationConfig;
  schema: ParsedSchema;
  currentModel: Model;
  currentField: Field;
  generatedData: Map<string, GeneratedRecord[]>;
  recordIndex: number;
  parentRecord?: GeneratedRecord;
}

export interface GeneratedRecord {
  [key: string]: unknown;
}

export interface GeneratedData {
  data: Map<string, GeneratedRecord[]>;
  stats: GenerationStats;
}

export interface GenerationStats {
  modelsGenerated: number;
  recordsPerModel: Record<string, number>;
  totalRecords: number;
  generationTimeMs: number;
  referentialIntegrity: 'valid' | 'invalid';
  errors: string[];
}

// ============================================
// Generator Types
// ============================================

export interface FieldGenerator<T = unknown> {
  generate(context: GenerationContext): T;
  canHandle(field: Field): boolean;
}

export interface GeneratorRegistry {
  register(generator: FieldGenerator): void;
  getGenerator(field: Field): FieldGenerator | null;
}
