import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const createI18n = require('../../../compat/i18n.cjs');

test('modelPricing resolves known Gemini, Claude and GPT models and returns null for unknown models', () => {
  const i18n = createI18n('en');

  assert.deepEqual(i18n.modelPricing('Gemini 4 Carbon (High)'), { in: 4, read: 0.2, write: 4, out: 20 });
  assert.deepEqual(i18n.modelPricing('Orchestrator (Carbon)'), { in: 4, read: 0.2, write: 4, out: 20 });
  assert.deepEqual(i18n.modelPricing('Gemini 4 Neon (Medium)'), { in: 3, read: 0.15, write: 3, out: 15 });
  assert.deepEqual(i18n.modelPricing('Gemini 4 Hydrogen (Medium)'), { in: 1.5, read: 0.075, write: 1.5, out: 7.5 });
  assert.deepEqual(i18n.modelPricing('Gemini 3.8 Flash (High)'), { in: 0.75, read: 0.075, write: 0.75, out: 3.75 });
  assert.deepEqual(i18n.modelPricing('Claude Opus 5.5 (Medium)'), { in: 4, read: 0.2, write: 5, out: 20 });
  assert.deepEqual(i18n.modelPricing('Claude Sonnet 5.5 (Low)'), { in: 2, read: 0.1, write: 2.5, out: 10 });
  assert.deepEqual(i18n.modelPricing('GPT-OSS 120B (Medium)'), { in: 0.15, read: 0.075, write: 0.15, out: 0.6 });
  assert.equal(i18n.modelPricing('Unknown Custom Model'), null);
  assert.equal(i18n.modelPricing(''), null);
});

test('calcCost handles both ledger fields and inline-widget token fields', () => {
  const i18n = createI18n('en');

  // 1M uncached ($4) + 2M cacheRead ($0.4) + 0.5M cacheWrite ($2.5) + 0.25M output ($5) = $11.90
  const ledgerCost = i18n.calcCost('Claude Opus 5.5 (Medium)', {
    uncached: 1_000_000,
    cacheRead: 2_000_000,
    cacheWrite: 500_000,
    output: 250_000,
  });
  assert.ok(Math.abs(ledgerCost - 11.9) < 1e-9);

  const inlineCost = i18n.calcCost('Gemini 4 Hydrogen (Medium)', {
    uncachedTokens: 1_000_000,
    cachedTokens: 1_000_000,
    cacheWriteTokens: 0,
    outputTokens: 1_000_000,
  });
  assert.ok(Math.abs(inlineCost - 9.075) < 1e-9);

  assert.equal(i18n.calcCost('Unknown Model', { uncached: 1000 }), null);
});

test('sumUsageCost aggregates date ranges and respects disabled models', () => {
  const i18n = createI18n('en');
  const days = [
    {
      date: '2026-11-18',
      models: {
        'Gemini 4 Carbon (High)': { uncached: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 }, // $4.00
        'Claude Sonnet 5.5 (Low)': { uncached: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 }, // $2.00
      },
    },
    {
      date: '2026-11-19',
      models: {
        'Gemini 4 Hydrogen (Medium)': { uncached: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 }, // $1.50
      },
    },
  ];

  assert.ok(Math.abs(i18n.sumUsageCost(days, '2026-11-19', '2026-11-19') - 1.5) < 1e-9);
  assert.ok(Math.abs(i18n.sumUsageCost(days, '2026-11-01', '2026-11-19') - 7.5) < 1e-9);
  assert.ok(Math.abs(i18n.sumUsageCost(days, null, null, new Set(['Gemini 4 Carbon (High)'])) - 3.5) < 1e-9);
  assert.equal(i18n.sumUsageCost([], '2026-11-19', '2026-11-19'), null);
});

test('formatUsd formats small, regular, large and invalid values cleanly', () => {
  const i18n = createI18n('en');

  assert.equal(i18n.formatUsd(0), '$0.00');
  assert.equal(i18n.formatUsd(0.0042), '$0.0042');
  assert.equal(i18n.formatUsd(12.345), '$12.35');
  assert.equal(i18n.formatUsd(1234.5), '$1,234.50');
  assert.equal(i18n.formatUsd(null), '—');
  assert.equal(i18n.formatUsd(Number.NaN), '—');
});
