/* Horario: planificador semanal recurrente */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc, D = T.d;
  const START = 7 * 60, END = 23 * 60;
  const slotH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--schedule-slot-height')) || 26;

  function weekStart() { return D.add(D.monday(T.today), T.ui.schedWeek * 7); }

  function occurrences(iso) {
    const dt = D.parse(iso), wd = D.wd(dt), st = T.state, out = [];
    const hol = T.holidayOn(iso);
    st.classes.forEach((c) => {
      const s = T.subject(c.subjectId);
      if (!s || s.archived || c.day !== wd) return;
      const skipped = st.skips.some((k) => k.kind === 'class' && k.id === c.id && k.date === iso);
      const restored = st.holidayRestores.some((k) => k.id === c.id && k.date === iso);
      out.push({ kind: 'class', id: c.id, ref: c, title: s.name, color: s.color, start: D.min(c.start), end: D.min(c.end), room: c.room, skipped: skipped, holiday: !!hol && !restored && !skipped });
    });
    st.events.forEach((e) => {
      const r = e.repeat; let on = false;
      if (r.type === 'none') on = e.date === iso;
      else if (r.type === 'daily') on = true;
      else if (r.type === 'weekly') on = r.days.includes(wd);
      if (on && e.until && iso > e.until) on = false;
      if (!on) return;
      const skipped = st.skips.some((k) => k.kind === 'event' && k.id === e.id && k.date === iso);
      out.push({ kind: 'event', id: e.id, ref: e, title: e.title, color: e.color, start: D.min(e.start), end: D.min(e.end), skipped: skipped, repeat: r.type !== 'none' });
    });
    /* overlap layout */
    out.sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster = [], clusterEnd = -1;
    const flush = () => { const cols = []; cluster.forEach((o) => { let i = cols.findIndex((end) => end <= o.start); if (i < 0) { i = cols.length; cols.push(0); } cols[i] = o.end; o.col = i; }); cluster.forEach((o) => { o.ncol = cols.length; }); cluster = []; };
    out.forEach((o) => { if (o.start >= clusterEnd) { flush(); clusterEnd = o.end; } else clusterEnd = Math.max(clusterEnd, o.end); cluster.push(o); });
    flush();
    return out;
  }
  T.scheduleOccurrences = occurrences;

  function blockHtml(o, iso) {
    const h = slotH(), pxm = h / 30;
    const top = (o.start - START) * pxm + 1, height = Math.max((o.end - o.start) * pxm - 3, 20);
    const left = 'calc(3px + (100% - 6px) * ' + o.col + ' / ' + o.ncol + ')';
    const width = 'calc((100% - 6px) / ' + o.ncol + ' - 3px)';
    const time = D.hhmm(o.start) + '–' + D.hhmm(o.end);
    const flag = o.skipped ? t('skipped_flag') : o.holiday ? t('no_class_flag') : '';
    const cls = 'block subj-' + o.color + (o.kind === 'event' ? ' is-event' : '') + (o.skipped || o.holiday ? ' is-skipped' : '');
    const label = [o.title, time, o.room, flag].filter(Boolean).join(', ');
    const compact = height < 40;
    return '<button class="' + cls + '" style="top:' + top + 'px;height:' + height + 'px;left:' + left + ';width:' + width + '" id="blk-' + o.id + '-' + iso + '" data-action="block-open" data-kind="' + o.kind + '" data-id="' + o.id + '" data-date="' + iso + '" aria-label="' + esc(label) + '">' +
      (compact
        ? '<span class="b-meta">' + (o.kind === 'event' ? '<span class="b-dot"></span>' : '') + '<strong class="b-title" style="-webkit-line-clamp:1">' + esc(o.title) + '</strong></span>'
        : '<span class="b-title">' + esc(o.title) + '</span>' +
          '<span class="b-meta">' + (o.kind === 'event' ? (o.repeat ? I('repeat', 12) : '<span class="b-dot"></span>') : '') + '<span>' + time + '</span></span>' +
          (o.room && height > 56 ? '<span class="b-meta">' + I('map-pin', 12) + '<span>' + esc(o.room) + '</span></span>' : '') +
          (flag ? '<span class="b-flag">' + flag + '</span>' : '')) +
    '</button>';
  }

  function grid() {
    const ws = weekStart();
    const days = T.settings.visibleDays.slice().sort();
    const n = days.length;
    const h = slotH();
    const cols = 'var(--schedule-time-col) repeat(' + n + ', minmax(0, 1fr))';
    let head = '<div class="sched-head" style="grid-template-columns:' + cols + '"><div></div>';
    let body = '<div class="sched-body" style="grid-template-columns:' + cols + ';height:' + ((END - START) / 30 * h) + 'px"><div class="sched-times" aria-hidden="true">';
    for (let m = START; m < END; m += 60) body += '<div class="sched-time">' + (m === START ? '' : D.hhmm(m)) + '</div>';
    body += '</div>';
    const now = T.nowMin();
    days.forEach((wd) => {
      const dt = D.add(ws, wd - 1), iso = D.iso(dt);
      const isToday = iso === T.todayIso;
      const hol = T.holidayOn(iso);
      head += '<div class="sched-dayhead' + (isToday ? ' is-today' : '') + '"><div class="d"><span class="wd">' + D.wdShort(wd) + '</span><span class="dn tnum">' + D.dm(dt) + '</span></div>' +
        (hol ? '<span class="holiday-tag" title="' + esc(hol.name) + '">' + I('calendar-off', 12) + '<span>' + esc(hol.name) + '</span></span>' : '') + '</div>';
      body += '<div class="sched-col' + (isToday ? ' is-today' : '') + (hol ? ' is-holiday' : '') + '" role="group" aria-label="' + esc(D.wdLong(wd) + ' ' + D.dm(dt) + (hol ? ' · ' + hol.name : '')) + '">';
      for (let m = START; m < END; m += 30) body += '<button class="slot-btn" tabindex="-1" style="top:' + ((m - START) / 30 * h) + 'px" data-action="slot-add" data-date="' + iso + '" data-day="' + wd + '" data-time="' + D.hhmm(m) + '" aria-label="' + esc(t('add_at', { day: D.wdLong(wd), time: D.hhmm(m) })) + '"></button>';
      occurrences(iso).forEach((o) => { body += blockHtml(o, iso); });
      if (isToday && now >= START && now <= END) {
        const y = (now - START) / 30 * h;
        body += '<div class="now-line" style="top:' + y + 'px" aria-hidden="true"></div><span class="now-label" style="top:' + y + 'px">' + D.hhmm(now) + '</span>';
      }
      body += '</div>';
    });
    body += '</div>';
    const empty = !T.state.classes.length && !T.state.events.length;
    return '<div class="sched" style="position:relative">' + head + '</div><div class="sched-scroll" id="sched-scroll" data-keep-scroll="sched">' + body + '</div>' +
      (empty ? '<div style="position:absolute;inset:64px 0 0 0;display:grid;place-items:center;pointer-events:none"><div class="panel" style="pointer-events:auto;text-align:center;max-width:420px;box-shadow:var(--shadow-popover);display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px">' + I('calendar-clock', 32) + '<p class="empty-title" style="font-size:28px">' + t('sched_empty_title') + '</p><p class="empty-text">' + t('sched_empty_text') + '</p><div class="btn-row" style="justify-content:center;margin-top:8px"><button class="btn btn-primary" data-action="sched-add" data-tab="class">' + I('plus', 18) + t('add_class') + '</button><button class="btn btn-secondary" data-action="sched-add" data-tab="event">' + t('add_activity') + '</button></div></div></div>' : '') +
    '</div>';
  }

  T.views.schedule = {
    render() {
      const ws = weekStart(), we = D.add(ws, 6);
      const label = D.dm(ws) + ' – ' + D.dm(we) + ' · ' + we.getFullYear();
      return {
        title: t('nav_schedule'), pageClass: 'page-wide',
        actions: '<button class="btn btn-primary" id="sched-add-btn" data-action="sched-add" data-tab="class">' + I('plus', 18) + t('add') + '</button>',
        body:
          '<div class="sched-toolbar">' +
            '<div class="week-nav"><button class="btn btn-secondary btn-icon" id="wk-prev" data-action="week-nav" data-d="-1" aria-label="' + t('prev_week') + '">' + I('chevron-left') + '</button>' +
            '<span class="week-label tnum" aria-live="polite">' + label + '</span>' +
            '<button class="btn btn-secondary btn-icon" id="wk-next" data-action="week-nav" data-d="1" aria-label="' + t('next_week') + '">' + I('chevron-right') + '</button></div>' +
            '<button class="btn btn-secondary" id="wk-today" data-action="week-today"' + (T.ui.schedWeek === 0 ? ' aria-disabled="true" disabled' : '') + '>' + t('this_week') + '</button>' +
            '<button class="btn btn-ghost" id="vis-days" data-action="visible-days" aria-haspopup="dialog">' + I('calendar-days', 18) + t('visible_days') + ' <span class="badge tnum">' + T.settings.visibleDays.length + '</span></button>' +
            '<span style="flex:1"></span>' +
            '<div class="sched-legend" aria-hidden="true"><span class="k"><i class="sw sw-class"></i>' + t('legend_class') + '</span><span class="k"><i class="sw sw-event"></i>' + t('legend_event') + '</span><span class="k"><i class="sw sw-skip"></i>' + t('legend_skipped') + '</span></div>' +
          '</div>' + grid()
      };
    },
    after(r) {
      const sc = document.getElementById('sched-scroll');
      if (sc && !T.ui.schedScrolled) { sc.scrollTop = (8 * 60 - START) / 30 * slotH() - 4; T.ui.schedScrolled = true; }
      const d = r.demo;
      if (d === 'nueva-clase') T.actions['sched-add']({ dataset: { tab: 'class' } });
      if (d === 'nuevo-evento') T.actions['sched-add']({ dataset: { tab: 'event', repeat: 'weekly' } });
      if (d === 'excepcion') { const b = document.getElementById('blk-c3-2026-10-13'); if (b) T.actions['block-open'](b); }
      if (d && d !== 'vacio') history.replaceState(null, '', location.pathname + location.search + '#/' + r.path);
    }
  };

  T.actions['week-nav'] = (el) => { T.ui.schedWeek += Number(el.dataset.d); T.render(); };
  T.actions['week-today'] = () => { T.ui.schedWeek = 0; T.render(); };
  T.actions['visible-days'] = (el) => {
    const html = '<div class="popover-pad" style="display:flex;flex-direction:column;gap:10px"><strong style="font-size:14px">' + t('visible_days') + '</strong><div class="daychips" role="group" aria-label="' + t('visible_days') + '">' +
      [1, 2, 3, 4, 5, 6, 7].map((d) => '<button class="daychip" aria-pressed="' + T.settings.visibleDays.includes(d) + '" aria-label="' + D.wdLong(d) + '" data-pd="' + d + '">' + D.wdLetter(d) + '</button>').join('') + '</div><span class="field-hint">' + t('visible_days_hint') + '</span></div>';
    const p = T.popover(el, html, { label: t('visible_days') });
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pd]'); if (!b) return;
      const d = Number(b.dataset.pd), v = T.settings.visibleDays;
      if (v.includes(d)) { if (v.length > 1) v.splice(v.indexOf(d), 1); } else { v.push(d); v.sort(); }
      b.setAttribute('aria-pressed', v.includes(d));
      const keep = T.closePopover; T.closePopover = () => {}; T.render(); T.closePopover = keep;
    });
  };

  /* Block popover: detalles + omitir/restaurar + editar + eliminar */
  T.actions['block-open'] = (el) => {
    const kind = el.dataset.kind, id = el.dataset.id, iso = el.dataset.date;
    const o = occurrences(iso).find((x) => x.kind === kind && x.id === id);
    if (!o) return;
    const dt = D.parse(iso);
    const hol = T.holidayOn(iso);
    const items = [];
    if (o.holiday) items.push(['restore-holiday', 'undo-2', t('restore_holiday')]);
    else if (o.skipped) items.push(['restore', 'undo-2', t('restore')]);
    else items.push(['skip', 'calendar-x-2', t('skip_once')]);
    items.push(['edit', 'pencil', t('edit')]);
    items.push(['delete', 'trash-2', kind === 'class' ? t('delete_slot') : t('delete_activity')]);
    const html = '<div class="block-pop-head subj-' + o.color + '"><span class="sw"></span><div><div class="t">' + esc(o.title) + '</div><div class="m">' + esc(D.wdLong(D.wd(dt))) + ' ' + D.dm(dt) + ' · ' + D.hhmm(o.start) + '–' + D.hhmm(o.end) + (o.room ? ' · ' + esc(o.room) : '') + '</div>' +
      (o.holiday ? '<div class="m" style="margin-top:6px"><span class="holiday-tag">' + I('calendar-off', 12) + '<span>' + esc(hol.name) + '</span></span></div>' : '') +
      (o.skipped ? '<div class="m" style="margin-top:4px">' + t('skipped_note') + '</div>' : '') +
      (kind === 'event' ? '<div class="m" style="margin-top:4px">' + I('repeat', 12) + ' ' + repeatLabel(o.ref) + '</div>' : '') + '</div></div><div class="menu-sep"></div>' +
      items.map((it) => '<button class="menu-item' + (it[0] === 'delete' ? ' danger' : '') + '" data-bp="' + it[0] + '">' + I(it[1], 18) + '<span>' + it[2] + '</span></button>').join('');
    const p = T.popover(el, html, { label: o.title });
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bp]'); if (!b) return;
      const a = b.dataset.bp; T.closePopover();
      const st = T.state;
      if (a === 'skip') { st.skips.push({ kind: kind, id: id, date: iso }); T.render(); T.toast(t('skipped_toast', { title: esc(o.title), date: D.dm(dt) }), { action: t('undo'), onAction: () => { st.skips = st.skips.filter((k) => !(k.kind === kind && k.id === id && k.date === iso)); T.render(); } }); }
      if (a === 'restore') { st.skips = st.skips.filter((k) => !(k.kind === kind && k.id === id && k.date === iso)); T.render(); T.toast(t('restored_toast')); }
      if (a === 'restore-holiday') { st.holidayRestores.push({ id: id, date: iso }); T.render(); T.toast(t('restored_toast')); }
      if (a === 'edit') T.actions['sched-add']({ dataset: { tab: kind === 'class' ? 'class' : 'event', edit: id } });
      if (a === 'delete') T.confirm({ title: kind === 'class' ? t('delete_slot_q') : t('delete_activity_q', { title: esc(o.title) }), body: kind === 'class' ? t('delete_slot_body') : t('delete_activity_body'), confirm: t('delete'), danger: true,
        onConfirm: () => { if (kind === 'class') st.classes = st.classes.filter((c) => c.id !== id); else st.events = st.events.filter((x) => x.id !== id); T.render(); } });
    });
  };
  function repeatLabel(e) {
    const r = e.repeat;
    if (r.type === 'none') return t('repeat_none') + ' · ' + D.dm(e.date);
    if (r.type === 'daily') return t('repeat_daily') + (e.until ? ' · ' + t('until', { date: D.dm(e.until) }) : '');
    return r.days.map((d) => D.wdShort(d)).join(', ') + (e.until ? ' · ' + t('until', { date: D.dm(e.until) }) : '');
  }

  T.actions['slot-add'] = (el) => T.actions['sched-add']({ dataset: { tab: 'class', day: el.dataset.day, time: el.dataset.time, date: el.dataset.date } });

  /* Alta / edición: clase (varios horarios) o actividad (con repetición) */
  T.actions['sched-add'] = (el) => {
    const ds = el.dataset;
    const editing = ds.edit ? (ds.tab === 'class' ? T.state.classes.find((c) => c.id === ds.edit) : T.state.events.find((e) => e.id === ds.edit)) : null;
    const startT = ds.time || (editing ? editing.start : '18:00');
    const endT = editing ? editing.end : D.hhmm(Math.min(D.min(startT) + 120, END));
    const st = {
      tab: ds.tab || 'class',
      subjectId: editing && editing.subjectId ? editing.subjectId : (T.activeSubjects()[0] || {}).id,
      rows: editing && ds.tab === 'class' ? [{ day: editing.day, start: editing.start, end: editing.end, room: editing.room }] : [{ day: Number(ds.day) || 1, start: startT, end: endT, room: '' }],
      title: editing && ds.tab === 'event' ? editing.title : '',
      color: editing && ds.tab === 'event' ? editing.color : 'lima',
      repeat: editing && ds.tab === 'event' ? editing.repeat.type : (ds.repeat || 'none'),
      days: editing && ds.tab === 'event' ? editing.repeat.days.slice() : (ds.repeat === 'weekly' ? [1, 3] : [Number(ds.day) || 1]),
      date: editing && editing.date ? editing.date : (ds.date || T.todayIso),
      until: editing ? editing.until || '' : '',
      evStart: ds.repeat === 'weekly' && !editing ? '21:00' : startT, evEnd: ds.repeat === 'weekly' && !editing ? '23:00' : endT, error: null
    };
    if (ds.repeat === 'weekly' && !editing) st.title = 'Vóley';
    const key = 'sched-form';
    const dayOpts = (sel) => [1, 2, 3, 4, 5, 6, 7].map((d) => '<option value="' + d + '"' + (d === Number(sel) ? ' selected' : '') + '>' + D.wdLong(d) + '</option>').join('');
    const body = () => {
      const subs = T.activeSubjects();
      const tabs = editing ? '' : '<div class="seg" role="radiogroup" aria-label="' + t('what_to_add') + '" style="align-self:flex-start"><button class="seg-item" role="radio" aria-checked="' + (st.tab === 'class') + '" data-sf="tab" data-v="class">' + I('book-open', 16) + t('class_of_subject') + '</button><button class="seg-item" role="radio" aria-checked="' + (st.tab === 'event') + '" data-sf="tab" data-v="event">' + I('calendar', 16) + t('activity') + '</button></div>';
      if (st.tab === 'class') {
        return tabs +
          '<div class="field"><label class="field-label" for="cf-subj">' + t('subject') + '</label><select class="select" id="cf-subj" data-sf="subject">' + subs.map((s) => '<option value="' + s.id + '"' + (s.id === st.subjectId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>' +
          '<div class="field"><span class="field-label">' + t('class_slots') + '</span><div class="slot-rows">' + st.rows.map((r, i) =>
            '<div class="slot-row"><div class="field"><label class="field-label" for="cr-d' + i + '">' + t('day') + '</label><select class="select" id="cr-d' + i + '" data-sf="row" data-i="' + i + '" data-k="day">' + dayOpts(r.day) + '</select></div>' +
            '<div class="field"><label class="field-label" for="cr-s' + i + '">' + t('from') + '</label><input class="input tnum" type="time" step="1800" id="cr-s' + i + '" value="' + r.start + '" data-sf="row" data-i="' + i + '" data-k="start"></div>' +
            '<div class="field' + (st.error === i ? ' is-invalid' : '') + '"><label class="field-label" for="cr-e' + i + '">' + t('to') + '</label><input class="input tnum" type="time" step="1800" id="cr-e' + i + '" value="' + r.end + '" data-sf="row" data-i="' + i + '" data-k="end"' + (st.error === i ? ' aria-invalid="true"' : '') + '></div>' +
            '<div class="field"><label class="field-label" for="cr-r' + i + '">' + t('room') + '</label><input class="input" id="cr-r' + i + '" value="' + esc(r.room) + '" placeholder="' + t('room_ph') + '" data-sf="row" data-i="' + i + '" data-k="room"></div>' +
            '<button class="btn btn-ghost btn-icon" data-sf="remove" data-i="' + i + '" aria-label="' + t('remove_slot') + '"' + (st.rows.length === 1 ? ' disabled' : '') + '>' + I('trash-2', 18) + '</button></div>' +
            (st.error === i ? '<span class="field-error">' + I('circle-alert', 14) + t('end_after_start') + '</span>' : '')).join('') + '</div></div>' +
          (editing ? '' : '<button class="btn btn-ghost" style="align-self:flex-start" data-sf="addrow">' + I('plus', 18) + t('add_another_slot') + '</button>');
      }
      return tabs +
        '<div class="form-grid"><div class="field span-2"><label class="field-label" for="ef-title">' + t('title') + '<span class="req" aria-hidden="true">*</span></label><input class="input" id="ef-title" value="' + esc(st.title) + '" placeholder="' + t('activity_ph') + '" data-sf="title"></div>' +
        '<div class="field span-2"><span class="field-label">' + t('color') + '</span>' + T.swatches(st.color, 'ef-c') + '</div>' +
        '<div class="field span-2"><span class="field-label" id="ef-rep-l">' + t('repeat') + '</span><div class="seg" role="radiogroup" aria-labelledby="ef-rep-l" style="align-self:flex-start">' +
          [['none', 'repeat_none'], ['daily', 'repeat_daily'], ['weekly', 'repeat_weekly']].map((x) => '<button class="seg-item" role="radio" aria-checked="' + (st.repeat === x[0]) + '" data-sf="repeat" data-v="' + x[0] + '">' + t(x[1]) + '</button>').join('') + '</div></div>' +
        (st.repeat === 'weekly' ? '<div class="field span-2"><span class="field-label">' + t('which_days') + '</span><div class="daychips" role="group" aria-label="' + t('which_days') + '">' + [1, 2, 3, 4, 5, 6, 7].map((d) => '<button class="daychip" aria-pressed="' + st.days.includes(d) + '" aria-label="' + D.wdLong(d) + '" data-sf="day" data-v="' + d + '">' + D.wdLetter(d) + '</button>').join('') + '</div></div>' : '') +
        (st.repeat === 'none' ? '<div class="field span-2"><label class="field-label" for="ef-date">' + t('date') + '</label><input class="input tnum" type="date" id="ef-date" value="' + st.date + '" data-sf="date" style="max-width:220px"></div>' : '') +
        '<div class="field"><label class="field-label" for="ef-s">' + t('from') + '</label><input class="input tnum" type="time" step="1800" id="ef-s" value="' + st.evStart + '" data-sf="evStart"></div>' +
        '<div class="field' + (st.error === 'ev' ? ' is-invalid' : '') + '"><label class="field-label" for="ef-e">' + t('to') + '</label><input class="input tnum" type="time" step="1800" id="ef-e" value="' + st.evEnd + '" data-sf="evEnd"></div>' +
        (st.error === 'ev' ? '<span class="field-error span-2">' + I('circle-alert', 14) + t('end_after_start') + '</span>' : '') +
        (st.repeat !== 'none' ? '<div class="field span-2"><label class="field-label" for="ef-until">' + t('ends_on') + ' <span class="subtle">(' + t('optional') + ')</span></label><input class="input tnum" type="date" id="ef-until" value="' + st.until + '" data-sf="until" style="max-width:220px"><span class="field-hint">' + t('ends_on_hint') + '</span></div>' : '') +
        '</div>';
    };
    const foot = '<button class="btn btn-secondary" data-action="overlay-close">' + t('cancel') + '</button><button class="btn btn-primary" id="sched-save">' + (editing ? t('save') : t('add')) + '</button>';
    T.dialog({
      key: key, size: 'lg', title: editing ? (ds.tab === 'class' ? t('edit_class') : t('edit_activity')) : t('add_to_schedule'), body: body, foot: foot,
      onMount: (host) => {
        const rerender = () => { host.querySelector('.dialog-body').innerHTML = body(); bind(); };
        const bind = () => { T.bindSwatches(host, (c) => { st.color = c; }); };
        bind();
        host.addEventListener('click', (e) => {
          const b = e.target.closest('[data-sf]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
          const k = b.dataset.sf;
          if (k === 'tab') st.tab = b.dataset.v;
          if (k === 'addrow') { const last = st.rows[st.rows.length - 1]; st.rows.push({ day: Math.min(last.day + 2, 7), start: last.start, end: last.end, room: '' }); }
          if (k === 'remove') st.rows.splice(Number(b.dataset.i), 1);
          if (k === 'repeat') st.repeat = b.dataset.v;
          if (k === 'day') { const d = Number(b.dataset.v); st.days = st.days.includes(d) ? st.days.filter((x) => x !== d) : st.days.concat(d).sort(); }
          if (['tab', 'addrow', 'remove', 'repeat', 'day'].includes(k)) { e.preventDefault(); rerender(); }
        });
        host.addEventListener('input', (e) => {
          const b = e.target.closest('[data-sf]'); if (!b) return;
          const k = b.dataset.sf;
          if (k === 'row') st.rows[Number(b.dataset.i)][b.dataset.k] = b.dataset.k === 'day' ? Number(b.value) : b.value;
          else if (k === 'subject') st.subjectId = b.value;
          else st[k] = b.value;
        });
        host.addEventListener('change', (e) => { const b = e.target.closest('[data-sf="row"]'); if (b && b.dataset.k === 'day') st.rows[Number(b.dataset.i)].day = Number(b.value); const s = e.target.closest('[data-sf="subject"]'); if (s) st.subjectId = s.value; });
        host.querySelector('#sched-save').addEventListener('click', () => {
          st.error = null;
          if (st.tab === 'class') {
            const bad = st.rows.findIndex((r) => D.min(r.end) <= D.min(r.start));
            if (bad >= 0) { st.error = bad; rerender(); return; }
            if (editing) Object.assign(editing, st.rows[0], { subjectId: st.subjectId });
            else st.rows.forEach((r) => T.state.classes.push({ id: T.id('c'), subjectId: st.subjectId, day: Number(r.day), start: r.start, end: r.end, room: r.room.trim() }));
            T.toast(editing ? t('saved') : T.tn('slots_added', st.rows.length, { name: esc(T.subject(st.subjectId).name) }));
          } else {
            if (!st.title.trim()) { const i = host.querySelector('#ef-title'); i.classList.add('is-invalid'); i.setAttribute('aria-invalid', 'true'); i.focus(); return; }
            if (D.min(st.evEnd) <= D.min(st.evStart)) { st.error = 'ev'; rerender(); return; }
            const data = { title: st.title.trim(), color: st.color, start: st.evStart, end: st.evEnd, repeat: { type: st.repeat, days: st.repeat === 'weekly' ? st.days : [] }, until: st.until || null, date: st.repeat === 'none' ? st.date : null };
            if (editing) Object.assign(editing, data); else T.state.events.push(Object.assign({ id: T.id('e') }, data));
            T.toast(editing ? t('saved') : t('activity_added', { title: esc(data.title) }));
          }
          T.closeOverlay(key); T.render();
        });
      }
    });
  };
})();
