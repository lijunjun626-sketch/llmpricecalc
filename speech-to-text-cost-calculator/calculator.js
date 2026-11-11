(function () {
  if (typeof document === 'undefined') return;
  const form = document.getElementById('cost-form');
  const error = document.getElementById('error');
  const summary = document.getElementById('workload');

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
      const result = speechCost.estimate(read());
      error.textContent = '';
      const taskWord = result.tasks === 1 ? 'task' : 'tasks';
      const channelWord = result.channels === 1 ? 'channel' : 'channels';
      summary.textContent = result.secondsPerTask + ' seconds per task × ' + result.tasks + ' ' + taskWord + ' × ' + result.channels + ' ' + channelWord;
      for (const row of result.rows) {
        const node = document.querySelector('[data-row="' + row.id + '"]');
        if (!node) continue;
        node.querySelector('[data-field="per"]').textContent = row.perTask;
        node.querySelector('[data-field="month"]').textContent = row.monthly;
        node.querySelector('[data-field="seconds"]').textContent = String(row.billedSecondsPerTask);
      }
    } catch (failure) {
      error.textContent = failure.message;
      summary.textContent = '';
      document.querySelectorAll('[data-field="per"], [data-field="month"]').forEach(node => {
        node.textContent = '—';
      });
    }
  }

  form.addEventListener('input', update);
  update();
})();
