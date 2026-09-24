/* Color theme switcher (all pages).
   Loaded in <head> right after css/ssp-type.css so the saved theme is applied before the page paints.
   Themes are CSS variable sets in css/ssp-type.css (html[data-theme="…"]); the choice is kept per browser.
   The picker (3 color dots) is added to the sidebar, above the user box. */
(function () {
  var KEY = 'archive_theme';
  var THEMES = [
    { id: '', name: 'Classic red', dots: ['#B0120A', '#F36C60'] },
    { id: 'earth', name: 'Earth (brown / orange / olive)', dots: ['#3E2723', '#BF360C'] },
    { id: 'lime', name: 'Lime (lime / olive)', dots: ['#827717', '#C0CA33'] },
  ];
  var read = function () { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  var apply = function (id) {
    if (id) document.documentElement.setAttribute('data-theme', id);
    else document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('.theme-pick button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === id)); });
    /* charts read the theme colors when they draw; tell open dashboards to redraw */
    try { window.dispatchEvent(new CustomEvent('themechange', { detail: id })); } catch (e) {}
  };
  apply(THEMES.some(function (t) { return t.id === read(); }) ? read() : '');

  /* current theme color for scripts (charts, map pins): themeColor('--c1', '#B0120A') */
  window.themeColor = function (name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  function buildPicker() {
    /* top-right of the page: inside the top bar when the page has one (Dashboard), else a small fixed pill */
    if (!document.querySelector('.sidebar') || document.querySelector('.theme-pick')) return;
    var bar = document.querySelector('.topbar-right');
    var pick = document.createElement('div');
    pick.className = 'theme-pick'; pick.setAttribute('role', 'group'); pick.setAttribute('aria-label', 'Color theme');
    pick.innerHTML = '<span>Theme</span>' + THEMES.map(function (t) {
      return '<button type="button" data-theme="' + t.id + '" title="' + t.name + '" aria-label="' + t.name + '"' +
        ' style="background:linear-gradient(135deg,' + t.dots[0] + ' 0 50%,' + t.dots[1] + ' 50% 100%)"></button>';
    }).join('');
    if (bar) { pick.classList.add('in-bar'); bar.insertBefore(pick, bar.firstChild); }
    else {   /* its own small row at the top-right of the page, so it never covers the page buttons */
      var main = document.querySelector('.main') || document.body;
      pick.classList.add('top-row'); main.insertBefore(pick, main.firstChild);
    }
    pick.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        try { localStorage.setItem(KEY, b.dataset.theme); } catch (e) {}
        apply(b.dataset.theme);
      };
    });
    apply(document.documentElement.getAttribute('data-theme') || '');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildPicker); else buildPicker();
})();
