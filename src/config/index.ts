/**
 * Configuration loader and default values
 */

import type { GenerationConfig, PrivacyConfig } from '../types.js';
import { readFileSync, existsSync } from 'fs';

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  piiFieldPatterns: ['email', 'phone', 'address', 'ssn', 'password'],
  syntheticSuffix: '_test',
  clearlyFake: true,
  emailDomain: 'example.com',
};

export const DEFAULT_CONFIG: Partial<GenerationConfig> = {
  output: {
    format: 'json',
    path: './synthetic-data.json',
    prettyPrint: true,
    includeStats: true,
  },
  counts: {},
  distributions: {},
  dateRanges: {},
  fieldOverrides: {},
  privacy: DEFAULT_PRIVACY_CONFIG,
};

/**
 * Load configuration from a JSON file
 */
export function loadConfig(configPath: string): Partial<GenerationConfig> {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  return mergeConfig(DEFAULT_CONFIG, config);
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  defaults: Partial<GenerationConfig>,
  userConfig: Partial<GenerationConfig>
): GenerationConfig {
  return {
    schema: userConfig.schema || '',
    output: {
      ...defaults.output,
      ...userConfig.output,
    } as GenerationConfig['output'],
    counts: {
      ...defaults.counts,
      ...userConfig.counts,
    },
    distributions: {
      ...defaults.distributions,
      ...userConfig.distributions,
    },
    dateRanges: {
      ...defaults.dateRanges,
      ...userConfig.dateRanges,
    },
    fieldOverrides: {
      ...defaults.fieldOverrides,
      ...userConfig.fieldOverrides,
    },
    privacy: {
      ...defaults.privacy,
      ...userConfig.privacy,
    } as PrivacyConfig,
    seed: userConfig.seed,
  };
}

/**
 * Create a config object from CLI options
 */
export function createConfigFromOptions(options: {
  schema: string;
  output?: string;
  format?: 'json' | 'sql' | 'both';
  count?: number;
  seed?: number;
}): GenerationConfig {
  const config = mergeConfig(DEFAULT_CONFIG, {
    schema: options.schema,
    output: {
      format: options.format || 'json',
      path: options.output || './synthetic-data.json',
      prettyPrint: true,
      includeStats: true,
    },
    seed: options.seed,
  });

  // If count is provided, apply to all models
  if (options.count) {
    // Will be applied during generation
    (config as any).defaultCount = options.count;
  }

  return config;
}
