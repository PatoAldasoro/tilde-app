/* Tareas: lista por día, subtareas, arrastrar y soltar, selección y borrado */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc, D = T.d;

  const leadOf = (tk) => (tk.lead == null ? T.settings.defaultLead : tk.lead);
  function visibleOn(tk, iso) {
    const today = T.todayIso;
    if (T.ui.tasksMode === 'subject' && T.ui.tasksSubject && tk.subjectId !== T.ui.tasksSubject) return null;
    if (!tk.due) {
      if (tk.done) return (tk.doneAt || tk.date) === iso ? { carry: 0 } : null;
      if (tk.date === iso) return { carry: 0 };
      if (iso === today && tk.date < today) return { carry: D.diff(tk.date, today) };
      return null;
    }
    if (tk.done) return tk.doneAt === iso ? { carry: 0 } : null;
    const from = D.addIso(tk.due, -leadOf(tk));
    if (iso >= from && iso <= tk.due && iso >= today) return { carry: 0 };
    if (iso === today && tk.due < today) return { carry: 0 };
    return null;
  }
  function dayList(iso) {
    const out = [];
    T.state.tasks.forEach((tk) => { const v = visibleOn(tk, iso); if (v) out.push(Object.assign({ tk: tk }, v)); });
    out.sort((a, b) => (a.tk.done - b.tk.done) || (a.tk.order - b.tk.order));
    return out;
  }
  T.dayTasks = dayList;
  function progressOf(list) { const total = list.length, done = list.filter((x) => x.tk.done).length; return { total: total, done: done, pct: total ? Math.round((done / total) * 100) : 100 }; }
  function rangeDays() {
    if (T.ui.tasksRange === 'today') return [T.todayIso];
    if (T.ui.tasksRange === 'date') return [T.ui.tasksDate || T.todayIso];
    return [0, 1, 2, 3, 4, 5, 6].map((n) => D.addIso(T.todayIso, n));
  }
  T.dueInfo = function (tk) {
    if (!tk.due) return null;
    const d = D.diff(T.today, tk.due);
    if (tk.done) return { cls: '', label: D.dm(tk.due) };
    if (d < 0) return { cls: 'is-overdue', label: t('overdue') };
    if (d === 0) return { cls: 'is-today', label: t('due_today') };
    if (d === 1) return { cls: 'is-soon', label: t('due_tomorrow') };
    return { cls: d <= 3 ? 'is-soon' : '', label: t('due_in', { n: d }) };
  };
  const subsLeft = (tk) => tk.subtasks.filter((s) => !s.done).length;
  T.subsLeft = subsLeft;

  T.checkButton = function (tk, idp, small) {
    const left = subsLeft(tk);
    const blocked = !tk.done && left > 0;
    const tip = blocked ? T.tn('subtasks_left', left) : '';
    return '<button class="check' + (small ? ' check-sm' : '') + '" role="checkbox" id="' + idp + '" aria-checked="' + tk.done + '"' + (blocked ? ' aria-disabled="true" data-tip="' + esc(tip) + '"' : '') + ' aria-label="' + esc((tk.done ? t('mark_pending') : t('mark_done')) + ': ' + tk.title + (blocked ? '. ' + tip : '')) + '" data-action="task-toggle" data-id="' + tk.id + '"><span class="check-box">' + I('check', 14, { sw: 3 }) + '</span></button>';
  };

  function row(x, iso, opts) {
    const tk = x.tk, sel = T.ui.selecting, isSel = T.ui.selected.has(tk.id);
    const due = T.dueInfo(tk);
    const left = subsLeft(tk), nsub = tk.subtasks.length;
    const expanded = T.ui.expanded.has(tk.id) && nsub;
    const prio = ['', 'p1', 'p2', 'p3'][tk.priority];
    const prioLabel = t(['prio_none', 'prio_low', 'prio_med', 'prio_high'][tk.priority]);
    const cls = 'task' + (tk.done ? ' is-done' : '') + (isSel ? ' is-selected' : '') + (opts && opts.placeholder ? ' is-placeholder' : '') + (opts && opts.lifted ? ' is-lifted' : '');
    const lead = sel
      ? '<span style="width:8px"></span><button class="check check-select" role="checkbox" id="sel-' + tk.id + '-' + iso + '" aria-checked="' + isSel + '" aria-label="' + esc(t('select') + ': ' + tk.title) + '" data-action="task-select" data-id="' + tk.id + '"><span class="check-box">' + I('check', 14, { sw: 3 }) + '</span></button>'
      : '<button class="grip" id="grip-' + tk.id + '-' + iso + '" aria-label="' + esc(t('drag_task', { title: tk.title })) + '" aria-roledescription="' + t('drag_handle') + '"' + (tk.done ? ' aria-disabled="true" tabindex="-1"' : '') + ' data-grip="' + tk.id + '" data-date="' + iso + '">' + I('grip-vertical', 18) + '</button>' + T.checkButton(tk, 'chk-' + tk.id + '-' + iso);
    return '<div class="' + cls + '" data-flip="' + tk.id + '@' + iso + '" data-task="' + tk.id + '" data-date="' + iso + '"><div class="task-row">' + lead +
      '<div class="task-main"><button class="task-title" id="tt-' + tk.id + '-' + iso + '" data-action="' + (sel ? 'task-select' : 'task-open') + '" data-id="' + tk.id + '">' + esc(tk.title) + '</button>' +
        '<span class="task-meta">' + (tk.subjectId ? T.chipSubject(tk.subjectId, { short: true, title: true }) : '') + (x.carry ? '<span class="carry">' + I('history', 13) + (x.carry === 1 ? t('from_yesterday') : t('days_ago', { n: x.carry })) + '</span>' : '') + '</span></div>' +
      '<div class="task-side">' +
        (tk.priority ? '<span class="flag ' + prio + '" role="img" aria-label="' + prioLabel + '" data-tip="' + prioLabel + '">' + I('flag', 16, { fill: tk.priority >= 2 ? 'currentColor' : 'none' }) + '</span>' : '') +
        (due ? '<span class="due ' + due.cls + '">' + I(due.cls === 'is-overdue' ? 'circle-alert' : 'calendar', 13) + due.label + '</span>' : '') +
        (nsub ? '<span class="subcount' + (left === 0 ? ' is-complete' : '') + '" aria-label="' + t('subtasks_progress', { done: nsub - left, total: nsub }) + '">' + I('list-todo', 14) + (nsub - left) + '/' + nsub + '</span>' +
          '<button class="btn btn-ghost btn-icon btn-sm expand-btn" id="exp-' + tk.id + '-' + iso + '" aria-expanded="' + !!expanded + '" aria-label="' + (expanded ? t('collapse_subtasks') : t('expand_subtasks')) + '" data-action="task-expand" data-id="' + tk.id + '">' + I('chevron-down', 18) + '</button>' : '<span style="width:32px" aria-hidden="true"></span>') +
      '</div></div>' +
      (expanded ? '<div class="subtasks">' + tk.subtasks.map((s) => '<div class="subtask' + (s.done ? ' is-done' : '') + '"><button class="check check-sm" role="checkbox" id="sub-' + s.id + '-' + iso + '" aria-checked="' + s.done + '" aria-label="' + esc(s.title) + '" data-action="sub-toggle" data-id="' + tk.id + '" data-sub="' + s.id + '"><span class="check-box">' + I('check', 12, { sw: 3 }) + '</span></button><span class="subtask-title">' + esc(s.title) + '</span></div>').join('') + '</div>' : '') +
    '</div>';
  }

  function group(iso, idx) {
    const list = dayList(iso), p = progressOf(list);
    const drag = T.ui.demoDrag;
    const isTarget = drag && drag.target === iso;
    let rows = list.map((x) => row(x, iso, drag && drag.id === x.tk.id && drag.from === iso ? { placeholder: true } : null));
    if (isTarget) {
      const tk = T.state.tasks.find((k) => k.id === drag.id);
      const pos = Math.min(drag.index, list.length);
      const parts = list.map((x, i) => rows[i]);
      parts.splice(pos, 0, '<div class="insert-line" aria-hidden="true"></div><div style="position:relative;height:0"><div style="position:absolute;left:18px;right:-12px;top:4px;z-index:20">' + row({ tk: tk, carry: 0 }, iso, { lifted: true }) + '</div></div>');
      rows = parts;
    }
    const dt = D.parse(iso);
    return '<section class="day-group' + (isTarget ? ' is-drop-target' : '') + '" data-day="' + iso + '" aria-labelledby="dh-' + iso + '">' +
      '<div class="day-head"><h2 class="day-title" id="dh-' + iso + '">' + T.dayLabel(iso) + '</h2><span class="day-date">' + (D.diff(T.today, iso) > 1 || D.diff(T.today, iso) < 0 ? '' : D.wdShort(D.wd(dt)) + ' ') + D.dm(dt) + '</span><span class="grow"></span>' +
        '<span class="day-count tnum" aria-label="' + t('done_of', { done: p.done, total: p.total }) + '">' + p.done + '/' + p.total + '</span>' +
        '<div class="progress progress-xs" role="progressbar" aria-label="' + t('day_progress') + '" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100" style="--value:' + p.pct + '%;' + (p.pct === 100 ? '--bar:var(--color-success)' : '') + '"><i></i></div></div>' +
      (T.ui.selecting ? '' : '<div class="quick-add">' + I('plus', 18) + '<label class="visually-hidden" for="qa-' + iso + '">' + t('quick_add_label', { day: T.dayLabel(iso) }) + '</label><input id="qa-' + iso + '" placeholder="' + t('quick_add_ph') + '" autocomplete="off" data-enter="quick-add" data-date="' + iso + '"><span class="kbd">Enter</span></div>') +
      '<div class="task-list" data-list="' + iso + '">' + (rows.length ? rows.join('') : '<p class="day-empty">' + t(idx === 0 ? 'day_empty_today' : 'day_empty') + '</p>') + '</div>' +
    '</section>';
  }

  T.views.tasks = {
    render(r) {
      const today = dayList(T.todayIso), tp = progressOf(today);
      const subs = T.activeSubjects();
      const anyTasks = T.state.tasks.length > 0;
      const allDone = tp.total > 0 && tp.done === tp.total;
      const days = rangeDays();
      const sel = T.ui.selecting;
      const head =
        '<div class="toolbar">' +
          '<div class="seg" role="radiogroup" aria-label="' + t('view') + '"><button class="seg-item" role="radio" id="tm-general" aria-checked="' + (T.ui.tasksMode === 'general') + '" data-action="tasks-mode" data-v="general">' + t('general') + '</button><button class="seg-item" role="radio" id="tm-subject" aria-checked="' + (T.ui.tasksMode === 'subject') + '" data-action="tasks-mode" data-v="subject">' + t('by_subject') + '</button></div>' +
          '<div class="seg" role="radiogroup" aria-label="' + t('date_filter') + '">' + [['today', 'f_today'], ['week', 'f_week'], ['date', 'f_date']].map((x) => '<button class="seg-item" role="radio" id="tr-' + x[0] + '" aria-checked="' + (T.ui.tasksRange === x[0]) + '" data-action="tasks-range" data-v="' + x[0] + '">' + (x[0] === 'date' ? I('calendar', 16) : '') + t(x[1]) + '</button>').join('') + '</div>' +
          (T.ui.tasksRange === 'date' ? '<label class="visually-hidden" for="tr-date-in">' + t('pick_date') + '</label><input class="input tnum" type="date" id="tr-date-in" style="width:180px" value="' + (T.ui.tasksDate || T.todayIso) + '" data-change="tasks-date">' : '') +
        '</div>' +
        (T.ui.tasksMode === 'subject' ? '<div class="subject-filter" role="radiogroup" aria-label="' + t('subject') + '" style="margin:-8px 0 20px">' + subs.map((s) => '<button class="chip-toggle subj-' + s.color + '" role="radio" id="tf-' + s.id + '" aria-pressed="' + (T.ui.tasksSubject === s.id) + '" aria-checked="' + (T.ui.tasksSubject === s.id) + '" data-action="tasks-subject" data-id="' + s.id + '"><span class="dot"></span>' + esc(T.shortName(s.name)) + '</button>').join('') + '</div>' : '');
      const todayCard = allDone
        ? '<div class="all-done" role="status">' + I('circle-check-big', 32) + '<div><strong>' + t('all_done_title') + '</strong><span>' + t('all_done_text', { n: tp.total }) + '</span></div></div>'
        : '<section class="today-card" aria-label="' + t('today_progress') + '"><div><div class="lbl">' + t('today') + ' · ' + D.wdLong(D.wd(T.today)) + ' ' + D.dm(T.today) + '</div><div class="k tnum">' + tp.done + '<small>/ ' + tp.total + '</small></div></div>' +
          '<div><div class="lbl"><span>' + t('today_progress') + '</span><span class="tnum">' + T.tn('pending_count', tp.total - tp.done) + '</span></div><div class="progress progress-lg" role="progressbar" aria-label="' + t('today_progress') + '" aria-valuenow="' + tp.pct + '" aria-valuemin="0" aria-valuemax="100" style="--value:' + tp.pct + '%"><i></i></div></div>' +
          '<div class="pct tnum">' + tp.pct + ' %</div></section>';
      let body;
      if (!anyTasks) {
        body = head + '<div class="empty" style="padding-top:40px">' + I('list-checks', 32) + '<p class="empty-title">' + t('tasks_empty_title') + '</p><p class="empty-text">' + t('tasks_empty_text') + '</p></div>' + group(T.todayIso, 0);
      } else {
        body = head + '<div class="tasks-layout">' + todayCard + days.map((iso, i) => group(iso, i)).join('') + '</div>';
      }
      if (sel) {
        const n = T.ui.selected.size;
        body += '<div class="select-bar" role="toolbar" aria-label="' + t('selection') + '"><span class="count" aria-live="polite">' + T.tn('selected_count', n) + '</span>' +
          '<button class="btn btn-ghost" data-action="select-all">' + t('select_all') + '</button><button class="btn btn-ghost" data-action="select-cancel">' + t('cancel') + '</button>' +
          '<button class="btn btn-danger" id="del-selected" data-action="delete-selected"' + (n ? '' : ' disabled') + '>' + I('trash-2', 18) + t('delete_n', { n: n }) + '</button></div>';
      }
      return {
        title: t('nav_tasks'), pageClass: 'page-narrow',
        actions: sel ? '' :
          '<button class="btn btn-ghost" id="sort-prio" data-action="sort-priority">' + I('arrow-down-wide-narrow', 18) + t('sort_priority') + '</button>' +
          '<button class="btn btn-secondary" id="select-mode" data-action="select-mode">' + I('square-check', 18) + t('select') + '</button>' +
          '<button class="btn btn-ghost btn-icon" id="tasks-more" aria-haspopup="menu" aria-label="' + t('more_options') + '" data-action="tasks-more">' + I('ellipsis') + '</button>',
        body: body
      };
    },
    after(r) {
      bindDrag();
      const d = r.demo;
      if (d && !T.ui._demoApplied) {
        T.ui._demoApplied = true;
        if (d === 'detalle') T.actions['task-open']({ dataset: { id: 't2' } });
        if (d === 'por-materia') { T.ui.tasksMode = 'subject'; T.ui.tasksSubject = 's3'; T.render(); }
        if (d === 'seleccion') { T.ui.selecting = true; T.ui.selected = new Set(['t3', 't5']); T.render(); }
        if (d === 'arrastrando') { T.ui.demoDrag = { id: 't3', from: T.todayIso, target: T.todayIso, index: 4 }; T.render(); }
        if (d === 'todo-hecho') { T.ui.tasksRange = 'today'; dayList(T.todayIso).forEach((x) => { x.tk.done = true; x.tk.doneAt = T.todayIso; x.tk.subtasks.forEach((s) => { s.done = true; }); x.tk.date = x.tk.date && x.tk.date < T.todayIso ? T.todayIso : x.tk.date; }); T.render(); }
        if (d === 'borrar') { T.ui.selecting = true; T.ui.selected = new Set(['t3', 't5']); T.render(); T.actions['delete-selected'](); }
      }
    }
  };
  addEventListener('hashchange', () => { T.ui._demoApplied = false; T.ui.demoDrag = null; });

  /* ---------- Actions ---------- */
  T.actions['tasks-mode'] = (el) => { T.ui.tasksMode = el.dataset.v; if (el.dataset.v === 'subject' && !T.ui.tasksSubject) T.ui.tasksSubject = (T.activeSubjects()[0] || {}).id; T.render(); };
  T.actions['tasks-subject'] = (el) => { T.ui.tasksSubject = el.dataset.id; T.render(); };
  T.actions['tasks-range'] = (el) => { T.ui.tasksRange = el.dataset.v; T.render(); };
  T.actions['tasks-date'] = (el) => { T.ui.tasksDate = el.value || T.todayIso; T.render(); };
  T.actions['task-expand'] = (el) => { const id = el.dataset.id; T.ui.expanded.has(id) ? T.ui.expanded.delete(id) : T.ui.expanded.add(id); T.render(); };
  T.actions['task-toggle'] = (el) => {
    const tk = T.state.tasks.find((x) => x.id === el.dataset.id);
    if (!tk.done && subsLeft(tk) > 0) {
      el.classList.add('tip-open'); setTimeout(() => el.classList.remove('tip-open'), 2200);
      if (matchMedia('(hover: none)').matches) T.toast(T.tn('subtasks_left', subsLeft(tk)));
      return;
    }
    tk.done = !tk.done;
    tk.doneAt = tk.done ? T.todayIso : null;
    if (tk.done && !tk.due && tk.date < T.todayIso) tk.date = T.todayIso;
    T.ui.flip = true; T.render();
  };
  T.actions['sub-toggle'] = (el) => {
    const tk = T.state.tasks.find((x) => x.id === el.dataset.id);
    const s = tk.subtasks.find((x) => x.id === el.dataset.sub);
    s.done = !s.done;
    if (!s.done && tk.done) { tk.done = false; tk.doneAt = null; }
    T.ui.flip = true; T.render();
  };
  T.actions['quick-add'] = (el) => {
    const title = el.value.trim(); if (!title) return;
    const maxOrder = Math.max(0, ...T.state.tasks.map((x) => x.order));
    T.state.tasks.push({ id: T.id('t'), title: title, subjectId: T.ui.tasksMode === 'subject' ? T.ui.tasksSubject : null, priority: 0, due: null, lead: null, date: el.dataset.date, done: false, doneAt: null, order: maxOrder + 1, subtasks: [] });
    el.value = ''; T.render();
  };
  T.actions['select-mode'] = () => { T.ui.selecting = true; T.ui.selected.clear(); T.render(); };
  T.actions['select-cancel'] = () => { T.ui.selecting = false; T.ui.selected.clear(); T.render(); };
  T.onEscape = () => { if (T.ui.selecting) { T.actions['select-cancel'](); return true; } return false; };
  T.actions['task-select'] = (el) => { const id = el.dataset.id; T.ui.selected.has(id) ? T.ui.selected.delete(id) : T.ui.selected.add(id); T.render(); };
  function visibleIds() { const s = new Set(); rangeDays().forEach((iso) => dayList(iso).forEach((x) => s.add(x.tk.id))); return s; }
  T.actions['select-all'] = () => { T.ui.selected = visibleIds(); T.render(); };
  function deleteIds(ids) {
    const n = ids.size;
    T.confirm({
      title: T.tn('delete_tasks_q', n), body: t('delete_tasks_body'), confirm: T.tn('delete_tasks', n), danger: true,
      onConfirm: () => {
        const snap = T.state.tasks.slice();
        T.state.tasks = T.state.tasks.filter((x) => !ids.has(x.id));
        T.ui.selecting = false; T.ui.selected.clear(); T.render();
        T.toast(T.tn('tasks_deleted', n), { action: t('undo'), onAction: () => { T.state.tasks = snap; T.render(); } });
      }
    });
  }
  T.actions['delete-selected'] = () => { if (T.ui.selected.size) deleteIds(new Set(T.ui.selected)); };
  T.actions['tasks-more'] = (el) => {
    const ids = visibleIds();
    T.menu(el, [
      { icon: 'trash-2', label: t('delete_all_n', { n: ids.size }), danger: true, disabled: !ids.size, run: () => deleteIds(ids) }
    ], { align: 'end' });
  };
  T.actions['sort-priority'] = () => {
    const sorted = T.state.tasks.slice().sort((a, b) => (b.priority - a.priority) || (a.order - b.order));
    sorted.forEach((x, i) => { x.order = i + 1; });
    T.ui.flip = true; T.render(); T.toast(t('sorted_priority'));
  };

  /* Detail sheet */
  function sheet(id) {
    const tk = T.state.tasks.find((x) => x.id === id);
    if (!tk) return '';
    const subs = T.activeSubjects();
    const left = subsLeft(tk);
    return '<div class="sheet-head">' + T.checkButton(tk, 'sh-chk') + '<span style="flex:1;font-weight:600;padding-left:8px">' + t('task_detail') + '</span><button class="btn btn-ghost btn-icon" data-action="overlay-close" aria-label="' + t('close') + '">' + I('x') + '</button></div>' +
      '<div class="sheet-body">' +
        '<div class="field"><label class="field-label" for="td-title">' + t('title') + '</label><input class="input" id="td-title" value="' + esc(tk.title) + '" data-change="task-field" data-id="' + tk.id + '" data-field="title" style="font-size:16px;height:44px"></div>' +
        '<div class="field"><label class="field-label" for="td-subj">' + t('subject') + ' <span class="subtle">(' + t('optional') + ')</span></label><select class="select" id="td-subj" data-change="task-field" data-id="' + tk.id + '" data-field="subjectId"><option value="">' + t('no_subject') + '</option>' + subs.map((s) => '<option value="' + s.id + '"' + (tk.subjectId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><span class="field-label">' + t('priority') + '</span><div class="prio-picker" role="radiogroup" aria-label="' + t('priority') + '">' +
          [0, 1, 2, 3].map((p) => '<button class="chip-toggle" role="radio" id="td-p' + p + '" aria-checked="' + (tk.priority === p) + '" aria-pressed="' + (tk.priority === p) + '" data-action="task-prio" data-id="' + tk.id + '" data-p="' + p + '"><span class="flag ' + ['', 'p1', 'p2', 'p3'][p] + '" style="width:16px;height:16px">' + I('flag', 16, { fill: p >= 2 ? 'currentColor' : 'none' }) + '</span>' + t(['prio_none', 'prio_low', 'prio_med', 'prio_high'][p]) + '</button>').join('') + '</div></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="field-label" for="td-due">' + t('due_date') + '</label><input class="input tnum" type="date" id="td-due" value="' + (tk.due || '') + '" data-change="task-due" data-id="' + tk.id + '"><span class="field-hint">' + t(tk.due ? 'due_hint_set' : 'due_hint') + '</span></div>' +
          (tk.due ? '' : '<div class="field"><label class="field-label" for="td-date">' + t('day') + '</label><input class="input tnum" type="date" id="td-date" value="' + (tk.date || T.todayIso) + '" data-change="task-field" data-id="' + tk.id + '" data-field="date"><span class="field-hint">' + t('day_hint') + '</span></div>') +
        '</div>' +
        (tk.due ? '<div class="lead-row"><label for="td-lead">' + t('appear_before_a') + '</label><input class="input tnum" type="number" min="0" max="30" id="td-lead" value="' + leadOf(tk) + '" data-change="task-field" data-id="' + tk.id + '" data-field="lead"><span>' + t('appear_before_b') + '</span></div>' : '') +
        '<div class="field"><span class="field-label">' + t('subtasks') + ' · <span class="tnum">' + (tk.subtasks.length - left) + '/' + tk.subtasks.length + '</span></span><div class="sub-edit">' +
          tk.subtasks.map((s) => '<div class="subtask' + (s.done ? ' is-done' : '') + '"><button class="check check-sm" role="checkbox" id="ss-' + s.id + '" aria-checked="' + s.done + '" aria-label="' + esc(s.title) + '" data-action="sub-toggle" data-id="' + tk.id + '" data-sub="' + s.id + '"><span class="check-box">' + I('check', 12, { sw: 3 }) + '</span></button><span class="subtask-title">' + esc(s.title) + '</span><button class="btn btn-ghost btn-icon btn-sm" data-action="sub-delete" data-id="' + tk.id + '" data-sub="' + s.id + '" aria-label="' + t('remove') + ': ' + esc(s.title) + '">' + I('x', 16) + '</button></div>').join('') +
          '<div class="quick-add">' + I('plus', 18) + '<label class="visually-hidden" for="sub-qa">' + t('add_subtask') + '</label><input id="sub-qa" placeholder="' + t('add_subtask') + '" data-enter="sub-add" data-id="' + tk.id + '" autocomplete="off"><span class="kbd">Enter</span></div>' +
        '</div>' + (left && !tk.done ? '<span class="field-hint">' + I('info', 13) + ' ' + t('subtasks_rule') + '</span>' : '') + '</div>' +
        (tk.calId ? '<p class="field-hint">' + I('calendar-days', 13) + ' ' + t('from_calendar') + '</p>' : '') +
      '</div>' +
      '<div class="sheet-foot"><button class="btn btn-danger-ghost" data-action="task-delete" data-id="' + tk.id + '">' + I('trash-2', 18) + t('delete_task') + '</button><span style="flex:1"></span><button class="btn btn-primary" data-action="overlay-close">' + t('done') + '</button></div>';
  }
  T.actions['task-open'] = (el) => { const id = el.dataset.id; T.closeAll('sheet'); T.sheet({ key: 'task-sheet', label: t('task_detail'), render: () => sheet(id) }); };
  T.actions['task-field'] = (el) => {
    const tk = T.state.tasks.find((x) => x.id === el.dataset.id); const f = el.dataset.field;
    if (f === 'title') { if (el.value.trim()) tk.title = el.value.trim(); }
    else if (f === 'subjectId') tk.subjectId = el.value || null;
    else if (f === 'lead') tk.lead = Math.max(0, Math.min(30, parseInt(el.value, 10) || 0));
    else if (f === 'date') tk.date = el.value || T.todayIso;
    T.render();
  };
  T.actions['task-due'] = (el) => { const tk = T.state.tasks.find((x) => x.id === el.dataset.id); tk.due = el.value || null; if (tk.due) { tk.date = null; if (tk.lead == null) tk.lead = T.settings.defaultLead; } else tk.date = T.todayIso; T.render(); };
  T.actions['task-prio'] = (el) => { const tk = T.state.tasks.find((x) => x.id === el.dataset.id); tk.priority = Number(el.dataset.p); T.render(); };
  T.actions['sub-add'] = (el) => { const tk = T.state.tasks.find((x) => x.id === el.dataset.id); const v = el.value.trim(); if (!v) return; tk.subtasks.push({ id: T.id('st'), title: v, done: false }); if (tk.done) { tk.done = false; tk.doneAt = null; } el.value = ''; T.render(); };
  T.actions['sub-delete'] = (el) => { const tk = T.state.tasks.find((x) => x.id === el.dataset.id); tk.subtasks = tk.subtasks.filter((s) => s.id !== el.dataset.sub); T.render(); };
  T.actions['task-delete'] = (el) => { T.closeAll('sheet'); deleteIds(new Set([el.dataset.id])); };

  /* ---------- Drag & drop (pointer events: mouse, pen and touch) ---------- */
  function bindDrag() {
    document.querySelectorAll('.grip[data-grip]').forEach((g) => {
      if (g.getAttribute('aria-disabled') === 'true') return;
      g.addEventListener('pointerdown', startDrag);
      g.addEventListener('keydown', keyMove);
    });
  }
  let drag = null;
  function startDrag(e) {
    if (e.button !== 0) return;
    const g = e.currentTarget, id = g.dataset.grip, from = g.dataset.date;
    const tk = T.state.tasks.find((x) => x.id === id);
    const rowEl = g.closest('.task');
    const rect = rowEl.getBoundingClientRect();
    e.preventDefault();
    g.setPointerCapture(e.pointerId);
    const ghost = rowEl.cloneNode(true);
    ghost.classList.add('drag-ghost', 'is-lifted');
    ghost.style.width = rect.width + 'px'; ghost.style.left = rect.left + 'px'; ghost.style.top = rect.top + 'px';
    ghost.querySelector('.subtasks') && ghost.querySelector('.subtasks').remove();
    document.body.appendChild(ghost);
    rowEl.classList.add('is-placeholder');
    const line = document.createElement('div'); line.className = 'insert-line';
    drag = { id: id, tk: tk, from: from, g: g, rowEl: rowEl, ghost: ghost, dy: e.clientY - rect.top, line: line, target: null, index: -1 };
    document.querySelectorAll('.day-group').forEach((sec) => { if (tk.due && sec.dataset.day !== from) sec.classList.add('is-drop-blocked'); });
    g.addEventListener('pointermove', moveDrag);
    g.addEventListener('pointerup', endDrag);
    g.addEventListener('pointercancel', cancelDrag);
  }
  function moveDrag(e) {
    if (!drag) return;
    drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const sec = el && el.closest('.day-group');
    document.querySelectorAll('.day-group.is-drop-target').forEach((s) => { if (s !== sec) s.classList.remove('is-drop-target'); });
    if (!sec || (drag.tk.due && sec.dataset.day !== drag.from)) { drag.target = null; drag.line.remove(); return; }
    sec.classList.add('is-drop-target');
    const list = sec.querySelector('.task-list');
    const rows = Array.from(list.querySelectorAll(':scope > .task:not(.is-placeholder):not(.is-done)'));
    let idx = rows.length;
    for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = i; break; } }
    if (rows[idx]) list.insertBefore(drag.line, rows[idx]); else { const firstDone = list.querySelector(':scope > .task.is-done'); list.insertBefore(drag.line, firstDone || null); }
    drag.target = sec.dataset.day; drag.index = idx;
    if (e.clientY < 90) scrollBy(0, -12); else if (e.clientY > innerHeight - 60) scrollBy(0, 12);
  }
  function finish() {
    drag.ghost.remove(); drag.line.remove();
    drag.rowEl.classList.remove('is-placeholder');
    document.querySelectorAll('.day-group').forEach((s) => s.classList.remove('is-drop-target', 'is-drop-blocked'));
    drag.g.removeEventListener('pointermove', moveDrag); drag.g.removeEventListener('pointerup', endDrag); drag.g.removeEventListener('pointercancel', cancelDrag);
  }
  function endDrag() {
    if (!drag) return;
    const d = drag; finish(); drag = null;
    if (!d.target) return;
    place(d.tk, d.from, d.target, d.index);
  }
  function cancelDrag() { if (!drag) return; finish(); drag = null; }
  function place(tk, from, target, index) {
    if (!tk.due && target !== from) tk.date = target;
    const seq = dayList(target).filter((x) => !x.tk.done && x.tk !== tk).map((x) => x.tk);
    seq.splice(Math.max(0, Math.min(index, seq.length)), 0, tk);
    const orders = seq.map((x) => x.order).sort((a, b) => a - b);
    seq.forEach((x, i) => { x.order = orders[i]; });
    T.ui.flip = true; T.render();
    if (target !== from) T.toast(t('moved_to', { day: T.dayLabel(target).toLowerCase(), date: D.dm(target) }));
  }
  function keyMove(e) {
    const g = e.currentTarget, id = g.dataset.grip, from = g.dataset.date;
    const tk = T.state.tasks.find((x) => x.id === id);
    const list = dayList(from).filter((x) => !x.tk.done).map((x) => x.tk);
    const i = list.indexOf(tk);
    let target = from, index = i;
    if (e.key === 'ArrowUp') index = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') index = Math.min(list.length - 1, i + 1);
    else if ((e.key === 'PageDown' || e.key === 'PageUp') && !tk.due) { target = D.addIso(from, e.key === 'PageDown' ? 1 : -1); if (target < T.todayIso) return; index = 0; }
    else return;
    e.preventDefault();
    place(tk, from, target, index);
    setTimeout(() => { const ng = document.getElementById('grip-' + id + '-' + target); if (ng) ng.focus(); }, 0);
  }
})();
