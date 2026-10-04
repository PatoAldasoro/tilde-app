/* Sesiones de estudio: timer con presets, tareas del día, modo foco, resumen, historial y amigos */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc, D = T.d;
  const PRESETS = { '25/5': [25, 5, 4], '50/10': [50, 10, 3], '90/20': [90, 20, 2] };
  const speed = Number(new URLSearchParams(location.search).get('velocidad')) || 1;

  const S = (T.timer = { preset: '25/5', focus: 25, brk: 5, cycles: 4, phase: 'idle', cycle: 1, remaining: 25 * 60, running: false, subjectId: '', filterSubject: false, focusSpent: 0, breakSpent: 0, doneDuring: new Set(), focusMode: false, int: null });

  function phaseTotal() { return (S.phase === 'break' ? S.brk : S.focus) * 60; }
  function fmt(sec) { const m = Math.floor(sec / 60), s = sec % 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }

  function ring(size) {
    const r = size / 2 - 10, c = 2 * Math.PI * r;
    const frac = S.phase === 'idle' ? 0 : 1 - S.remaining / phaseTotal();
    const endAt = new Date(Date.now() + S.remaining * 1000 / speed);
    const sub = S.phase === 'idle' ? T.tn('focus_cycles_plan', S.cycles, { f: S.focus, b: S.brk }) : (S.running ? t('ends_at', { time: String(endAt.getHours()).padStart(2, '0') + ':' + String(endAt.getMinutes()).padStart(2, '0') }) : t('paused'));
    return '<div class="timer-ring' + (S.phase === 'break' ? ' is-break' : S.phase === 'idle' ? ' is-idle' : '') + '" role="timer" aria-label="' + esc(t(S.phase === 'break' ? 'phase_break' : 'phase_focus') + ' ' + fmt(S.remaining)) + '">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle class="track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="8"/>' +
      '<circle class="bar" data-ring cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - frac)) + '" data-c="' + c + '"/></svg>' +
      '<span class="timer-time tnum" data-time aria-hidden="true">' + fmt(S.remaining) + '</span><span class="timer-sub" data-sub>' + sub + '</span></div>';
  }
  function phaseRow() {
    const pill = S.phase === 'idle' ? '<span class="phase-pill is-idle">' + I('target', 16) + t('ready') + '</span>'
      : S.phase === 'break' ? '<span class="phase-pill is-break">' + I('coffee', 16) + t('phase_break') + '</span>'
      : '<span class="phase-pill">' + I('target', 16) + t('phase_focus') + '</span>';
    let dots = '';
    for (let i = 1; i <= S.cycles; i++) dots += '<i class="' + (i < S.cycle ? 'done' : i === S.cycle && S.phase !== 'idle' ? 'current' : '') + '"></i>';
    return '<div class="phase-row" aria-live="polite">' + pill + '<span class="cycle-label tnum">' + t('cycle_of', { n: S.cycle, total: S.cycles }) + '<span class="cycle-dots" aria-hidden="true">' + dots + '</span></span></div>';
  }
  function controls() {
    return '<div class="timer-controls">' +
      '<button class="round-btn" id="tm-reset" data-action="timer-reset" aria-label="' + t('reset') + '" data-tip="' + t('reset') + '"' + (S.phase === 'idle' ? ' disabled' : '') + '>' + I('rotate-ccw', 20) + '</button>' +
      '<button class="play-btn" id="tm-play" data-action="timer-toggle" aria-label="' + (S.running ? t('pause') : (S.phase === 'idle' ? t('start') : t('resume'))) + '">' + I(S.running ? 'pause' : 'play', 28, { fill: 'currentColor', sw: 1.5 }) + '</button>' +
      '<button class="round-btn" id="tm-skip" data-action="timer-skip" aria-label="' + t('skip_break') + '" data-tip="' + (S.phase === 'break' ? t('skip_break') : t('skip_break_only')) + '"' + (S.phase === 'break' ? '' : ' disabled') + '>' + I('skip-forward', 20) + '</button>' +
    '</div>';
  }
  function options() {
    const locked = S.phase !== 'idle';
    const subs = T.activeSubjects();
    return '<div class="session-options">' +
      '<div class="row"><div class="seg" role="radiogroup" aria-label="' + t('preset') + '">' + ['25/5', '50/10', '90/20', 'custom'].map((p) =>
        '<button class="seg-item tnum" role="radio" id="pr-' + p.replace('/', '-') + '" aria-checked="' + (S.preset === p) + '" data-action="timer-preset" data-v="' + p + '"' + (locked ? ' disabled' : '') + '>' + (p === 'custom' ? I('sliders-horizontal', 16) + t('custom') : (p === '25/5' ? 'Pomodoro 25/5' : p)) + '</button>').join('') + '</div></div>' +
      (S.preset === 'custom' ? '<div class="custom-row">' +
        '<div class="field"><label class="field-label" for="cu-f">' + t('focus_min') + '</label><input class="input tnum input-number" type="number" min="5" max="180" id="cu-f" value="' + S.focus + '" data-change="timer-custom" data-k="focus"' + (locked ? ' disabled' : '') + '></div>' +
        '<div class="field"><label class="field-label" for="cu-b">' + t('break_min') + '</label><input class="input tnum input-number" type="number" min="1" max="60" id="cu-b" value="' + S.brk + '" data-change="timer-custom" data-k="brk"' + (locked ? ' disabled' : '') + '></div>' +
        '<div class="field"><label class="field-label" for="cu-c">' + t('cycles') + '</label><input class="input tnum input-number" type="number" min="1" max="12" id="cu-c" value="' + S.cycles + '" data-change="timer-custom" data-k="cycles"' + (locked ? ' disabled' : '') + '></div></div>' : '') +
      '<div class="row"><label class="visually-hidden" for="tm-subj">' + t('subject') + '</label><select class="select" id="tm-subj" style="width:auto;min-width:240px" data-change="timer-subject"><option value="">' + t('no_subject_session') + '</option>' + subs.map((s) => '<option value="' + s.id + '"' + (S.subjectId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>' +
        '<button class="switch" role="switch" id="tm-sound" aria-checked="' + T.settings.sound + '" data-action="timer-sound"><span class="switch-track"></span>' + I(T.settings.sound ? 'volume-2' : 'volume-x', 18) + t('sound_on_phase') + '</button></div>' +
      (locked ? '<p class="field-hint">' + t('options_locked') + '</p>' : '') +
      (S.phase !== 'idle' ? '<button class="btn btn-ghost" id="tm-finish" data-action="timer-finish">' + t('finish_session') + '</button>' : '') +
    '</div>';
  }
  function todayTasks() {
    let list = T.dayTasks(T.todayIso);
    if (S.filterSubject && S.subjectId) list = list.filter((x) => x.tk.subjectId === S.subjectId);
    return list;
  }
  function taskPanel(focus) {
    const list = todayTasks();
    const done = list.filter((x) => x.tk.done).length;
    const subj = T.subject(S.subjectId);
    return '<div class="side-panel-head"><div class="t"><span>' + t('today_tasks') + '</span><span class="badge tnum">' + done + '/' + list.length + '</span></div>' +
      (subj ? '<button class="switch" role="switch" id="tm-filter' + (focus ? '-f' : '') + '" aria-checked="' + S.filterSubject + '" data-action="timer-filter"><span class="switch-track"></span>' + t('only_subject', { name: esc(T.shortName(subj.name)) }) + '</button>' : '<span class="field-hint">' + t('pick_subject_to_filter') + '</span>') + '</div>' +
      '<div class="side-panel-body">' + (list.length ? list.map((x) => '<div class="mini-task' + (x.tk.done ? ' is-done' : '') + '">' + T.checkButton(x.tk, 'mt-' + x.tk.id + (focus ? '-f' : ''), true) + '<span class="mt-title">' + esc(x.tk.title) + '</span>' + (x.tk.subjectId ? T.chipSubject(x.tk.subjectId, { short: true }) : '') + '</div>').join('') : '<p class="day-empty" style="padding:16px">' + t('no_tasks_today') + '</p>') + '</div>';
  }

  function sessionTab() {
    return '<div class="sessions-grid"><section class="timer-card" aria-label="' + t('timer') + '">' + phaseRow() + ring(340) + controls() + options() + '</section>' +
      '<aside class="side-panel" aria-label="' + t('today_tasks') + '">' + taskPanel(false) + '</aside></div>';
  }

  function historyTab() {
    const st = T.state;
    if (!st.sessions.length) return '<div class="empty">' + I('history', 32) + '<p class="empty-title">' + t('history_empty_title') + '</p><p class="empty-text">' + t('history_empty_text') + '</p><button class="btn btn-primary" data-action="session-tab" data-v="session">' + I('play', 16) + t('start_session') + '</button></div>';
    const weeks = st.weeklyFocus;
    const max = Math.max(...weeks, 60);
    const mon = D.monday(T.today);
    const bars = weeks.map((m, i) => {
      const wk = D.add(mon, (i - 7) * 7);
      const cur = i === weeks.length - 1;
      return '<div class="bar-col">' + (cur ? '<span class="bar-val">' + T.fmtMin(m) + '</span>' : '') + '<div class="bar' + (cur ? ' is-current' : '') + '" style="height:' + (m / max * 100) + '%" tabindex="0" role="img" aria-label="' + esc(t('week_of', { date: D.dm(wk) }) + ': ' + T.fmtMin(m)) + '" data-tip="' + esc(t('week_of', { date: D.dm(wk) }) + ' · ' + T.fmtMin(m)) + '"></div></div>';
    }).join('');
    const xs = weeks.map((m, i) => '<span>' + D.dm(D.add(mon, (i - 7) * 7)) + '</span>').join('');
    const bySubj = {};
    st.sessions.forEach((s) => { const k = s.subjectId || '_'; bySubj[k] = (bySubj[k] || 0) + s.focus; });
    const total = Object.values(bySubj).reduce((a, b) => a + b, 0);
    const hmax = Math.max(...Object.values(bySubj));
    const rows = Object.entries(bySubj).sort((a, b) => b[1] - a[1]).map(([k, m]) => {
      const s = T.subject(k);
      return '<div class="hbar ' + (s ? 'subj-' + s.color : '') + '"><span class="name"><i class="dot" style="' + (s ? '' : 'background:var(--color-border-strong)') + '"></i><span>' + esc(s ? s.name : t('no_subject')) + '</span></span><span class="val">' + T.fmtMin(m) + '</span><div class="progress progress-xs" aria-hidden="true" style="--value:' + (m / hmax * 100) + '%;--bar:' + (s ? 'var(--s-vivid)' : 'var(--color-border-strong)') + '"><i></i></div></div>';
    }).join('');
    const table = '<div class="table-wrap"><table class="session-table"><caption class="visually-hidden">' + t('saved_sessions') + '</caption><thead><tr><th scope="col">' + t('date') + '</th><th scope="col">' + t('subject') + '</th><th scope="col">' + t('preset') + '</th><th scope="col" class="num">' + t('focus') + '</th><th scope="col" class="num">' + t('cycles') + '</th><th scope="col" class="num">' + t('tasks_done') + '</th></tr></thead><tbody>' +
      st.sessions.map((s) => '<tr><td class="tnum">' + D.wdShort(D.wd(D.parse(s.date))) + ' ' + D.dm(s.date) + '</td><td>' + (s.subjectId ? T.chipSubject(s.subjectId) : '<span class="subtle">' + t('no_subject') + '</span>') + '</td><td class="tnum">' + esc(s.preset === 'custom' ? t('custom') : s.preset) + '</td><td class="num">' + T.fmtMin(s.focus) + '</td><td class="num">' + s.cycles + '</td><td class="num">' + s.tasks + '</td></tr>').join('') + '</tbody></table></div>';
    return '<div class="history-grid"><section class="panel"><div class="panel-head"><span class="panel-title">' + t('focus_per_week') + '</span><span class="panel-sub">' + t('this_week_total', { v: T.fmtMin(weeks[weeks.length - 1]) }) + '</span></div><div class="bars">' + bars + '</div><div class="bars-x" aria-hidden="true">' + xs + '</div></section>' +
      '<section class="panel"><div class="panel-head"><span class="panel-title">' + t('per_subject') + '</span><span class="panel-sub">' + t('total_v', { v: T.fmtMin(total) }) + '</span></div><div class="hbar-list">' + rows + '</div></section></div>' +
      '<h2 class="section-label" style="margin:0 0 12px">' + t('saved_sessions') + '</h2>' + table;
  }

  function friendsTab() {
    const st = T.state;
    const fr = (id) => st.friends.find((f) => f.id === id);
    return '<div class="design-only">' + I('info', 18) + '<span><strong>' + t('design_only') + '.</strong> ' + t('design_only_text') + '</span></div>' +
      '<div class="friends-grid"><section class="panel"><div class="panel-head"><span class="panel-title">' + t('friends') + ' <span class="badge tnum">' + st.friends.length + '</span></span><button class="btn btn-secondary btn-sm" id="add-friend" data-action="friend-add">' + I('user-plus', 16) + t('add_friends') + '</button></div>' +
        st.friends.map((f) => '<div class="friend"><span class="avatar avatar-lg subj-' + f.color + '">' + f.initials + (f.live ? '<span class="presence" aria-hidden="true"></span>' : '') + '</span><div class="who"><strong>' + esc(f.name) + '</strong><span>' + (f.live ? esc(f.live.subject) + ' · ' + esc(f.live.preset) : t('last_seen', { when: esc(f.last) })) + '</span></div>' + (f.live ? '<span class="live">' + t('studying_now', { m: f.live.minutes }) + '</span>' : '') + '</div>').join('') + '</section>' +
      '<section class="panel"><div class="panel-head"><span class="panel-title">' + t('recent_activity') + '</span></div>' +
        st.feed.map((x) => { const f = fr(x.friend); return '<div class="feed-item"><span class="avatar subj-' + f.color + '">' + f.initials + '</span><div class="body"><div>' + t('feed_line', { name: '<strong>' + esc(f.name.split(' ')[0]) + '</strong>', subject: esc(x.subject) }) + ' <span class="when">· ' + esc(x.when) + '</span></div><div class="stats-inline"><span>' + I('target', 13) + ' ' + T.fmtMin(x.focus) + '</span><span>' + I('rotate-ccw', 13) + ' ' + T.tn('cycles_n', x.cycles) + '</span><span>' + I('list-checks', 13) + ' ' + T.tn('tasks_n', x.tasks) + '</span></div></div></div>'; }).join('') + '</section></div>';
  }

  function focusModeHtml() {
    return '<div class="focus-mode" role="dialog" aria-modal="true" aria-label="' + t('focus_mode') + '"><div class="focus-main">' +
      '<button class="btn btn-secondary focus-exit" id="fm-exit" data-action="focus-exit">' + I('minimize-2', 18) + t('exit_focus') + '</button>' +
      phaseRow() + ring(460) + controls() + '</div><aside class="focus-side"><h3>' + t('today') + '</h3>' + taskPanel(true) + '</aside></div>';
  }

  T.views.sessions = {
    render(r) {
      const tab = r.seg[1] === 'historial' ? 'history' : r.seg[1] === 'amigos' ? 'friends' : 'session';
      const tabs = '<div class="tabs" role="tablist" aria-label="' + t('nav_sessions') + '" style="margin-bottom:24px">' +
        '<a class="tab" role="tab" href="#/sesiones" aria-selected="' + (tab === 'session') + '">' + I('timer', 18) + t('tab_session') + '</a>' +
        '<a class="tab" role="tab" href="#/sesiones/historial" aria-selected="' + (tab === 'history') + '">' + I('history', 18) + t('tab_history') + '</a>' +
        '<a class="tab" role="tab" href="#/sesiones/amigos" aria-selected="' + (tab === 'friends') + '">' + I('users', 18) + t('tab_friends') + '<span class="badge badge-outline">' + t('design_only') + '</span></a></div>';
      return {
        title: t('nav_sessions'),
        actions: tab === 'session' ? '<button class="btn btn-secondary" id="focus-mode-btn" data-action="focus-enter">' + I('maximize-2', 18) + t('focus_mode') + '</button>' : '',
        body: tabs + (tab === 'session' ? sessionTab() : tab === 'history' ? historyTab() : friendsTab())
      };
    },
    after(r) {
      if (S.focusMode) mountFocus();
      const d = r.demo;
      if (!d || T.ui._sessDemo) return;
      T.ui._sessDemo = true;
      if (d === 'foco' || d === 'modo-foco') { S.preset = '25/5'; S.focus = 25; S.brk = 5; S.cycles = 4; S.phase = 'focus'; S.cycle = 2; S.remaining = 18 * 60 + 24; S.subjectId = 's3'; S.focusSpent = 31 * 60; S.breakSpent = 5 * 60; if (d === 'modo-foco') S.focusMode = true; start(); T.render(); }
      if (d === 'descanso') { S.preset = '50/10'; S.focus = 50; S.brk = 10; S.cycles = 3; S.phase = 'break'; S.cycle = 2; S.remaining = 7 * 60 + 12; S.subjectId = 's4'; S.focusSpent = 100 * 60; start(); T.render(); }
      if (d === 'resumen') { S.preset = '25/5'; S.focus = 25; S.brk = 5; S.cycles = 4; S.phase = 'focus'; S.cycle = 4; S.subjectId = 's3'; S.focusSpent = 100 * 60; S.breakSpent = 15 * 60; S.doneDuring = new Set(['t6', 't7']); summary(); }
      if (d === 'agregar-amigo') T.actions['friend-add']();
    }
  };
  addEventListener('hashchange', () => { T.ui._sessDemo = false; });

  /* targeted DOM updates each second (no full re-render) */
  function paint() {
    document.querySelectorAll('[data-time]').forEach((el) => { el.textContent = fmt(S.remaining); });
    document.querySelectorAll('[data-ring]').forEach((el) => { const c = Number(el.dataset.c); el.setAttribute('stroke-dashoffset', c * (S.remaining / phaseTotal())); });
    document.title = fmt(S.remaining) + ' · ' + t(S.phase === 'break' ? 'phase_break' : 'phase_focus') + ' · Tilde';
  }
  function chime() {
    if (!T.settings.sound) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + i * 0.18 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.18 + 0.5); o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * 0.18); o.stop(ac.currentTime + i * 0.18 + 0.55); });
    } catch (e) { /* audio unavailable */ }
  }
  function tick() {
    if (!S.running) return;
    S.remaining -= 1;
    if (S.phase === 'focus') S.focusSpent += 1; else S.breakSpent += 1;
    if (S.remaining <= 0) {
      chime();
      if (S.phase === 'focus') {
        if (S.cycle >= S.cycles) { stop(); summary(); return; }
        S.phase = 'break'; S.remaining = S.brk * 60;
        T.toast(t('break_started', { n: S.brk }));
      } else { S.phase = 'focus'; S.cycle += 1; S.remaining = S.focus * 60; T.toast(t('focus_started', { n: S.cycle, total: S.cycles })); }
      rerender(); return;
    }
    paint();
  }
  function start() { S.running = true; clearInterval(S.int); S.int = setInterval(tick, 1000 / speed); }
  function stop() { S.running = false; clearInterval(S.int); }
  function rerender() { if (T.route && T.route.seg[0] === 'sesiones') T.render(); else if (S.focusMode) mountFocus(); }

  function mountFocus() {
    let host = document.getElementById('focus-host');
    if (!S.focusMode) { if (host) host.remove(); return; }
    if (!host) { host = document.createElement('div'); host.id = 'focus-host'; document.body.appendChild(host); }
    host.innerHTML = focusModeHtml();
  }

  T.actions['timer-toggle'] = () => {
    if (S.phase === 'idle') { S.phase = 'focus'; S.cycle = 1; S.remaining = S.focus * 60; S.focusSpent = 0; S.breakSpent = 0; S.doneDuring = new Set(); }
    S.running ? stop() : start();
    rerender();
  };
  T.actions['timer-reset'] = () => { stop(); S.phase = 'idle'; S.cycle = 1; S.remaining = S.focus * 60; S.focusSpent = 0; S.breakSpent = 0; rerender(); };
  T.actions['timer-skip'] = () => { if (S.phase !== 'break') return; S.phase = 'focus'; S.cycle += 1; S.remaining = S.focus * 60; rerender(); };
  T.actions['timer-preset'] = (el) => {
    const v = el.dataset.v; S.preset = v;
    if (PRESETS[v]) { S.focus = PRESETS[v][0]; S.brk = PRESETS[v][1]; S.cycles = PRESETS[v][2]; }
    else { S.focus = 40; S.brk = 8; S.cycles = 3; }
    S.remaining = S.focus * 60; T.render();
  };
  T.actions['timer-custom'] = (el) => {
    const k = el.dataset.k, lim = { focus: [5, 180], brk: [1, 60], cycles: [1, 12] }[k];
    S[k] = Math.max(lim[0], Math.min(lim[1], parseInt(el.value, 10) || lim[0]));
    if (S.phase === 'idle') S.remaining = S.focus * 60;
    T.render();
  };
  T.actions['timer-subject'] = (el) => { S.subjectId = el.value; if (!el.value) S.filterSubject = false; T.render(); };
  T.actions['timer-sound'] = () => { T.settings.sound = !T.settings.sound; T.render(); };
  T.actions['timer-filter'] = () => { S.filterSubject = !S.filterSubject; rerender(); };
  T.actions['timer-finish'] = () => { stop(); summary(); };
  T.actions['focus-enter'] = () => {
    S.focusMode = true; mountFocus();
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* not allowed */ }
    setTimeout(() => { const b = document.getElementById('tm-play'); if (b) b.focus(); }, 30);
  };
  T.actions['focus-exit'] = () => {
    S.focusMode = false; mountFocus();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ignore */ }
    const b = document.getElementById('focus-mode-btn'); if (b) b.focus();
  };
  const prevEsc = T.onEscape;
  T.onEscape = () => { if (S.focusMode) { T.actions['focus-exit'](); return true; } return prevEsc ? prevEsc() : false; };
  /* track tasks completed during a running session */
  const origToggle = T.actions['task-toggle'];
  T.actions['task-toggle'] = (el) => {
    const tk = T.state.tasks.find((x) => x.id === el.dataset.id);
    const was = tk && tk.done;
    origToggle(el);
    if (tk && !was && tk.done && S.phase !== 'idle') S.doneDuring.add(tk.id);
    if (tk && was && !tk.done) S.doneDuring.delete(tk.id);
    if (S.focusMode) mountFocus();
  };

  function summary() {
    const key = 'summary';
    const focusMin = Math.round(S.focusSpent / 60), breakMin = Math.round(S.breakSpent / 60);
    const cyclesDone = S.phase === 'idle' ? 0 : (S.phase === 'break' ? S.cycle : (S.remaining <= 0 || S.cycle > S.cycles ? S.cycles : S.cycle - (S.focusSpent >= S.focus * 60 * S.cycle ? 0 : 1)));
    const subj = T.subject(S.subjectId);
    T.dialog({
      key: key, title: t('session_summary'), desc: (subj ? esc(subj.name) + ' · ' : '') + (S.preset === 'custom' ? t('custom') + ' ' + S.focus + '/' + S.brk : S.preset),
      body: '<div class="summary-stats">' +
        '<div class="summary-stat"><div class="v tnum">' + T.fmtMin(focusMin) + '</div><div class="l">' + t('focus_time') + '</div></div>' +
        '<div class="summary-stat"><div class="v tnum">' + T.fmtMin(breakMin) + '</div><div class="l">' + t('breaks') + '</div></div>' +
        '<div class="summary-stat"><div class="v tnum">' + Math.max(cyclesDone, 0) + '<span class="subtle" style="font-size:18px"> / ' + S.cycles + '</span></div><div class="l">' + t('cycles_completed') + '</div></div>' +
        '<div class="summary-stat"><div class="v tnum">' + S.doneDuring.size + '</div><div class="l">' + t('tasks_completed') + '</div></div></div>',
      foot: '<button class="btn btn-ghost" id="sum-discard">' + t('discard') + '</button><span class="spacer"></span><button class="btn btn-primary" id="sum-save" data-autofocus>' + t('save') + '</button>',
      onMount: (host) => {
        const reset = () => { S.phase = 'idle'; S.cycle = 1; S.remaining = S.focus * 60; S.focusSpent = 0; S.breakSpent = 0; S.doneDuring = new Set(); if (S.focusMode) T.actions['focus-exit'](); };
        host.querySelector('#sum-discard').addEventListener('click', () => { T.closeOverlay(key); reset(); T.render(); });
        host.querySelector('#sum-save').addEventListener('click', () => {
          T.state.sessions.unshift({ id: T.id('h'), date: T.todayIso, subjectId: S.subjectId || null, preset: S.preset, focus: focusMin, breaks: breakMin, cycles: Math.max(cyclesDone, 0), tasks: S.doneDuring.size });
          T.state.weeklyFocus[T.state.weeklyFocus.length - 1] += focusMin;
          T.closeOverlay(key); reset(); T.render(); T.toast(t('session_saved'));
        });
      }
    });
  }

  T.actions['session-tab'] = () => T.go('sesiones');
  T.actions['friend-add'] = () => {
    T.dialog({
      key: 'friend', size: 'sm', title: t('add_friends'), desc: t('add_friends_desc'),
      body: '<div class="field"><label class="field-label" for="fr-mail">' + t('friend_email') + '</label><div class="paste-row"><input class="input" id="fr-mail" type="email" placeholder="nombre@gmail.com" data-autofocus><button class="btn btn-primary">' + t('invite') + '</button></div></div>' +
        '<div class="field"><span class="field-label">' + t('or_share_link') + '</span><div class="paste-row"><input class="input tnum" readonly value="tilde.app/i/pz-7K2M" aria-label="' + t('invite_link') + '"><button class="btn btn-secondary">' + I('link', 16) + t('copy') + '</button></div></div>' +
        '<p class="field-hint">' + t('friends_privacy') + '</p>',
      foot: '<button class="btn btn-secondary" data-action="overlay-close">' + t('close') + '</button>'
    });
  };
})();
