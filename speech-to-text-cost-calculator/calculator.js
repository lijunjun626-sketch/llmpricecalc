(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') api.bind(document);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function render(document, result) {
    document.getElementById('error').textContent = '';
    document.getElementById('workload').textContent = result.summary;
    const caption = document.getElementById('results-caption');
    if (caption) caption.textContent = result.summary;
    for (const row of result.rows) {
      const node = document.querySelector('[data-row="' + row.id + '"]');
      if (!node) continue;
      node.querySelector('[data-field="basis"]').textContent = row.channelNote;
      node.querySelector('[data-field="seconds"]').textContent = row.quoted ? String(row.billedSecondsPerTask) : '—';
      node.querySelector('[data-field="per"]').textContent = row.perTask;
      node.querySelector('[data-field="month"]').textContent = row.monthly;
    }
  }

  function bind(document) {
    const form = document.getElementById('cost-form');
    function read() {
      return {
        duration: document.getElementById('duration').value,
        unit: document.getElementById('unit').value,
        tasks: document.getElementById('tasks').value,
        channels: document.getElementById('channels').value
      };
    }
    function update() {
      try {
        render(document, speechCost.estimate(read()));
      } catch (failure) {
        document.getElementById('error').textContent = failure.message;
        document.getElementById('workload').textContent = '';
        const caption = document.getElementById('results-caption');
        if (caption) caption.textContent = '';
        document.querySelectorAll('[data-field="per"], [data-field="month"], [data-field="basis"], [data-field="seconds"]').forEach(node => {
          node.textContent = '—';
        });
      }
    }
    form.addEventListener('input', update);
    update();
  }

  return { render: render, bind: bind };
});
