(() => {
  const root = document.documentElement;
  if (!document.fonts?.load) return;

  document.fonts
    .load('24px "Material Symbols Rounded"')
    .then((fonts) => {
      if (fonts.length > 0) root.classList.add('material-symbols-ready');
    })
    .catch(() => {
      // Якщо CDN недоступний, приховані лігатури кращі за службові назви іконок.
    });
})();
