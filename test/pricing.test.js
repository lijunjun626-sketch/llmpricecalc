const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const pricing = require('../pricing/models.js');
const argon = require('../gemini-4-argon-pricing/calculator.js');
const terra = require('../gpt-6-1-terra-pricing/calculator.js');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const SAMPLE = {
  inputTokens: 1_000_000,
  cachedTokens: 1_000_000,
  cacheReadTokens: 1_000_000,
  outputTokens: 200_000,
  thinkingTokens: 100_000
};

test('existing Argon and Terra calculators keep their published behavior', () => {
  assert.deepEqual(argon.estimate(10, 2), { intro: 40, later: 80, delta: 40 });
  assert.equal(argon.estimate(0.1, 0.025).intro, 0.45);
  assert.equal(terra.cost({ input: 1_000_000, cached: 0, output: 1_000_000 }, terra.RATES.terra, false), 6);
  assert.equal(terra.cost({ input: 1_000_000, cached: 1_000_000, output: 0 }, terra.RATES.terra, true), 0.025);
});

test('legacy hub rates are unchanged', () => {
  assert.equal(pricing.legacyMonthly('haikuShort', 10_000_000, 2_000_000), 2);
  assert.equal(pricing.legacyMonthly('haikuLong', 10_000_000, 2_000_000), 10);
  assert.equal(pricing.legacyMonthly('sonnet', 10_000_000, 2_000_000), 40);
  assert.equal(pricing.legacyMonthly('opus', 10_000_000, 2_000_000), 80);
  assert.equal(pricing.legacyMonthly('step5', 10_000_000, 2_000_000), 15.4);
  assert.equal(pricing.legacyMonthly('haiku', 10_000_000, 2_000_000), 2);
  const haiku = pricing.hubMonthly('haikuShort', {
    inputTokens: 10_000_000,
    outputTokens: 2_000_000,
    cachedTokens: 9_000_000,
    thinkingTokens: 9_000_000,
    billingDate: '2026-12-01',
    timeZone: 'Pacific/Kiritimati',
    now: '2026-12-01T00:00:00Z'
  });
  assert.equal(haiku.monthly, 2);
  assert.equal(haiku.note, '$0.10 input + $0.50 output per MTok');
});

test('Carbon introductory and December rates, with no free tier', () => {
  const intro = pricing.estimateCarbon({ inputTokens: 1_000_000, outputTokens: 1_000_000, billingDate: '2026-11-30' });
  const later = pricing.estimateCarbon({ inputTokens: 1_000_000, outputTokens: 1_000_000, billingDate: '2026-12-01' });
  assert.equal(intro.perRequest, 12);
  assert.equal(later.perRequest, 24);
  assert.equal(intro.rates.input, 2);
  assert.equal(intro.rates.output, 10);
  assert.equal(later.rates.input, 4);
  assert.equal(later.rates.output, 20);
  assert.equal(intro.freeTier, false);
  assert.equal(intro.explicitCache, false);
  assert.equal(intro.route, 'gemini-developer-api');
  assert.equal(pricing.estimateCarbon({ billingDate: '2026-11-12' }).perRequest, 0);
});

test('Carbon implicit cache and thinking billed as output', () => {
  const introCache = pricing.estimateCarbon({ cachedTokens: 1_000_000, billingDate: '2026-11-30' });
  const laterCache = pricing.estimateCarbon({ cachedTokens: 1_000_000, billingDate: '2026-12-01' });
  assert.equal(introCache.perRequest, 0.1);
  assert.equal(laterCache.perRequest, 0.2);
  const introThinking = pricing.estimateCarbon({ thinkingTokens: 1_000_000, billingDate: '2026-11-30' });
  const laterThinking = pricing.estimateCarbon({ thinkingTokens: 1_000_000, billingDate: '2026-12-01' });
  assert.equal(introThinking.perRequest, 10);
  assert.equal(laterThinking.perRequest, 20);
  assert.equal(introThinking.billableOutput, 1_000_000);
  assert.equal(introThinking.thinkingBilledAs, 'output');
  const mixed = pricing.estimateCarbon({
    inputTokens: 1_500_000,
    cachedTokens: 500_000,
    outputTokens: 100_000,
    thinkingTokens: 50_000,
    billingDate: '2026-11-30'
  });
  assert.equal(mixed.perRequest, 4.55);
});

