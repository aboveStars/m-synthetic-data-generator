/**
 * Synthetic Data Generator
 * GDPR-compliant synthetic data generation for testing environments
 */

export * from './types.js';
export { parsePrismaSchema, PrismaParser } from './parser/index.js';
export { Orchestrator, DependencyGraph, DataStore } from './engine/index.js';
export { JsonExporter, SqlExporter } from './exporters/index.js';
export {
  StringGenerator,
  IntGenerator,
  FloatGenerator,
  BigIntGenerator,
  DateTimeGenerator,
  BooleanGenerator,
  JsonGenerator,
  EnumGenerator,
  GeneratorRegistry,
} from './generators/index.js';
export { loadConfig, createConfigFromOptions, DEFAULT_CONFIG } from './config/index.js';
export * from './utils/index.js';

import { readFileSync } from 'fs';
import { parsePrismaSchema } from './parser/index.js';
import { Orchestrator } from './engine/index.js';
import { JsonExporter, SqlExporter } from './exporters/index.js';
import type { GenerationConfig, GeneratedRecord, GenerationStats } from './types.js';

/**
 * Main API function to generate synthetic data
 */
export async function generateSyntheticData(
  schemaPath: string,
  config?: Partial<GenerationConfig>
): Promise<{
  data: Map<string, GeneratedRecord[]>;
  stats: GenerationStats;
  toJson: () => string;
  toSql: () => string;
}> {
  // Read and parse schema
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const parsedSchema = parsePrismaSchema(schemaContent);

  // Merge with default config
  const fullConfig: GenerationConfig = {
    schema: schemaPath,
    output: {
      format: 'json',
      path: './synthetic-data.json',
      prettyPrint: true,
      includeStats: true,
      ...config?.output,
    },
    counts: config?.counts || {},
    distributions: config?.distributions || {},
    dateRanges: config?.dateRanges || {},
    fieldOverrides: config?.fieldOverrides || {},
    privacy: {
      piiFieldPatterns: ['email', 'phone', 'address', 'ssn'],
      syntheticSuffix: '_test',
      clearlyFake: true,
      emailDomain: 'example.com',
      ...config?.privacy,
    },
    seed: config?.seed,
  };

  // Generate data
  const orchestrator = new Orchestrator(parsedSchema, fullConfig);
  const { data, stats } = await orchestrator.generate();

  // Create exporters
  const jsonExporter = new JsonExporter({
    prettyPrint: fullConfig.output.prettyPrint,
    includeStats: fullConfig.output.includeStats,
  });

  const sqlExporter = new SqlExporter({ dialect: 'postgresql' });
  sqlExporter.setSchema(parsedSchema);

  return {
    data,
    stats,
    toJson: () => jsonExporter.export(data, stats),
    toSql: () => sqlExporter.export(data),
  };
}
