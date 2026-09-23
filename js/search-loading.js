/* Search feedback: while a search runs, the table blurs and "Loading…" shows,
   then the results appear.
   - window.searchLoading(true/false) — pages with a server search (Data U) call this
   - every other page: the #searchInput handler is wrapped automatically
     (overlay while typing, results 350 ms after the last key)
   Styles: .search-busy in css/ssp-type.css */
(function () {
  var MIN_SHOW = 300;       /* keep the overlay visible long enough to notice */
  var shownAt = 0, hideTimer = null;

  function target() {
    var box = document.querySelector('.fit-scroll') || document.getElementById('tableWrap');
    if (!box) return null;
    /* the non-scrolling card around the table, so the overlay covers the visible area */
    return box.closest('.tcard, .table-card, .tbl-card, .section') || box.parentElement;
  }

  window.searchLoading = function (on) {
    var el = target(); if (!el) return;
    clearTimeout(hideTimer);
    if (on) {
      if (!el.classList.contains('search-busy')) shownAt = Date.now();
      el.classList.add('search-busy');
      el.setAttribute('aria-busy', 'true');
    } else {
      var wait = Math.max(0, MIN_SHOW - (Date.now() - shownAt));
      hideTimer = setTimeout(function () {
        el.classList.remove('search-busy');
        el.removeAttribute('aria-busy');
      }, wait);
    }
  };

  function wrapInput() {
    var input = document.getElementById('searchInput');
    if (!input || input.dataset.serverSearch === '1' || typeof input.oninput !== 'function') return;
    var original = input.oninput, t = null;
    input.oninput = function (e) {
      window.searchLoading(true);
      clearTimeout(t);
      var self = this;
      t = setTimeout(function () {
        try { original.call(self, e); } finally {
          requestAnimationFrame(function () { window.searchLoading(false); });
        }
      }, 350);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapInput);
  else wrapInput();
})();
