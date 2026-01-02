#!/usr/bin/env node

/**
 * CLI for Synthetic Data Generator
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import { parsePrismaSchema } from './parser/index.js';
import { Orchestrator } from './engine/index.js';
import { JsonExporter, SqlExporter } from './exporters/index.js';
import { loadConfig, createConfigFromOptions, DEFAULT_CONFIG } from './config/index.js';
import type { GenerationConfig } from './types.js';

const program = new Command();

program
  .name('synthetic-data-gen')
  .description('Generate GDPR-compliant synthetic data from database schemas')
  .version('1.0.0');

program
  .option('-s, --schema <path>', 'Path to Prisma schema file')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <path>', 'Output file path', './synthetic-data.json')
  .option('-f, --format <format>', 'Output format (json, sql, both)', 'json')
  .option('-n, --count <number>', 'Default record count per model', parseInt)
  .option('--seed <number>', 'Random seed for reproducible generation', parseInt)
  .option('--dry-run', 'Show what would be generated without writing files')
  .option('-v, --verbose', 'Show detailed output');

program.parse();

const options = program.opts();

async function main() {
  console.log('🧪 Synthetic Data Generator\n');

  try {
    // Load configuration
    let config: GenerationConfig;

    if (options.config) {
      console.log(`📁 Loading config from ${options.config}`);
      config = loadConfig(options.config) as GenerationConfig;

      // Override with CLI options
      if (options.schema) config.schema = options.schema;
      if (options.output) config.output.path = options.output;
      if (options.format) config.output.format = options.format;
    } else if (options.schema) {
      config = createConfigFromOptions({
        schema: options.schema,
        output: options.output,
        format: options.format,
        count: options.count,
        seed: options.seed,
      });
    } else {
      console.error('❌ Error: Either --schema or --config is required');
      process.exit(1);
    }

    // Read schema file
    const schemaPath = resolve(config.schema);
    if (!existsSync(schemaPath)) {
      console.error(`❌ Error: Schema file not found: ${schemaPath}`);
      process.exit(1);
    }

    console.log(`📖 Reading schema from ${schemaPath}`);
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    // Parse schema
    console.log('🔍 Parsing schema...');
    const parsedSchema = parsePrismaSchema(schemaContent);

    console.log(`   Found ${parsedSchema.models.length} models:`);
    for (const model of parsedSchema.models) {
      console.log(`   - ${model.name} (${model.fields.length} fields)`);
    }

    if (parsedSchema.enums.length > 0) {
      console.log(`   Found ${parsedSchema.enums.length} enums:`);
      for (const enumDef of parsedSchema.enums) {
        console.log(`   - ${enumDef.name}: [${enumDef.values.join(', ')}]`);
      }
    }

    // Apply default count if specified
    if (options.count) {
      for (const model of parsedSchema.models) {
        if (!config.counts[model.name]) {
          config.counts[model.name] = options.count;
        }
      }
    }

    // Generate data
    console.log('\n⚙️ Generating synthetic data...');
    const startTime = Date.now();

    const orchestrator = new Orchestrator(parsedSchema, config);
    const { data, stats } = await orchestrator.generate();

    const duration = Date.now() - startTime;

    // Display stats
    console.log('\n📊 Generation Stats:');
    console.log(`   Total records: ${stats.totalRecords.toLocaleString()}`);
    console.log(`   Generation time: ${duration}ms`);
    console.log(`   Referential integrity: ${stats.referentialIntegrity === 'valid' ? '✅ Valid' : '❌ Invalid'}`);

    console.log('\n   Records per model:');
    for (const [model, count] of Object.entries(stats.recordsPerModel)) {
      console.log(`   - ${model}: ${count.toLocaleString()}`);
    }

    if (options.dryRun) {
      console.log('\n🔍 Dry run - no files written');
      console.log('\nSample data:');

      const jsonExporter = new JsonExporter({ prettyPrint: true });
      const sample = jsonExporter.exportObject(data, stats);

      // Show first record of each model
      for (const [model, records] of Object.entries(sample.data)) {
        console.log(`\n${model}[0]:`);
        console.log(JSON.stringify(records[0], null, 2));
      }

      return;
    }

    // Export data
    console.log('\n💾 Exporting data...');

    const format = config.output.format;
    const outputPath = resolve(config.output.path);

    if (format === 'json' || format === 'both') {
      const jsonExporter = new JsonExporter({
        prettyPrint: config.output.prettyPrint,
        includeStats: config.output.includeStats,
      });

      const jsonPath = format === 'both'
        ? outputPath.replace(/\.[^.]+$/, '.json')
        : outputPath;

      const jsonOutput = jsonExporter.export(data, stats);
      writeFileSync(jsonPath, jsonOutput, 'utf-8');
      console.log(`   ✅ JSON written to ${jsonPath}`);
    }

    if (format === 'sql' || format === 'both') {
      const sqlExporter = new SqlExporter({
        dialect: 'postgresql',
        includeTransaction: true,
      });
      sqlExporter.setSchema(parsedSchema);

      const sqlPath = format === 'both'
        ? outputPath.replace(/\.[^.]+$/, '.sql')
        : outputPath.replace('.json', '.sql');

      const sqlOutput = sqlExporter.export(data);
      writeFileSync(sqlPath, sqlOutput, 'utf-8');
      console.log(`   ✅ SQL written to ${sqlPath}`);
    }

    console.log('\n✨ Done!');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    if (options.verbose && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
