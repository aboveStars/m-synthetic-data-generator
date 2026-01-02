/**
 * Dependency Graph for Model Ordering
 * Ensures models are generated in the correct order (parents before children)
 */

import type { ParsedSchema, Model, Relation } from '../types.js';

interface GraphNode {
  model: Model;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export class DependencyGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private schema: ParsedSchema;

  constructor(schema: ParsedSchema) {
    this.schema = schema;
    this.buildGraph();
  }

  /**
   * Build the dependency graph from schema
   */
  private buildGraph(): void {
    // Initialize nodes for all models
    for (const model of this.schema.models) {
      this.nodes.set(model.name, {
        model,
        dependencies: new Set(),
        dependents: new Set(),
      });
    }

    // Add dependencies based on relations
    for (const model of this.schema.models) {
      for (const relation of model.relations) {
        // If this model has a foreign key, it depends on the other model
        if (relation.foreignKey) {
          const node = this.nodes.get(model.name);
          const dependsOn = relation.toModel;

          // Don't add self-references as hard dependencies
          if (dependsOn !== model.name && this.nodes.has(dependsOn)) {
            node?.dependencies.add(dependsOn);

            const parentNode = this.nodes.get(dependsOn);
            parentNode?.dependents.add(model.name);
          }
        }
      }
    }
  }

  /**
   * Get the generation order using topological sort
   */
  getGenerationOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (modelName: string): void => {
      if (visited.has(modelName)) return;
      if (visiting.has(modelName)) {
        // Circular dependency - will be handled separately
        return;
      }

      visiting.add(modelName);

      const node = this.nodes.get(modelName);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(modelName);
      visited.add(modelName);
      order.push(modelName);
    };

    // Visit all models
    for (const modelName of this.nodes.keys()) {
      if (!visited.has(modelName)) {
        visit(modelName);
      }
    }

    return order;
  }

  /**
   * Detect cycles in the dependency graph
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const inStack = new Set<string>();

    const dfs = (modelName: string): void => {
      if (inStack.has(modelName)) {
        // Found a cycle
        const cycleStart = stack.indexOf(modelName);
        const cycle = stack.slice(cycleStart);
        cycles.push([...cycle, modelName]);
        return;
      }

      if (visited.has(modelName)) return;

      visited.add(modelName);
      stack.push(modelName);
      inStack.add(modelName);

      const node = this.nodes.get(modelName);
      if (node) {
        for (const dep of node.dependencies) {
          dfs(dep);
        }
      }

      stack.pop();
      inStack.delete(modelName);
    };

    for (const modelName of this.nodes.keys()) {
      if (!visited.has(modelName)) {
        dfs(modelName);
      }
    }

    return cycles;
  }

  /**
   * Get models that depend on a given model
   */
  getDependents(modelName: string): string[] {
    return Array.from(this.nodes.get(modelName)?.dependents || []);
  }

  /**
   * Get models that a given model depends on
   */
  getDependencies(modelName: string): string[] {
    return Array.from(this.nodes.get(modelName)?.dependencies || []);
  }

  /**
   * Get self-referencing fields (for circular dependencies)
   */
  getSelfReferences(modelName: string): Relation[] {
    const model = this.schema.models.find((m) => m.name === modelName);
    if (!model) return [];

    return model.relations.filter((r) => r.toModel === modelName);
  }

  /**
   * Check if a field is a deferred relation (to be filled later)
   */
  isDeferredField(modelName: string, fieldName: string): boolean {
    const model = this.schema.models.find((m) => m.name === modelName);
    if (!model) return false;

    const relation = model.relations.find((r) => r.fromField === fieldName);
    if (!relation) return false;

    // Self-references are always deferred
    if (relation.toModel === modelName) return true;

    // Check if there's a cycle involving this relation
    const cycles = this.detectCycles();
    return cycles.some(
      (cycle) => cycle.includes(modelName) && cycle.includes(relation.toModel)
    );
  }
}
