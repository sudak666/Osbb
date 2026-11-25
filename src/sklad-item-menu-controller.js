// Згенеровано з src/sklad-item-menu-controller.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const STICKY_LAYERS = ".topbar, .items-filter-bar, .list-toolbar, .receipts-toolbar, .audit-toolbar";
function shellBottomNavTop(win) {
  try {
    const frame = win.frameElement;
    const parent = win.parent;
    if (!frame || !parent || parent === win) return null;
    const nav = parent.document.getElementById("shell-bottom-nav");
    if (!nav || parent.getComputedStyle(nav).display === "none") return null;
    const rect = nav.getBoundingClientRect();
    if (rect.height <= 0) return null;
    return rect.top - frame.getBoundingClientRect().top;
  } catch {
    return null;
  }
}
function createSkladItemMenuController({ document, window, actions }) {
  let repositionFrame = 0;
  function setExpanded(menu, expanded) {
    menu?.querySelector("summary")?.setAttribute("aria-expanded", String(expanded));
    menu?.closest?.(".m-card,tr")?.classList.toggle("has-open-menu", Boolean(expanded));
  }
  function closeAll(except = null) {
    document.querySelectorAll("details.item-more[open]").forEach((menu) => {
      if (menu === except) return;
      menu.removeAttribute("open");
      setExpanded(menu, false);
    });
  }
  function position(menu) {
    const panel = menu.querySelector(".item-more-menu");
    if (!panel) return;
    menu.classList.remove("opens-down");
    panel.classList.remove("is-viewport-positioned");
    panel.style.left = "";
    panel.style.top = "";
    panel.style.maxHeight = "";
    const summaryRect = menu.getBoundingClientRect();
    const padding = 8;
    const shellNavTop = shellBottomNavTop(window);
    const screenBottom = shellNavTop === null ? window.innerHeight : Math.min(window.innerHeight, shellNavTop);
    if (menu.classList.contains("topbar-more")) {
      menu.classList.add("opens-down");
      panel.style.maxHeight = Math.max(120, screenBottom - summaryRect.bottom - 16) + "px";
      return;
    }
    const bottomNav = document.querySelector(".bottom-nav");
    const bottom = bottomNav && window.getComputedStyle(bottomNav).display !== "none" ? Math.min(screenBottom - padding, bottomNav.getBoundingClientRect().top - padding) : screenBottom - padding;
    const topLimit = Array.from(document.querySelectorAll(STICKY_LAYERS)).map((el) => el.getBoundingClientRect()).filter((rect) => rect.height > 0 && rect.bottom <= summaryRect.top).reduce((limit, rect) => Math.max(limit, rect.bottom + padding), padding);
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const above = Math.max(0, summaryRect.top - topLimit - 8);
    const below = Math.max(0, bottom - summaryRect.bottom - 8);
    const opensDown = below >= Math.min(height, 360) || below > above;
    const left = Math.min(window.innerWidth - width - padding, Math.max(padding, summaryRect.right - width));
    if (height > above && height > below && height <= bottom - topLimit) {
      const top2 = Math.min(Math.max(topLimit, summaryRect.bottom - height), bottom - height);
      panel.classList.add("is-viewport-positioned");
      panel.style.left = Math.max(padding, left) + "px";
      panel.style.top = top2 + "px";
      panel.style.maxHeight = height + "px";
      return;
    }
    const available = opensDown ? below : above;
    if (opensDown) menu.classList.add("opens-down");
    const visibleHeight = Math.max(0, Math.min(360, available));
    const top = opensDown ? summaryRect.bottom + 8 : Math.max(topLimit, summaryRect.top - 8 - Math.min(height, visibleHeight));
    panel.classList.add("is-viewport-positioned");
    panel.style.left = Math.max(padding, left) + "px";
    panel.style.top = top + "px";
    panel.style.maxHeight = visibleHeight + "px";
    if (height > visibleHeight) {
      const scroller = document.scrollingElement;
      const room = scroller ? scroller.scrollHeight - window.innerHeight - window.scrollY : 0;
      const delta = Math.ceil(height + 8 - below);
      if (delta > 0 && room >= delta && typeof window.scrollBy === "function") window.scrollBy({ top: delta, behavior: "instant" });
    }
  }
  function activate(event) {
    const trigger = event.target.closest("[data-item-action]");
    if (!trigger || !trigger.closest("#itemsTable,#mobileCards")) return;
    event.preventDefault();
    const id = Number(trigger.dataset.itemId);
    if (!id) return;
    const menu = trigger.closest("details.item-more");
    if (menu) {
      menu.removeAttribute("open");
      setExpanded(menu, false);
    }
    const action = actions[trigger.dataset.itemAction];
    if (action) action(id, trigger);
  }
  function keydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const trigger = event.target.closest("[data-item-action]");
    if (!trigger || !trigger.closest("#itemsTable,#mobileCards")) return;
    event.preventDefault();
    trigger.click();
  }
  function toggle(event) {
    const menu = event.target;
    if (!menu.matches?.("details.item-more")) return;
    setExpanded(menu, menu.open);
    if (menu.open) {
      closeAll(menu);
      position(menu);
    }
  }
  function outsideClick(event) {
    if (!event.target.closest?.("details.item-more")) closeAll();
  }
  function reposition(event) {
    const target = event?.target;
    if (target && typeof target.closest === "function" && target.closest(".item-more-menu")) return;
    if (repositionFrame) return;
    repositionFrame = window.requestAnimationFrame(() => {
      repositionFrame = 0;
      document.querySelectorAll("details.item-more[open]").forEach(position);
    });
  }
  function bind() {
    ["itemsTable", "mobileCards"].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.addEventListener("click", activate);
      element.addEventListener("keydown", keydown);
    });
    document.addEventListener("toggle", toggle, true);
    document.addEventListener("click", outsideClick);
    document.addEventListener("scroll", reposition, { passive: true, capture: true });
    window.addEventListener("resize", reposition, { passive: true });
    window.visualViewport?.addEventListener("resize", reposition, { passive: true });
  }
  return { bind, closeAll, position, reposition, setExpanded };
}
export {
  createSkladItemMenuController,
  shellBottomNavTop
};
