/**
 * Phase 3 — Sentiment Analysis
 *
 * Lexicon-based sentiment analysis tailored for cryptocurrency discussions.
 * Uses a curated dictionary of crypto-specific terms with sentiment weights.
 *
 * The analyzer processes text from social media sources (Reddit, Twitter)
 * and produces a sentiment score that can be integrated into validation
 * and prediction pipelines.
 *
 * No external NLP libraries required — uses pure TypeScript with a
 * domain-specific lexicon for crypto sentiment.
 */

import type { SentimentScore, SentimentCategories, TextItem } from './types.js';

// ── Crypto-Specific Sentiment Lexicon ────────────────────────────────────────

interface LexiconEntry {
  score: number;           // −1 to +1
  category: keyof SentimentCategories;
  weight: number;          // importance multiplier (default: 1)
}

/**
 * Curated cryptocurrency sentiment lexicon.
 * Scores: negative (−1 to −0.1), neutral (0), positive (0.1 to 1)
 */
const CRYPTO_LEXICON: Record<string, LexiconEntry> = {
  // ── Market Positive ──────────────────────────────────────────
  'bullish':       { score: 0.8, category: 'market', weight: 1.5 },
  'moon':          { score: 0.7, category: 'market', weight: 1.0 },
  'mooning':       { score: 0.8, category: 'market', weight: 1.0 },
  'pump':          { score: 0.5, category: 'market', weight: 0.8 },
  'rally':         { score: 0.7, category: 'market', weight: 1.2 },
  'breakout':      { score: 0.6, category: 'market', weight: 1.0 },
  'ath':           { score: 0.7, category: 'market', weight: 1.2 },
  'all-time high': { score: 0.7, category: 'market', weight: 1.2 },
  'buy':           { score: 0.3, category: 'market', weight: 0.8 },
  'hodl':          { score: 0.5, category: 'market', weight: 1.0 },
  'accumulate':    { score: 0.4, category: 'market', weight: 0.8 },
  'undervalued':   { score: 0.6, category: 'market', weight: 1.2 },
  'recovery':      { score: 0.5, category: 'market', weight: 1.0 },
  'gain':          { score: 0.4, category: 'market', weight: 0.8 },
  'gains':         { score: 0.4, category: 'market', weight: 0.8 },
  'profit':        { score: 0.5, category: 'market', weight: 1.0 },
  'profitable':    { score: 0.5, category: 'market', weight: 1.0 },
  'surge':         { score: 0.6, category: 'market', weight: 1.0 },
  'soar':          { score: 0.7, category: 'market', weight: 1.0 },

  // ── Market Negative ──────────────────────────────────────────
  'bearish':       { score: -0.8, category: 'market', weight: 1.5 },
  'dump':          { score: -0.6, category: 'market', weight: 1.0 },
  'crash':         { score: -0.9, category: 'market', weight: 1.5 },
  'dip':           { score: -0.3, category: 'market', weight: 0.8 },
  'correction':    { score: -0.4, category: 'market', weight: 0.8 },
  'sell':          { score: -0.3, category: 'market', weight: 0.8 },
  'selling':       { score: -0.3, category: 'market', weight: 0.8 },
  'overvalued':    { score: -0.6, category: 'market', weight: 1.2 },
  'bubble':        { score: -0.7, category: 'market', weight: 1.2 },
  'fear':          { score: -0.6, category: 'market', weight: 1.0 },
  'fud':           { score: -0.5, category: 'market', weight: 1.0 },
  'rug':           { score: -0.9, category: 'market', weight: 1.5 },
  'rugpull':       { score: -0.9, category: 'market', weight: 1.5 },
  'scam':          { score: -0.9, category: 'market', weight: 1.5 },
  'fraud':         { score: -0.9, category: 'market', weight: 1.5 },
  'loss':          { score: -0.5, category: 'market', weight: 1.0 },
  'losses':        { score: -0.5, category: 'market', weight: 1.0 },
  'plunge':        { score: -0.7, category: 'market', weight: 1.0 },
  'tank':          { score: -0.6, category: 'market', weight: 1.0 },
  'tanking':       { score: -0.7, category: 'market', weight: 1.0 },

  // ── Technology Positive ──────────────────────────────────────
  'upgrade':       { score: 0.6, category: 'technology', weight: 1.2 },
  'mainnet':       { score: 0.7, category: 'technology', weight: 1.2 },
  'launch':        { score: 0.5, category: 'technology', weight: 1.0 },
  'scalability':   { score: 0.4, category: 'technology', weight: 0.8 },
  'scalable':      { score: 0.4, category: 'technology', weight: 0.8 },
  'decentralized': { score: 0.5, category: 'technology', weight: 1.0 },
  'innovation':    { score: 0.6, category: 'technology', weight: 1.0 },
  'innovative':    { score: 0.6, category: 'technology', weight: 1.0 },
  'partnership':   { score: 0.5, category: 'technology', weight: 1.0 },
  'integration':   { score: 0.4, category: 'technology', weight: 0.8 },
  'milestone':     { score: 0.5, category: 'technology', weight: 1.0 },
  'development':   { score: 0.3, category: 'technology', weight: 0.8 },
  'roadmap':       { score: 0.4, category: 'technology', weight: 0.8 },
  'defi':          { score: 0.3, category: 'technology', weight: 0.8 },
  'smart contract': { score: 0.3, category: 'technology', weight: 0.8 },
  'layer 2':       { score: 0.4, category: 'technology', weight: 0.8 },

  // ── Technology Negative ──────────────────────────────────────
  'bug':           { score: -0.5, category: 'technology', weight: 1.0 },
  'hack':          { score: -0.9, category: 'technology', weight: 1.5 },
  'hacked':        { score: -0.9, category: 'technology', weight: 1.5 },
  'exploit':       { score: -0.8, category: 'technology', weight: 1.5 },
  'vulnerability': { score: -0.7, category: 'technology', weight: 1.2 },
  'downtime':      { score: -0.6, category: 'technology', weight: 1.0 },
  'outage':        { score: -0.7, category: 'technology', weight: 1.2 },
  'delay':         { score: -0.4, category: 'technology', weight: 0.8 },
  'centralized':   { score: -0.4, category: 'technology', weight: 0.8 },
  'fork':          { score: -0.2, category: 'technology', weight: 0.6 },

  // ── Community Positive ───────────────────────────────────────
  'adoption':      { score: 0.7, category: 'community', weight: 1.2 },
  'community':     { score: 0.3, category: 'community', weight: 0.8 },
  'growing':       { score: 0.5, category: 'community', weight: 1.0 },
  'growth':        { score: 0.5, category: 'community', weight: 1.0 },
  'institutional': { score: 0.6, category: 'community', weight: 1.2 },
  'mainstream':    { score: 0.6, category: 'community', weight: 1.0 },
  'whale':         { score: 0.2, category: 'community', weight: 0.5 },
  'staking':       { score: 0.3, category: 'community', weight: 0.8 },
  'governance':    { score: 0.3, category: 'community', weight: 0.8 },

  // ── Community Negative ───────────────────────────────────────
  'dead':          { score: -0.8, category: 'community', weight: 1.2 },
  'dying':         { score: -0.7, category: 'community', weight: 1.0 },
  'abandoned':     { score: -0.8, category: 'community', weight: 1.2 },
  'exit scam':     { score: -0.9, category: 'community', weight: 1.5 },
  'ponzi':         { score: -0.9, category: 'community', weight: 1.5 },

  // ── Regulatory Positive ──────────────────────────────────────
  'regulation':    { score: 0.1, category: 'regulatory', weight: 0.5 },
  'compliant':     { score: 0.4, category: 'regulatory', weight: 0.8 },
  'compliance':    { score: 0.3, category: 'regulatory', weight: 0.8 },
  'approved':      { score: 0.7, category: 'regulatory', weight: 1.2 },
  'etf':           { score: 0.5, category: 'regulatory', weight: 1.0 },
  'legal':         { score: 0.2, category: 'regulatory', weight: 0.5 },
  'legalized':     { score: 0.6, category: 'regulatory', weight: 1.0 },

  // ── Regulatory Negative ──────────────────────────────────────
  'ban':           { score: -0.8, category: 'regulatory', weight: 1.5 },
  'banned':        { score: -0.8, category: 'regulatory', weight: 1.5 },
  'crackdown':     { score: -0.7, category: 'regulatory', weight: 1.2 },
  'lawsuit':       { score: -0.6, category: 'regulatory', weight: 1.0 },
  'sec':           { score: -0.2, category: 'regulatory', weight: 0.5 },
  'fine':          { score: -0.5, category: 'regulatory', weight: 0.8 },
  'sanction':      { score: -0.6, category: 'regulatory', weight: 1.0 },
  'sanctions':     { score: -0.6, category: 'regulatory', weight: 1.0 },
  'illegal':       { score: -0.7, category: 'regulatory', weight: 1.0 },
};

