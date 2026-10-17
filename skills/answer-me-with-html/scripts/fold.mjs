// Local semantic zoom for generated answer pages. No network or model calls.
export const FOLD_CSS = `
.am-fold-bar { position: sticky; top: 0; z-index: 9; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 12px 0; margin-bottom: 18px; background: var(--bg); }
.am-fold-levels { display: flex; flex-wrap: wrap; gap: 4px; }
.am-fold-bar button[aria-pressed="true"] { color: var(--paper); background: var(--ink); border-color: var(--ink); }
.am-fold-bar input { width: 130px; accent-color: var(--accent); }
.am-fold-note { font-size: 12px; color: var(--ink-2); }
.am-fold-token { display: inline-block; white-space: pre; transform-origin: left top; }
.am-fold-hidden { display: none !important; }
.am-fold-ghosts { position: fixed; inset: 0; z-index: 8; pointer-events: none; overflow: hidden; }
.am-fold-ghosts > * { position: absolute !important; margin: 0 !important; }
.am-fold-local { margin: 4px 6px; align-self: center; white-space: nowrap; }
html[data-am-fold] .am-panel { overflow: visible; }
html[data-am-fold] .am-panel-head { border-radius: var(--radius) var(--radius) 0 0; }
html[data-am-fold] .am-grid { display: grid !important; align-items: start; }
html[data-am-fold] .am-grid > .am-col { display: contents !important; }
html[data-am-fold] .am-grid .am-panel { width: auto !important; flex: none !important; grid-column: auto !important; }
html[data-am-fold="1"] .am-grid .am-panel.am-span-wide,
html[data-am-fold="2"] .am-grid .am-panel.am-span-wide,
html[data-am-fold="3"] .am-grid .am-panel.am-span-wide { grid-column: 1 / -1 !important; }
html[data-am-fold="5"] .am-doc-layout { display: block; }
html[data-am-fold="5"] .am-toc { display: none; }
html[data-am-fold="5"] .am-doc-body { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,250px),1fr)); gap: 16px; }
html[data-am-fold="5"] .am-doc-body > .am-panel { margin: 0; }
@media(max-width:760px) { .am-toolbar { position: static; padding: 8px 12px; flex-wrap: wrap; } .am-sheet,.am-doc { padding-top: 16px; } .am-fold-bar { gap: 6px; } .am-fold-note { flex-basis: 100%; } }
@media print { .am-fold-bar,.am-fold-local,.am-fold-ghosts { display: none !important; } .am-fold-hidden { display: revert !important; } .am-fold-token { display: inline; white-space: normal; } html[data-am-fold] .am-doc-body { display: block; } html[data-am-fold] .am-doc-body > .am-panel { margin-bottom: 20px; } }
`;

export function foldScript(meta) {
  if (String(meta.fold) === 'off') return '';
  const value = meta.fold === undefined ? 1 : Number(meta.fold);
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('fold must be off or an integer from 1 to 5');
  return `;(${installFold.toString()})(${value});`;
}

