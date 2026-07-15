// Кастомний <select>: нативний select рендериться браузером як квадратне
// непіддатливе спливне меню, тому обгортаємо прихований <select> кастомною
// заокругленою панеллю (.custom-select-wrap/-btn/-panel/-option) з підтримкою
// клавіатури (Enter/Space/стрілки/Escape) і опційним пошуком через
// data-searchable="1" (+ data-search-placeholder="...").
//
// Було продубльовано в osbb/index.html і sklad/index.html — версія Складу
// додала пошук і разом з ним виправила зіставлення опції в панелі з опцією
// select на textContent замість позиції в DOM (позиційне зіставлення
// ламається, коли пошук фільтрує панель до підмножини select.options).
// Ця версія — спільна канонічна: без data-searchable поводиться так само,
// як і оригінальна проста версія журналу, плюс коректніша навіть тоді.
//
// Без бандлера: підключається як звичайний <script src="shared/enhance-select.js">.

function enhanceSelect(select) {
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = '1';
  const btnClass = select.className;
  const searchable = select.dataset.searchable === '1';
  let selectSearchTerm = '';
  select.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'custom-select-wrap';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = btnClass + ' custom-select-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="custom-select-label"></span><svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.55;"><polyline points="6 9 12 15 18 9"/></svg>';
  wrap.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'custom-select-panel hidden';
  panel.setAttribute('role', 'listbox');
  wrap.appendChild(panel);

  function normalizeForSearch(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function optionMatches(opt) {
    if (!searchable || !selectSearchTerm) return true;
    if (!opt.value) return true;
    return normalizeForSearch(opt.textContent).includes(normalizeForSearch(selectSearchTerm));
  }
  function renderOptions() {
    panel.innerHTML = '';
    if (searchable) {
      const searchInput = document.createElement('input');
      searchInput.className = 'inp custom-select-search';
      searchInput.type = 'search';
      searchInput.placeholder = select.dataset.searchPlaceholder || 'Пошук...';
      searchInput.value = selectSearchTerm;
      searchInput.addEventListener('input', () => {
        selectSearchTerm = searchInput.value;
        renderOptions();
        const next = panel.querySelector('input[type="search"]');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); closePanel(); btn.focus(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); panel.querySelector('.custom-select-option')?.focus(); }
      });
      panel.appendChild(searchInput);
    }
    const visibleOptions = Array.from(select.options).filter(optionMatches);
    visibleOptions.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'custom-select-option' + (opt.value === select.value ? ' active' : '');
      item.textContent = opt.textContent;
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-selected', opt.value === select.value ? 'true' : 'false');
      const choose = () => {
        select.value = opt.value;
        select.dispatchEvent(new Event('change'));
        selectSearchTerm = '';
        syncLabel();
        closePanel();
        btn.focus();
      };
      item.addEventListener('click', choose);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
        else if (e.key === 'Escape') { closePanel(); btn.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); (item.nextElementSibling || panel.querySelector('.custom-select-option'))?.focus(); }
        else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = item.previousElementSibling;
          if (prev && prev.classList.contains('custom-select-option')) prev.focus();
          else panel.querySelector('input[type="search"]')?.focus();
        }
      });
      panel.appendChild(item);
    });
    if (searchable && !visibleOptions.some(o => o.value)) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.style.padding = '12px';
      empty.textContent = select.dataset.searchEmptyText || 'Нічого не знайдено';
      panel.appendChild(empty);
    }
  }
  function syncLabel() {
    const selectedOpt = select.options[select.selectedIndex];
    btn.querySelector('.custom-select-label').textContent = selectedOpt ? selectedOpt.textContent : '';
    panel.querySelectorAll('.custom-select-option').forEach(el => {
      const opt = Array.from(select.options).find(o => o.textContent === el.textContent);
      el.classList.toggle('active', opt && opt.value === select.value);
      el.setAttribute('aria-selected', opt && opt.value === select.value ? 'true' : 'false');
    });
  }
  function openPanel() {
    document.querySelectorAll('.custom-select-panel').forEach(p => { if (p !== panel) p.classList.add('hidden'); });
    renderOptions();
    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    if (searchable) panel.querySelector('input[type="search"]')?.focus();
    else panel.querySelector('.custom-select-option.active')?.focus();
  }
  function closePanel() { panel.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.classList.contains('hidden')) openPanel(); else closePanel();
  });
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && panel.classList.contains('hidden')) {
      e.preventDefault();
      openPanel();
    } else if (searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      selectSearchTerm = e.key;
      openPanel();
    }
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', closePanel);

  select._syncCustomLabel = syncLabel;
  renderOptions();
  syncLabel();
}
function refreshEnhancedSelect(select) {
  if (select && select._syncCustomLabel) select._syncCustomLabel();
}
