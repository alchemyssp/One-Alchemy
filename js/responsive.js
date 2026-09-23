/* Small screens: the sidebar slides in from the left.
   Adds a "Menu" button and a dim backdrop; styles live in css/ssp-type.css. */
(function () {
  function init() {
    if (!document.querySelector('.sidebar') || document.querySelector('.nav-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.textContent = 'Menu';
    btn.setAttribute('aria-label', 'Open menu');

    var shade = document.createElement('div');
    shade.className = 'nav-shade';

    function close() { document.body.classList.remove('nav-open'); }
    btn.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
    shade.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.querySelectorAll('.sidebar a').forEach(function (a) { a.addEventListener('click', close); });

    document.body.appendChild(shade);
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