test('explicit Carbon date wins over the clock and the time zone', () => {
  const intro = pricing.estimateCarbon({
    inputTokens: 1_000_000,
    billingDate: '2026-11-30',
    timeZone: 'Pacific/Kiritimati',
    now: '2026-12-15T00:00:00Z'
  });
  const later = pricing.estimateCarbon({
    inputTokens: 1_000_000,
    billingDate: '2026-12-01',
    timeZone: 'UTC',
    now: '2026-01-01T00:00:00Z'
  });
  assert.equal(intro.period, 'introductory');
  assert.equal(intro.source, 'explicit');
  assert.equal(intro.perRequest, 2);
  assert.equal(later.period, 'standard');
  assert.equal(later.perRequest, 4);
  assert.throws(() => pricing.estimateCarbon({ billingDate: '2026-02-31' }), /real calendar date/);
  assert.throws(() => pricing.estimateCarbon({ billingDate: '30 Nov 2026' }), /YYYY-MM-DD/);
});

test('Carbon auto mode switches on the calendar date inside the selected time zone', () => {
  const cases = [
    ['2026-11-30T23:59:59Z', 'UTC', '2026-11-30', 'introductory'],
    ['2026-12-01T00:00:00Z', 'UTC', '2026-12-01', 'standard'],
    ['2026-11-30T15:59:59Z', 'Asia/Shanghai', '2026-11-30', 'introductory'],
    ['2026-11-30T16:00:00Z', 'Asia/Shanghai', '2026-12-01', 'standard'],
    ['2026-12-01T07:59:59Z', 'America/Los_Angeles', '2026-11-30', 'introductory'],
    ['2026-12-01T08:00:00Z', 'America/Los_Angeles', '2026-12-01', 'standard'],
    ['2026-11-30T14:59:59Z', 'Asia/Tokyo', '2026-11-30', 'introductory'],
    ['2026-11-30T15:00:00Z', 'Asia/Tokyo', '2026-12-01', 'standard'],
    ['2026-11-30T09:59:59Z', 'Pacific/Kiritimati', '2026-11-30', 'introductory'],
    ['2026-11-30T10:00:00Z', 'Pacific/Kiritimati', '2026-12-01', 'standard'],
    ['2026-11-12T00:30:00+08:00', 'Asia/Shanghai', '2026-11-12', 'introductory']
  ];
  for (const [now, timeZone, calendar, period] of cases) {
    const result = pricing.resolveCarbonSchedule({ billingDate: 'auto', timeZone, now });
    assert.equal(result.calendar, calendar, now + ' ' + timeZone);
    assert.equal(result.period, period, now + ' ' + timeZone);
    assert.equal(result.source, 'auto');
    assert.equal(result.timeZone, timeZone);
  }
  assert.throws(() => pricing.calendarDate('2026-12-01T00:00:00Z', 'Not/AZone'), /Unknown time zone/);
});

