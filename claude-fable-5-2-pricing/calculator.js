(function () {
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });

  function usage() {
    return {
      inputTokens: $('input').value,
      cacheReadTokens: $('cacheRead').value,
      cacheWrite5mTokens: $('cacheWrite5m').value,
      cacheWrite1hTokens: $('cacheWrite1h').value,
      outputTokens: $('output').value,
      thinkingTokens: $('thinking').value,
      requests: $('requests').value,
      mode: document.querySelector('input[name="mode"]:checked').value,
      inferenceGeo: document.querySelector('input[name="geo"]:checked').value
    };
  }

  function update() {
    try {
      const fields = usage();
      const result = llmPriceCalc.estimateFable(fields);
      const compare = llmPriceCalc.compareSameWorkload({
        inputTokens: fields.inputTokens,
        cacheReadTokens: fields.cacheReadTokens,
        cacheWrite5mTokens: fields.cacheWrite5mTokens,
        cacheWrite1hTokens: fields.cacheWrite1hTokens,
        outputTokens: fields.outputTokens,
        thinkingTokens: fields.thinkingTokens,
        requests: fields.requests
      }, { inferenceGeo: fields.inferenceGeo });
      $('error').textContent = '';
      $('modeLabel').textContent = result.mode + ' · ' + result.inferenceGeo;
      $('monthlyCost').textContent = money.format(result.monthly);
      $('perRequest').textContent = money.format(result.perRequest) + ' for one request';
      $('standardCost').textContent = money.format(compare.fableStandard.monthly);
      $('fastCost').textContent = money.format(compare.fableFast.monthly);
      $('batchCost').textContent = money.format(compare.fableBatch.monthly);
      $('carbonIntro').textContent = money.format(compare.carbonIntroductory.monthly);
      $('carbonLater').textContent = money.format(compare.carbonStandard.monthly);
    } catch (error) {
      $('error').textContent = error.message;
      for (const id of ['monthlyCost', 'standardCost', 'fastCost', 'batchCost', 'carbonIntro', 'carbonLater']) $(id).textContent = '—';
      $('perRequest').textContent = '';
    }
  }

  document.getElementById('cost-form').addEventListener('input', update);
  update();
})();
