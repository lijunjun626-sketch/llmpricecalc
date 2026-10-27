const RATES = {
  terra: { input: 1, cached: 0.05, output: 5 },
  sol: { input: 2, cached: 0.1, output: 10 }
};

function cost(tokens, rates, batch) {
  const input = Math.max(0, Number(tokens.input) || 0);
  const cached = Math.min(input, Math.max(0, Number(tokens.cached) || 0));
  const output = Math.max(0, Number(tokens.output) || 0);
  const multiplier = batch ? 0.5 : 1;
  return ((input - cached) * rates.input + cached * rates.cached + output * rates.output) / 1e6 * multiplier;
}

if (typeof module !== 'undefined') module.exports = { cost, RATES };

if (typeof document !== 'undefined') {
  const fields = ['input', 'cached', 'output', 'requests'].map(id => document.getElementById(id));
  const batch = document.getElementById('batch');
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
  function update() {
    const tokens = { input: fields[0].value, cached: fields[1].value, output: fields[2].value };
    const requests = Math.max(1, Number(fields[3].value) || 1);
    const isBatch = batch.checked;
    const terra = cost(tokens, RATES.terra, isBatch);
    const sol = cost(tokens, RATES.sol, isBatch);
    document.getElementById('terra-request').textContent = currency.format(terra);
    document.getElementById('sol-request').textContent = currency.format(sol);
    document.getElementById('terra-month').textContent = currency.format(terra * requests);
    document.getElementById('sol-month').textContent = currency.format(sol * requests);
    document.getElementById('saving').textContent = currency.format((sol - terra) * requests);
  }
  fields.forEach(field => field.addEventListener('input', update));
  batch.addEventListener('change', update);
  update();
}
