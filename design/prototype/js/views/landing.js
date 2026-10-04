/* Landing: barra superior fija, hero y un bloque por funcionalidad con captura real (pantallas del prototipo escaladas) */
(function () {
  const T = window.T, t = T.t, I = T.icon, esc = T.esc;
  const FEATURES = [
    { key: 'subjects', route: 'inicio', view: 'home' },
    { key: 'schedule', route: 'horario', view: 'schedule' },
    { key: 'tasks', route: 'tareas', view: 'tasks' },
    { key: 'calendar', route: 'calendario', view: 'calendar' },
    { key: 'grades', route: 'inicio/notas', view: 'home' },
    { key: 'sessions', route: 'sesiones', view: 'sessions' }
  ];

  function shot(f) {
    /* Render the real screen markup, inert, at 1440 px and scale it down. */
    const r = { path: f.route, seg: f.route.split('/'), params: new URLSearchParams(), demo: null };
    const saved = { ui: Object.assign({}, T.ui), sel: T.ui.selected };
    if (f.view === 'tasks') { T.ui.tasksRange = 'week'; T.ui.selecting = false; }
    if (f.view === 'home') T.ui.homeArchived = false;
    let v;
    try { v = T.views[f.view].render(r); } finally { Object.assign(T.ui, saved.ui); T.ui.selected = saved.sel; }
    return '<div class="shot" aria-hidden="true"><div class="shot-inner" inert><div class="app"><header class="topbar"><span class="btn btn-ghost btn-icon">' + I('menu', 22) + '</span><h1 class="topbar-title">' + esc(v.title) + '</h1><div class="topbar-spacer"></div><div class="topbar-actions">' + ((v.actions || '') + '</div></header><main class="page ' + (v.pageClass || '') + '">' + v.body + '</main></div></div></div>').replace(/ id="[^"]*"/g, '');
  }
  function googleBtn(id, lg) {
    return '<button class="btn-google' + (lg ? ' btn-google-lg' : '') + '" id="' + id + '" data-action="google-login">' + T.googleG + '<span>' + t('continue_google') + '</span></button>';
  }

  T.views.landing = {
    render() {
      return '<div class="landing">' +
        '<header class="landing-top" id="landing-top"><a href="#/" class="logo-link" style="color:inherit" aria-label="Tilde">' + T.logo(30) + '</a><span class="grow"></span>' +
          '<label class="visually-hidden" for="lp-lang">' + t('language') + '</label><select class="select lang-select" id="lp-lang" style="width:auto" data-change="landing-lang"><option value="es"' + (T.settings.lang === 'es' ? ' selected' : '') + ' lang="es">Español</option><option value="en"' + (T.settings.lang === 'en' ? ' selected' : '') + ' lang="en">English</option></select>' +
          '<button class="btn btn-ghost btn-icon" id="lp-theme" data-action="landing-theme" aria-label="' + t('toggle_theme') + '" data-tip="' + t('toggle_theme') + '" data-tip-pos="bottom">' + I(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 20) + '</button>' +
          googleBtn('lp-google-top') + '</header>' +
        '<main>' +
          '<section class="hero"><span class="hero-mark">' + T.logoSymbol(64) + '</span><h1>Tilde</h1><p>' + t('hero_line') + '</p>' + googleBtn('lp-google-hero', true) + '<span class="hero-note">' + t('hero_note') + '</span></section>' +
          FEATURES.map((f, i) => '<section class="feature" aria-labelledby="ft-' + f.key + '"><div class="feature-inner"><span class="feature-kicker"><span class="n">0' + (i + 1) + '</span>' + t('nav_feature_' + f.key) + '</span><h2 id="ft-' + f.key + '">' + t('feat_' + f.key + '_title') + '</h2><p>' + t('feat_' + f.key + '_text') + '</p>' + shot(f) + '</div></section>').join('') +
        '</main>' +
        '<footer class="landing-foot"><span style="color:var(--color-text)">' + T.logo(22) + '</span><span>' + t('footer_line') + '</span><span class="grow"></span><span class="tnum">© 2026</span></footer>' +
      '</div>';
    },
    after() { scaleShots(); }
  };
  function scaleShots() {
    document.querySelectorAll('.shot').forEach((s) => { const inner = s.querySelector('.shot-inner'); inner.style.transform = 'scale(' + (s.clientWidth / 1440) + ')'; });
  }
  const prevResize = T.onResize;
  T.onResize = () => { scaleShots(); if (prevResize) prevResize(); };

  T.actions['google-login'] = (el) => {
    el.style.opacity = '0.7'; el.setAttribute('aria-busy', 'true');
    el.querySelector('span').textContent = t('signing_in');
    setTimeout(() => T.go('inicio'), 650);
  };
  T.actions['landing-lang'] = (el) => { T.settings.lang = el.value; T.render(); };
  T.actions['landing-theme'] = () => { const dark = document.documentElement.dataset.theme === 'dark'; T.settings.theme = dark ? 'light' : 'dark'; T.applyTheme(); T.render(); };
})();
