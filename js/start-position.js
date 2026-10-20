(() => {
  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation?.type !== 'reload') return;

  // Run before the body is parsed so a section hash cannot cause a visible jump.
  history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  addEventListener('pageshow', event => {
    if (!event.persisted) scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, { once: true });
})();
