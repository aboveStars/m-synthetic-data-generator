/**
 * Main Generation Orchestrator
 * Coordinates the generation of synthetic data across all models
 */

import type {
  ParsedSchema,
  GenerationConfig,
  GeneratedRecord,
  GenerationContext,
  Field,
  Model,
  GenerationStats,
  FieldGenerator,
} from '../types.js';

import { DependencyGraph } from './dependency-graph.js';
import { DataStore } from './data-store.js';
import {
  GeneratorRegistry,
  StringGenerator,
  IntGenerator,
  FloatGenerator,
  BigIntGenerator,
  DateTimeGenerator,
  BooleanGenerator,
  JsonGenerator,
  EnumGenerator,
} from '../generators/index.js';
import { weightedRandom, maybeNull } from '../utils/random.js';

export class Orchestrator {
  private schema: ParsedSchema;
  private config: GenerationConfig;
  private dataStore: DataStore;
  private registry: GeneratorRegistry;
  private dependencyGraph: DependencyGraph;
  private enumGenerator: EnumGenerator;

  constructor(schema: ParsedSchema, config: GenerationConfig) {
    this.schema = schema;
    this.config = config;
    this.dataStore = new DataStore();
    this.registry = new GeneratorRegistry();
    this.dependencyGraph = new DependencyGraph(schema);
    this.enumGenerator = new EnumGenerator();

    this.registerGenerators();
  }

  /**
   * Register all built-in generators
   */
  private registerGenerators(): void {
    this.registry.register(new StringGenerator());
    this.registry.register(new IntGenerator());
    this.registry.register(new FloatGenerator());
    this.registry.register(new BigIntGenerator());
    this.registry.register(new DateTimeGenerator());
    this.registry.register(new BooleanGenerator());
    this.registry.register(new JsonGenerator());

    // Register enum types
    for (const enumDef of this.schema.enums) {
      this.enumGenerator.registerEnumType(enumDef.name);
    }
    this.registry.register(this.enumGenerator);
  }

