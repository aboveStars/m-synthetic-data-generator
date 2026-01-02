/**
 * SQL Exporter
 * Exports generated data to SQL INSERT statements
 */

import type { GeneratedRecord, ParsedSchema, Model } from '../types.js';
import { DependencyGraph } from '../engine/dependency-graph.js';

export interface SqlExportOptions {
  dialect?: 'postgresql' | 'mysql' | 'sqlite';
  batchSize?: number;
  includeTransaction?: boolean;
  tableName?: (modelName: string) => string;
}

export class SqlExporter {
  private options: SqlExportOptions;
  private schema?: ParsedSchema;

  constructor(options: SqlExportOptions = {}) {
    this.options = {
      dialect: 'postgresql',
      batchSize: 100,
      includeTransaction: true,
      tableName: (name) => this.toSnakeCase(name) + 's',
      ...options,
    };
  }

  /**
   * Set schema for determining column types
   */
  setSchema(schema: ParsedSchema): void {
    this.schema = schema;
  }

  /**
   * Export data to SQL string
   */
  export(data: Map<string, GeneratedRecord[]>): string {
    const statements: string[] = [];

    // Add transaction start
    if (this.options.includeTransaction) {
      statements.push(this.getTransactionStart());
    }

    // Determine insert order based on dependencies
    const insertOrder = this.schema
      ? new DependencyGraph(this.schema).getGenerationOrder()
      : Array.from(data.keys());

    // Generate INSERT statements for each model
    for (const modelName of insertOrder) {
      const records = data.get(modelName);
      if (!records || records.length === 0) continue;

      const tableName = this.options.tableName!(modelName);
      const inserts = this.generateInserts(tableName, records);
      statements.push(`-- ${modelName} records`);
      statements.push(...inserts);
      statements.push('');
    }

    // Add transaction end
    if (this.options.includeTransaction) {
      statements.push(this.getTransactionEnd());
    }

    return statements.join('\n');
  }

  /**
   * Generate INSERT statements for a table
   */
  private generateInserts(
    tableName: string,
    records: GeneratedRecord[]
  ): string[] {
    const statements: string[] = [];
    const batchSize = this.options.batchSize!;

    // Get column names from first record
    if (records.length === 0) return statements;

    const columns = Object.keys(records[0]).filter(
      (col) => records[0][col] !== undefined
    );

    // Generate batched INSERT statements
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = batch.map((record) => this.formatRow(record, columns));

      const sql = this.formatInsert(tableName, columns, values);
      statements.push(sql);
    }

    return statements;
  }

  /**
   * Format an INSERT statement
   */
  private formatInsert(
    tableName: string,
    columns: string[],
    values: string[]
  ): string {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c));
    const columnList = quotedColumns.join(', ');
    const valueList = values.join(',\n  ');

    return `INSERT INTO ${this.quoteIdentifier(tableName)} (${columnList}) VALUES\n  ${valueList};`;
  }

  /**
   * Format a row of values
   */
  private formatRow(record: GeneratedRecord, columns: string[]): string {
    const values = columns.map((col) => this.formatValue(record[col]));
    return `(${values.join(', ')})`;
  }

  /**
   * Format a single value for SQL
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return this.quoteString(value);
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return this.formatBoolean(value);
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return this.quoteString(value.toISOString());
    }

    if (Array.isArray(value) || typeof value === 'object') {
      return this.quoteString(JSON.stringify(value));
    }

    return this.quoteString(String(value));
  }

  /**
   * Quote a string value
   */
  private quoteString(value: string): string {
    // Escape single quotes
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  /**
   * Quote an identifier (table/column name)
   */
  private quoteIdentifier(name: string): string {
    const snakeName = this.toSnakeCase(name);

    switch (this.options.dialect) {
      case 'mysql':
        return `\`${snakeName}\``;
      case 'postgresql':
      case 'sqlite':
      default:
        return `"${snakeName}"`;
    }
  }

  /**
   * Format a boolean value
   */
  private formatBoolean(value: boolean): string {
    switch (this.options.dialect) {
      case 'mysql':
        return value ? '1' : '0';
      case 'postgresql':
      case 'sqlite':
      default:
        return value ? 'TRUE' : 'FALSE';
    }
  }

  /**
   * Get transaction start statement
   */
  private getTransactionStart(): string {
    switch (this.options.dialect) {
      case 'mysql':
        return 'START TRANSACTION;';
      case 'postgresql':
      case 'sqlite':
      default:
        return 'BEGIN;';
    }
  }

  /**
   * Get transaction end statement
   */
  private getTransactionEnd(): string {
    return 'COMMIT;';
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}
