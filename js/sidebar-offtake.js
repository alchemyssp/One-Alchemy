/* Sidebar mini card (above Theme): Off-take Compare — Off-Take Value Inc.VAT (THB), previous year vs latest year.
   Same data as the Off-take 2026 page (offtake_dashboard RPC, latest month, no filters).
   Kept for 10 minutes in this browser tab so moving between pages does not reload it. */
(function () {
  var KEY = 'sb_offtake_cmp_v1', TTL = 10 * 60 * 1000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var PREV = '#D99500';

  function client() {
    if (window.__sbClient) return window.__sbClient;                     /* dashboard.html keeps its own client */
    return window.supabase && typeof window.supabase.rpc === 'function' ? window.supabase : null;
  }
  function cur() { return window.themeColor ? themeColor('--c1', '#B0120A') : '#B0120A'; }
  function short(v) { var a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v)); }

  async function fetchData(sb) {
    try { var c = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < TTL) return c.d; } catch (e) {}
    var o = await sb.rpc('offtake_options');
    var latest = o.data && o.data.months && o.data.months[0];
    if (o.error || !latest) return null;
    var r = await sb.rpc('offtake_dashboard', { p_months: [latest], p_companies: null, p_principle: null, p_brand: null,
      p_wholesaler: null, p_team: null, p_bde: null });
    if (r.error || !r.data) return null;
    var Y = new Date(r.data.month + 'T00:00:00').getFullYear();
    var d = { Y: Y, monthly: (r.data.monthly || []).map(function (x) { return { y: x.y, m: x.m, v: Number(x.val) || 0 }; }) };
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
    return d;
  }

  function svg(d) {
    var W = 224, H = 46, pad = 4;
    var s = function (y) { var a = new Array(12).fill(null); d.monthly.forEach(function (x) { if (x.y === y) a[x.m - 1] = x.v; }); return a; };
    var a = s(d.Y - 1), b = s(d.Y), all = a.concat(b).filter(function (v) { return v != null; });
    if (!all.length) return '';
    var max = Math.max.apply(null, all), min = Math.min.apply(null, all); if (max === min) { max += 1; min -= 1; }
    var X = function (i) { return pad + i * (W - pad * 2) / 11; }, Yp = function (v) { return pad + (max - v) * (H - pad * 2) / (max - min); };
    var path = function (arr, color) {
      var pts = [], dots = '';
      arr.forEach(function (v, i) { if (v == null) return; pts.push(X(i).toFixed(1) + ',' + Yp(v).toFixed(1));
        dots += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Yp(v).toFixed(1) + '" r="2.2" fill="' + color + '"><title>' +
          MONTHS[i] + ' ' + (arr === a ? d.Y - 1 : d.Y) + ': ' + Math.round(v).toLocaleString() + ' THB</title></circle>'; });
      return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots;
    };
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Off-take value Inc.VAT by month, ' +
      (d.Y - 1) + ' vs ' + d.Y + ', highest ' + short(max) + ' THB">' +
      '<line x1="0" x2="' + W + '" y1="' + (H - 1) + '" y2="' + (H - 1) + '" stroke="rgba(0,0,0,.08)"/>' +
      path(a, PREV) + path(b, cur()) + '</svg>';
  }

  function render(box, d) {
    var yy = function (y) { return String(y).slice(2); };
    box.innerHTML = '<div class="sbo-head"><b>Off-take Compare ' + yy(d.Y - 1) + '-' + yy(d.Y) + '</b>' +
      '<span class="sbo-leg"><i style="background:' + PREV + '"></i>' + yy(d.Y - 1) + '<i style="background:' + cur() + '"></i>' + yy(d.Y) + '</span></div>' +
      svg(d);
  }

  async function init() {
    var pick = document.querySelector('.theme-pick'), sb = client();
    if (!pick || !sb || document.querySelector('.sbo-card')) return;
    var box = document.createElement('a');
    box.className = 'sbo-card'; box.href = 'offtake.html'; box.title = 'Open Off-take 2026';
    box.innerHTML = '<div class="sbo-head"><b>Off-take Compare</b></div><div class="sbo-wait">Coming in 3 2 1 ...</div>';
    pick.parentNode.insertBefore(box, pick);
    var d = null;
    try { d = await fetchData(sb); } catch (e) {}
    if (!d) { box.remove(); return; }
    render(box, d);
    window.addEventListener('themechange', function () { render(box, d); });
  }

  /* theme.js adds the Theme row on load; wait for it and for the page's login check */
  function start() { setTimeout(init, 600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