test('Fable standard, cache, Batch, Fast, and US multiplier', () => {
  assert.deepEqual(pricing.fableRates('standard'), { input: 8, output: 40, cacheHit: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 });
  assert.deepEqual(pricing.fableRates('fast'), { input: 16, output: 80, cacheHit: 0.4, cacheWrite5m: 20, cacheWrite1h: 32 });
  assert.deepEqual(pricing.fableRates('batch'), { input: 4, output: 20, cacheHit: 0.1, cacheWrite5m: 5, cacheWrite1h: 8 });
  assert.equal(pricing.estimateFable({ inputTokens: 1_000_000, outputTokens: 1_000_000 }).perRequest, 48);
  assert.equal(pricing.estimateFable({ cacheReadTokens: 1_000_000 }).perRequest, 0.2);
  assert.equal(pricing.estimateFable({ cacheWrite5mTokens: 1_000_000 }).perRequest, 10);
  assert.equal(pricing.estimateFable({ cacheWrite1hTokens: 1_000_000 }).perRequest, 16);
  assert.equal(pricing.estimateFable({ inputTokens: 1_000_000, outputTokens: 1_000_000, mode: 'batch' }).perRequest, 24);
  assert.equal(pricing.estimateFable({ inputTokens: 1_000_000, outputTokens: 1_000_000, mode: 'fast' }).perRequest, 96);
  assert.equal(pricing.estimateFable({ inputTokens: 1_000_000, outputTokens: 1_000_000, inferenceGeo: 'us' }).perRequest, 52.8);
  assert.equal(pricing.estimateFable({ cacheReadTokens: 1_000_000, inferenceGeo: 'us' }).perRequest, 0.22);
  assert.equal(pricing.estimateFable({ inputTokens: 1_000_000, outputTokens: 1_000_000, mode: 'fast', inferenceGeo: 'us' }).perRequest, 105.6);
  assert.equal(pricing.estimateFable({ inputTokens: 1_000_000, mode: 'batch', inferenceGeo: 'us' }).perRequest, 4.4);
  assert.equal(pricing.estimateFable({ cacheReadTokens: 1_000_000, mode: 'fast' }).perRequest, 0.4);
  assert.equal(pricing.estimateFable({ cacheReadTokens: 1_000_000, mode: 'batch' }).perRequest, 0.1);
  assert.equal(pricing.estimateFable({ cacheWrite5mTokens: 1_000_000, mode: 'fast' }).perRequest, 20);
  assert.equal(pricing.estimateFable({ cacheWrite1hTokens: 1_000_000, mode: 'batch' }).perRequest, 8);
  assert.equal(pricing.estimateFable({ mode: 'fast' }).fastBatchAllowed, false);
  assert.throws(() => pricing.estimateFable({ mode: 'fast-batch' }), /standard, fast, or batch/);
  assert.equal(pricing.FABLE_BASE.fast.input / pricing.FABLE_BASE.standard.input, 2);
  assert.equal(pricing.US_MULTIPLIER, 1.1);
});

test('Fable thinking tokens use the output rate and follow Fast, Batch, and US', () => {
  assert.equal(pricing.estimateFable({ thinkingTokens: 1_000_000 }).perRequest, 40);
  assert.equal(pricing.estimateFable({ thinkingTokens: 1_000_000, mode: 'fast' }).perRequest, 80);
  assert.equal(pricing.estimateFable({ thinkingTokens: 1_000_000, mode: 'batch' }).perRequest, 20);
  assert.equal(pricing.estimateFable({ thinkingTokens: 1_000_000, inferenceGeo: 'us' }).perRequest, 44);
  assert.equal(pricing.estimateFable({ outputTokens: 1_000_000, thinkingTokens: 1_000_000 }).billableOutput, 2_000_000);
  assert.equal(pricing.estimateFable({ thinkingTokens: 0 }).thinkingBilledAs, 'output');
});

test('same-workload comparison uses one token definition', () => {
  const compared = pricing.compareSameWorkload(SAMPLE);
  assert.equal(compared.carbonIntroductory.perRequest, 5.1);
  assert.equal(compared.carbonStandard.perRequest, 10.2);
  assert.equal(compared.fableStandard.perRequest, 20.2);
  assert.equal(compared.fableBatch.perRequest, 10.1);
  assert.equal(compared.fableFast.perRequest, 40.4);
  const us = pricing.compareSameWorkload(SAMPLE, { inferenceGeo: 'us' });
  assert.equal(us.fableStandard.perRequest, 22.22);
  assert.equal(us.carbonIntroductory.perRequest, 5.1);
  assert.equal(compared.carbonIncludesCacheWrites, false);
  const withWrites = pricing.compareSameWorkload(Object.assign({ cacheWrite5mTokens: 1_000_000 }, SAMPLE));
  assert.equal(withWrites.fableStandard.perRequest, 30.2);
  assert.equal(withWrites.carbonIntroductory.perRequest, 5.1);
});

test('sample log: expected and actual', () => {
  const expected = {
    carbonIntroductory: 5.1,
    carbonStandard: 10.2,
    fableStandardGlobal: 20.2,
    fableBatchGlobal: 10.1,
    fableFastGlobal: 40.4,
    fableStandardUs: 22.22,
    carbonIntroPerMillionThinking: 10,
    carbonStandardPerMillionThinking: 20,
    fableFastUsPerMillionInOut: 105.6
  };
  const compared = pricing.compareSameWorkload(SAMPLE);
  const actual = {
    carbonIntroductory: compared.carbonIntroductory.perRequest,
    carbonStandard: compared.carbonStandard.perRequest,
    fableStandardGlobal: compared.fableStandard.perRequest,
    fableBatchGlobal: compared.fableBatch.perRequest,
    fableFastGlobal: compared.fableFast.perRequest,
    fableStandardUs: pricing.compareSameWorkload(SAMPLE, { inferenceGeo: 'us' }).fableStandard.perRequest,
    carbonIntroPerMillionThinking: pricing.estimateCarbon({ thinkingTokens: 1_000_000, billingDate: '2026-11-30' }).perRequest,
    carbonStandardPerMillionThinking: pricing.estimateCarbon({ thinkingTokens: 1_000_000, billingDate: '2026-12-01' }).perRequest,
    fableFastUsPerMillionInOut: pricing.estimateFable({ inputTokens: 1_000_000, outputTokens: 1_000_000, mode: 'fast', inferenceGeo: 'us' }).perRequest
  };
  console.log(JSON.stringify({ sampleTokens: SAMPLE, expected, actual }, null, 2));
  assert.deepEqual(actual, expected);
});

