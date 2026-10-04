/* Calendario: vista mensual con categorías por borde y opacidad */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc, D = T.d;
  const CATS = ['parcial', 'final', 'tp', 'recuperatorio', 'feriado'];
  const RANK = { feriado: 0, final: 1, parcial: 2, recuperatorio: 3, tp: 4 };

  function monthStart() { return new Date(T.today.getFullYear(), T.today.getMonth() + T.ui.calOffset, 1); }
  function evLabel(e) {
    if (e.title) return e.title;
    const s = T.subject(e.subjectId);
    return t('cat_' + e.category) + (s ? ' · ' + T.shortName(s.name) : '');
  }
  T.calLabel = evLabel;
  function eventsOn(iso) {
    const out = [];
    const h = window.AR_HOLIDAYS.find((x) => x.date === iso);
    if (h) out.push({ id: 'h-' + iso, category: 'feriado', title: h[T.settings.lang] || h.es, date: iso, preset: true });
    T.state.calEvents.filter((e) => e.date === iso).forEach((e) => out.push(e));
    return out.sort((a, b) => RANK[a.category] - RANK[b.category]);
  }

  function chip(e, opts) {
    opts = opts || {};
    const s = T.subject(e.subjectId);
    const color = s ? s.color : 'grafito';
    const label = evLabel(e);
    const catName = t('cat_' + e.category);
    if (e.category === 'recuperatorio') {
      const state = e.confirmed ? t('recup_confirmed') : t('recup_tentative');
      return '<div class="ev-wrap subj-' + color + '"><button class="ev cat-recuperatorio' + (e.confirmed ? ' is-confirmed' : '') + '" id="ev-' + e.id + (opts.suffix || '') + '" aria-pressed="' + !!e.confirmed + '" aria-label="' + esc(label + ' — ' + catName + ', ' + state + '. ' + t('recup_toggle_hint')) + '" data-action="recup-toggle" data-id="' + e.id + '" title="' + esc(label) + '"><span class="ev-label">' + esc(label) + '</span></button>' +
        '<button class="ev-edit-abs" aria-label="' + esc(t('edit') + ': ' + label) + '" data-action="cal-edit" data-id="' + e.id + '">' + I('pencil', 13) + '</button></div>';
    }
    return '<button class="ev cat-' + e.category + ' subj-' + color + '" id="ev-' + e.id + (opts.suffix || '') + '" aria-label="' + esc(label + ' — ' + catName) + '" data-action="cal-open" data-id="' + e.id + '" data-date="' + e.date + '" title="' + esc(label) + '"><span class="ev-label">' + esc(label) + '</span></button>';
  }
  T.calChip = chip;

  function legend() {
    const demo = { parcial: { category: 'parcial', subjectId: null }, final: { category: 'final' }, tp: { category: 'tp' }, recuperatorio: { category: 'recuperatorio' }, feriado: { category: 'feriado' } };
    return '<div class="cal-legend" aria-label="' + t('legend') + '">' + CATS.map((c) =>
      '<span class="k"><span class="ev cat-' + c + ' subj-grafito' + (c === 'recuperatorio' ? '' : '') + '" aria-hidden="true"></span>' + t('cat_' + c) + (c === 'recuperatorio' ? ' <span class="subtle">(' + t('tentative') + ')</span>' : '') + '</span>').join('') + '</div>';
  }

  T.views.calendar = {
    render() {
      const ms = monthStart();
      const start = D.monday(ms);
      const last = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
      const weeks = Math.ceil((D.diff(start, last) + 1) / 7);
      let cells = '';
      for (let i = 0; i < weeks * 7; i++) {
        const dt = D.add(start, i), iso = D.iso(dt);
        const out = dt.getMonth() !== ms.getMonth();
        const evs = eventsOn(iso);
        const shown = evs.slice(0, 3), more = evs.length - shown.length;
        const wd = D.wd(dt);
        cells += '<div class="cal-cell' + (out ? ' is-out' : '') + (iso === T.todayIso ? ' is-today' : '') + (wd >= 6 ? ' is-weekend' : '') + '" role="gridcell" aria-label="' + esc(D.wdLong(wd) + ' ' + D.dm(dt) + (evs.length ? ', ' + T.tn('events_count', evs.length) : '')) + '">' +
          '<div class="cal-cell-top"><button class="cal-dn tnum" id="dn-' + iso + '" data-action="cal-day" data-date="' + iso + '" aria-label="' + esc(t('open_day', { date: D.wdLong(wd) + ' ' + D.dm(dt) })) + '"' + (iso === T.todayIso ? ' aria-current="date"' : '') + '>' + dt.getDate() + '</button>' +
          '<button class="cal-add" data-action="cal-new" data-date="' + iso + '" aria-label="' + esc(t('add_on', { date: D.dm(dt) })) + '">' + I('plus', 16) + '</button></div>' +
          shown.map((e) => chip(e)).join('') +
          (more ? '<button class="cal-more" id="more-' + iso + '" data-action="cal-day" data-date="' + iso + '">' + t('n_more', { n: more }) + '</button>' : '') +
        '</div>';
      }
      const label = D.month(ms.getMonth()) + ' ' + ms.getFullYear();
      return {
        title: t('nav_calendar'), pageClass: 'page-wide',
        actions: '<button class="btn btn-primary" id="cal-add-btn" data-action="cal-new" data-date="' + T.todayIso + '">' + I('calendar-plus', 18) + t('add_date') + '</button>',
        body:
          '<div class="cal-head"><button class="btn btn-secondary btn-icon" id="cal-prev" data-action="cal-nav" data-d="-1" aria-label="' + t('prev_month') + '">' + I('chevron-left') + '</button>' +
          '<button class="btn btn-secondary btn-icon" id="cal-next" data-action="cal-nav" data-d="1" aria-label="' + t('next_month') + '">' + I('chevron-right') + '</button>' +
          '<h2 class="cal-month" aria-live="polite">' + label + '</h2>' +
          '<button class="btn btn-secondary" id="cal-today" data-action="cal-today"' + (T.ui.calOffset === 0 ? ' disabled' : '') + '>' + t('today') + '</button>' + legend() + '</div>' +
          (!T.state.calEvents.length ? '<div class="archived-banner">' + I('calendar-plus', 18) + '<span>' + t('cal_empty') + '</span></div>' : '') +
          '<div class="cal" role="grid" aria-label="' + esc(label) + '"><div class="cal-wd" role="row">' + [1, 2, 3, 4, 5, 6, 7].map((d) => '<div role="columnheader">' + D.wdShort(d) + '</div>').join('') + '</div><div class="cal-grid">' + cells + '</div></div>'
      };
    },
    after(r) {
      const d = r.demo;
      if (!d || T.ui._calDemo) return;
      T.ui._calDemo = true;
      if (d === 'nuevo-evento') T.actions['cal-new']({ dataset: { date: '2026-10-29', cat: 'parcial', subj: 's2' } });
      if (d === 'nuevo-tp') T.actions['cal-new']({ dataset: { date: '2026-11-06', cat: 'tp', subj: 's4' } });
      if (d === 'dia') { const b = document.getElementById('more-2026-10-20'); if (b) T.actions['cal-day'](b); }
      if (d === 'recuperatorio') { T.ui.calOffset = 1; T.render(); }
    }
  };
  addEventListener('hashchange', () => { T.ui._calDemo = false; });

  T.actions['cal-nav'] = (el) => { T.ui.calOffset += Number(el.dataset.d); T.render(); };
  T.actions['cal-today'] = () => { T.ui.calOffset = 0; T.render(); };

  function syncRecupTask(e) {
    const st = T.state;
    const existing = st.tasks.find((x) => x.calId === e.id);
    if (e.confirmed && !existing) {
      st.tasks.push({ id: T.id('t'), title: evLabel(e), subjectId: e.subjectId, priority: 3, due: e.date, lead: T.settings.defaultLead, date: null, done: false, doneAt: null, order: Math.max(0, ...st.tasks.map((x) => x.order)) + 1, calId: e.id, subtasks: [] });
    } else if (!e.confirmed && existing && !existing.done) {
      st.tasks = st.tasks.filter((x) => x !== existing);
    }
  }
  T.actions['recup-toggle'] = (el) => {
    const e = T.state.calEvents.find((x) => x.id === el.dataset.id);
    e.confirmed = !e.confirmed; syncRecupTask(e);
    T.render();
    T.toast(e.confirmed ? t('recup_confirmed_toast') : t('recup_paused_toast'));
  };

  T.actions['cal-day'] = (el) => {
    const iso = el.dataset.date, dt = D.parse(iso);
    const evs = eventsOn(iso);
    const html = '<div class="day-list"><div class="day-list-head"><div class="t">' + D.wdLong(D.wd(dt)) + ' ' + D.dm(dt) + '</div><div class="field-hint">' + T.tn('events_count', evs.length) + '</div></div>' +
      (evs.length ? evs.map((e) => '<div class="day-list-row">' + '<div style="flex:1;min-width:0">' + chip(e, { suffix: '-dl' }) + '</div>' + (e.preset || e.category === 'recuperatorio' ? '' : '<button class="btn btn-ghost btn-icon" data-action="cal-edit" data-id="' + e.id + '" aria-label="' + esc(t('edit') + ': ' + evLabel(e)) + '">' + I('pencil', 16) + '</button>') + '</div>').join('') : '<p class="field-hint" style="padding:0 8px">' + t('no_dates') + '</p>') +
      '<div class="menu-sep"></div><button class="menu-item" data-action="cal-new" data-date="' + iso + '">' + I('plus', 18) + '<span>' + t('add_date') + '</span></button></div>';
    T.popover(el, html, { label: D.dm(dt) });
  };

  T.actions['cal-open'] = (el) => {
    const id = el.dataset.id;
    if (id.startsWith('h-')) {
      const iso = id.slice(2); const h = T.holidayOn(iso);
      T.popover(el, '<div class="popover-pad"><div class="badge" style="margin-bottom:8px">' + t('cat_feriado') + '</div><div style="font-weight:600">' + esc(h.name) + '</div><div class="field-hint" style="margin-top:4px">' + t('holiday_preset_note') + '</div></div>', { label: h.name });
      return;
    }
    const e = T.state.calEvents.find((x) => x.id === id);
    const s = T.subject(e.subjectId);
    const task = T.state.tasks.find((x) => x.calId === e.id);
    const html = '<div class="block-pop-head ' + (s ? 'subj-' + s.color : '') + '"><span class="sw"' + (s ? '' : ' style="background:var(--color-border-strong)"') + '></span><div><div class="t">' + esc(evLabel(e)) + '</div><div class="m">' + t('cat_' + e.category) + ' · ' + D.wdLong(D.wd(D.parse(e.date))) + ' ' + D.dm(e.date) + '</div>' +
      (task ? '<div class="m" style="margin-top:6px">' + I('list-checks', 13) + ' ' + t('linked_task', { n: leadLabel(task) }) + '</div>' : '') + '</div></div><div class="menu-sep"></div>' +
      '<button class="menu-item" data-cp="edit">' + I('pencil', 18) + '<span>' + t('edit') + '</span></button>' +
      (task ? '<button class="menu-item" data-cp="task">' + I('list-checks', 18) + '<span>' + t('see_in_tasks') + '</span></button>' : '') +
      '<button class="menu-item danger" data-cp="del">' + I('trash-2', 18) + '<span>' + t('delete') + '</span></button>';
    const p = T.popover(el, html, { label: evLabel(e) });
    p.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-cp]'); if (!b) return; T.closePopover();
      if (b.dataset.cp === 'edit') T.actions['cal-edit']({ dataset: { id: e.id } });
      if (b.dataset.cp === 'task') T.go('tareas');
      if (b.dataset.cp === 'del') T.confirm({ title: t('delete_date_q', { name: esc(evLabel(e)) }), body: t('delete_date_body'), confirm: t('delete'), danger: true, onConfirm: () => { T.state.calEvents = T.state.calEvents.filter((x) => x !== e); T.state.tasks = T.state.tasks.filter((x) => x.calId !== e.id || x.done); T.render(); } });
    });
  };
  const leadLabel = (task) => (task.lead == null ? T.settings.defaultLead : task.lead);

  /* Form: categoría · materia · título · fecha · anticipación */
  function form(existing, preset) {
    const st = existing
      ? { category: existing.category, subjectId: existing.subjectId, title: existing.title || '', date: existing.date, lead: existing.lead == null ? T.settings.defaultLead : existing.lead }
      : { category: preset.cat || 'parcial', subjectId: preset.subj || (T.activeSubjects()[0] || {}).id, title: '', date: preset.date || T.todayIso, lead: T.settings.defaultLead };
    const key = 'cal-form';
    const autoTitle = () => st.category === 'feriado' ? t('holiday_ph') : t('cat_' + st.category) + ' · ' + (T.subject(st.subjectId) ? T.shortName(T.subject(st.subjectId).name) : '');
    const body = () => {
      const subs = T.activeSubjects();
      const color = st.category === 'feriado' ? 'grafito' : (T.subject(st.subjectId) || {}).color || 'grafito';
      return '<div class="field"><span class="field-label" id="cf-cat-l">' + t('category') + '</span><div class="cat-picker" role="radiogroup" aria-labelledby="cf-cat-l">' + CATS.map((c) =>
          '<button class="cat-option" role="radio" aria-checked="' + (st.category === c) + '" data-cf="cat" data-v="' + c + '"><span class="ev cat-' + c + ' subj-' + (c === 'feriado' ? 'grafito' : color) + (c === 'recuperatorio' ? '' : '') + '" aria-hidden="true"></span>' + t('cat_' + c) + '</button>').join('') + '</div><span class="field-hint">' + t('cat_hint_' + st.category) + '</span></div>' +
        '<div class="form-grid">' +
          (st.category !== 'feriado' ? '<div class="field span-2"><label class="field-label" for="cf-subj">' + t('subject') + '</label><select class="select" id="cf-subj" data-cf="subj">' + subs.map((s) => '<option value="' + s.id + '"' + (s.id === st.subjectId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>' : '') +
          '<div class="field span-2"><label class="field-label" for="cf-title">' + t('title') + ' <span class="subtle">(' + t('optional') + ')</span></label><input class="input" id="cf-title" value="' + esc(st.title) + '" placeholder="' + esc(autoTitle()) + '" data-cf="title"></div>' +
          '<div class="field"><label class="field-label" for="cf-date">' + t('date') + '</label><input class="input tnum" type="date" id="cf-date" value="' + st.date + '" data-cf="date"></div>' +
          (['tp', 'parcial', 'final'].includes(st.category) ? '<div class="field"><span class="field-label">' + t('in_your_list') + '</span><div class="lead-row"><label for="cf-lead">' + t('appear_before_a') + '</label><input class="input tnum" type="number" min="0" max="30" id="cf-lead" value="' + st.lead + '" data-cf="lead"><span>' + t('appear_before_b') + '</span></div></div>' : '') +
        '</div>' +
        (st.category !== 'feriado' ? '<p class="field-hint" style="display:flex;gap:6px;align-items:center">' + I('list-checks', 14) + (st.category === 'recuperatorio' ? t('recup_task_note') : t('task_auto_note')) + '</p>' : '');
    };
    T.dialog({
      key: key, size: 'lg', title: existing ? t('edit_date') : t('add_date'), body: body,
      foot: '<button class="btn btn-secondary" data-action="overlay-close">' + t('cancel') + '</button><button class="btn btn-primary" id="cf-save">' + (existing ? t('save') : t('add_date')) + '</button>',
      onMount: (host) => {
        const rerender = () => { host.querySelector('.dialog-body').innerHTML = body(); };
        host.addEventListener('click', (e) => { const b = e.target.closest('[data-cf="cat"]'); if (!b) return; st.category = b.dataset.v; rerender(); host.querySelector('[data-cf="cat"][aria-checked="true"]').focus(); });
        host.addEventListener('input', (e) => { const b = e.target.closest('[data-cf]'); if (!b || b.dataset.cf === 'cat') return; const k = b.dataset.cf; st[k === 'subj' ? 'subjectId' : k] = k === 'lead' ? Number(b.value) : b.value; if (k === 'subj') rerender(); });
        host.addEventListener('change', (e) => { const b = e.target.closest('[data-cf="subj"]'); if (b) { st.subjectId = b.value; rerender(); } });
        host.querySelector('#cf-save').addEventListener('click', () => {
          const data = { category: st.category, subjectId: st.category === 'feriado' ? null : st.subjectId, title: st.title.trim(), date: st.date, lead: st.lead };
          let ev = existing;
          if (ev) Object.assign(ev, data); else { ev = Object.assign({ id: T.id('ce'), confirmed: false, manual: st.category === 'feriado' }, data); T.state.calEvents.push(ev); }
          let msg = t('date_saved');
          if (['tp', 'parcial', 'final'].includes(ev.category)) {
            const tk = T.state.tasks.find((x) => x.calId === ev.id);
            if (tk) Object.assign(tk, { title: evLabel(ev), subjectId: ev.subjectId, due: ev.date, lead: ev.lead });
            else { T.state.tasks.push({ id: T.id('t'), title: evLabel(ev), subjectId: ev.subjectId, priority: 3, due: ev.date, lead: ev.lead, date: null, done: false, doneAt: null, order: Math.max(0, ...T.state.tasks.map((x) => x.order)) + 1, calId: ev.id, subtasks: [] }); msg = t('date_added_task'); }
          }
          T.closeOverlay(key); T.render();
          T.toast(msg);
        });
      }
    });
  }
  T.actions['cal-new'] = (el) => { T.closePopover(); form(null, { date: el.dataset.date, cat: el.dataset.cat, subj: el.dataset.subj }); };
  T.actions['cal-edit'] = (el) => { T.closePopover(); const e = T.state.calEvents.find((x) => x.id === el.dataset.id); if (e) form(e); };
})();
