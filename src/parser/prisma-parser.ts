/**
 * Prisma Schema Parser
 * Parses Prisma schema files and extracts models, fields, enums, and relationships
 */

import type {
  ParsedSchema,
  Model,
  Field,
  EnumDef,
  Relation,
  Attribute,
  DefaultValue,
  FieldType,
} from '../types.js';

export class PrismaParser {
  private schemaContent: string = '';

  /**
   * Parse a Prisma schema file content
   */
  parse(schemaContent: string): ParsedSchema {
    this.schemaContent = schemaContent;

    const enums = this.parseEnums();
    const models = this.parseModels(enums);

    // Resolve relationships between models
    this.resolveRelations(models);

    return { models, enums };
  }

  /**
   * Parse enum definitions from schema
   */
  private parseEnums(): EnumDef[] {
    const enums: EnumDef[] = [];
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;

    let match;
    while ((match = enumRegex.exec(this.schemaContent)) !== null) {
      const name = match[1];
      const valuesBlock = match[2];
      const values = valuesBlock
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'));

      enums.push({ name, values });
    }

    return enums;
  }

  /**
   * Parse model definitions from schema
   */
  private parseModels(enums: EnumDef[]): Model[] {
    const models: Model[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;

    let match;
    while ((match = modelRegex.exec(this.schemaContent)) !== null) {
      const name = match[1];
      const fieldsBlock = match[2];
      const model = this.parseModel(name, fieldsBlock, enums);
      models.push(model);
    }

    return models;
  }

  /**
   * Parse a single model definition
   */
  private parseModel(name: string, fieldsBlock: string, enums: EnumDef[]): Model {
    const lines = fieldsBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));

    const fields: Field[] = [];
    const modelAttributes: Attribute[] = [];

    for (const line of lines) {
      // Model-level attributes (@@unique, @@index, etc.)
      if (line.startsWith('@@')) {
        const attr = this.parseModelAttribute(line);
        if (attr) modelAttributes.push(attr);
        continue;
      }

      // Parse field
      const field = this.parseField(line, enums);
      if (field) {
        fields.push(field);
      }
    }

    return {
      name,
      fields,
      relations: [], // Will be resolved later
      attributes: modelAttributes,
    };
  }

  /**
   * Parse a single field definition
   */
  private parseField(line: string, enums: EnumDef[]): Field | null {
    // Skip relation-only fields (those that are just types without any other definition)
    // Match: fieldName Type? TypeModifier? @attributes
    const fieldRegex = /^(\w+)\s+(\w+)(\[\])?\??(.*)$/;
    const match = fieldRegex.exec(line);

    if (!match) return null;

    const [, fieldName, rawType, listModifier, rest] = match;
    const isOptional = line.includes('?');
    const isList = !!listModifier;

    // Determine field type
    let type: FieldType = rawType;
    let enumValues: string[] | undefined;

    // Check if it's an enum type
    const enumDef = enums.find((e) => e.name === rawType);
    if (enumDef) {
      enumValues = enumDef.values;
    }

    // Parse attributes
    const attributes = this.parseFieldAttributes(rest);

    // Check for special attributes
    const isId = attributes.some((a) => a.name === 'id');
    const isUnique = attributes.some((a) => a.name === 'unique');
    const isUpdatedAt = attributes.some((a) => a.name === 'updatedAt');

    // Parse default value
    const defaultAttr = attributes.find((a) => a.name === 'default');
    const defaultValue = defaultAttr ? this.parseDefaultValue(defaultAttr.args[0]) : undefined;

    return {
      name: fieldName,
      type,
      isRequired: !isOptional && !isList,
      isUnique,
      isId,
      isList,
      isUpdatedAt,
      default: defaultValue,
      attributes,
      enumValues,
    };
  }

  /**
   * Parse field attributes (@id, @unique, @default, etc.)
   */
  private parseFieldAttributes(attributesStr: string): Attribute[] {
    const attributes: Attribute[] = [];
    const attrRegex = /@(\w+)(?:\(([^)]*)\))?/g;

    let match;
    while ((match = attrRegex.exec(attributesStr)) !== null) {
      const name = match[1];
      const argsStr = match[2] || '';
      const args = argsStr ? this.parseAttributeArgs(argsStr) : [];
      attributes.push({ name, args });
    }

    return attributes;
  }

  /**
   * Parse attribute arguments
   */
  private parseAttributeArgs(argsStr: string): string[] {
    // Simple parsing - can be enhanced for complex cases
    return argsStr.split(',').map((arg) => arg.trim());
  }

  /**
   * Parse model-level attributes (@@unique, @@index, etc.)
   */
  private parseModelAttribute(line: string): Attribute | null {
    const match = /@@(\w+)(?:\(([^)]*)\))?/.exec(line);
    if (!match) return null;

    return {
      name: match[1],
      args: match[2] ? this.parseAttributeArgs(match[2]) : [],
    };
  }

  /**
   * Parse default value
   */
  private parseDefaultValue(valueStr: string): DefaultValue {
    // Check if it's a function call (uuid(), now(), etc.)
    if (valueStr.includes('(')) {
      return { type: 'function', value: valueStr };
    }
    return { type: 'literal', value: valueStr };
  }

  /**
   * Resolve relationships between models
   */
  private resolveRelations(models: Model[]): void {
    for (const model of models) {
      for (const field of model.fields) {
        const relationAttr = field.attributes.find((a) => a.name === 'relation');

        // Check if field type is another model
        const relatedModel = models.find((m) => m.name === field.type);

        if (relatedModel) {
          const relation = this.buildRelation(model, field, relatedModel, relationAttr);
          if (relation) {
            model.relations.push(relation);
          }
        }
      }
    }
  }

  /**
   * Build a relation object from field and model information
   */
  private buildRelation(
    fromModel: Model,
    field: Field,
    toModel: Model,
    relationAttr?: Attribute
  ): Relation | null {
    // Parse relation attribute to get fields and references
    let foreignKey: string | undefined;
    let references: string | undefined;

    if (relationAttr) {
      for (const arg of relationAttr.args) {
        if (arg.startsWith('fields:')) {
          foreignKey = arg
            .replace('fields:', '')
            .replace('[', '')
            .replace(']', '')
            .trim();
        }
        if (arg.startsWith('references:')) {
          references = arg
            .replace('references:', '')
            .replace('[', '')
            .replace(']', '')
            .trim();
        }
      }
    }

    // Determine relation type
    let relationType: 'one-to-one' | 'one-to-many' | 'many-to-many';

    if (field.isList) {
      // Check if the other side is also a list (many-to-many)
      const reverseField = toModel.fields.find(
        (f) => f.type === fromModel.name && f.isList
      );
      relationType = reverseField ? 'many-to-many' : 'one-to-many';
    } else {
      relationType = 'one-to-one';
    }

    return {
      name: field.name,
      type: relationType,
      fromModel: fromModel.name,
      toModel: toModel.name,
      fromField: field.name,
      toField: references || 'id',
      foreignKey,
      references,
      isOptional: !field.isRequired,
    };
  }
}

/**
 * Parse a Prisma schema file
 */
export function parsePrismaSchema(schemaContent: string): ParsedSchema {
  const parser = new PrismaParser();
  return parser.parse(schemaContent);
}
