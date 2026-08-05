(function () {
  const MONTHS = ['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень'];
  const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  let openPanel = null;

  function parseIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
  }

  function iso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function closeDatePanel() {
    if (!openPanel) return;
    openPanel.panel.remove();
    openPanel.input.setAttribute('aria-expanded', 'false');
    openPanel = null;
  }

  function positionPanel(input, panel) {
    const rect = input.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - gap * 2);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.min(Math.max(gap, rect.left), window.innerWidth - width - gap)}px`;
    panel.style.top = `${rect.bottom + 6}px`;
    panel.style.bottom = 'auto';
    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.bottom > window.innerHeight - gap && rect.top > window.innerHeight - rect.bottom) {
        panel.style.top = 'auto';
        panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      }
    });
  }

  function enhanceDateInput(input) {
    if (!input || input.dataset.enhancedDate) return;
    input.dataset.enhancedDate = '1';
    input.type = 'text';
    input.inputMode = 'none';
    input.autocomplete = 'off';
    input.readOnly = true;
    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('aria-expanded', 'false');

    function open() {
      closeDatePanel();
      const selected = parseIso(input.value) || new Date();
      let viewYear = selected.getFullYear();
      let viewMonth = selected.getMonth();
      const panel = document.createElement('div');
      panel.className = 'custom-date-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Вибір дати');
      document.body.appendChild(panel);
      openPanel = { input, panel };
      input.setAttribute('aria-expanded', 'true');

      function render() {
        const first = new Date(viewYear, viewMonth, 1);
        const startOffset = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const selectedIso = input.value;
        panel.innerHTML = '';

        const head = document.createElement('div');
        head.className = 'custom-date-head';
        head.innerHTML = `<button type="button" class="custom-date-nav" data-date-step="-1" aria-label="Попередній місяць">‹</button><strong>${MONTHS[viewMonth]} ${viewYear}</strong><button type="button" class="custom-date-nav" data-date-step="1" aria-label="Наступний місяць">›</button>`;
        panel.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'custom-date-grid';
        WEEKDAYS.forEach((day) => {
          const el = document.createElement('span');
          el.className = 'custom-date-weekday';
          el.textContent = day;
          grid.appendChild(el);
        });
        for (let i = 0; i < startOffset; i += 1) grid.appendChild(document.createElement('span'));
        for (let day = 1; day <= daysInMonth; day += 1) {
          const date = new Date(viewYear, viewMonth, day);
          const value = iso(date);
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'custom-date-day' + (value === selectedIso ? ' is-selected' : '');
          button.textContent = String(day);
          button.dataset.dateValue = value;
          grid.appendChild(button);
        }
        panel.appendChild(grid);

        const actions = document.createElement('div');
        actions.className = 'custom-date-actions';
        actions.innerHTML = '<button type="button" data-date-clear>Очистити</button><button type="button" data-date-today>Сьогодні</button>';
        panel.appendChild(actions);
        positionPanel(input, panel);
      }

      panel.addEventListener('click', (event) => {
        const step = event.target.closest('[data-date-step]');
        if (step) { viewMonth += Number(step.dataset.dateStep); if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; } if (viewMonth > 11) { viewMonth = 0; viewYear += 1; } render(); return; }
        const day = event.target.closest('[data-date-value]');
        if (day) { input.value = day.dataset.dateValue; input.dispatchEvent(new Event('change', { bubbles: true })); closeDatePanel(); input.focus(); return; }
        if (event.target.closest('[data-date-clear]')) { input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true })); closeDatePanel(); input.focus(); return; }
        if (event.target.closest('[data-date-today]')) { input.value = iso(new Date()); input.dispatchEvent(new Event('change', { bubbles: true })); closeDatePanel(); input.focus(); }
      });
      render();
    }

    input.addEventListener('click', open);
    input.addEventListener('focus', open);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDatePanel();
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  }

  document.addEventListener('click', (event) => {
    if (!openPanel) return;
    if (event.target === openPanel.input || openPanel.panel.contains(event.target)) return;
    closeDatePanel();
  });
  window.addEventListener('resize', () => openPanel && positionPanel(openPanel.input, openPanel.panel), { passive: true });
  window.enhanceDateInput = enhanceDateInput;
  window.refreshEnhancedDateInput = function refreshEnhancedDateInput(input) { if (input) input.value = input.value; };
}());
