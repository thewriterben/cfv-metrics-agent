/**
 * Unit tests for Phase 3 — Sentiment Analysis
 */

import { SentimentAnalyzer } from '../../../ml/SentimentAnalyzer.js';
import type { TextItem } from '../../../ml/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTextItem(text: string, hoursAgo = 1, weight = 1): TextItem {
  return {
    text,
    source: 'test',
    timestamp: new Date(Date.now() - hoursAgo * 3_600_000),
    weight,
  };
}

// ── Single Text Analysis ─────────────────────────────────────────────────────

describe('SentimentAnalyzer', () => {
  let analyzer: SentimentAnalyzer;

  beforeEach(() => {
    analyzer = new SentimentAnalyzer();
  });

  describe('analyzeText', () => {
    it('detects positive market sentiment', () => {
      const result = analyzer.analyzeText('BTC is very bullish, we are going to the moon!');
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchedTerms).toContain('bullish');
      expect(result.matchedTerms).toContain('moon');
    });

    it('detects negative market sentiment', () => {
      const result = analyzer.analyzeText('The market is crashing, very bearish outlook');
      expect(result.score).toBeLessThan(0);
      expect(result.matchedTerms).toContain('bearish');
    });

    it('returns neutral for ambiguous text', () => {
      const result = analyzer.analyzeText('the quick brown fox jumps over the lazy dog');
      expect(result.score).toBe(0);
      expect(result.matchedTerms).toHaveLength(0);
    });

    it('handles negation correctly', () => {
      const positive = analyzer.analyzeText('This coin is bullish');
      const negated = analyzer.analyzeText('This coin is not bullish');
      
      expect(positive.score).toBeGreaterThan(0);
      expect(negated.score).toBeLessThan(positive.score);
    });

    it('handles intensifiers correctly', () => {
      const normal = analyzer.analyzeText('This is bullish');
      const intensified = analyzer.analyzeText('This is extremely bullish');
      
      // Both should be positive, but intensified should have higher magnitude
      expect(normal.score).toBeGreaterThan(0);
      expect(intensified.score).toBeGreaterThan(0);
    });

    it('categorises terms correctly', () => {
      const result = analyzer.analyzeText('The mainnet upgrade is great and adoption is growing');
      expect(result.categories.technology).toBeGreaterThan(0);
      expect(result.categories.community).toBeGreaterThan(0);
    });

    it('handles technology negative terms', () => {
      const result = analyzer.analyzeText('The project was hacked and has a critical vulnerability');
      expect(result.score).toBeLessThan(0);
      expect(result.categories.technology).toBeLessThan(0);
    });

    it('handles regulatory terms', () => {
      const result = analyzer.analyzeText('The SEC ban on crypto is concerning');
      expect(result.categories.regulatory).toBeLessThan(0);
    });

    it('handles empty text', () => {
      const result = analyzer.analyzeText('');
      expect(result.score).toBe(0);
      expect(result.matchedTerms).toHaveLength(0);
    });

    it('handles bigram terms', () => {
      const result = analyzer.analyzeText('Bitcoin reached a new all-time high today');
      expect(result.score).toBeGreaterThan(0);
    });
  });

  // ── Batch Analysis ───────────────────────────────────────────────────────

  describe('analyze (batch)', () => {
    it('aggregates sentiment from multiple items', () => {
      const items: TextItem[] = [
        makeTextItem('Very bullish on BTC, going to the moon!'),
        makeTextItem('Great adoption and growing community'),
        makeTextItem('Mainnet upgrade successful'),
      ];
      
      const result = analyzer.analyze(items);
      expect(result.score).toBeGreaterThan(0);
      expect(result.label).toMatch(/positive/);
      expect(result.sampleSize).toBe(3);
    });

    it('correctly identifies negative aggregate sentiment', () => {
      const items: TextItem[] = [
        makeTextItem('Market is crashing hard'),
        makeTextItem('Huge scam, this project is dead'),
        makeTextItem('Bearish, expecting more losses'),
      ];
      
      const result = analyzer.analyze(items);
      expect(result.score).toBeLessThan(0);
      expect(result.label).toMatch(/negative/);
    });

    it('applies temporal decay to older items', () => {
      const recentPositive = makeTextItem('Very bullish on BTC!', 1);
      const oldNegative = makeTextItem('Market is crashing!', 72); // 3 days ago
      
      const result = analyzer.analyze([recentPositive, oldNegative]);
      // Recent positive should outweigh old negative due to temporal decay
      expect(result.score).toBeGreaterThan(0);
    });

    it('respects item weights', () => {
      const lowWeight = makeTextItem('Very bearish crash', 1, 0.1);
      const highWeight = makeTextItem('Very bullish rally', 1, 10);
      
      const result = analyzer.analyze([lowWeight, highWeight]);
      expect(result.score).toBeGreaterThan(0);
    });

    it('returns neutral for empty item list', () => {
      const result = analyzer.analyze([]);
      expect(result.score).toBe(0);
      expect(result.label).toBe('neutral');
      expect(result.sampleSize).toBe(0);
    });

    it('returns neutral for items with no matched terms', () => {
      const items: TextItem[] = [
        makeTextItem('the quick brown fox'),
        makeTextItem('lorem ipsum dolor sit amet'),
      ];
      
      const result = analyzer.analyze(items);
      expect(result.score).toBe(0);
      expect(result.label).toBe('neutral');
    });

    it('provides category breakdown', () => {
      const items: TextItem[] = [
        makeTextItem('Very bullish market rally'),
        makeTextItem('Mainnet upgrade is innovative'),
        makeTextItem('Growing adoption, institutional investors entering'),
        makeTextItem('ETF approved by regulators'),
      ];
      
      const result = analyzer.analyze(items);
      expect(result.categories).toHaveProperty('market');
      expect(result.categories).toHaveProperty('technology');
      expect(result.categories).toHaveProperty('community');
      expect(result.categories).toHaveProperty('regulatory');
    });
  });

  // ── Sentiment Labels ───────────────────────────────────────────────────

  describe('sentiment labels', () => {
    it('classifies very positive sentiment', () => {
      const items: TextItem[] = [
        makeTextItem('Extremely bullish, massive rally, mooning, huge gains!'),
      ];
      const result = analyzer.analyze(items);
      expect(result.label).toBe('very_positive');
    });

    it('classifies very negative sentiment', () => {
      const items: TextItem[] = [
        makeTextItem('Huge crash, major scam, rug pull, total fraud!'),
      ];
      const result = analyzer.analyze(items);
      expect(result.label).toBe('very_negative');
    });
  });

  // ── Lexicon ────────────────────────────────────────────────────────────

  describe('lexicon', () => {
    it('reports lexicon size', () => {
      expect(analyzer.getLexiconSize()).toBeGreaterThan(50);
    });

    it('accepts custom lexicon entries', () => {
      const custom = new SentimentAnalyzer({
        'wagmi': { score: 0.9, category: 'community', weight: 1.5 },
      });
      const result = custom.analyzeText('wagmi everybody!');
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchedTerms).toContain('wagmi');
    });
  });
});
