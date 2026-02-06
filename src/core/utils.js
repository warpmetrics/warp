// Warpmetrics SDK — Utilities

import { nanoid } from 'nanoid';

/**
 * Generate a prefixed unique ID.
 * @param {'run' | 'grp' | 'call'} prefix
 * @returns {string} e.g. "wm_run_a1b2c3d4e5f6"
 */
export function generateId(prefix) {
  return `wm_${prefix}_${nanoid(12)}`;
}

// ---------------------------------------------------------------------------
// Pricing (per 1 M tokens, USD)
// Best-effort — returns 0 for unknown models.
// ---------------------------------------------------------------------------

const PRICING = {
  // OpenAI
  'gpt-4o':                       { prompt: 2.50,  completion: 10.00 },
  'gpt-4o-2024-11-20':            { prompt: 2.50,  completion: 10.00 },
  'gpt-4o-mini':                  { prompt: 0.15,  completion: 0.60  },
  'gpt-4o-mini-2024-07-18':       { prompt: 0.15,  completion: 0.60  },
  'gpt-4-turbo':                  { prompt: 10.00, completion: 30.00 },
  'gpt-4-turbo-preview':          { prompt: 10.00, completion: 30.00 },
  'gpt-4':                        { prompt: 30.00, completion: 60.00 },
  'gpt-3.5-turbo':                { prompt: 0.50,  completion: 1.50  },
  'o1':                           { prompt: 15.00, completion: 60.00 },
  'o1-mini':                      { prompt: 3.00,  completion: 12.00 },
  'o3-mini':                      { prompt: 1.10,  completion: 4.40  },

  // Anthropic
  'claude-sonnet-4-5-20250514':   { prompt: 3.00,  completion: 15.00 },
  'claude-opus-4-6':              { prompt: 15.00, completion: 75.00 },
  'claude-3-5-sonnet-20241022':   { prompt: 3.00,  completion: 15.00 },
  'claude-3-5-sonnet-latest':     { prompt: 3.00,  completion: 15.00 },
  'claude-3-5-haiku-20241022':    { prompt: 0.80,  completion: 4.00  },
  'claude-3-5-haiku-latest':      { prompt: 0.80,  completion: 4.00  },
  'claude-3-opus-20240229':       { prompt: 15.00, completion: 75.00 },
  'claude-3-haiku-20240307':      { prompt: 0.25,  completion: 1.25  },
};

/**
 * Estimate cost from model name and token counts.
 * Returns 0 for unknown models.
 * @param {string} model
 * @param {{ prompt: number, completion: number }} tokens
 * @returns {number} cost in USD
 */
export function calculateCost(model, tokens) {
  const p = PRICING[model];
  if (!p) return 0;
  return (tokens.prompt / 1_000_000) * p.prompt
       + (tokens.completion / 1_000_000) * p.completion;
}
