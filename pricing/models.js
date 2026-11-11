(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.llmPriceCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Checked November 12, 2026 (Asia/Shanghai) against:
  // https://aistudio.google.com/docs/pricing
  // https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/
  // https://platform.claude.com/docs/en/about-claude/pricing
  // https://www.anthropic.com/claude-fable-and-mythos-5-2
  // Google states the calendar dates and does not name a billing timezone.
  const CARBON_CUTOVER = '2026-12-01';
  const CARBON_RATES = {
    introductory: { input: 2, output: 10, cache: 0.1 },
    standard: { input: 4, output: 20, cache: 0.2 }
  };
  const FABLE_BASE = {
    standard: { input: 8, output: 40 },
    fast: { input: 16, output: 80 },
    batch: { input: 4, output: 20 }
  };
  // Published Fable 5.2 ratios against the active base input price.
  // Standard table: hit $0.20 = 0.025x of $8, 5-minute write $10 = 1.25x, 1-hour write $16 = 2x.
  // Fast and Batch use the same ratios on their own base input price.
  const FABLE_CACHE = { hit: 0.025, write5m: 1.25, write1h: 2 };
  const US_MULTIPLIER = 1.1;
  const LEGACY_MONTHLY_RATES = {
    haikuShort: [0.1, 0.5],
    haikuLong: [0.5, 2.5],
    haiku: [0.1, 0.5],
    sonnet: [2, 10],
    opus: [4, 20],
    step5: [1, 2.7]
  };

  function round6(n) {
    return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  }

  function tokensOf(value, name) {
    const n = value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1e12) {
      throw new RangeError(name + ' must be a number from 0 to 1,000,000,000,000.');
    }
    return n;
  }

  function requestsOf(value) {
    if (value === undefined || value === '') return 1;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) {
      throw new RangeError('Requests must be a number from 0 to 1,000,000,000.');
    }
    return n;
  }

  function dollars(parts, geo) {
    let centsScaled = 0;
    for (const part of parts) {
      const centsPerMillion = Math.round(part.perMillion * 100);
      centsScaled += part.tokens * centsPerMillion;
    }
    if (geo === 'us') centsScaled = centsScaled * 11 / 10;
    else if (geo !== 'global') throw new RangeError('Inference geography must be global or us.');
    return round6(centsScaled / 1e8);
  }

  function assertIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new RangeError('Billing date must be YYYY-MM-DD.');
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
      throw new RangeError('Billing date must be a real calendar date.');
    }
    return value;
  }

  function calendarDate(instant, timeZone) {
    const date = instant instanceof Date ? instant : new Date(instant);
    if (Number.isNaN(date.getTime())) throw new RangeError('Invalid instant.');
    let formatter;
    try {
      formatter = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (error) {
      throw new RangeError('Unknown time zone.');
    }
    const parts = formatter.formatToParts(date);
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    return year + '-' + month + '-' + day;
  }

  function resolveCarbonSchedule(options) {
    const input = options || {};
    if (input.billingDate && input.billingDate !== 'auto') {
      const calendar = assertIsoDate(input.billingDate);
      return {
        calendar: calendar,
        period: calendar < CARBON_CUTOVER ? 'introductory' : 'standard',
        source: 'explicit',
        timeZone: null
      };
    }
    const timeZone = input.timeZone || 'UTC';
    const calendar = calendarDate(input.now === undefined ? new Date() : input.now, timeZone);
    return {
      calendar: calendar,
      period: calendar < CARBON_CUTOVER ? 'introductory' : 'standard',
      source: 'auto',
      timeZone: timeZone
    };
  }

  function estimateCarbon(input) {
    const options = input || {};
    const schedule = resolveCarbonSchedule(options);
    const rates = CARBON_RATES[schedule.period];
    const inputTokens = tokensOf(options.inputTokens, 'Input tokens');
    const cachedTokens = tokensOf(options.cachedTokens, 'Cached tokens');
    const outputTokens = tokensOf(options.outputTokens, 'Output tokens');
    const thinkingTokens = tokensOf(options.thinkingTokens, 'Thinking tokens');
    const requests = requestsOf(options.requests);
    const perRequest = dollars([
      { tokens: inputTokens, perMillion: rates.input },
      { tokens: cachedTokens, perMillion: rates.cache },
      { tokens: outputTokens + thinkingTokens, perMillion: rates.output }
    ], 'global');
    return {
      model: 'gemini-4-carbon',
      route: 'gemini-developer-api',
      freeTier: false,
      explicitCache: false,
      thinkingBilledAs: 'output',
      calendar: schedule.calendar,
      period: schedule.period,
      source: schedule.source,
      timeZone: schedule.timeZone,
      rates: { input: rates.input, output: rates.output, cache: rates.cache },
      billableOutput: outputTokens + thinkingTokens,
      perRequest: perRequest,
      monthly: round6(perRequest * requests),
      requests: requests
    };
  }

  function fableRates(mode) {
    const base = FABLE_BASE[mode];
    if (!base) throw new RangeError('Mode must be standard, fast, or batch.');
    return {
      input: base.input,
      output: base.output,
      cacheHit: round6(base.input * FABLE_CACHE.hit),
      cacheWrite5m: round6(base.input * FABLE_CACHE.write5m),
      cacheWrite1h: round6(base.input * FABLE_CACHE.write1h)
    };
  }

  function estimateFable(input) {
    const options = input || {};
    const mode = options.mode || 'standard';
    const inferenceGeo = options.inferenceGeo || 'global';
    if (inferenceGeo !== 'global' && inferenceGeo !== 'us') {
      throw new RangeError('Inference geography must be global or us.');
    }
    const rates = fableRates(mode);
    const inputTokens = tokensOf(options.inputTokens, 'Input tokens');
    const cacheReadTokens = tokensOf(options.cacheReadTokens, 'Cache-read tokens');
    const cacheWrite5mTokens = tokensOf(options.cacheWrite5mTokens, '5-minute cache-write tokens');
    const cacheWrite1hTokens = tokensOf(options.cacheWrite1hTokens, '1-hour cache-write tokens');
    const outputTokens = tokensOf(options.outputTokens, 'Output tokens');
    const thinkingTokens = tokensOf(options.thinkingTokens, 'Thinking tokens');
    const requests = requestsOf(options.requests);
    const perRequest = dollars([
      { tokens: inputTokens, perMillion: rates.input },
      { tokens: cacheReadTokens, perMillion: rates.cacheHit },
      { tokens: cacheWrite5mTokens, perMillion: rates.cacheWrite5m },
      { tokens: cacheWrite1hTokens, perMillion: rates.cacheWrite1h },
      { tokens: outputTokens + thinkingTokens, perMillion: rates.output }
    ], inferenceGeo);
    return {
      model: 'claude-fable-5-2',
      mode: mode,
      inferenceGeo: inferenceGeo,
      fastBatchAllowed: false,
      thinkingBilledAs: 'output',
      rates: rates,
      billableOutput: outputTokens + thinkingTokens,
      perRequest: perRequest,
      monthly: round6(perRequest * requests),
      requests: requests
    };
  }

  function compareSameWorkload(tokens, options) {
    const source = tokens || {};
    const settings = options || {};
    const shared = {
      inputTokens: source.inputTokens || 0,
      outputTokens: source.outputTokens || 0,
      thinkingTokens: source.thinkingTokens || 0,
      requests: source.requests
    };
    const cached = source.cachedTokens !== undefined ? source.cachedTokens : (source.cacheReadTokens || 0);
    const geo = settings.inferenceGeo || 'global';
    const fable = {
      inputTokens: shared.inputTokens,
      outputTokens: shared.outputTokens,
      thinkingTokens: shared.thinkingTokens,
      requests: shared.requests,
      cacheReadTokens: source.cacheReadTokens !== undefined ? source.cacheReadTokens : cached,
      cacheWrite5mTokens: source.cacheWrite5mTokens || 0,
      cacheWrite1hTokens: source.cacheWrite1hTokens || 0,
      inferenceGeo: geo
    };
    return {
      carbonIntroductory: estimateCarbon(Object.assign({ cachedTokens: cached, billingDate: '2026-11-30' }, shared)),
      carbonStandard: estimateCarbon(Object.assign({ cachedTokens: cached, billingDate: '2026-12-01' }, shared)),
      fableStandard: estimateFable(Object.assign({ mode: 'standard' }, fable)),
      fableFast: estimateFable(Object.assign({ mode: 'fast' }, fable)),
      fableBatch: estimateFable(Object.assign({ mode: 'batch' }, fable)),
      carbonIncludesCacheWrites: false
    };
  }

  function legacyMonthly(model, inputTokens, outputTokens) {
    const rates = LEGACY_MONTHLY_RATES[model];
    if (!rates) throw new RangeError('Unknown model.');
    return dollars([
      { tokens: tokensOf(inputTokens, 'Input tokens'), perMillion: rates[0] },
      { tokens: tokensOf(outputTokens, 'Output tokens'), perMillion: rates[1] }
    ], 'global');
  }

  function moneyNote(amount) {
    return '$' + amount.toFixed(2);
  }

  function hubMonthly(model, fields) {
    const input = fields || {};
    if (LEGACY_MONTHLY_RATES[model]) {
      const rates = LEGACY_MONTHLY_RATES[model];
      return {
        monthly: legacyMonthly(model, input.inputTokens, input.outputTokens),
        note: moneyNote(rates[0]) + ' input + ' + moneyNote(rates[1]) + ' output per MTok'
      };
    }
    if (model === 'carbon') {
      const result = estimateCarbon({
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cachedTokens: input.cachedTokens,
        thinkingTokens: input.thinkingTokens,
        billingDate: input.billingDate,
        timeZone: input.timeZone,
        now: input.now,
        requests: 1
      });
      const label = result.period === 'introductory' ? 'Introductory' : 'Standard';
      return {
        monthly: result.perRequest,
        period: result.period,
        calendar: result.calendar,
        note: label + ' ' + result.calendar + ': ' + moneyNote(result.rates.input) + ' input, ' + moneyNote(result.rates.cache) + ' implicit cache, ' + moneyNote(result.rates.output) + ' output including thinking per MTok'
      };
    }
    if (model === 'fable') {
      const result = estimateFable({
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadTokens: input.cachedTokens,
        thinkingTokens: input.thinkingTokens,
        mode: 'standard',
        inferenceGeo: 'global',
        requests: 1
      });
      return {
        monthly: result.perRequest,
        note: '$8.00 input + $40.00 output per MTok, standard global. Cache hits use $0.20. Fast, Batch, and US inference are on the Fable page.'
      };
    }
    throw new RangeError('Unknown model.');
  }

  return {
    CARBON_CUTOVER: CARBON_CUTOVER,
    CARBON_RATES: CARBON_RATES,
    FABLE_BASE: FABLE_BASE,
    FABLE_CACHE: FABLE_CACHE,
    US_MULTIPLIER: US_MULTIPLIER,
    LEGACY_MONTHLY_RATES: LEGACY_MONTHLY_RATES,
    calendarDate: calendarDate,
    resolveCarbonSchedule: resolveCarbonSchedule,
    estimateCarbon: estimateCarbon,
    estimateFable: estimateFable,
    fableRates: fableRates,
    compareSameWorkload: compareSameWorkload,
    legacyMonthly: legacyMonthly,
    hubMonthly: hubMonthly
  };
});