  /**
   * Generate synthetic data for all models
   */
  async generate(): Promise<{
    data: Map<string, GeneratedRecord[]>;
    stats: GenerationStats;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Get generation order from dependency graph
      const generationOrder = this.dependencyGraph.getGenerationOrder();

      // Generate data for each model in order
      for (const modelName of generationOrder) {
        const model = this.schema.models.find((m) => m.name === modelName);
        if (!model) continue;

        await this.generateModel(model);
      }

      // Handle deferred relations (self-references, cycles)
      await this.resolveDeferredRelations();

      // Validate referential integrity
      const integrityValid = this.validateAllIntegrity();

      const endTime = Date.now();

      return {
        data: this.dataStore.getAll(),
        stats: {
          modelsGenerated: generationOrder.length,
          recordsPerModel: this.dataStore.getCountPerModel(),
          totalRecords: this.dataStore.getTotalCount(),
          generationTimeMs: endTime - startTime,
          referentialIntegrity: integrityValid ? 'valid' : 'invalid',
          errors,
        },
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Generate records for a single model
   */
  private async generateModel(model: Model): Promise<void> {
    const count = this.getRecordCount(model);
    const records: GeneratedRecord[] = [];

    // Check if this model has a parent relationship with distribution config
    const parentRelation = this.findParentRelation(model);

    if (parentRelation) {
      // Generate records based on parent distribution
      const parentRecords = this.dataStore.get(parentRelation.toModel);

      for (const parentRecord of parentRecords) {
        const childCount = this.getChildCount(model, parentRelation.toModel);

        for (let i = 0; i < childCount; i++) {
          const record = this.generateRecord(model, records.length, parentRecord);
          records.push(record);
        }
      }
    } else {
      // Generate standalone records
      for (let i = 0; i < count; i++) {
        const record = this.generateRecord(model, i);
        records.push(record);
      }
    }

    this.dataStore.addMany(model.name, records);
  }

  /**
   * Generate a single record for a model
   */
  private generateRecord(
    model: Model,
    index: number,
    parentRecord?: GeneratedRecord
  ): GeneratedRecord {
    const record: GeneratedRecord = {};

    const context: GenerationContext = {
      config: this.config,
      schema: this.schema,
      currentModel: model,
      currentField: model.fields[0], // Will be updated per field
      generatedData: this.dataStore.getAll(),
      recordIndex: index,
      parentRecord,
    };

    for (const field of model.fields) {
      // Skip relation fields (they're virtual)
      if (this.isVirtualRelation(model, field)) {
        continue;
      }

      context.currentField = field;

      // Handle foreign key fields
      if (this.isForeignKey(model, field)) {
        record[field.name] = this.generateForeignKey(model, field, parentRecord);
        continue;
      }

      // Handle deferred fields (self-references, cycles)
      if (this.dependencyGraph.isDeferredField(model.name, field.name)) {
        record[field.name] = null; // Will be filled later
        continue;
      }

      // Generate value using appropriate generator
      const value = this.generateFieldValue(field, context);

      // Handle null for optional fields
      if (!field.isRequired && this.shouldBeNull(field)) {
        record[field.name] = null;
      } else {
        record[field.name] = value;
      }

      // Track unique values
      if (field.isUnique) {
        this.ensureUnique(model, field, record);
      }
    }

    return record;
  }

  /**
   * Generate a value for a field using the appropriate generator
   */
  private generateFieldValue(field: Field, context: GenerationContext): unknown {
    const generator = this.registry.getGenerator(field);

    if (!generator) {
      // Check if this is a model type (relation) - don't warn for those
      const isModelType = this.schema.models.some((m) => m.name === field.type);
      if (!isModelType) {
        console.warn(`No generator found for field type: ${field.type}`);
      }
      return null;
    }

    return generator.generate(context);
  }

  /**
   * Check if a field is a virtual relation (not a real database column)
   */
  private isVirtualRelation(model: Model, field: Field): boolean {
    // Check if the field type is another model name
    const isModelType = this.schema.models.some((m) => m.name === field.type);

    if (!isModelType) return false;

    // Check if it has a @relation attribute without fields[]
    const relationAttr = field.attributes.find((a) => a.name === 'relation');
    if (relationAttr) {
      const hasFields = relationAttr.args.some((arg) => arg.includes('fields:'));
      return !hasFields;
    }

    return true;
  }

  /**
   * Check if a field is a foreign key
   */
  private isForeignKey(model: Model, field: Field): boolean {
    for (const relation of model.relations) {
      if (relation.foreignKey === field.name) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a foreign key value
   */
  private generateForeignKey(
    model: Model,
    field: Field,
    parentRecord?: GeneratedRecord
  ): unknown {
    // Find the relation for this foreign key
    const relation = model.relations.find((r) => r.foreignKey === field.name);
    if (!relation) return null;

    // If we have a parent record and it matches the relation, use its ID
    if (parentRecord && relation.toModel === this.getParentModelName(model)) {
      return parentRecord[relation.references || 'id'];
    }

    // Otherwise, get a random ID from the referenced model
    const referencedId = this.dataStore.getRandomId(
      relation.toModel,
      relation.references || 'id'
    );

    // Handle optional relations
    if (referencedId === null && relation.isOptional) {
      return null;
    }

    return referencedId;
  }

  /**
   * Find the parent relation for child count distribution
   */
  private findParentRelation(model: Model): { toModel: string; foreignKey: string } | null {
    // Check if there's a distribution config for this model
    const modelConfig = this.config.distributions?.[model.name];
    if (!modelConfig?.perParent) return null;

    // Find the first required relation with a foreign key
    for (const relation of model.relations) {
      if (relation.foreignKey && !relation.isOptional) {
        // Check if parent model has been generated
        if (this.dataStore.get(relation.toModel).length > 0) {
          return { toModel: relation.toModel, foreignKey: relation.foreignKey };
        }
      }
    }

    return null;
  }

  /**
   * Get the parent model name for a child model
   */
  private getParentModelName(model: Model): string | null {
    const parentRelation = this.findParentRelation(model);
    return parentRelation?.toModel ?? null;
  }

  /**
   * Get the number of records to generate for a model
   */
  private getRecordCount(model: Model): number {
    // Check explicit count in config
    if (this.config.counts?.[model.name]) {
      return this.config.counts[model.name];
    }

    // Default count
    return 100;
  }

  /**
   * Get the number of child records per parent using distribution
   */
  private getChildCount(model: Model, parentModel: string): number {
    const modelConfig = this.config.distributions?.[model.name];

    if (modelConfig?.perParent) {
      return weightedRandom(
        modelConfig.perParent.values,
        modelConfig.perParent.weights
      );
    }

    // Default distribution: 80% have 1-3, 20% have more
    return weightedRandom([1, 2, 3, 5, 10], [0.4, 0.3, 0.1, 0.15, 0.05]);
  }

  /**
   * Determine if a field should be null
   */
  private shouldBeNull(field: Field): boolean {
    // Get null probability from config or use default
    const modelOverrides = this.config.fieldOverrides?.[field.name];
    let nullProbability = 0.1; // Default

    if (modelOverrides && typeof modelOverrides === 'object' && 'nullProbability' in modelOverrides) {
      nullProbability = (modelOverrides as { nullProbability?: number }).nullProbability ?? 0.1;
    }

    return Math.random() < nullProbability;
  }

  /**
   * Ensure a value is unique for a field
   */
  private ensureUnique(model: Model, field: Field, record: GeneratedRecord): void {
    const key = `${model.name}.${field.name}`;
    let value = record[field.name];
    let attempts = 0;
    const maxAttempts = 100;

    while (!this.dataStore.trackUnique(key, value) && attempts < maxAttempts) {
      // Regenerate the value
      const context: GenerationContext = {
        config: this.config,
        schema: this.schema,
        currentModel: model,
        currentField: field,
        generatedData: this.dataStore.getAll(),
        recordIndex: Date.now(), // Use timestamp for variation
      };

      value = this.generateFieldValue(field, context);
      attempts++;
    }

    record[field.name] = value;
  }

  /**
   * Resolve deferred relations (self-references, cycles)
   */
  private async resolveDeferredRelations(): Promise<void> {
    for (const model of this.schema.models) {
      const selfRefs = this.dependencyGraph.getSelfReferences(model.name);

      if (selfRefs.length === 0) continue;

      const records = this.dataStore.get(model.name);

      for (const relation of selfRefs) {
        // Update a portion of records with valid self-references
        const updatePortion = 0.2; // 20% of records
        const updateCount = Math.floor(records.length * updatePortion);

        for (let i = 0; i < updateCount; i++) {
          const record = records[i];
          const foreignKey = relation.foreignKey;

          if (foreignKey) {
            // Get a random ID from the same model (excluding self)
            const otherId = record.id;
            const candidates = records.filter((r) => r.id !== otherId);

            if (candidates.length > 0) {
              const randomRecord =
                candidates[Math.floor(Math.random() * candidates.length)];
              record[foreignKey] = randomRecord[relation.references || 'id'];
            }
          }
        }
      }
    }
  }

  /**
   * Validate referential integrity for all relations
   */
  private validateAllIntegrity(): boolean {
    let allValid = true;

    for (const model of this.schema.models) {
      for (const relation of model.relations) {
        if (!relation.foreignKey) continue;

        const result = this.dataStore.validateIntegrity(
          model.name,
          relation.foreignKey,
          relation.toModel,
          relation.references || 'id'
        );

        if (!result.valid) {
          console.warn(`Integrity errors in ${model.name}:`, result.errors);
          allValid = false;
        }
      }
    }

    return allValid;
  }
}
