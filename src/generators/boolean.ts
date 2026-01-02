/**
 * Boolean field generator
 */

import { BaseGenerator } from './base.js';
import type { GenerationContext } from '../types.js';
import { weightedRandom } from '../utils/random.js';

/**
 * Boolean generator with smart defaults based on field name
 */
export class BooleanGenerator extends BaseGenerator<boolean> {
  constructor() {
    super(['Boolean']);
  }

  generate(context: GenerationContext): boolean {
    const { currentField } = context;
    const fieldName = currentField.name.toLowerCase();

    // Check for default value
    if (currentField.default) {
      const defaultVal = currentField.default.value.toLowerCase();
      if (defaultVal === 'true' || defaultVal === 'false') {
        // Use default value more often but not always
        const defaultBool = defaultVal === 'true';
        return weightedRandom([defaultBool, !defaultBool], [0.8, 0.2]);
      }
    }

    // Smart detection based on field name
    if (this.isActiveField(fieldName)) {
      return weightedRandom([true, false], [0.85, 0.15]); // 85% active
    }

    if (this.isVerifiedField(fieldName)) {
      return weightedRandom([true, false], [0.7, 0.3]); // 70% verified
    }

    if (this.isDeletedField(fieldName)) {
      return weightedRandom([false, true], [0.95, 0.05]); // 5% deleted
    }

    if (this.isAdminField(fieldName)) {
      return weightedRandom([false, true], [0.95, 0.05]); // 5% admin
    }

    if (this.isEnabledField(fieldName)) {
      return weightedRandom([true, false], [0.9, 0.1]); // 90% enabled
    }

    // Default: 50/50
    return Math.random() < 0.5;
  }

  private isActiveField(name: string): boolean {
    return (
      name === 'active' ||
      name === 'isactive' ||
      name === 'is_active'
    );
  }

  private isVerifiedField(name: string): boolean {
    return (
      name.includes('verified') ||
      name.includes('confirmed') ||
      name.includes('validated')
    );
  }

  private isDeletedField(name: string): boolean {
    return (
      name === 'deleted' ||
      name === 'isdeleted' ||
      name === 'is_deleted' ||
      name.includes('archived')
    );
  }

  private isAdminField(name: string): boolean {
    return (
      name === 'admin' ||
      name === 'isadmin' ||
      name === 'is_admin' ||
      name.includes('superuser')
    );
  }

  private isEnabledField(name: string): boolean {
    return (
      name === 'enabled' ||
      name === 'isenabled' ||
      name === 'is_enabled'
    );
  }
}
