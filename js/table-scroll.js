/* Big tables: fit the table box into the visible screen, so its scrollbars
   (sideways and up/down) are always on screen — no need to scroll the page
   down to reach the horizontal scrollbar.
   Works on every page with a data table; styles live in css/ssp-type.css. */
(function () {
  var MIN_H = 560;   /* at least ~15 rows of the compact table */

  /* the element that actually scrolls: .tscroll if present, else the table wrapper */
  function findBoxes() {
    var boxes = [];
    document.querySelectorAll('.tscroll').forEach(function (el) { boxes.push(el); });
    ['tableWrap', 'rawWrap'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.closest('.tscroll')) boxes.push(el);
    });
    return boxes;
  }

  function fit(box) {
    if (!box.offsetParent) return;                       /* hidden (e.g. inactive tab) */
    var top = box.getBoundingClientRect().top + window.scrollY;
    /* leave room for pagination / footer that sits below the box */
    var after = 0, n = box.parentElement && box.parentElement.lastElementChild;
    if (n && n !== box && box.parentElement.contains(box)) after = n.offsetHeight + 16;
    /* a page can ask for a taller minimum (data-min-h, e.g. Contracts: at least 15 rows) */
    var h = Math.max(+box.dataset.minH || MIN_H, window.innerHeight - top - after - 16);
    var px = h + 'px';
    if (box.style.maxHeight !== px) box.style.maxHeight = px;
  }

  function init() {
    var boxes = findBoxes();
    if (!boxes.length) return;
    boxes.forEach(function (b) { b.classList.add('fit-scroll'); });

    var queued = false;
    function refit() {
      if (queued) return; queued = true;
      requestAnimationFrame(function () { queued = false; boxes.forEach(fit); });
    }
    window.addEventListener('resize', refit);
    document.addEventListener('click', function () { setTimeout(refit, 50); });   /* tabs, filters */
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(refit);
      ro.observe(document.body);
      boxes.forEach(function (b) { ro.observe(b); });
    }
    boxes.forEach(function (b) { new MutationObserver(refit).observe(b, { childList: true }); });
    refit();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
