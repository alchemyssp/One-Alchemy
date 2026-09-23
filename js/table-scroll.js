/* Data U: keep the horizontal scrollbar reachable without scrolling to the bottom.
   - a mirrored scrollbar above the table (#tscrollTop) synced with the table box (#tscroll)
   - the table box itself is limited to the screen height (see css/ssp-type.css) */
(function () {
  function init() {
    var top = document.getElementById('tscrollTop');
    var box = document.getElementById('tscroll');
    if (!top || !box) return;
    var spacer = top.firstElementChild, lock = false;

    function size() {
      /* fit the box into the space left on screen (page not scrolled), min 320px; leave room for paging */
      var topY = box.getBoundingClientRect().top + window.scrollY;
      box.style.maxHeight = Math.max(320, window.innerHeight - topY - 64) + 'px';
      spacer.style.width = box.scrollWidth + 'px';
      top.style.display = box.scrollWidth > box.clientWidth + 1 ? 'block' : 'none';
    }
    top.addEventListener('scroll', function () { if (lock) { lock = false; return; } lock = true; box.scrollLeft = top.scrollLeft; });
    box.addEventListener('scroll', function () { if (lock) { lock = false; return; } lock = true; top.scrollLeft = box.scrollLeft; });

    new MutationObserver(size).observe(box, { childList: true, subtree: true });
    window.addEventListener('resize', size);
    size();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