function installFold(initial) {
  const root = document.documentElement;
  const main = document.querySelector('main');
  const sections = [...document.querySelectorAll('.am-panel')];
  if (!main || !sections.length) return;
  const zh = /^zh/.test(root.lang);
  const names = zh ? ['全文', '简述', '关键句', '要点', '主题'] : ['Full', 'Brief', 'Key', 'Points', 'Topics'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sentenceSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(root.lang || 'en', { granularity: 'sentence' }) : null;
  const wordSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(root.lang || 'en', { granularity: 'word' }) : null;
  const sentences = (s) => sentenceSegmenter ? [...sentenceSegmenter.segment(s)].map(x => x.segment) : (s.match(/[^。！？.!?]+[。！？.!?]*\s*|[。！？.!?]+/gu) || [s]);
  const pieces = (s) => wordSegmenter ? [...wordSegmenter.segment(s)].map(x => x.segment) : (s.match(/\s+|[\p{L}\p{N}_]+|[^\s]/gu) || []);
  const hide = (el, yes) => el.classList.toggle('am-fold-hidden', yes);
  let level = initial;
  let animations = [];
  let ghosts = null;
  let stage = null;
  let generation = 0;
  const local = new Map();
  const allTokens = [];
  const data = sections.map(section => {
    const body = section.querySelector('.am-panel-body');
    const units = [...body.querySelectorAll('p,li')].filter(el => !el.closest('table,pre,svg,.am-diagram,.am-kv,.am-limits,.am-tree,.am-timeline,.am-annot') && !el.querySelector('img,svg')).map(unit => {
      const walker = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) {
        if (walker.currentNode.parentElement.closest('p,li') === unit) texts.push(walker.currentNode);
      }
      return { unit, texts };
    }).filter(({ texts }) => texts.some(node => node.data.trim()));
    const first = units[0]?.unit;
    const tokens = [];
    for (const { unit, texts } of units) {
      const text = texts.map(node => node.data).join('');
      const parts = sentences(text);
      const keyEnd = (parts[0] || '').length;
      const briefEnd = keyEnd + (parts[1] || '').length;
      let offset = 0;
      for (const node of texts) {
        // Preserve inline code as a unit, while retaining its original text.
        const fragment = document.createDocumentFragment();
        for (const piece of pieces(node.data)) {
          const span = document.createElement('span');
          span.className = 'am-fold-token';
          span.textContent = piece;
          const max = offset < keyEnd ? (unit === first ? 4 : 3) : offset < briefEnd ? 2 : 1;
          const record = { el: span, max };
          tokens.push(record);
          allTokens.push(span);
          fragment.append(span);
          offset += piece.length;
        }
        node.replaceWith(fragment);
      }
    }
    // These blocks remain intact; a table, formula or diagram must never be cut into a misleading fragment.
    const atomic = [...body.querySelectorAll('table,pre,figure,svg,.am-diagram,.am-kv,.am-limits,.am-tree,.am-timeline,.am-annot,hr')].filter(el => !el.parentElement.closest('table,pre,figure,svg,.am-diagram,.am-kv,.am-limits,.am-tree,.am-timeline,.am-annot'));
    const headings = [...body.querySelectorAll('h3,h4,.am-callout-title')];
    const containers = [...body.querySelectorAll('p,li,ul,ol,blockquote,.am-md,.am-callout,.am-table-wrap')].reverse();
    let header = section.querySelector('.am-panel-head');
    if (!header) {
      header = document.createElement('header');
      header.className = 'am-panel-head';
      const title = document.createElement('h2');
      title.textContent = section.id;
      header.append(title);
      section.prepend(header);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'am-btn am-fold-local';
    button.setAttribute('aria-controls', section.id + '-fold-body');
    body.id = section.id + '-fold-body';
    header.append(button);
    const record = { section, body, tokens, units, atomic, headings, containers, button };
    button.addEventListener('click', () => {
      settle();
      const current = local.get(section) ?? level;
      const next = current === 1 ? level : current - 1;
      morph(() => { if (next === level) local.delete(section); else local.set(section, next); apply(level); });
    });
    // Clicking whitespace on a collapsed section opens it, without intercepting links or text selection.
    section.addEventListener('click', event => {
      if ((local.get(section) ?? level) < 2 || event.target.closest('a,button,input,select,textarea') || getSelection()?.toString()) return;
      button.click();
    });
    return record;
  });
  const bar = document.createElement('nav');
  bar.className = 'am-fold-bar';
  bar.setAttribute('aria-label', zh ? '阅读层级' : 'Reading level');
  const group = document.createElement('div');
  group.className = 'am-fold-levels';
  const buttons = names.map((name, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'am-btn';
    button.textContent = `${i + 1} ${name}`;
    button.addEventListener('click', () => jump(i + 1));
    group.append(button);
    return button;
  });
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '1'; slider.max = '5'; slider.step = '.01';
  slider.setAttribute('aria-label', zh ? '阅读缩放' : 'Reading zoom');
  const note = document.createElement('span');
  note.className = 'am-fold-note';
  note.setAttribute('aria-live', 'polite');
  bar.append(group, slider, note);
  main.querySelector('.am-head').after(bar);

  function apply(value) {
    root.dataset.amFold = String(value);
    for (const d of data) {
      const effective = local.get(d.section) ?? value;
      hide(d.body, false);
      for (const el of d.containers) hide(el, false);
      for (const { el, max } of d.tokens) hide(el, effective > max);
      for (const el of d.atomic) hide(el, effective > 2);
      for (const el of d.headings) hide(el, effective > 3);
      // Prune empty wrappers after hiding their descendants, preserving list structure and links.
      for (const el of d.containers) {
        hide(el, false);
        const descendants = [...el.querySelectorAll('.am-fold-token')];
        const hasVisibleText = descendants.some(t => !t.closest('.am-fold-hidden'));
        const hasVisibleAtomic = d.atomic.some(a => el.contains(a) && !a.closest('.am-fold-hidden'));
        if (descendants.length || d.atomic.some(a => el.contains(a))) hide(el, !hasVisibleText && !hasVisibleAtomic);
      }
      hide(d.body, effective === 5);
      d.button.textContent = effective === 1 ? (zh ? '收起' : 'Fold') : (zh ? '展开' : 'Expand');
      d.button.disabled = effective === 1 && value === 1;
      d.button.setAttribute('aria-expanded', String(effective < 5));
      d.button.setAttribute('aria-label', `${d.section.querySelector('h2')?.textContent || d.section.id}: ${names[effective - 1]}`);
    }
    slider.value = String(value);
    slider.setAttribute('aria-valuetext', names[value - 1]);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i + 1 === value)));
    note.textContent = zh ? '原句折叠 · 1–5 切换 · Shift＋滚轮 · 点击章节展开' : 'Original words · Keys 1–5 · Shift + wheel · Click a section to expand';
  }
  const targets = [...allTokens, ...sections.map(s => s.querySelector('h2')), ...data.flatMap(d => d.atomic)].filter(Boolean);
  function snapshot() {
    const map = new Map();
    for (const el of targets) {
      if (el.closest('.am-fold-hidden')) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < -100 || rect.top > innerHeight + 100) continue;
      const style = getComputedStyle(el);
      map.set(el, { rect, font: style.font, color: style.color });
    }
    return map;
  }
  function clearMotion() {
    generation++;
    animations.forEach(a => a.cancel());
    animations = [];
    ghosts?.remove(); ghosts = null;
  }
  function motion(before, scrub) {
    const after = snapshot();
    const opts = { duration: scrub ? 1000 : 280, easing: scrub ? 'linear' : 'ease-out', fill: 'both' };
    ghosts = document.createElement('div');
    ghosts.className = 'am-fold-ghosts';
    ghosts.setAttribute('aria-hidden', 'true');
    document.body.append(ghosts);
    const add = (el, frames) => {
      const a = el.animate(frames, opts);
      if (scrub) a.pause();
      animations.push(a);
    };
    for (const [el, b] of after) {
      const a = before.get(el);
      if (a) {
        const dx = a.rect.left - b.rect.left, dy = a.rect.top - b.rect.top;
        if (Math.abs(dx) + Math.abs(dy) > .5) add(el, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }]);
      } else add(el, [{ opacity: 0 }, { opacity: 1 }]);
    }
    let count = 0;
    for (const [el, a] of before) {
      if (after.has(el) || count++ > 450) continue;
      const clone = el.cloneNode(true);
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      clone.classList.remove('am-fold-hidden');
      Object.assign(clone.style, { left: `${a.rect.left}px`, top: `${a.rect.top}px`, width: `${a.rect.width}px`, height: `${a.rect.height}px`, font: a.font, color: a.color });
      ghosts.append(clone);
      add(clone, [{ opacity: 1 }, { opacity: 0 }]);
    }
    if (!scrub) {
      const ticket = generation;
      Promise.all(animations.map(a => a.finished.catch(() => {}))).then(() => { if (ticket === generation) clearMotion(); });
    }
  }
  function morph(mutate) {
    clearMotion();
    const before = reduced.matches ? null : snapshot();
    mutate();
    if (before) motion(before, false);
  }
  function settle() {
    stopWheel();
    if (!stage) return;
    const target = Math.round(stage.position);
    stage = null;
    clearMotion();
    level = target;
    apply(level);
  }
  function jump(value) {
    settle();
    morph(() => { local.clear(); level = value; apply(level); });
  }
  function scrub(position, anchor) {
    position = Math.max(1, Math.min(5, position));
    if (reduced.matches || position === Math.round(position)) {
      clearMotion(); stage = null; local.clear();
      level = Math.round(position); apply(level);
      return;
    }
    const low = Math.floor(position);
    if (!stage || stage.low !== low) {
      clearMotion(); local.clear();
      const y = anchor?.getBoundingClientRect().top;
      const keepAnchor = () => {
        if (anchor && y !== undefined) scrollBy(0, anchor.getBoundingClientRect().top - y);
      };
      apply(low); keepAnchor();
      const before = snapshot();
      apply(low + 1); keepAnchor();
      motion(before, true);
      stage = { low, position };
    }
    stage.position = position;
    animations.forEach(a => { a.currentTime = (position - low) * 1000; });
    slider.value = String(position);
    slider.setAttribute('aria-valuetext', `${names[low - 1]} ↔ ${names[low]}`);
    buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  }
  slider.addEventListener('input', () => { stopWheel(); scrub(Number(slider.value)); });
  slider.addEventListener('change', settle);
  addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.defaultPrevented || document.querySelector('.am-lightbox:not([hidden])')) return;
    if (event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || !/^[1-5]$/.test(event.key)) return;
    event.preventDefault(); jump(Number(event.key));
  });
  // Keep a wheel gesture's target separate from its displayed (possibly fractional) position.
  // Input only changes the target; one animation-frame loop renders it at the screen refresh rate.
  let wheel = null;
  let wheelFrame = 0;
  let wheelTimer = 0;
  const clamp = value => Math.round(Math.max(1, Math.min(5, value)) * 1e6) / 1e6;
  function stopWheel() {
    clearTimeout(wheelTimer);
    cancelAnimationFrame(wheelFrame);
    wheelFrame = 0;
    wheel = null;
  }
  function advanceWheel(now) {
    wheelFrame = 0;
    if (!wheel) return;
    const elapsed = Math.min(64, Math.max(1, now - wheel.time));
    wheel.time = now;
    const remaining = wheel.target - wheel.position;
    wheel.position = Math.abs(remaining) < .003 ? wheel.target : wheel.position + remaining * (1 - Math.exp(-elapsed / 38));
    scrub(wheel.position, wheel.anchor);
    if (wheel.finishing && wheel.position === wheel.target) {
      const target = wheel.target;
      stopWheel();
      stage = null; clearMotion(); level = target; apply(level);
    } else if (wheel.position !== wheel.target) {
      wheelFrame = requestAnimationFrame(advanceWheel);
    }
  }
  function requestWheelFrame() {
    if (!wheelFrame) wheelFrame = requestAnimationFrame(advanceWheel);
  }
  function finishWheel() {
    if (!wheel) return;
    const displacement = wheel.target - wheel.start;
    let target = Math.round(wheel.target);
    // A short deliberate gesture must not disappear when rounded back to its starting level.
    if (target === Math.round(wheel.start) && Math.abs(displacement) > .0001) {
      target = clamp(Math.round(wheel.start) + Math.sign(displacement));
    }
    wheel.target = target;
    wheel.finishing = true;
    requestWheelFrame();
  }
  document.addEventListener('wheel', event => {
    const element = event.target instanceof Element ? event.target : null;
    if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (element?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"]),.am-lightbox') || document.querySelector('.am-lightbox:not([hidden])')) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!Number.isFinite(delta) || delta === 0) return;
    event.preventDefault();
    // Browsers report pixels, lines, or pages; Shift can also move vertical input onto deltaX.
    const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (!wheel) {
      const position = stage?.position ?? level;
      clearMotion(); stage = null; local.clear();
      level = Math.round(position); apply(level);
      const anchor = element?.closest('.am-panel') || sections.reduce((best, section) => {
        const rect = section.getBoundingClientRect();
        const distance = Math.max(rect.top - event.clientY, event.clientY - rect.bottom, 0);
        return !best || distance < best.distance ? { section, distance } : best;
      }, null)?.section;
      wheel = { start: position, position, target: position, anchor, time: performance.now(), finishing: false };
    }
    wheel.finishing = false;
    wheel.target = clamp(wheel.target + Math.max(-1, Math.min(1, pixels / 100)));
    requestWheelFrame();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(finishWheel, 120);
  }, { passive: false });
  addEventListener('resize', settle);
  addEventListener('beforeprint', () => { settle(); clearMotion(); });
  apply(initial);
}