// Negation words that flip sentiment
const NEGATION_WORDS = new Set([
  'not', "n't", 'no', 'never', 'neither', 'nor', 'none',
  'nobody', 'nothing', 'nowhere', 'hardly', 'barely', 'scarcely',
  "don't", "doesn't", "didn't", "won't", "wouldn't", "shouldn't",
  "couldn't", "isn't", "aren't", "wasn't", "weren't",
]);

// Intensifier words that amplify sentiment
const INTENSIFIERS: Record<string, number> = {
  'very': 1.5,
  'extremely': 2.0,
  'super': 1.5,
  'incredibly': 1.8,
  'absolutely': 1.8,
  'highly': 1.5,
  'massively': 1.8,
  'huge': 1.5,
  'major': 1.3,
  'slightly': 0.5,
  'somewhat': 0.7,
  'barely': 0.3,
  'minor': 0.5,
};

// ── Sentiment Analyzer ───────────────────────────────────────────────────────

export class SentimentAnalyzer {
  private lexicon: Record<string, LexiconEntry>;

  constructor(customLexicon?: Record<string, LexiconEntry>) {
    this.lexicon = { ...CRYPTO_LEXICON, ...customLexicon };
  }

  /**
   * Analyse a single text string and return a sentiment score.
   */
  analyzeText(text: string): {
    score: number;
    magnitude: number;
    matchedTerms: string[];
    categories: SentimentCategories;
  } {
    const words = this.tokenize(text);
    const matchedTerms: string[] = [];
    let totalScore = 0;
    let totalWeight = 0;
    const categoryScores: SentimentCategories = {
      market: 0,
      technology: 0,
      community: 0,
      regulatory: 0,
    };
    const categoryCounts: Record<keyof SentimentCategories, number> = {
      market: 0,
      technology: 0,
      community: 0,
      regulatory: 0,
    };

    for (let i = 0; i < words.length; i++) {
      // Check single words
      let entry = this.lexicon[words[i]];
      let term = words[i];

      // Check bigrams (e.g., "all-time high", "smart contract")
      if (i < words.length - 1) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (this.lexicon[bigram]) {
          entry = this.lexicon[bigram];
          term = bigram;
        }
      }

      if (!entry) continue;

      let score = entry.score;

      // Check for negation in preceding 3 words
      let negated = false;
      for (let j = Math.max(0, i - 3); j < i; j++) {
        if (NEGATION_WORDS.has(words[j])) {
          negated = true;
          break;
        }
      }
      if (negated) score *= -0.75;

      // Check for intensifiers in preceding 2 words
      for (let j = Math.max(0, i - 2); j < i; j++) {
        const multiplier = INTENSIFIERS[words[j]];
        if (multiplier !== undefined) {
          score *= multiplier;
          break;
        }
      }

      // Clamp score to [−1, 1]
      score = Math.max(-1, Math.min(1, score));

      totalScore += score * entry.weight;
      totalWeight += entry.weight;
      matchedTerms.push(term);

      categoryScores[entry.category] += score * entry.weight;
      categoryCounts[entry.category]++;
    }

