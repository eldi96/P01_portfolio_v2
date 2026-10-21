(() => {
  'use strict';
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'eldi-motion-preference';
  let preference = null;
  try { preference = localStorage.getItem(key); } catch {}
  if (preference !== 'full' && preference !== 'reduce') preference = null;
  const changes = new EventTarget();
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.media && rule.media.mediaText.includes('prefers-reduced-motion')) {
          rules.push({ rule, original: rule.media.mediaText });
        }
      }
    } catch { /* Cross-origin fonts do not contain our motion rules. */ }
  }
  const controller = {
    get matches() { return preference ? preference === 'reduce' : system.matches; },
    addEventListener: (...args) => changes.addEventListener(...args)
  };
  window.portfolioMotion = controller;
  const panel = document.createElement('aside');
  panel.className = 'motion-preference';
  panel.setAttribute('aria-label', '사이트 모션 설정');
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'motion-reset';
  reset.textContent = '시스템 설정 따르기';
  panel.append(status, toggle, reset);
  document.body.append(panel);
  function apply(notify = true) {
    const reduced = controller.matches;
    document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
    // Change this site's media rules only; never change the visitor's OS preference.
    for (const { rule, original } of rules) {
      rule.media.mediaText = original.includes('no-preference')
        ? (reduced ? 'not all' : original.replace(/\s*and\s*\(prefers-reduced-motion:\s*no-preference\)/, ''))
        : (reduced ? 'all' : 'not all');
    }
    status.textContent = reduced ? '모션을 줄여 표시 중' : '모션 효과 사용 중';
    toggle.textContent = reduced ? '효과 켜기' : '효과 끄기';
    toggle.setAttribute('aria-label', reduced ? '이 사이트의 모션 효과 켜기' : '이 사이트의 모션 효과 끄기');
    reset.hidden = preference === null;
    if (notify) changes.dispatchEvent(new Event('change'));
  }
  function choose(value) {
    const section = [...document.querySelectorAll('main > section')].find(node => {
      const rect = node.getBoundingClientRect();
      return rect.top <= innerHeight * .5 && rect.bottom > innerHeight * .5;
    });
    const fraction = section ? Math.max(0, Math.min(1, -section.getBoundingClientRect().top / Math.max(1, section.offsetHeight))) : 0;
    preference = value;
    try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch {}
    apply();
    // Layout lengths change when motion is toggled. Keep the current chapter in view.
    if (section) requestAnimationFrame(() => {
      scrollTo({ top: Math.max(0, scrollY + section.getBoundingClientRect().top + fraction * section.offsetHeight), behavior: 'instant' });
    });
  }
  toggle.addEventListener('click', () => choose(controller.matches ? 'full' : 'reduce'));
  reset.addEventListener('click', () => choose(null));
  system.addEventListener('change', () => { if (preference === null) apply(); });
  apply(false);
})();
