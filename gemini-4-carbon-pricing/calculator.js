(function () {
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const dateInput = $('billingDate');

  function zone() {
    const selected = $('timeZone').value;
    return selected === 'browser' ? Intl.DateTimeFormat().resolvedOptions().timeZone : selected;
  }

  function tokens() {
    return {
      inputTokens: $('input').value,
      cachedTokens: $('cached').value,
      outputTokens: $('output').value,
      thinkingTokens: $('thinking').value,
      requests: $('requests').value
    };
  }

  function selectedSchedule() {
    const mode = document.querySelector('input[name="dateMode"]:checked').value;
    return mode === 'explicit'
      ? { billingDate: dateInput.value, timeZone: zone(), now: new Date() }
      : { billingDate: 'auto', timeZone: zone(), now: new Date() };
  }

  function update() {
    const explicit = document.querySelector('input[name="dateMode"]:checked').value === 'explicit';
    dateInput.disabled = !explicit;
    try {
      const usage = tokens();
      const result = llmPriceCalc.estimateCarbon(Object.assign({}, usage, selectedSchedule()));
      const intro = llmPriceCalc.estimateCarbon(Object.assign({}, usage, { billingDate: '2026-11-30' }));
      const later = llmPriceCalc.estimateCarbon(Object.assign({}, usage, { billingDate: '2026-12-01' }));
      const compare = llmPriceCalc.compareSameWorkload(usage);
      $('error').textContent = '';
      $('activeDate').textContent = result.calendar + (result.source === 'auto' ? ' · ' + result.timeZone : ' · explicit date');
      $('activePeriod').textContent = result.period === 'introductory'
        ? 'Introductory Developer API rate, through November 30, 2026'
        : 'Standard Developer API rate, from December 1, 2026';
      $('activeCost').textContent = money.format(result.monthly);
      $('perRequest').textContent = money.format(result.perRequest) + ' for one request';
      $('introCost').textContent = money.format(intro.monthly);
      $('laterCost').textContent = money.format(later.monthly);
      $('fableCost').textContent = money.format(compare.fableStandard.monthly);
    } catch (error) {
      $('error').textContent = error.message;
      for (const id of ['activeCost', 'introCost', 'laterCost', 'fableCost']) $(id).textContent = '—';
      $('perRequest').textContent = '';
    }
  }

  document.getElementById('cost-form').addEventListener('input', update);
  update();
})();
