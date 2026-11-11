(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.speechCost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Checked November 12, 2026 (Asia/Shanghai) against the official pages cited on each row.
  // Amounts are regular paid list rates. Signup credits and first-year free tiers are not subtracted.
  const CHECKED = '2026-11-12';
  const MICRO = 1000000;

  const ROWS = [
    {
      id: 'openai-gpt-transcribe',
      provider: 'OpenAI',
      model: 'gpt-transcribe',
      mode: 'File transcription',
      currency: 'USD',
      listed: '$0.0045 per minute',
      microPerMinute: 4500,
      rounding: 'exact',
      channels: 'not-stated',
      free: 'No free audio allowance is listed on the pricing page.',
      source: 'https://developers.openai.com/api/docs/models/gpt-transcribe',
      note: 'Model page lists a transcription audio-duration price. Partial-minute rounding is not stated, so this row uses exact duration.'
    },
    {
      id: 'openai-whisper-1',
      provider: 'OpenAI',
      model: 'whisper-1',
      mode: 'File transcription',
      currency: 'USD',
      listed: '$0.006 per minute',
      microPerMinute: 6000,
      rounding: 'exact',
      channels: 'not-stated',
      free: 'The model page shows a Free rate-limit tier. It does not publish free audio minutes, so none are subtracted.',
      source: 'https://developers.openai.com/api/docs/models/whisper-1',
      note: 'OpenAI marks whisper-1 as deprecated. The model page prices transcription at $0.006 per minute. Partial-minute rounding is not stated.'
    },
    {
      id: 'openai-gpt-live-transcribe',
      provider: 'OpenAI',
      model: 'gpt-live-transcribe',
      mode: 'Live transcription',
      currency: 'USD',
      listed: '$0.017 per minute',
      microPerMinute: 17000,
      rounding: 'exact',
      channels: 'not-stated',
      free: 'No free audio allowance is listed for this model.',
      source: 'https://developers.openai.com/api/docs/models/gpt-live-transcribe',
      note: 'Live audio is a different product from file transcription. The model page lists $0.017 per minute of realtime audio duration. Partial-minute rounding is not stated.'
    },
    {
      id: 'deepgram-nova3-mono-prerecorded',
      provider: 'Deepgram',
      model: 'Nova-3 Monolingual',
      mode: 'Pre-recorded, pay as you go',
      currency: 'USD',
      listed: '$0.0043 per minute',
      microPerMinute: 4300,
      rounding: 'exact',
      channels: 'per-channel',
      free: 'New accounts get a $200 credit. It is not subtracted here.',
      source: 'https://deepgram.com/pricing',
      note: 'Pay-as-you-go list rate. Deepgram bills per second with no block rounding and no minimum. Multichannel audio bills the total processed duration across channels. Growth prepaid rates are not used.'
    },
    {
      id: 'deepgram-nova3-mono-streaming',
      provider: 'Deepgram',
      model: 'Nova-3 Monolingual',
      mode: 'Streaming, pay as you go',
      currency: 'USD',
      listed: '$0.0077 per minute',
      microPerMinute: 7700,
      rounding: 'exact',
      channels: 'per-channel',
      free: 'The $200 new-account credit is not subtracted.',
      source: 'https://deepgram.com/pricing',
      note: 'Streaming is priced separately from pre-recorded audio. Same per-second rule and channel rule. This is not a cheaper version of the same mode.'
    },
    {
      id: 'assemblyai-universal-2',
      provider: 'AssemblyAI',
      model: 'universal-2',
      mode: 'Pre-recorded',
      currency: 'USD',
      listed: '$0.15 per hour',
      microPerHour: 150000,
      rounding: 'exact-second',
      channels: 'per-channel',
      free: 'New accounts receive $50 in credits. Those credits are not subtracted.',
      source: 'https://www.assemblyai.com/pricing',
      note: 'Docs say pre-recorded audio is pro-rated to the exact second. When multichannel transcription is enabled, each channel is billed. Streaming is excluded because it bills WebSocket session time, including idle time.'
    },
    {
      id: 'assemblyai-universal-3-5-pro',
      provider: 'AssemblyAI',
      model: 'universal-3-5-pro',
      mode: 'Pre-recorded',
      currency: 'USD',
      listed: '$0.21 per hour',
      microPerHour: 210000,
      rounding: 'exact-second',
      channels: 'per-channel',
      free: 'The $50 new-account credit is not subtracted.',
      source: 'https://www.assemblyai.com/pricing',
      note: 'Higher pre-recorded model rate. Add-ons are not included. Exact-second pro-rating and per-channel billing follow the billing docs.'
    },
    {
      id: 'google-stt-v2-standard',
      provider: 'Google Cloud Speech-to-Text',
      model: 'V2 standard recognition',
      mode: 'Standard recognition',
      currency: 'USD',
      listed: '$0.016 per minute for the first 500,000 minutes / month',
      microPerMinute: 16000,
      rounding: 'ceil-second',
      channels: 'per-channel',
      tiers: [
        { throughMinutes: 500000, microPerMinute: 16000 },
        { throughMinutes: 1000000, microPerMinute: 10000 },
        { throughMinutes: 2000000, microPerMinute: 8000 },
        { throughMinutes: Infinity, microPerMinute: 4000 }
      ],
      free: 'The V2 standard table read here has no free minutes. The V1 60-minute allowance is a different API version and is not applied.',
      source: 'https://cloud.google.com/speech-to-text/pricing',
      note: 'Each request is rounded up to the next 1 second before the monthly total is priced. Volume tiers assume this workload is the account’s only V2 standard usage. Each channel is billed. Committed-use discounts are not applied.'
    },
    {
      id: 'google-stt-v2-dynamic-batch',
      provider: 'Google Cloud Speech-to-Text',
      model: 'V2 dynamic batch',
      mode: 'Dynamic batch',
      currency: 'USD',
      listed: '$0.003 per minute',
      microPerMinute: 3000,
      rounding: 'ceil-second',
      channels: 'per-channel',
      free: 'No free minutes are listed on the dynamic batch row.',
      source: 'https://cloud.google.com/speech-to-text/pricing',
      note: 'Dynamic batch is a lower-urgency mode, not the same service level as standard recognition. Each request is rounded up to 1 second. The published dynamic batch price is flat in the table read here.'
    },
    {
      id: 'aws-transcribe-batch-us-east-1',
      provider: 'Amazon Transcribe',
      model: 'Standard',
      mode: 'Batch, US East (N. Virginia)',
      currency: 'USD',
      listed: '$0.006 per minute',
      microPerMinute: 6000,
      rounding: 'exact',
      channels: 'two-included',
      free: 'The 60 minutes per month for the first 12 months is a new-account offer. It is not subtracted.',
      source: 'https://aws.amazon.com/transcribe/pricing/',
      note: 'Taken from Amazon’s US East batch example. The page says usage is billed in one-second increments with no minimum, and does not say a partial second is rounded up, so this row uses exact duration. Up to two channels are included in the duration price. Region tables beyond that example did not render as separate numbers.'
    },
    {
      id: 'aws-transcribe-streaming-us-east-1',
      provider: 'Amazon Transcribe',
      model: 'Standard',
      mode: 'Streaming, US East (N. Virginia)',
      currency: 'USD',
      listed: '$0.01 per minute',
      microPerMinute: 10000,
      rounding: 'exact',
      channels: 'two-included',
      free: 'The 12-month 60-minute offer is not subtracted.',
      source: 'https://aws.amazon.com/transcribe/pricing/',
      note: 'Taken from Amazon’s US East streaming example, which prices live audio at $0.01 per minute. Streaming is not the batch product. The same one-second increment wording applies, without an explicit round-up rule.'
    }
  ];

  function roundMicro(value) {
    return Math.round(value);
  }

  function normalizeSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Duration must be a positive number or zero.');
    const nearest = Math.round(seconds);
    if (Math.abs(seconds - nearest) < 1e-9) return nearest;
    return seconds;
  }

  function ceilSecond(seconds) {
    const exact = normalizeSeconds(seconds);
    return Math.ceil(exact - 1e-12);
  }

  function parseInput(input) {
    const source = input || {};
    if (source.duration === undefined || source.duration === null || String(source.duration).trim() === '') {
      throw new RangeError('Enter an audio duration.');
    }
    if (source.tasks === undefined || source.tasks === null || String(source.tasks).trim() === '') {
      throw new RangeError('Enter a task count.');
    }
    const duration = Number(source.duration);
    if (!Number.isFinite(duration)) throw new RangeError('Duration must be a number.');
    if (duration < 0) throw new RangeError('Duration cannot be negative.');
    const unit = source.unit || 'minutes';
    if (unit !== 'minutes' && unit !== 'hours') throw new RangeError('Choose minutes or hours.');
    const tasks = Number(source.tasks);
    if (!Number.isFinite(tasks)) throw new RangeError('Task count must be a number.');
    if (!Number.isInteger(tasks)) throw new RangeError('Task count must be a whole number.');
    if (tasks < 0) throw new RangeError('Task count cannot be negative.');
    const channels = source.channels === undefined || source.channels === '' ? 1 : Number(source.channels);
    if (!Number.isFinite(channels) || !Number.isInteger(channels) || channels < 1 || channels > 32) {
      throw new RangeError('Channels must be a whole number from 1 to 32.');
    }
    const seconds = unit === 'hours' ? duration * 3600 : duration * 60;
    if (!Number.isFinite(seconds) || seconds > 1e12) throw new RangeError('Duration is too large to estimate.');
    if (tasks > 1e9) throw new RangeError('Task count is too large to estimate.');
    if (seconds * tasks > 1e15) throw new RangeError('The duration and task count overflow this estimate.');
    return { seconds: normalizeSeconds(seconds), tasks: tasks, channels: channels, unit: unit };
  }

  function billedSecondsPerTask(row, seconds, channels) {
    let billed = row.rounding === 'ceil-second' ? ceilSecond(seconds) : normalizeSeconds(seconds);
    if (row.channels === 'per-channel') billed *= channels;
    if (!Number.isFinite(billed)) throw new RangeError('Billed duration overflowed.');
    return billed;
  }

  function moneyFromMicro(micro) {
    const rounded = roundMicro(micro);
    const sign = rounded < 0 ? '-' : '';
    const abs = Math.abs(rounded);
    const dollars = Math.floor(abs / MICRO);
    const frac = String(abs % MICRO).padStart(6, '0');
    if (abs === 0) return '$0.00';
    if (abs >= 10000) {
      const rest = frac.slice(2).replace(/0+$/, '');
      return sign + '$' + dollars.toLocaleString('en-US') + '.' + frac.slice(0, 2) + rest;
    }
    return sign + '$0.' + frac.replace(/0+$/, '');
  }

  function tierMicro(billedMinutes, tiers) {
    let remaining = billedMinutes;
    let start = 0;
    let micro = 0;
    for (let i = 0; i < tiers.length; i++) {
      const width = tiers[i].throughMinutes - start;
      const take = Math.min(remaining, width);
      micro += take * tiers[i].microPerMinute;
      remaining -= take;
      start = tiers[i].throughMinutes;
      if (remaining <= 1e-9) break;
    }
    return micro;
  }

  function billingFor(row, channels) {
    if (row.channels === 'two-included' && channels > 2) {
      return {
        quoted: false,
        billingBasis: 'Unavailable / Not quoted. Amazon states that the duration price includes up to two channels. It does not publish a formula for more than two channels, so this row shows no amount and does not invent a multiplier.'
      };
    }
    if (row.channels === 'two-included') {
      return {
        quoted: true,
        billingBasis: 'Quoted from the source audio duration once. Amazon states that up to two channels are included in that price. The channel count is not multiplied.'
      };
    }
    if (row.channels === 'per-channel') {
      return {
        quoted: true,
        billingBasis: channels > 1
          ? 'Quoted after multiplying this provider’s billed duration by ' + channels + ' channels. That provider states each channel is billed.'
          : 'Quoted from the source audio duration once. One channel is entered, so there is no extra channel multiplier.'
      };
    }
    return {
      quoted: true,
      billingBasis: 'Quoted from the source audio duration once. This provider does not state a channel multiplier, so the channel count is not applied.'
    };
  }

  function blankRow(row, basis) {
    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      mode: row.mode,
      currency: row.currency,
      listed: row.listed,
      free: row.free,
      source: row.source,
      note: row.note,
      quoted: false,
      billingBasis: basis.billingBasis,
      channelNote: basis.billingBasis,
      billedSecondsPerTask: null,
      perTaskMicro: null,
      monthlyMicro: null,
      perTask: 'Not quoted',
      monthly: 'Unavailable'
    };
  }

  function estimateRow(row, parsed) {
    const basis = billingFor(row, parsed.channels);
    if (!basis.quoted) return blankRow(row, basis);
    const perTaskSeconds = billedSecondsPerTask(row, parsed.seconds, parsed.channels);
    const totalSeconds = perTaskSeconds * parsed.tasks;
    if (!Number.isFinite(totalSeconds) || totalSeconds > 1e15) {
      throw new RangeError('The duration and task count overflow this estimate.');
    }
    let micro;
    if (row.tiers) {
      micro = tierMicro(totalSeconds / 60, row.tiers);
    } else if (row.microPerHour) {
      micro = totalSeconds * row.microPerHour / 3600;
    } else {
      micro = totalSeconds * row.microPerMinute / 60;
    }
    if (!Number.isFinite(micro) || Math.abs(micro) > 1e18) {
      throw new RangeError('Monthly total is too large to show.');
    }
    const perTaskMicro = parsed.tasks === 0 ? 0 : micro / parsed.tasks;
    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      mode: row.mode,
      currency: row.currency,
      listed: row.listed,
      free: row.free,
      source: row.source,
      note: row.note,
      quoted: true,
      billingBasis: basis.billingBasis,
      channelNote: basis.billingBasis,
      billedSecondsPerTask: perTaskSeconds,
      perTaskMicro: roundMicro(perTaskMicro),
      monthlyMicro: roundMicro(micro),
      perTask: moneyFromMicro(perTaskMicro),
      monthly: moneyFromMicro(micro)
    };
  }

  function estimate(input) {
    const parsed = parseInput(input);
    const sourceSecondsTotal = parsed.seconds * parsed.tasks;
    const taskLabel = parsed.tasks === 1 ? '1 task' : parsed.tasks + ' tasks';
    return {
      checked: CHECKED,
      secondsPerTask: parsed.seconds,
      sourceSecondsPerTask: parsed.seconds,
      sourceSecondsTotal: sourceSecondsTotal,
      tasks: parsed.tasks,
      channels: parsed.channels,
      summary: 'Source audio is ' + parsed.seconds + ' seconds in each of ' + taskLabel + ' (' + sourceSecondsTotal + ' seconds total). Channel count entered: ' + parsed.channels + '. Whether channels change the bill is stated on each row.',
      rows: ROWS.map(row => estimateRow(row, parsed))
    };
  }

  return {
    CHECKED: CHECKED,
    ROWS: ROWS,
    parseInput: parseInput,
    estimate: estimate,
    moneyFromMicro: moneyFromMicro,
    ceilSecond: ceilSecond
  };
});
