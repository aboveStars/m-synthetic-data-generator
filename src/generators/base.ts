/**
 * Base generator interface and abstract class
 */

import type { Field, GenerationContext, FieldGenerator } from '../types.js';

/**
 * Abstract base class for field generators
 */
export abstract class BaseGenerator<T = unknown> implements FieldGenerator<T> {
  protected fieldTypes: string[];

  constructor(fieldTypes: string[]) {
    this.fieldTypes = fieldTypes;
  }

  abstract generate(context: GenerationContext): T;

  canHandle(field: Field): boolean {
    return this.fieldTypes.includes(field.type);
  }
}

/**
 * Registry for field generators
 */
export class GeneratorRegistry {
  private generators: FieldGenerator[] = [];

  register(generator: FieldGenerator): void {
    this.generators.push(generator);
  }

  getGenerator(field: Field): FieldGenerator | null {
    for (const generator of this.generators) {
      if (generator.canHandle(field)) {
        return generator;
      }
    }
    return null;
  }

  getAllGenerators(): FieldGenerator[] {
    return [...this.generators];
  }
}
