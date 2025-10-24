/**
 * Anthropic Client Wrapper
 *
 * Centralized client for Claude API with configuration and error handling
 */

import Anthropic from '@anthropic-ai/sdk';

// Singleton client instance
let anthropicClient: Anthropic | null = null;

/**
 * Get or create Anthropic client instance
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. ' +
        'Please add it to your .env.local file.'
      );
    }

    anthropicClient = new Anthropic({
      apiKey,
    });
  }

  return anthropicClient;
}

/**
 * Default model configuration
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
export const DEFAULT_MAX_TOKENS = 4096;

/**
 * API rate limits and costs
 */
export const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 50,
  MAX_TOKENS_PER_REQUEST: 200000, // Claude 3.5 Sonnet context window
};

export const COSTS = {
  INPUT_COST_PER_1M_TOKENS: 3.0,   // $3 per 1M input tokens
  OUTPUT_COST_PER_1M_TOKENS: 15.0, // $15 per 1M output tokens
};

/**
 * Calculate estimated cost based on token usage
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * COSTS.INPUT_COST_PER_1M_TOKENS;
  const outputCost = (outputTokens / 1_000_000) * COSTS.OUTPUT_COST_PER_1M_TOKENS;
  return inputCost + outputCost;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}
