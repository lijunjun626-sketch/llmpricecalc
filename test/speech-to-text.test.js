const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const speech = require('../speech-to-text-cost-calculator/rates.js');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const HUNDRED_HOURS = { duration: 100, unit: 'hours', tasks: 1, channels: 1 };
const EXPECTED_100H = {
  'openai-gpt-transcribe': '$27.00',
  'openai-whisper-1': '$36.00',
  'openai-gpt-live-transcribe': '$102.00',
  'deepgram-nova3-mono-prerecorded': '$25.80',
  'deepgram-nova3-mono-streaming': '$46.20',
  'assemblyai-universal-2': '$15.00',
  'assemblyai-universal-3-5-pro': '$21.00',
  'google-stt-v2-standard': '$96.00',
  'google-stt-v2-dynamic-batch': '$18.00',
  'aws-transcribe-batch-us-east-1': '$36.00',
  'aws-transcribe-streaming-us-east-1': '$60.00'
};

function byId(result) {
  return Object.fromEntries(result.rows.map(row => [row.id, row]));
}

test('100 audio hours, one task, one channel, from the published paid rates', () => {
  const actual = byId(speech.estimate(HUNDRED_HOURS));
  const printed = {};
  for (const id of Object.keys(EXPECTED_100H)) {
    printed[id] = { expected: EXPECTED_100H[id], actual: actual[id].monthly, listed: actual[id].listed };
    assert.equal(actual[id].monthly, EXPECTED_100H[id], id);
    assert.equal(actual[id].currency, 'USD');
  }
  console.log(JSON.stringify({ sample: '100 hours x 1 task x 1 channel', printed }, null, 2));
});

test('the same 100 hours split into 100 one-hour tasks matches when rounding does not change whole hours', () => {
  const one = byId(speech.estimate(HUNDRED_HOURS));
  const many = byId(speech.estimate({ duration: 1, unit: 'hours', tasks: 100, channels: 1 }));
  for (const id of Object.keys(EXPECTED_100H)) {
    assert.equal(many[id].monthly, one[id].monthly, id);
  }
});

test('Google rounds each request up to one second before multiplying by the task count', () => {
  const split = byId(speech.estimate({ duration: 0.1, unit: 'minutes', tasks: 100, channels: 1 }));
  // 0.1 minute = 6 seconds, already a whole number of seconds, so this is not the ceil case.
  const partial = byId(speech.estimate({ duration: 0.1 / 60, unit: 'minutes', tasks: 100, channels: 1 }));
  assert.equal(speech.ceilSecond(0.1), 1);
  assert.equal(partial['google-stt-v2-standard'].billedSecondsPerTask, 1);
  assert.equal(partial['google-stt-v2-dynamic-batch'].billedSecondsPerTask, 1);
  assert.equal(partial['openai-gpt-transcribe'].billedSecondsPerTask, 0.1);
  assert.equal(partial['deepgram-nova3-mono-prerecorded'].billedSecondsPerTask, 0.1);
  // 100 requests x 1 billed second x $0.016/min = $0.026667
  assert.equal(partial['google-stt-v2-standard'].monthly, '$0.026667');
  // One 10-second request is not rounded further: 10/60 * 0.016 = $0.002667
  const once = byId(speech.estimate({ duration: 10 / 60, unit: 'minutes', tasks: 1, channels: 1 }));
  assert.equal(once['google-stt-v2-standard'].monthly, '$0.002667');
  assert.notEqual(partial['google-stt-v2-standard'].monthlyMicro, once['google-stt-v2-standard'].monthlyMicro * 10);
  assert.ok(split['google-stt-v2-standard'].monthlyMicro > 0);
});

