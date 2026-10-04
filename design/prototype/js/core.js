/* Tilde prototype — core: state, i18n, dates, icons, router, overlays, toasts, theme. No build step. */
(function () {
  'use strict';
  const T = (window.T = {});
  const qs = new URLSearchParams(location.search);

  /* ---------- State ---------- */
  T.state = window.SAMPLE();
  T.settings = { lang: 'es', theme: 'system', visibleDays: [1, 2, 3, 4, 5], defaultLead: 3, sound: true };
  T.ui = { homeArchived: false, schedWeek: 0, tasksMode: 'general', tasksSubject: null, tasksRange: 'week', tasksDate: null, selecting: false, selected: new Set(), expanded: new Set(['t2']), calOffset: 0, sessionTab: 'session', grades: {} };
  T.views = {};
  T.actions = {};
  const langParam = qs.get('lang');
  if (langParam === 'en' || langParam === 'es') T.settings.lang = langParam;
  const themeParam = qs.get('tema') || qs.get('theme');
  if (themeParam) T.settings.theme = { oscuro: 'dark', dark: 'dark', claro: 'light', light: 'light', sistema: 'system', system: 'system' }[themeParam] || 'system';

  let uid = 1000;
  T.id = (p) => (p || 'x') + (++uid);

  /* ---------- i18n ---------- */
  T.t = function (key, vars) {
    const dict = window.I18N[T.settings.lang] || {};
    let s = dict[key];
    if (s === undefined) s = window.I18N.es[key];
    if (s === undefined) { console.warn('[i18n] missing', key); s = key; }
    if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (_, n) => (vars[n] !== undefined ? vars[n] : ''));
    return s;
  };
  T.tn = function (key, n, vars) { return T.t(key + (n === 1 ? '_one' : '_other'), Object.assign({ n: n }, vars || {})); };
  T.colorName = (key) => { const c = window.SUBJECT_COLORS.find((x) => x.key === key); return c ? c[T.settings.lang] : key; };

  /* ---------- Escaping & icons ---------- */
  T.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  T.icon = function (name, size, opts) {
    size = size || 20; opts = opts || {};
    const sw = opts.sw || (size >= 28 ? 1.75 : 2);
    const body = window.ICONS[name];
    if (!body) { console.warn('[icon] missing', name); return ''; }
    return '<svg class="icon icon-' + name + (opts.cls ? ' ' + opts.cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (opts.fill || 'none') + '" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  };
  T.logoSymbol = function (size) {
    return '<svg class="logo-symbol" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6.5" fill="var(--color-accent)"/><path d="M5 13.2C6.3 10.6 8.3 10.4 9.9 12.6L11.6 15C12.1 15.7 12.9 15.7 13.4 15L18.9 7.4" fill="none" stroke="var(--color-on-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  T.wordmark = function () {
    return '<svg class="wordmark" viewBox="0 0 64 28" width="51" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4V19.5a4.5 4.5 0 0 0 4.5 4.5H9"/><path d="M0.5 10.5H8.5"/><path d="M15 11V24"/><path d="M21.5 2V19.5a4.5 4.5 0 0 0 4.5 4.5"/><circle cx="36" cy="17.5" r="6.5"/><path d="M42.5 2V24"/><path d="M48.5 17.5H61.5a6.5 6.5 0 1 0-1.6 4.3"/></g><circle cx="15" cy="4.6" r="2" fill="currentColor"/></svg>';
  };
  T.logo = (size) => '<span class="logo">' + T.logoSymbol(size || 28) + T.wordmark() + '<span class="visually-hidden">Tilde</span></span>';
  T.googleG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

  /* ---------- Dates ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const D = (T.d = {
    parse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
    iso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); },
    add(dt, n) { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); x.setDate(x.getDate() + n); return x; },
    addIso(s, n) { return D.iso(D.add(D.parse(s), n)); },
    wd(dt) { return ((dt.getDay() + 6) % 7) + 1; }, /* Mon=1 … Sun=7 */
    monday(dt) { return D.add(dt, -(D.wd(dt) - 1)); },
    dm(dt) { if (typeof dt === 'string') dt = D.parse(dt); return pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1); },
    diff(a, b) { if (typeof a === 'string') a = D.parse(a); if (typeof b === 'string') b = D.parse(b); return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000); },
    wdShort(n) { return T.t('wd_short').split(',')[n - 1]; },
    wdLong(n) { return T.t('wd_long').split(',')[n - 1]; },
    wdLetter(n) { return T.t('wd_letter').split(',')[n - 1]; },
    month(m) { return T.t('months').split(',')[m]; },
    min(hhmm) { const p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; },
    hhmm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  });
  T.today = D.parse(qs.get('hoy') || '2026-10-13');
  T.todayIso = D.iso(T.today);
  T.nowMin = function () {
    const h = qs.get('hora');
    if (h) return D.min(h);
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  };
  T.dayLabel = function (iso) {
    const diff = D.diff(T.today, iso);
    if (diff === 0) return T.t('today');
    if (diff === 1) return T.t('tomorrow');
    if (diff === -1) return T.t('yesterday');
    const dt = D.parse(iso);
    return D.wdLong(D.wd(dt));
  };
  T.holidayOn = function (iso) {
    const h = window.AR_HOLIDAYS.find((x) => x.date === iso);
    if (h) return { name: h[T.settings.lang] || h.es, preset: true };
    const m = T.state.calEvents.find((e) => e.category === 'feriado' && e.date === iso);
    return m ? { name: m.title || T.t('cat_feriado'), preset: false, id: m.id } : null;
  };

  /* ---------- Domain helpers ---------- */
  T.subject = (id) => T.state.subjects.find((s) => s.id === id);
  T.activeSubjects = () => T.state.subjects.filter((s) => !s.archived);
  T.subjectProgress = function (sid) {
    const ts = T.state.tasks.filter((t) => t.subjectId === sid);
    if (!ts.length) return { pct: 100, done: 0, total: 0 };
    const done = ts.filter((t) => t.done).length;
    return { pct: Math.round((done / ts.length) * 100), done: done, total: ts.length };
  };
  T.fmtNum = function (n, dec) {
    if (n == null || isNaN(n)) return '—';
    const s = (Math.round(n * 100) / 100).toFixed(dec == null ? 2 : dec).replace(/\.?0+$/, '');
    return T.settings.lang === 'es' ? s.replace('.', ',') : s;
  };
  T.fmtMin = function (m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return T.t('min_short', { n: r });
    return r ? T.t('h_min_short', { h: h, m: r }) : T.t('h_short', { h: h });
  };
  T.chipSubject = function (sid, opts) {
    const s = T.subject(sid);
    if (!s) return '';
    return '<span class="chip subj-' + s.color + '"' + (opts && opts.title ? ' title="' + T.esc(s.name) + '"' : '') + '><span class="dot"></span><span>' + T.esc(opts && opts.short ? T.shortName(s.name) : s.name) + '</span></span>';
  };
  T.shortName = function (name) {
    const map = { 'Programación Orientada a Objetos': 'POO', 'Diseño y Procesamiento de Documentos XML': 'XML', 'Introducción a la Programación': 'Intro. a la Prog.', 'Lógica Computacional': 'Lógica Comp.' };
    return map[name] || name;
  };

  /* ---------- Router ---------- */
  T.parseRoute = function () {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('?');
    const path = parts[0].replace(/\/$/, '');
    const params = new URLSearchParams(parts[1] || '');
    return { path: path, seg: path.split('/').filter(Boolean), params: params, demo: params.get('demo') };
  };
  T.go = function (path) { location.hash = '#/' + path; };
  const viewFor = function (r) {
    const s = r.seg[0] || '';
    return { '': 'landing', inicio: 'home', horario: 'schedule', tareas: 'tasks', calendario: 'calendar', sesiones: 'sessions' }[s] || 'landing';
  };
  T.navItems = [
    { id: 'home', path: 'inicio', icon: 'house', key: 'nav_home' },
    { id: 'schedule', path: 'horario', icon: 'calendar-clock', key: 'nav_schedule' },
    { id: 'tasks', path: 'tareas', icon: 'list-checks', key: 'nav_tasks' },
    { id: 'calendar', path: 'calendario', icon: 'calendar-days', key: 'nav_calendar' },
    { id: 'sessions', path: 'sesiones', icon: 'timer', key: 'nav_sessions' }
  ];

  /* ---------- Render ---------- */
  const root = () => document.getElementById('root');
  const overlayRoot = () => document.getElementById('overlays');
  let rendering = false, renderAgain = false;
  T.render = function () {
    /* Re-entrancy guard: replacing innerHTML blurs the focused input, which can fire `change` → render. */
    if (rendering) { renderAgain = true; return; }
    rendering = true;
    try { renderNow(); } finally { rendering = false; }
    if (renderAgain) { renderAgain = false; T.render(); }
  };
  function renderNow() {
    const r = T.parseRoute();
    applyDemoData(r);
    T.route = r;
    const vid = viewFor(r);
    const view = T.views[vid];
    const focus = captureFocus();
    const scrolls = captureScroll();
    const flip = T.ui.flip ? captureFlip() : null;
    T.closePopover();
    document.documentElement.lang = T.settings.lang;
    if (vid === 'landing') {
      root().innerHTML = view.render(r);
      document.title = 'Tilde';
    } else {
      const v = view.render(r);
      document.title = v.title + ' · Tilde';
      root().innerHTML =
        '<div class="app" data-view="' + vid + '" data-width="' + (/page-wide/.test(v.pageClass || '') ? 'wide' : /page-narrow/.test(v.pageClass || '') ? 'narrow' : 'std') + '">' +
          '<header class="topbar" id="topbar">' +
            '<button class="btn btn-ghost btn-icon" id="menu-btn" data-action="drawer-open" aria-label="' + T.t('open_menu') + '" aria-haspopup="dialog" aria-expanded="' + (T.isOpen('drawer') ? 'true' : 'false') + '">' + T.icon('menu', 22) + '</button>' +
            '<h1 class="topbar-title">' + T.esc(v.title) + '</h1>' + (v.sub ? '<span class="topbar-sub">' + v.sub + '</span>' : '') +
            '<div class="topbar-spacer"></div>' +
            '<div class="topbar-actions">' + (v.actions || '') + '</div>' +
          '</header>' +
          '<main class="page ' + (v.pageClass || '') + '" id="main">' + v.body + '</main>' +
        '</div>';
    }
    renderOverlays(true);
    if (view.after) view.after(r);
    restoreScroll(scrolls);
    restoreFocus(focus);
    if (flip) { playFlip(flip); T.ui.flip = false; }
    onScroll();
  }
  T.renderOverlaysOnly = () => renderOverlays(true);

  let emptyBackup = null;
  function applyDemoData(r) {
    if (r.demo === 'vacio' && !emptyBackup) {
      emptyBackup = T.state;
      T.state = Object.assign({}, T.state, { subjects: [], classes: [], events: [], skips: [], tasks: [], calEvents: [], sessions: [], weeklyFocus: [0, 0, 0, 0, 0, 0, 0, 0] });
    } else if (r.demo !== 'vacio' && emptyBackup) {
      T.state = emptyBackup; emptyBackup = null;
    }
  }

  function captureFocus() {
    const a = document.activeElement;
    if (!a || !a.id || a === document.body) return null;
    return { id: a.id, start: a.selectionStart, end: a.selectionEnd };
  }
  function restoreFocus(f) {
    if (!f) return;
    const el = document.getElementById(f.id);
    if (!el) return;
    el.focus({ preventScroll: true });
    try { if (f.start != null && el.setSelectionRange) el.setSelectionRange(f.start, f.end); } catch (e) { /* not a text input */ }
  }
  function captureScroll() {
    const out = {};
    document.querySelectorAll('[data-keep-scroll]').forEach((el) => { out[el.dataset.keepScroll] = el.scrollTop; });
    return out;
  }
  function restoreScroll(s) {
    document.querySelectorAll('[data-keep-scroll]').forEach((el) => { if (s[el.dataset.keepScroll] != null) el.scrollTop = s[el.dataset.keepScroll]; });
  }
  function captureFlip() {
    const m = new Map();
    document.querySelectorAll('[data-flip]').forEach((el) => m.set(el.dataset.flip, el.getBoundingClientRect().top));
    return m;
  }
  function playFlip(m) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('[data-flip]').forEach((el) => {
      const before = m.get(el.dataset.flip);
      if (before == null) return;
      const dy = before - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 2) return;
      el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    });
  }

  /* ---------- Overlays (drawer, dialogs, sheets) ---------- */
  T.overlays = [];
  T.isOpen = (kind) => T.overlays.some((o) => o.kind === kind);
  T.openOverlay = function (o) {
    o.returnFocus = document.activeElement && document.activeElement.id ? document.activeElement.id : null;
    o.key = o.key || T.id('ov');
    T.overlays.push(o);
    renderOverlays(false);
    setTimeout(() => focusFirst(o), 20);
    if (o.kind === 'drawer') { const b = document.getElementById('menu-btn'); if (b) b.setAttribute('aria-expanded', 'true'); }
    return o;
  };
  T.closeOverlay = function (key) {
    const i = key ? T.overlays.findIndex((o) => o.key === key) : T.overlays.length - 1;
    if (i < 0) return;
    const o = T.overlays.splice(i, 1)[0];
    renderOverlays(false);
    if (o.onClose) o.onClose();
    if (o.kind === 'drawer') { const b = document.getElementById('menu-btn'); if (b) b.setAttribute('aria-expanded', 'false'); }
    const back = o.returnFocus && document.getElementById(o.returnFocus);
    if (back) back.focus({ preventScroll: true });
  };
  T.closeAll = function (kind) { T.overlays = T.overlays.filter((o) => kind && o.kind !== kind); renderOverlays(false); };
  function renderOverlays(liveOnly) {
    const host = overlayRoot();
    const existing = new Map();
    host.querySelectorAll(':scope > [data-ov]').forEach((el) => existing.set(el.dataset.ov, el));
    T.overlays.forEach((o, idx) => {
      let el = existing.get(o.key);
      if (el && liveOnly && !o.live) { existing.delete(o.key); return; }
      if (el && !liveOnly) { existing.delete(o.key); return; }
      const html = o.render();
      if (el) { el.innerHTML = html; existing.delete(o.key); }
      else {
        el = document.createElement('div');
        el.dataset.ov = o.key;
        el.innerHTML = html;
        host.appendChild(el);
        if (o.mount) o.mount(el);
      }
      el.style.position = 'relative';
      el.style.zIndex = String(40 + idx);
    });
    existing.forEach((el) => el.remove());
    document.body.style.overflow = T.overlays.some((o) => o.kind === 'dialog' || o.kind === 'drawer') ? 'hidden' : '';
  }
  function focusables(el) {
    return Array.from(el.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null || x === document.activeElement);
  }
  function focusFirst(o) {
    const el = overlayRoot().querySelector('[data-ov="' + o.key + '"]');
    if (!el) return;
    const body = el.querySelector('.dialog-body, .sheet-body, .drawer-nav');
    const pref = el.querySelector('[data-autofocus]') || (body && focusables(body)[0]) || focusables(el).find((x) => !x.classList.contains('scrim'));
    if (pref) pref.focus({ preventScroll: true });
  }

  T.dialog = function (opts) {
    /* opts: { title, desc, body (html), foot (html), size, onMount(el), live } */
    return T.openOverlay({
      kind: 'dialog', live: !!opts.live, key: opts.key,
      render: () => {
        const body = typeof opts.body === 'function' ? opts.body() : opts.body;
        const foot = typeof opts.foot === 'function' ? opts.foot() : opts.foot;
        return '<div class="dialog-layer" role="presentation"><div class="scrim" data-action="overlay-close"></div>' +
          '<div class="dialog ' + (opts.size ? 'dialog-' + opts.size : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-title-' + (opts.key || 'x') + '">' +
            '<div class="dialog-head"><div><h2 class="dialog-title" id="dlg-title-' + (opts.key || 'x') + '">' + opts.title + '</h2>' + (opts.desc ? '<p class="dialog-desc">' + opts.desc + '</p>' : '') + '</div>' +
            '<button class="btn btn-ghost btn-icon" data-action="overlay-close" aria-label="' + T.t('close') + '">' + T.icon('x') + '</button></div>' +
            '<div class="dialog-body">' + body + '</div>' + (foot ? '<div class="dialog-foot">' + foot + '</div>' : '') +
          '</div></div>';
      },
      mount: opts.onMount
    });
  };
  T.confirm = function (opts) {
    const key = T.id('cf');
    T.dialog({
      key: key, size: 'sm', title: opts.title, body: '<p class="muted">' + opts.body + '</p>',
      foot: '<button class="btn btn-secondary" data-action="overlay-close">' + T.t('cancel') + '</button><button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" id="confirm-ok" data-autofocus>' + opts.confirm + '</button>',
      onMount: (el) => { el.querySelector('#confirm-ok').addEventListener('click', () => { T.closeOverlay(key); opts.onConfirm(); }); }
    });
  };
  T.sheet = function (opts) {
    return T.openOverlay({
      kind: 'sheet', live: true, key: opts.key,
      render: () => '<div class="sheet-layer" role="presentation"><div class="scrim" data-action="overlay-close"></div><aside class="sheet" role="dialog" aria-modal="false" aria-label="' + T.esc(opts.label || '') + '">' + opts.render() + '</aside></div>',
      onClose: opts.onClose
    });
  };

  /* ---------- Popover & menus ---------- */
  let pop = null;
  T.popover = function (anchor, html, opts) {
    opts = opts || {};
    T.closePopover();
    const layer = document.createElement('div');
    layer.className = 'popover-layer';
    layer.innerHTML = '<div class="popover ' + (opts.cls || '') + '" role="' + (opts.role || 'dialog') + '"' + (opts.label ? ' aria-label="' + T.esc(opts.label) + '"' : '') + '>' + html + '</div>';
    document.body.appendChild(layer);
    const p = layer.firstChild;
    const r = anchor.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let left = opts.align === 'end' ? r.right - pw : r.left;
    let top = r.bottom + 6;
    if (top + ph > innerHeight - 12) top = Math.max(12, r.top - ph - 6);
    left = Math.max(12, Math.min(left, innerWidth - pw - 12));
    p.style.left = left + 'px'; p.style.top = top + 'px';
    pop = { layer: layer, anchor: anchor, onClose: opts.onClose };
    anchor.setAttribute('aria-expanded', 'true');
    setTimeout(() => { const f = p.querySelector('[data-autofocus]') || p.querySelector('button, input, select, a[href]'); if (f && opts.focus !== false) f.focus({ preventScroll: true }); }, 10);
    return p;
  };
  T.closePopover = function (restore) {
    if (!pop) return;
    const a = pop.anchor; pop.layer.remove();
    if (a) a.setAttribute('aria-expanded', 'false');
    if (pop.onClose) pop.onClose();
    pop = null;
    if (restore && a && document.contains(a)) a.focus({ preventScroll: true });
  };
  T.menu = function (anchor, items, opts) {
    const html = items.map((it, i) => it === '-' ? '<div class="menu-sep" role="separator"></div>' :
      '<button class="menu-item ' + (it.danger ? 'danger' : '') + '" role="menuitem" data-mi="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' + (it.icon ? T.icon(it.icon, 18) : '') + '<span>' + it.label + '</span></button>').join('');
    const p = T.popover(anchor, html, Object.assign({ role: 'menu' }, opts || {}));
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mi]'); if (!b) return;
      const it = items[Number(b.dataset.mi)];
      T.closePopover(); it.run();
    });
  };

  /* ---------- Toast ---------- */
  T.toast = function (msg, opts) {
    opts = opts || {};
    let layer = document.querySelector('.toast-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'toast-layer'; layer.setAttribute('role', 'status'); layer.setAttribute('aria-live', 'polite'); document.body.appendChild(layer); }
    layer.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + msg + '</span>' + (opts.action ? '<button class="btn btn-ghost btn-sm toast-action">' + T.icon('undo-2', 16) + opts.action + '</button>' : '') + '<button class="btn btn-ghost btn-icon btn-sm" aria-label="' + T.t('close') + '">' + T.icon('x', 16) + '</button>';
    layer.appendChild(el);
    const kill = () => el.remove();
    const btns = el.querySelectorAll('button');
    if (opts.action) btns[0].addEventListener('click', () => { kill(); opts.onAction(); });
    btns[btns.length - 1].addEventListener('click', kill);
    setTimeout(kill, opts.duration || 6000);
  };

  /* ---------- Theme ---------- */
  const mq = matchMedia('(prefers-color-scheme: dark)');
  T.applyTheme = function () {
    const p = T.settings.theme;
    const dark = p === 'dark' || (p === 'system' && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };
  mq.addEventListener('change', () => { if (T.settings.theme === 'system') T.applyTheme(); });

  /* ---------- Global events ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = T.actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A' && !el.dataset.keepHref) e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && T.actions[el.dataset.change]) T.actions[el.dataset.change](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && T.actions[el.dataset.input]) T.actions[el.dataset.input](el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      const el = e.target.closest('[data-enter]');
      if (el && T.actions[el.dataset.enter]) { e.preventDefault(); T.actions[el.dataset.enter](el, e); return; }
    }
    if (e.key === 'Escape') {
      if (pop) { T.closePopover(true); e.preventDefault(); return; }
      if (T.overlays.length) { T.closeOverlay(); e.preventDefault(); return; }
      if (T.onEscape && T.onEscape()) { e.preventDefault(); return; }
    }
    if (e.key === 'Tab' && T.overlays.length) {
      const top = T.overlays[T.overlays.length - 1];
      if (top.kind === 'sheet') return;
      const el = overlayRoot().querySelector('[data-ov="' + top.key + '"]');
      const f = el ? focusables(el).filter((x) => !x.classList.contains('scrim')) : [];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (pop && !pop.layer.firstChild.contains(e.target) && !pop.anchor.contains(e.target)) T.closePopover();
  });
  function onScroll() {
    const tb = document.getElementById('topbar') || document.querySelector('.landing-top');
    if (tb) tb.classList.toggle('is-scrolled', scrollY > 4);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { T.closePopover(); if (T.onResize) T.onResize(); });
  addEventListener('hashchange', () => { T.closeAll(); T.ui.selecting = false; T.ui.selected.clear(); T.render(); scrollTo(0, 0); });

  /* ---------- Shared actions ---------- */
  T.actions['overlay-close'] = () => T.closeOverlay();
  T.actions['help'] = (el) => T.popover(el, '<div class="popover-pad" style="max-width:300px;font-size:13px;line-height:1.5">' + T.esc(el.dataset.help) + '</div>', { focus: false, role: 'tooltip' });
  T.actions['noop'] = () => {};

  T.boot = function () {
    T.applyTheme();
    T.render();
    const r = T.parseRoute();
    if (r.params.get('drawer') === '1') T.actions['drawer-open']();
    if (r.params.get('ajustes') === '1') T.actions['settings-open']();
  };
})();
