/**
 * JSON Exporter
 * Exports generated data to JSON format
 */

import type { GeneratedRecord, GenerationStats } from '../types.js';

export interface JsonExportOptions {
  prettyPrint?: boolean;
  includeStats?: boolean;
  camelCaseKeys?: boolean;
}

export interface JsonExportResult {
  data: Record<string, GeneratedRecord[]>;
  stats?: {
    users_generated?: number;
    orders_generated?: number;
    [key: string]: number | string | undefined;
    total_records: number;
    generation_time_ms: number;
    referential_integrity: string;
  };
}

export class JsonExporter {
  private options: JsonExportOptions;

  constructor(options: JsonExportOptions = {}) {
    this.options = {
      prettyPrint: true,
      includeStats: true,
      camelCaseKeys: false,
      ...options,
    };
  }

  /**
   * Export data to JSON string
   */
  export(
    data: Map<string, GeneratedRecord[]>,
    stats?: GenerationStats
  ): string {
    const result = this.buildExportObject(data, stats);
    const indent = this.options.prettyPrint ? 2 : undefined;

    return JSON.stringify(result, this.replacer.bind(this), indent);
  }

  /**
   * Export data to plain object
   */
  exportObject(
    data: Map<string, GeneratedRecord[]>,
    stats?: GenerationStats
  ): JsonExportResult {
    return this.buildExportObject(data, stats);
  }

  /**
   * Build the export object structure
   */
  private buildExportObject(
    data: Map<string, GeneratedRecord[]>,
    stats?: GenerationStats
  ): JsonExportResult {
    const result: JsonExportResult = {
      data: {},
    };

    // Convert model names to camelCase or keep as-is
    for (const [modelName, records] of data) {
      const key = this.options.camelCaseKeys
        ? this.toCamelCase(modelName)
        : modelName.toLowerCase() + 's'; // pluralize

      result.data[key] = records.map((record) =>
        this.transformRecord(record)
      );
    }

    // Add stats if requested
    if (this.options.includeStats && stats) {
      result.stats = {
        total_records: stats.totalRecords,
        generation_time_ms: stats.generationTimeMs,
        referential_integrity:
          stats.referentialIntegrity === 'valid'
            ? '✅ All foreign keys valid'
            : '❌ Some integrity errors',
      };

      // Add per-model counts
      for (const [model, count] of Object.entries(stats.recordsPerModel)) {
        result.stats[`${model.toLowerCase()}s_generated`] = count;
      }
    }

    return result;
  }

  /**
   * Transform a record for export
   */
  private transformRecord(record: GeneratedRecord): GeneratedRecord {
    const transformed: GeneratedRecord = {};

    for (const [key, value] of Object.entries(record)) {
      const newKey = this.options.camelCaseKeys ? this.toCamelCase(key) : key;
      transformed[newKey] = this.transformValue(value);
    }

    return transformed;
  }

  /**
   * Transform a value for JSON serialization
   */
  private transformValue(value: unknown): unknown {
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((v) => this.transformValue(v));
    }

    // Handle nested objects
    if (value !== null && typeof value === 'object') {
      const transformed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        transformed[k] = this.transformValue(v);
      }
      return transformed;
    }

    return value;
  }

  /**
   * JSON.stringify replacer function
   */
  private replacer(key: string, value: unknown): unknown {
    // Handle BigInt
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}
