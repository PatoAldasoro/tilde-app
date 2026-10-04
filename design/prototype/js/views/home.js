/* Inicio: Materias · Notas · Archivadas */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc;
  const DOC_ICON = { doc: 'file-text', sheet: 'file-spreadsheet', slides: 'presentation', image: 'image', pdf: 'file', link: 'link' };

  function subjectCard(s) {
    const p = T.subjectProgress(s.id);
    const docs = s.docs.length;
    return '<article class="subject-card subj-' + s.color + (s.archived ? ' is-archived' : '') + '" aria-labelledby="sc-' + s.id + '">' +
      '<button class="card-open" id="open-' + s.id + '" data-action="subject-open" data-id="' + s.id + '" aria-label="' + t('open_subject', { name: esc(s.name) }) + '"></button>' +
      '<div class="card-top"><h3 class="card-title" id="sc-' + s.id + '">' + esc(s.name) + '</h3>' +
        (s.archived
          ? '<button class="btn btn-secondary btn-sm card-menu" style="margin:0" data-action="subject-unarchive" data-id="' + s.id + '">' + I('archive-restore', 16) + t('unarchive') + '</button>'
          : '<button class="btn btn-ghost btn-icon card-menu" id="menu-' + s.id + '" aria-haspopup="menu" aria-label="' + t('subject_options', { name: esc(s.name) }) + '" data-action="subject-menu" data-id="' + s.id + '">' + I('ellipsis') + '</button>') +
      '</div>' +
      '<div class="card-meta">' +
        '<div class="row">' + I('user-round', 16) + '<span>' + esc(s.teacher || t('no_teacher')) + '</span></div>' +
        '<div class="row">' + I('calendar', 16) + '<span>' + esc([s.commission, s.term].filter(Boolean).join(' · ')) + '</span></div>' +
      '</div>' +
      '<div><div class="card-progress"><div class="progress" role="progressbar" aria-label="' + t('progress') + '" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100" style="--value:' + p.pct + '%;--bar:var(--s-vivid)"><i></i></div><span class="progress-label tnum">' + p.pct + ' %</span></div>' +
        '<div class="field-hint" style="margin-top:6px">' + (p.total ? T.tn('tasks_done_of', p.total, { done: p.done, total: p.total }) : t('no_tasks_yet')) + '</div></div>' +
      '<div class="card-foot"><span class="left">' + I('file-text', 16) + T.tn('docs_count', docs) + '</span><span class="tnum">' + T.tn('credits_count', s.credits || 0) + '</span></div>' +
    '</article>';
  }

  function firstRun() {
    return '<section class="first-run">' +
      '<div><h2>' + t('first_run_title') + '</h2><p>' + t('first_run_text') + '</p>' +
        '<ol class="steps"><li>' + t('first_run_s1') + '</li><li>' + t('first_run_s2') + '</li><li>' + t('first_run_s3') + '</li></ol>' +
        '<div style="margin-top:32px"><button class="btn btn-primary btn-lg" data-action="subject-new" id="fr-add">' + I('plus') + t('add_subject') + '</button></div></div>' +
      '<div class="first-run-stack" aria-hidden="true">' +
        '<div class="subject-ghost" style="min-height:150px"><span class="badge">' + t('example') + '</span><strong>' + t('first_run_ghost1') + '</strong><span>' + t('first_run_ghost1_meta') + '</span></div>' +
        '<div class="subject-ghost" style="min-height:110px;opacity:.7"><strong>' + t('first_run_ghost2') + '</strong></div>' +
        '<div class="subject-ghost" style="min-height:80px;opacity:.45"></div>' +
      '</div></section>';
  }

  function materias(r) {
    const archivedView = T.ui.homeArchived || r.seg[1] === 'archivadas';
    const list = T.state.subjects.filter((s) => s.archived === archivedView);
    if (!archivedView && !T.state.subjects.length) return firstRun();
    let html = '';
    if (archivedView) html += '<div class="archived-banner">' + I('archive', 18) + '<span>' + t('archived_banner') + '</span></div>';
    if (!list.length) {
      html += '<div class="empty">' + I(archivedView ? 'archive' : 'book-open', 32) + '<p class="empty-title">' + t(archivedView ? 'archived_empty_title' : 'subjects_empty_title') + '</p><p class="empty-text">' + t(archivedView ? 'archived_empty_text' : 'subjects_empty_text') + '</p></div>';
      return html;
    }
    html += '<div class="subject-grid">' + list.map(subjectCard).join('') +
      (!archivedView ? '<button class="subject-ghost" data-action="subject-new" id="ghost-add">' + I('plus', 22) + '<strong>' + t('add_subject') + '</strong><span>' + t('add_subject_hint') + '</span></button>' : '') + '</div>';
    return html;
  }

  /* ---------- Notas ---------- */
  function parseGrade(v) {
    if (v === '' || v == null) return { ok: true, value: null };
    const n = Number(String(v).replace(',', '.'));
    if (isNaN(n) || n < 0 || n > 10) return { ok: false };
    return { ok: true, value: Math.round(n * 100) / 100 };
  }
  function subjAvg(s) { const g = s.grades; return g.course != null && g.final != null ? (g.course + g.final) / 2 : null; }
  function avgs(list) {
    const withAvg = list.map((s) => ({ s: s, a: subjAvg(s) })).filter((x) => x.a != null);
    if (!withAvg.length) return { simple: null, weighted: null, n: 0 };
    const simple = withAvg.reduce((m, x) => m + x.a, 0) / withAvg.length;
    const cred = withAvg.reduce((m, x) => m + (x.s.credits || 0), 0);
    const weighted = cred ? withAvg.reduce((m, x) => m + x.a * (x.s.credits || 0), 0) / cred : null;
    return { simple: simple, weighted: weighted, n: withAvg.length };
  }
  T.gradeAverages = avgs;
  function statGroup(title, sub, a, idp) {
    const v = (x) => '<span class="stat-value tnum' + (x == null ? ' is-empty' : '') + '">' + (x == null ? '—' : T.fmtNum(x, 2)) + '</span>';
    return '<section class="stat-group"><div class="stat-group-head"><div><div class="stat-group-title">' + title + '</div><div class="stat-group-sub">' + sub + '</div></div><span class="badge tnum">' + T.tn('subjects_counted', a.n) + '</span></div>' +
      '<div class="stats">' +
        '<div class="stat"><span class="stat-label">' + t('avg_simple') + '<button class="help-btn" id="' + idp + '-hs" data-action="help" data-help="' + esc(t('avg_simple_help')) + '" data-tip="' + esc(t('avg_simple_help')) + '" aria-label="' + t('how_calculated') + '">' + I('circle-help', 16) + '</button></span>' + v(a.simple) + '</div>' +
        '<div class="stat"><span class="stat-label">' + t('avg_weighted') + '<button class="help-btn" id="' + idp + '-hw" data-action="help" data-help="' + esc(t('avg_weighted_help')) + '" data-tip="' + esc(t('avg_weighted_help')) + '" aria-label="' + t('how_calculated') + '">' + I('circle-help', 16) + '</button></span>' + v(a.weighted) + '</div>' +
      '</div></section>';
  }
  function gradeCell(s, field) {
    const ui = T.ui.grades[s.id + field];
    const val = ui ? ui.raw : (s.grades[field] == null ? '' : T.fmtNum(s.grades[field], 2));
    const bad = ui && ui.error;
    return '<td class="num' + (bad ? ' cell-error is-invalid' : '') + '"><input class="input input-number input-inline' + (bad ? ' is-invalid' : '') + '" id="g-' + s.id + '-' + field + '" inputmode="decimal" value="' + esc(val) + '" placeholder="—" aria-label="' + esc(t(field === 'course' ? 'grade_course' : 'grade_final') + ' · ' + s.name) + '"' + (bad ? ' aria-invalid="true" aria-describedby="ge-' + s.id + field + '"' : '') + ' data-change="grade-set" data-enter="grade-set" data-id="' + s.id + '" data-field="' + field + '">' +
      (bad ? '<span class="field-error" id="ge-' + s.id + field + '">' + t('grade_range') + '</span>' : '') + '</td>';
  }
  function notas() {
    const subs = T.state.subjects;
    if (!subs.length) return '<div class="empty">' + I('book-open', 32) + '<p class="empty-title">' + t('grades_empty_title') + '</p><p class="empty-text">' + t('grades_empty_text') + '</p><button class="btn btn-primary" data-action="subject-new">' + I('plus') + t('add_subject') + '</button></div>';
    const cur = avgs(subs.filter((s) => !s.archived));
    const all = avgs(subs);
    const ordered = subs.slice().sort((a, b) => (a.archived - b.archived));
    return '<div class="stat-groups">' + statGroup(t('current_term'), t('current_term_sub'), cur, 'sg1') + statGroup(t('overall'), t('overall_sub'), all, 'sg2') + '</div>' +
      '<div class="table-wrap"><table class="grades"><caption class="visually-hidden">' + t('grades_caption') + '</caption><thead><tr><th scope="col">' + t('subject') + '</th><th scope="col">' + t('term') + '</th><th scope="col" class="num">' + t('credits') + '</th><th scope="col" class="num">' + t('grade_course') + '</th><th scope="col" class="num">' + t('grade_final') + '</th><th scope="col" class="num">' + t('subject_avg') + '</th></tr></thead><tbody>' +
      ordered.map((s) => {
        const a = subjAvg(s);
        return '<tr class="subj-' + s.color + (s.archived ? ' is-archived' : '') + '"><td><div class="subject-cell"><span class="dot" aria-hidden="true"></span><strong>' + esc(s.name) + '</strong>' + (s.archived ? '<span class="badge">' + t('archived_tag') + '</span>' : '') + '</div></td>' +
          '<td class="tnum">' + esc(s.term) + '</td><td class="num tnum">' + (s.credits || '—') + '</td>' + gradeCell(s, 'course') + gradeCell(s, 'final') +
          '<td class="num"><span class="avg tnum' + (a == null ? ' is-empty' : '') + '">' + (a == null ? '—' : T.fmtNum(a, 2)) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="notes-foot">' + I('info', 16) + t('grades_foot') + '</p>';
  }

  T.views.home = {
    render(r) {
      const tab = r.seg[1] === 'notas' ? 'notas' : 'materias';
      if (r.seg[1] === 'archivadas') T.ui.homeArchived = true;
      const archivedCount = T.state.subjects.filter((s) => s.archived).length;
      const empty = !T.state.subjects.length;
      let head = '';
      if (!empty || tab === 'notas') {
        head = '<div class="home-head"><div class="tabs" role="tablist" aria-label="' + t('nav_home') + '">' +
          '<a class="tab" role="tab" href="#/inicio" id="tab-materias" aria-selected="' + (tab === 'materias') + '">' + t('tab_subjects') + '</a>' +
          '<a class="tab" role="tab" href="#/inicio/notas" id="tab-notas" aria-selected="' + (tab === 'notas') + '">' + t('tab_grades') + '</a></div><div class="grow"></div>' +
          (tab === 'materias' ? '<button class="btn ' + (T.ui.homeArchived ? 'btn-secondary' : 'btn-ghost') + '" id="btn-archived" aria-pressed="' + T.ui.homeArchived + '" data-action="toggle-archived">' + I(T.ui.homeArchived ? 'arrow-left' : 'archive', 18) + (T.ui.homeArchived ? t('back_to_subjects') : t('archived') + ' <span class="badge tnum">' + archivedCount + '</span>') + '</button>' : '') +
        '</div>';
      }
      return {
        title: t('nav_home'),
        actions: tab === 'materias' && !empty ? '<button class="btn btn-primary" id="add-subject" data-action="subject-new">' + I('plus', 18) + t('add_subject') + '</button>' : '',
        body: head + (tab === 'notas' ? notas() : materias(r))
      };
    },
    after(r) {
      const d = r.demo;
      if (d === 'nueva-materia') T.actions['subject-new']();
      if (d === 'editar-materia') T.actions['subject-edit']({ dataset: { id: 's3' } });
      if (d === 'documentos') T.actions['subject-open']({ dataset: { id: 's3' } });
      if (d === 'drive') { T.actions['subject-open']({ dataset: { id: 's3' } }); T.actions['drive-pick']({ dataset: { id: 's3' } }); }
      if (d === 'error-materia') { T.actions['subject-new'](); setTimeout(() => document.getElementById('sf-save') && document.getElementById('sf-save').click(), 30); }
      if (d && d !== 'vacio') history.replaceState(null, '', location.pathname + location.search + '#/' + r.path);
    }
  };

  /* ---------- Actions ---------- */
  T.actions['toggle-archived'] = () => { T.ui.homeArchived = !T.ui.homeArchived; if (T.parseRoute().seg[1] === 'archivadas') T.go('inicio'); else T.render(); };
  T.actions['subject-menu'] = (el) => {
    const s = T.subject(el.dataset.id);
    T.menu(el, [
      { icon: 'pencil', label: t('edit'), run: () => T.actions['subject-edit']({ dataset: { id: s.id } }) },
      { icon: 'archive', label: t('archive'), run: () => archive(s, true) },
      '-',
      { icon: 'trash-2', label: t('delete'), danger: true, run: () => del(s) }
    ], { align: 'end' });
  };
  function archive(s, v) {
    s.archived = v; T.render();
    T.toast(t(v ? 'subject_archived' : 'subject_unarchived', { name: esc(s.name) }), { action: t('undo'), onAction: () => { s.archived = !v; T.render(); } });
  }
  function del(s) {
    T.confirm({
      title: t('delete_subject_q', { name: esc(s.name) }), body: t('delete_subject_body'), confirm: t('delete_subject'), danger: true,
      onConfirm: () => {
        const snap = JSON.stringify(T.state);
        T.state.subjects = T.state.subjects.filter((x) => x !== s);
        T.state.classes = T.state.classes.filter((c) => c.subjectId !== s.id);
        T.state.tasks.forEach((tk) => { if (tk.subjectId === s.id) tk.subjectId = null; });
        T.closeAll(); T.render();
        T.toast(t('subject_deleted', { name: esc(s.name) }), { action: t('undo'), onAction: () => { T.state = JSON.parse(snap); T.render(); } });
      }
    });
  }
  T.actions['subject-unarchive'] = (el) => archive(T.subject(el.dataset.id), false);

  /* Subject form (alta / edición) */
  function swatches(sel, idp) {
    return '<div class="swatches" role="radiogroup" aria-label="' + t('color') + '">' + window.SUBJECT_COLORS.map((c) =>
      '<button type="button" class="swatch subj-' + c.key + '" role="radio" id="' + idp + '-' + c.key + '" aria-checked="' + (sel === c.key) + '" aria-label="' + c[T.settings.lang] + '" data-tip="' + c[T.settings.lang] + '" data-color="' + c.key + '">' + (sel === c.key ? I('check', 16, { sw: 2.5 }) : '') + '</button>').join('') + '</div>';
  }
  T.swatches = swatches;
  function bindSwatches(el, onPick) {
    el.querySelectorAll('.swatches').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('.swatch'); if (!b) return;
      g.querySelectorAll('.swatch').forEach((x) => { x.setAttribute('aria-checked', 'false'); x.innerHTML = ''; });
      b.setAttribute('aria-checked', 'true'); b.innerHTML = I('check', 16, { sw: 2.5 });
      onPick(b.dataset.color);
    }));
  }
  T.bindSwatches = bindSwatches;
  function subjectForm(s) {
    const isNew = !s;
    const used = T.activeSubjects().map((x) => x.color);
    const firstFree = (window.SUBJECT_COLORS.find((c) => !used.includes(c.key)) || window.SUBJECT_COLORS[0]).key;
    const v = s ? Object.assign({}, s) : { name: '', commission: '', teacher: '', term: '2C 2026', credits: '', color: firstFree };
    const key = T.id('sf');
    T.dialog({
      key: key, title: isNew ? t('new_subject') : t('edit_subject'), desc: isNew ? t('new_subject_desc') : '',
      body: '<form id="sf-form" class="form-grid" novalidate>' +
        '<div class="field span-2" id="sf-name-f"><label class="field-label" for="sf-name">' + t('name') + '<span class="req" aria-hidden="true">*</span></label><input class="input" id="sf-name" required aria-required="true" value="' + esc(v.name) + '" placeholder="' + t('name_ph') + '" data-autofocus autocomplete="off"><span class="field-error" id="sf-name-err" hidden>' + I('circle-alert', 14) + t('name_required') + '</span></div>' +
        '<div class="field"><label class="field-label" for="sf-com">' + t('commission') + '</label><input class="input" id="sf-com" value="' + esc(v.commission) + '" placeholder="' + t('commission_ph') + '"></div>' +
        '<div class="field"><label class="field-label" for="sf-term">' + t('term') + '</label><input class="input" id="sf-term" value="' + esc(v.term) + '" placeholder="2C 2026"></div>' +
        '<div class="field"><label class="field-label" for="sf-teacher">' + t('teacher') + '</label><input class="input" id="sf-teacher" value="' + esc(v.teacher) + '" placeholder="' + t('teacher_ph') + '"></div>' +
        '<div class="field"><label class="field-label" for="sf-cred">' + t('credits') + '</label><input class="input tnum" id="sf-cred" type="number" min="0" max="40" value="' + esc(v.credits) + '" placeholder="6"><span class="field-hint">' + t('credits_hint') + '</span></div>' +
        '<div class="field span-2"><span class="field-label">' + t('color') + '</span>' + swatches(v.color, 'sf-c') + '<span class="field-hint">' + t('color_hint') + '</span></div>' +
      '</form>',
      foot: '<button class="btn btn-secondary" data-action="overlay-close">' + t('cancel') + '</button><button class="btn btn-primary" id="sf-save">' + (isNew ? t('add_subject') : t('save')) + '</button>',
      onMount: (el) => {
        let color = v.color;
        bindSwatches(el, (c) => { color = c; });
        const save = () => {
          const name = el.querySelector('#sf-name').value.trim();
          const f = el.querySelector('#sf-name-f');
          if (!name) { f.classList.add('is-invalid'); el.querySelector('#sf-name-err').hidden = false; el.querySelector('#sf-name').setAttribute('aria-invalid', 'true'); el.querySelector('#sf-name').setAttribute('aria-describedby', 'sf-name-err'); el.querySelector('#sf-name').focus(); return; }
          const data = { name: name, commission: el.querySelector('#sf-com').value.trim(), term: el.querySelector('#sf-term').value.trim(), teacher: el.querySelector('#sf-teacher').value.trim(), credits: Number(el.querySelector('#sf-cred').value) || 0, color: color };
          const btn = el.querySelector('#sf-save'); btn.classList.add('is-loading');
          setTimeout(() => {
            if (isNew) T.state.subjects.push(Object.assign({ id: T.id('s'), archived: false, docs: [], grades: { course: null, final: null } }, data));
            else Object.assign(s, data);
            T.closeOverlay(key); T.render();
            T.toast(t(isNew ? 'subject_added' : 'subject_saved', { name: esc(name) }));
          }, 450);
        };
        el.querySelector('#sf-save').addEventListener('click', save);
        el.querySelector('#sf-form').addEventListener('submit', (e) => { e.preventDefault(); save(); });
        el.querySelector('#sf-name').addEventListener('input', (e) => { if (e.target.value.trim()) { el.querySelector('#sf-name-f').classList.remove('is-invalid'); el.querySelector('#sf-name-err').hidden = true; e.target.removeAttribute('aria-invalid'); } });
      }
    });
  }
  T.actions['subject-new'] = () => subjectForm(null);
  T.actions['subject-edit'] = (el) => subjectForm(T.subject(el.dataset.id));

  /* Subject sheet: datos + documentos */
  function sheetHtml(id) {
    const s = T.subject(id);
    if (!s) return '';
    const fld = (k, label, type) => '<div class="field"><label class="field-label" for="ss-' + k + '">' + label + '</label><input class="input' + (type === 'number' ? ' tnum' : '') + '" id="ss-' + k + '" ' + (type ? 'type="' + type + '"' : '') + ' value="' + esc(s[k]) + '" data-change="subject-field" data-id="' + s.id + '" data-field="' + k + '"></div>';
    const docs = s.docs.length ? '<div class="doc-list">' + s.docs.map((d) =>
      '<div class="doc-row"><span class="doc-icon">' + I(DOC_ICON[d.type] || 'file', 18) + '</span>' +
      '<div class="doc-name"><label class="visually-hidden" for="dn-' + d.id + '">' + t('doc_name') + '</label><input class="input input-inline" id="dn-' + d.id + '" value="' + esc(d.name) + '" data-change="doc-rename" data-id="' + s.id + '" data-doc="' + d.id + '"></div>' +
      '<div class="doc-actions"><a class="btn btn-ghost btn-icon" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + t('open_new_tab', { name: esc(d.name) }) + '" data-tip="' + t('open_new_tab_short') + '">' + I('external-link', 18) + '</a>' +
      '<button class="btn btn-ghost btn-icon" data-action="doc-delete" data-id="' + s.id + '" data-doc="' + d.id + '" aria-label="' + t('remove_doc', { name: esc(d.name) }) + '" data-tip="' + t('remove') + '">' + I('trash-2', 18) + '</button></div></div>').join('') + '</div>'
      : '<div class="doc-empty">' + t('docs_empty') + '</div>';
    const pasting = T.ui.pasting === s.id;
    return '<div class="sheet-head subj-' + s.color + '"><span class="swatch-lg" style="width:14px;height:14px;border-radius:4px;background:var(--s-vivid);flex:none"></span><h2 style="flex:1;min-width:0;font-size:17px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.name) + '</h2>' +
      '<button class="btn btn-ghost btn-icon" data-action="overlay-close" aria-label="' + t('close') + '">' + I('x') + '</button></div>' +
      '<div class="sheet-body subj-' + s.color + '">' +
        '<section style="display:flex;flex-direction:column;gap:14px"><h3 class="section-label">' + t('details') + '</h3>' +
          fld('name', t('name')) +
          '<div class="form-grid">' + fld('commission', t('commission')) + fld('term', t('term')) + fld('teacher', t('teacher')) + fld('credits', t('credits'), 'number') + '</div>' +
          '<div class="field"><span class="field-label">' + t('color') + '</span>' + swatches(s.color, 'ss-c') + '</div>' +
        '</section>' +
        '<section style="display:flex;flex-direction:column;gap:12px"><h3 class="section-label">' + t('documents') + ' · <span class="tnum">' + s.docs.length + '</span></h3>' + docs +
          '<div class="btn-row"><button class="btn btn-secondary" id="ss-drive" data-action="drive-pick" data-id="' + s.id + '">' + I('folder-open', 18) + t('add_from_drive') + '</button><button class="btn btn-secondary" id="ss-paste" data-action="paste-toggle" data-id="' + s.id + '" aria-expanded="' + pasting + '">' + I('link', 18) + t('paste_link') + '</button></div>' +
          (pasting ? '<div class="field"><label class="field-label" for="ss-url">' + t('drive_link') + '</label><div class="paste-row"><input class="input" id="ss-url" placeholder="https://docs.google.com/…" data-enter="paste-add" data-id="' + s.id + '" autocomplete="off"><button class="btn btn-primary" data-action="paste-add" data-id="' + s.id + '">' + t('add') + '</button></div><span class="field-hint">' + t('paste_hint') + '</span></div>' : '') +
          '<p class="field-hint">' + t('docs_note') + '</p>' +
        '</section>' +
      '</div>' +
      '<div class="sheet-foot"><button class="btn btn-ghost" data-action="sheet-archive" data-id="' + s.id + '">' + I('archive', 18) + t('archive') + '</button><button class="btn btn-danger-ghost" data-action="sheet-delete" data-id="' + s.id + '">' + I('trash-2', 18) + t('delete') + '</button><span style="flex:1"></span><button class="btn btn-primary" data-action="overlay-close">' + t('done') + '</button></div>';
  }
  T.actions['subject-open'] = (el) => {
    const id = el.dataset.id;
    T.closeAll('sheet');
    T.sheet({ key: 'subject-sheet', label: T.subject(id).name, render: () => sheetHtml(id) });
    setTimeout(() => {
      const host = document.querySelector('[data-ov="subject-sheet"]');
      if (host) host.addEventListener('click', (e) => { const b = e.target.closest('.swatch'); if (!b) return; T.subject(id).color = b.dataset.color; T.render(); });
    }, 0);
  };
  T.actions['subject-field'] = (el) => { const s = T.subject(el.dataset.id); const f = el.dataset.field; s[f] = f === 'credits' ? (Number(el.value) || 0) : el.value.trim() || s[f]; T.render(); };
  T.actions['doc-rename'] = (el) => { const d = T.subject(el.dataset.id).docs.find((x) => x.id === el.dataset.doc); if (el.value.trim()) d.name = el.value.trim(); T.render(); };
  T.actions['doc-delete'] = (el) => {
    const s = T.subject(el.dataset.id); const i = s.docs.findIndex((x) => x.id === el.dataset.doc); const d = s.docs[i];
    s.docs.splice(i, 1); T.render();
    T.toast(t('doc_removed', { name: esc(d.name) }), { action: t('undo'), onAction: () => { s.docs.splice(i, 0, d); T.render(); } });
  };
  T.actions['paste-toggle'] = (el) => { T.ui.pasting = T.ui.pasting === el.dataset.id ? null : el.dataset.id; T.render(); setTimeout(() => { const i = document.getElementById('ss-url'); if (i) i.focus(); }, 10); };
  T.actions['paste-add'] = (el) => {
    const s = T.subject(el.dataset.id); const inp = document.getElementById('ss-url'); const url = inp.value.trim();
    if (!/^https?:\/\//.test(url)) { inp.classList.add('is-invalid'); inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
    const type = /spreadsheets/.test(url) ? 'sheet' : /presentation/.test(url) ? 'slides' : /document/.test(url) ? 'doc' : /drive\.google\.com\/file/.test(url) ? 'pdf' : 'link';
    s.docs.push({ id: T.id('d'), type: type, name: t('new_link_name'), url: url });
    T.ui.pasting = null; T.render();
  };
  T.actions['sheet-archive'] = (el) => { T.closeAll('sheet'); archive(T.subject(el.dataset.id), true); };
  T.actions['sheet-delete'] = (el) => del(T.subject(el.dataset.id));

  /* Simulated Google Drive picker */
  T.actions['drive-pick'] = (el) => {
    const s = T.subject(el.dataset.id);
    const files = [
      { type: 'doc', name: 'Resumen unidad 2 — Ley de Gauss' }, { type: 'pdf', name: 'Parcial 2025 resuelto.pdf' }, { type: 'sheet', name: 'Tabla de constantes' },
      { type: 'slides', name: 'Clase 8 — Capacitores' }, { type: 'image', name: 'Esquema circuito RC.png' }
    ];
    const key = 'drive';
    T.dialog({
      key: key, title: t('drive_title'), desc: t('drive_desc'),
      body: '<p class="badge badge-outline" style="align-self:flex-start">' + t('drive_simulated') + '</p><div class="doc-list subj-' + s.color + '">' + files.map((f, i) =>
        '<label class="doc-row" style="cursor:pointer"><input type="checkbox" class="visually-hidden" data-i="' + i + '" id="dp-' + i + '"><span class="check" aria-hidden="true" style="margin:0"><span class="check-box">' + I('check', 14, { sw: 3 }) + '</span></span><span class="doc-icon">' + I(DOC_ICON[f.type], 18) + '</span><span style="flex:1">' + esc(f.name) + '</span></label>').join('') + '</div>',
      foot: '<button class="btn btn-secondary" data-action="overlay-close">' + t('cancel') + '</button><button class="btn btn-primary" id="dp-ok" disabled>' + t('add_selected') + '</button>',
      onMount: (host) => {
        const ok = host.querySelector('#dp-ok');
        host.querySelectorAll('input[type=checkbox]').forEach((cb) => cb.addEventListener('change', () => {
          cb.nextElementSibling.setAttribute('aria-checked', cb.checked);
          cb.nextElementSibling.querySelector('.check-box').style.cssText = cb.checked ? 'background:var(--color-accent);border-color:var(--color-accent);color:var(--color-on-accent)' : '';
          const n = host.querySelectorAll('input:checked').length;
          ok.disabled = !n; ok.textContent = n ? t('add_n', { n: n }) : t('add_selected');
        }));
        ok.addEventListener('click', () => {
          host.querySelectorAll('input:checked').forEach((cb) => { const f = files[Number(cb.dataset.i)]; s.docs.push({ id: T.id('d'), type: f.type, name: f.name, url: 'https://drive.google.com/file/d/ejemplo' }); });
          T.closeOverlay(key); T.render();
        });
      }
    });
  };

  /* Grades */
  T.actions['grade-set'] = (el) => {
    const s = T.subject(el.dataset.id); const f = el.dataset.field; const k = s.id + f;
    const res = parseGrade(el.value.trim());
    if (!res.ok) { T.ui.grades[k] = { raw: el.value, error: true }; }
    else { delete T.ui.grades[k]; s.grades[f] = res.value; }
    T.render();
  };
})();