test('channel multipliers follow only the published rules', () => {
  const stereo = byId(speech.estimate({ duration: 10, unit: 'minutes', tasks: 1, channels: 2 }));
  assert.equal(stereo['deepgram-nova3-mono-prerecorded'].monthly, '$0.086');
  assert.equal(stereo['assemblyai-universal-2'].monthly, '$0.05');
  assert.equal(stereo['google-stt-v2-standard'].monthly, '$0.32');
  assert.equal(stereo['openai-gpt-transcribe'].monthly, '$0.045');
  assert.equal(stereo['aws-transcribe-batch-us-east-1'].monthly, '$0.06');
  const three = byId(speech.estimate({ duration: 10, unit: 'minutes', tasks: 1, channels: 3 }));
  assert.equal(three['aws-transcribe-batch-us-east-1'].monthly, '$0.06');
  assert.match(three['aws-transcribe-batch-us-east-1'].channelNote, /does not multiply/);
});

test('Google standard volume tiers apply to the monthly billed minutes', () => {
  const heavy = byId(speech.estimate({ duration: 600000, unit: 'minutes', tasks: 1, channels: 1 }));
  // 500,000 x $0.016 + 100,000 x $0.01 = $9,000
  assert.equal(heavy['google-stt-v2-standard'].monthly, '$9,000.00');
  assert.equal(heavy['google-stt-v2-dynamic-batch'].monthly, '$1,800.00');
});

test('amounts below one cent keep visible precision and zero is not labeled free', () => {
  const tiny = byId(speech.estimate({ duration: 1, unit: 'minutes', tasks: 1, channels: 1 }));
  assert.equal(tiny['openai-gpt-transcribe'].monthly, '$0.0045');
  assert.doesNotMatch(tiny['openai-gpt-transcribe'].monthly, /^\$0\.00$/);
  const zero = byId(speech.estimate({ duration: 0, unit: 'minutes', tasks: 4, channels: 1 }));
  assert.equal(zero['openai-gpt-transcribe'].monthly, '$0.00');
  assert.equal(zero['openai-gpt-transcribe'].free.includes('not subtracted') || zero['openai-gpt-transcribe'].free.includes('No free'), true);
});

test('rejects empty, non-numeric, negative, fractional task counts, and overflow', () => {
  assert.throws(() => speech.estimate({ duration: '', tasks: 1 }), /duration/i);
  assert.throws(() => speech.estimate({ duration: 'abc', tasks: 1 }), /number/i);
  assert.throws(() => speech.estimate({ duration: -1, tasks: 1 }), /negative/i);
  assert.throws(() => speech.estimate({ duration: 1, tasks: '' }), /task count/i);
  assert.throws(() => speech.estimate({ duration: 1, tasks: 1.5 }), /whole number/i);
  assert.throws(() => speech.estimate({ duration: 1, tasks: -3 }), /negative/i);
  assert.throws(() => speech.estimate({ duration: 1, tasks: 'nope' }), /number/i);
  assert.throws(() => speech.estimate({ duration: 1e12, unit: 'hours', tasks: 1 }), /too large|overflow/i);
  assert.throws(() => speech.estimate({ duration: 1, tasks: 1, channels: 1.2 }), /Channels/);
});

test('the page is crawlable and does not invent a token-to-duration rate', () => {
  const html = read('speech-to-text-cost-calculator/index.html');
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /https:\/\/llmpricecalc\.com\/speech-to-text-cost-calculator\//);
  assert.match(html, /November 12, 2026/);
  assert.match(html, /\$27\.00/);
  assert.match(html, /\$15\.00/);
  assert.match(html, /\$96\.00/);
  assert.match(html, /gpt-4o-transcribe/);
  assert.match(html, /not converted into a duration price/i);
  assert.match(html, /session duration/i);
  assert.doesNotMatch(html, /cheapest/i);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/llmpricecalc\.com\/speech-to-text-cost-calculator\/<\/loc><lastmod>2026-11-12<\/lastmod>/);
  assert.match(read('index.html'), /\/speech-to-text-cost-calculator\//);
  assert.match(read('robots.txt'), /Allow: \/\n/);
});
