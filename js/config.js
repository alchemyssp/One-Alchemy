// ============================================================
// Supabase Configuration
// ============================================================

const SUPABASE_URL = 'https://txjxwhpdxkswxfmsyutd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4anh3aHBkeGtzd3hmbXN5dXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDAwMzksImV4cCI6MjA5NzkxNjAzOX0.wvGFe0ZyrGV1OVahelj12cy9KnTGdrgXZc2t8HOnacw';

const { createClient } = window.supabase;
window._sbCreateClient = createClient;
window.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Nav labels ── */
(function () {
  var NAV_LABELS = {
    'dashboard.html':  'Dashboard',
    'outlets.html':    'Outlet Master',
    'data_u.html':     'Data Universe',
    'contracts.html':  'Contracts',
    'promotions.html': 'Promotions',
    'products.html':   'Products',
    'roi.html':        'ROI Analysis',
    'offtake.html':    'Off-take 2026',
    'sku.html':        'SKU'
  };

  function restoreNav() {
    document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
      var raw = a.getAttribute('href') || '';
      var key = raw.replace(/^.*\//, '').replace(/\?.*$/, '');
      var label = NAV_LABELS[key];
      if (!label) return;
      while (a.firstChild) a.removeChild(a.firstChild);
      a.textContent = label;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(restoreNav, 0); });
  } else {
    setTimeout(restoreNav, 0);
  }
})();

/* Table header label: show the real Supabase column name.
   Only names stored in ALL CAPS are turned into Title Case
   (short codes like BDE / ROI / SKU / VAT stay as they are). */
window.colLabel = function (c) {
  const s = String(c);
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return s;   // not ALL CAPS → as-is
  const KEEP = new Set(['BDE','ROI','SKU','BBC','VAT','THB','TEG','RC','ID','WS','CM','TH','EN']);
  return s.replace(/[A-Z]+/g, w => KEEP.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase());
};

/* Realtime refresh helper: many change events in a row (e.g. an import of
   1,000 rows) cause ONE reload, 2.5 s after the last change. */
window.liveReload = function (fn, wait) {
  var t = null;
  return function () { clearTimeout(t); t = setTimeout(fn, wait || 2500); };
};
