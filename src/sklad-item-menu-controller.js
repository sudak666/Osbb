export function createSkladItemMenuController({ document, window, actions }) {
  let repositionFrame = 0;
  function setExpanded(menu, expanded) {
    menu?.querySelector('summary')?.setAttribute('aria-expanded', String(expanded));
    menu?.closest?.('.m-card,tr')?.classList.toggle('has-open-menu', Boolean(expanded));
  }
  function closeAll(except = null) {
    document.querySelectorAll('details.item-more[open]').forEach(menu => {
      if (menu === except) return;
      menu.removeAttribute('open');
      setExpanded(menu, false);
    });
  }
  function position(menu) {
    const panel = menu.querySelector('.item-more-menu');
    if (!panel) return;
    menu.classList.remove('opens-down');
    panel.classList.remove('is-viewport-positioned');
    panel.style.left = ''; panel.style.top = ''; panel.style.maxHeight = '';
    const summaryRect = menu.getBoundingClientRect();
    if (menu.classList.contains('topbar-more')) {
      menu.classList.add('opens-down');
      panel.style.maxHeight = Math.max(120, window.innerHeight - summaryRect.bottom - 16) + 'px';
      return;
    }
    const bottomNav = document.querySelector('.bottom-nav');
    const padding = 8;
    const bottom = bottomNav && window.getComputedStyle(bottomNav).display !== 'none'
      ? Math.min(window.innerHeight - padding, bottomNav.getBoundingClientRect().top - padding)
      : window.innerHeight - padding;
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const above = Math.max(0, summaryRect.top - padding - 8);
    const below = Math.max(0, bottom - summaryRect.bottom - 8);
    const opensDown = below >= Math.min(height, 360) || below > above;
    const available = opensDown ? below : above;
    if (opensDown) menu.classList.add('opens-down');
    const visibleHeight = Math.max(0, Math.min(360, available));
    const left = Math.min(window.innerWidth - width - padding, Math.max(padding, summaryRect.right - width));
    const top = opensDown ? summaryRect.bottom + 8 : Math.max(padding, summaryRect.top - 8 - Math.min(height, visibleHeight));
    panel.classList.add('is-viewport-positioned');
    panel.style.left = Math.max(padding, left) + 'px';
    panel.style.top = top + 'px'; panel.style.maxHeight = visibleHeight + 'px';
  }
  function activate(event) {
    const trigger = event.target.closest('[data-item-action]');
    if (!trigger || !trigger.closest('#itemsTable,#mobileCards')) return;
    event.preventDefault();
    const id = Number(trigger.dataset.itemId);
    if (!id) return;
    const menu = trigger.closest('details.item-more');
    if (menu) { menu.removeAttribute('open'); setExpanded(menu, false); }
    const action = actions[trigger.dataset.itemAction];
    if (action) action(id, trigger);
  }
  function keydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('[data-item-action]');
    if (!trigger || !trigger.closest('#itemsTable,#mobileCards')) return;
    event.preventDefault(); trigger.click();
  }
  function toggle(event) {
    const menu = event.target;
    if (!menu.matches?.('details.item-more')) return;
    setExpanded(menu, menu.open);
    if (menu.open) { closeAll(menu); position(menu); }
  }
  function outsideClick(event) { if (!event.target.closest?.('details.item-more')) closeAll(); }
  function reposition() {
    if (repositionFrame) return;
    repositionFrame = window.requestAnimationFrame(() => {
      repositionFrame = 0;
      document.querySelectorAll('details.item-more[open]').forEach(position);
    });
  }
  function bind() {
    ['itemsTable', 'mobileCards'].forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.addEventListener('click', activate);
      element.addEventListener('keydown', keydown);
    });
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('click', outsideClick);
    document.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
    window.visualViewport?.addEventListener('resize', reposition, { passive: true });
  }
  return { bind, closeAll, position, reposition, setExpanded };
}
