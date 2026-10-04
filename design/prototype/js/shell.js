/* Drawer (navigation) + Ajustes dialog + theme/language controls */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc;

  function themeSeg(prefix) {
    const opts = [['light', 'sun', 'theme_light'], ['dark', 'moon', 'theme_dark'], ['system', 'monitor', 'theme_system']];
    return '<div class="seg" role="radiogroup" aria-label="' + t('theme') + '">' + opts.map((o) =>
      '<button class="seg-item" role="radio" id="' + prefix + '-theme-' + o[0] + '" aria-checked="' + (T.settings.theme === o[0]) + '" data-action="set-theme" data-value="' + o[0] + '">' + I(o[1], 16) + '<span>' + t(o[2]) + '</span></button>').join('') + '</div>';
  }
  function langSeg(prefix) {
    return '<div class="seg" role="radiogroup" aria-label="' + t('language') + '">' + [['es', 'Español'], ['en', 'English']].map((o) =>
      '<button class="seg-item" role="radio" id="' + prefix + '-lang-' + o[0] + '" lang="' + o[0] + '" aria-checked="' + (T.settings.lang === o[0]) + '" data-action="set-lang" data-value="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
  }
  T.themeSeg = themeSeg; T.langSeg = langSeg;

  function drawerHtml() {
    const cur = T.parseRoute().seg[0];
    const u = T.state.user;
    return '<div class="drawer-layer" role="presentation"><div class="scrim" data-action="overlay-close"></div>' +
      '<nav class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="' + t('menu') + '">' +
        '<div class="drawer-head"><a href="#/inicio" class="logo-link" aria-label="Tilde — ' + t('nav_home') + '" style="color:inherit">' + T.logo(28) + '</a>' +
        '<button class="btn btn-ghost btn-icon" data-action="overlay-close" aria-label="' + t('close_menu') + '">' + I('x') + '</button></div>' +
        '<div class="drawer-nav">' + T.navItems.map((n) =>
          '<a class="nav-item" href="#/' + n.path + '" id="nav-' + n.id + '"' + (cur === n.path ? ' aria-current="page"' : '') + '>' + I(n.icon) + '<span>' + t(n.key) + '</span></a>').join('') + '</div>' +
        '<div class="drawer-foot">' +
          '<div class="profile"><span class="avatar subj-cobalto" aria-hidden="true">' + esc(u.initials) + '</span><div style="min-width:0"><div class="profile-name">' + esc(u.name) + '</div><div class="profile-mail">' + esc(u.email) + '</div></div></div>' +
          '<button class="nav-item" id="drawer-settings" data-action="settings-open">' + I('settings') + '<span>' + t('settings') + '</span></button>' +
          '<div class="drawer-row" style="flex-direction:column;align-items:stretch;gap:8px">' + themeSeg('dr') + langSeg('dr') + '</div>' +
        '</div>' +
      '</nav></div>';
  }

  T.actions['drawer-open'] = () => {
    if (T.isOpen('drawer')) return;
    T.openOverlay({ kind: 'drawer', live: true, key: 'drawer', render: drawerHtml });
  };
  T.actions['set-theme'] = (el) => { T.settings.theme = el.dataset.value; T.applyTheme(); T.render(); };
  T.actions['set-lang'] = (el) => { T.settings.lang = el.dataset.value; T.render(); };

  /* ---------- Ajustes ---------- */
  function settingsBody() {
    const s = T.settings;
    return '<div class="field"><span class="field-label" id="set-lang-l">' + t('language') + '</span>' + langSeg('st') + '</div>' +
      '<div class="field"><span class="field-label">' + t('theme') + '</span>' + themeSeg('st') + '<span class="field-hint">' + t('theme_hint') + '</span></div>' +
      '<div class="field"><span class="field-label">' + t('visible_days') + '</span><div class="daychips" role="group" aria-label="' + t('visible_days') + '">' +
        [1, 2, 3, 4, 5, 6, 7].map((d) => '<button class="daychip" id="st-day-' + d + '" aria-pressed="' + s.visibleDays.includes(d) + '" aria-label="' + T.d.wdLong(d) + '" data-action="toggle-visible-day" data-day="' + d + '">' + T.d.wdLetter(d) + '</button>').join('') +
      '</div><span class="field-hint">' + t('visible_days_hint') + '</span></div>' +
      '<div class="field"><label class="field-label" for="st-lead">' + t('default_lead') + '</label><div class="lead-row"><input class="input input-number tnum" id="st-lead" type="number" min="0" max="30" value="' + s.defaultLead + '" data-change="set-default-lead"><span>' + t('default_lead_suffix') + '</span></div><span class="field-hint">' + t('default_lead_hint') + '</span></div>' +
      '<div class="menu-sep"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div style="font-weight:500">' + esc(T.state.user.email) + '</div><div class="field-hint">' + t('signed_in_google') + '</div></div><button class="btn btn-danger-ghost" data-action="sign-out">' + I('log-out', 18) + t('sign_out') + '</button></div>';
  }
  T.actions['settings-open'] = () => {
    T.closeAll('drawer');
    T.dialog({ key: 'settings', title: t('settings'), body: settingsBody, live: true, foot: '<button class="btn btn-primary" data-action="overlay-close">' + t('done') + '</button>' });
  };
  T.actions['toggle-visible-day'] = (el) => {
    const d = Number(el.dataset.day); const v = T.settings.visibleDays;
    if (v.includes(d)) { if (v.length > 1) v.splice(v.indexOf(d), 1); } else { v.push(d); v.sort(); }
    T.render();
  };
  T.actions['set-default-lead'] = (el) => { const n = Math.max(0, Math.min(30, parseInt(el.value, 10) || 0)); T.settings.defaultLead = n; };
  T.actions['sign-out'] = () => { T.closeAll(); T.go(''); };
})();