test('new pages are crawlable, singular, and linked from the sitemap', () => {
  const sitemap = read('sitemap.xml');
  const robots = read('robots.txt');
  const headers = read('_headers');
  assert.match(robots, /User-agent: \*\nAllow: \/\n/);
  assert.match(headers, /\/og\/\*/);
  assert.doesNotMatch(robots, /Disallow: \/gemini-4-carbon-pricing/);
  for (const page of ['gemini-4-carbon-pricing/index.html', 'claude-fable-5-2-pricing/index.html']) {
    const html = read(page);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, page);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /name="description"/);
    assert.match(html, /November 12, 2026/);
    assert.match(html, /Independent/);
    assert.equal((html.match(/<noscript>/g) || []).length, 1, page);
  }
  const carbon = read('gemini-4-carbon-pricing/index.html');
  const fable = read('claude-fable-5-2-pricing/index.html');
  assert.match(carbon, /https:\/\/llmpricecalc\.com\/gemini-4-carbon-pricing\//);
  assert.match(fable, /https:\/\/llmpricecalc\.com\/claude-fable-5-2-pricing\//);
  assert.match(carbon, /gemini-4-carbon/);
  assert.match(carbon, /\$2/);
  assert.match(carbon, /\$4/);
  assert.match(carbon, /\$0\.10/);
  assert.match(carbon, /\$0\.20/);
  assert.match(carbon, /not available on the free tier/i);
  assert.match(carbon, /Implicit caching only/);
  assert.match(carbon, /thinking/i);
  assert.match(carbon, /\/gemini-4-argon-pricing\//);
  assert.match(carbon, /aistudio\.google\.com\/docs\/pricing/);
  assert.match(carbon, /blog\.google\/innovation-and-ai\/models-and-research\/gemini-models\/gemini-4-carbon-now-available\//);
  assert.match(carbon, /Developer API/);
  assert.match(carbon, /does not name a timezone/i);
  assert.match(fable, /claude-fable-5-2/);
  assert.match(fable, /\$8/);
  assert.match(fable, /\$40/);
  assert.match(fable, /\$16/);
  assert.match(fable, /\$80/);
  assert.match(fable, /\$4/);
  assert.match(fable, /\$20/);
  assert.match(fable, /\$0\.20/);
  assert.match(fable, /Fast mode is not available with the Batch API/);
  assert.match(fable, /1\.1/);
  assert.match(fable, /Mythos 5\.2 is not publicly available/);
  assert.match(fable, /platform\.claude\.com\/docs\/en\/about-claude\/pricing/);
  assert.match(fable, /\$5\.10/);
  assert.match(fable, /\$10\.20/);
  assert.match(fable, /\$20\.20/);
  assert.match(fable, /\$22\.22/);
  assert.match(sitemap, /<loc>https:\/\/llmpricecalc\.com\/gemini-4-carbon-pricing\/<\/loc><lastmod>2026-11-12<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/llmpricecalc\.com\/claude-fable-5-2-pricing\/<\/loc><lastmod>2026-11-12<\/lastmod>/);
  assert.match(read('index.html'), /\/gemini-4-carbon-pricing\//);
  assert.match(read('index.html'), /\/claude-fable-5-2-pricing\//);
  assert.match(read('llm-api-pricing/index.html'), /value="carbon"/);
  assert.match(read('llm-api-pricing/index.html'), /value="fable"/);
  assert.match(read('claude-api-pricing/index.html'), /value="fable"/);
  assert.match(read('gemini-4-argon-pricing/index.html'), /\/gemini-4-carbon-pricing\//);
});