    // Normalize
    const normalizedScore =
      totalWeight > 0 ? Math.max(-1, Math.min(1, totalScore / totalWeight)) : 0;
    const magnitude = totalWeight > 0 ? Math.min(1, totalWeight / words.length) : 0;

    // Normalize category scores
    for (const cat of Object.keys(categoryScores) as (keyof SentimentCategories)[]) {
      if (categoryCounts[cat] > 0) {
        categoryScores[cat] = categoryScores[cat] / categoryCounts[cat];
      }
    }

    return { score: normalizedScore, magnitude, matchedTerms, categories: categoryScores };
  }

  /**
   * Analyse multiple text items and produce an aggregate sentiment score.
   * More recent and higher-weighted items have greater influence.
   */
  analyze(items: TextItem[]): SentimentScore {
    if (items.length === 0) {
      return {
        score: 0,
        label: 'neutral',
        magnitude: 0,
        sampleSize: 0,
        categories: { market: 0, technology: 0, community: 0, regulatory: 0 },
      };
    }

    const now = Date.now();
    let totalScore = 0;
    let totalWeight = 0;
    const aggCategories: SentimentCategories = {
      market: 0,
      technology: 0,
      community: 0,
      regulatory: 0,
    };
    const categoryCounts: Record<keyof SentimentCategories, number> = {
      market: 0,
      technology: 0,
      community: 0,
      regulatory: 0,
    };

    for (const item of items) {
      const analysis = this.analyzeText(item.text);
      if (analysis.matchedTerms.length === 0) continue;

      // Temporal decay: half-life of 24 hours
      const ageHours = (now - item.timestamp.getTime()) / 3_600_000;
      const temporalWeight = Math.pow(0.5, ageHours / 24);

      const itemWeight = (item.weight ?? 1) * temporalWeight;

      totalScore += analysis.score * itemWeight;
      totalWeight += itemWeight;

      for (const cat of Object.keys(aggCategories) as (keyof SentimentCategories)[]) {
        if (analysis.categories[cat] !== 0) {
          aggCategories[cat] += analysis.categories[cat] * itemWeight;
          categoryCounts[cat] += itemWeight;
        }
      }
    }

    const score = totalWeight > 0 ? Math.max(-1, Math.min(1, totalScore / totalWeight)) : 0;
    const magnitude = totalWeight > 0 ? Math.min(1, totalWeight / items.length) : 0;

    // Normalize category scores
    for (const cat of Object.keys(aggCategories) as (keyof SentimentCategories)[]) {
      if (categoryCounts[cat] > 0) {
        aggCategories[cat] = aggCategories[cat] / categoryCounts[cat];
      }
    }

    return {
      score,
      label: this.classifyScore(score),
      magnitude,
      sampleSize: items.length,
      categories: aggCategories,
    };
  }

  /**
   * Get the current lexicon size.
   */
  getLexiconSize(): number {
    return Object.keys(this.lexicon).length;
  }

  // ── Private helpers ──────────────────────────────────────────

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  private classifyScore(score: number): SentimentScore['label'] {
    if (score > 0.5) return 'very_positive';
    if (score > 0.15) return 'positive';
    if (score < -0.5) return 'very_negative';
    if (score < -0.15) return 'negative';
    return 'neutral';
  }
}
