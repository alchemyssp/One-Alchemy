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
    'roi.html':        'ROI Analysis',
    'offtake.html':    'Off-take 2026',
    'sku.html':        'SKU',
    'users.html':      'User Management'
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
