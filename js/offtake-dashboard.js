/* Off-take Analytics dashboard (Off-take page).
   All totals are computed in Supabase (offtake_options / offtake_dashboard RPCs),
   so the page never downloads the ~75k raw rows.
   Colors: previous year #F36C60, selected year #B0120A (validated pair; the light
   one is under 3:1 on white, so values are also shown as text / in tables). */
(function () {
  var PREV = '#F36C60', CUR = '#B0120A', INK = '#111111', MUTED = '#666666', GRID = '#EEEEEE';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var opts = null, charts = {}, seq = 0;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  var short = function (n) {
    n = Number(n || 0); var a = Math.abs(n);
    /* 24.36M, 16.7K, 5K — drop trailing zeros */
    var trim = function (x) { return x.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); };
    if (a >= 1e6) return trim((n / 1e6).toFixed(2)) + 'M';
    if (a >= 1e3) return trim((n / 1e3).toFixed(1)) + 'K';
    return fmt(n);
  };
  var pct = function (cur, base) {
    if (!base) return null;
    return (cur - base) / base * 100;
  };
  var pctHtml = function (v) {
    if (v == null || !isFinite(v)) return '<span class="otd-chg">—</span>';
    var up = v >= 0;
    return '<span class="otd-chg ' + (up ? 'up' : 'down') + '">' + (up ? '▲ +' : '▼ ') + v.toFixed(2) + '%</span>';
  };
  var monthLabel = function (iso) { var d = new Date(iso + 'T00:00:00'); return MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear(); };

  function shell() {
    var host = $('otDashboard'); if (!host) return false;
    host.innerHTML =
      '<div class="otd-filters" role="group" aria-label="Dashboard filters">' +
      '  <div class="otd-f otd-company"><span class="otd-lbl">Company</span><div id="otdCompanies" class="otd-chips"></div></div>' +
      '  <label class="otd-f"><span class="otd-lbl">Year, Month</span><select id="otdMonth"></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Principle</span><select id="otdPrinciple"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Brand</span><select id="otdBrand"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Wholesaler</span><select id="otdWholesaler"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Team</span><select id="otdTeam"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">BDE</span><select id="otdBde"><option value="">All</option></select></label>' +
      '  <button class="otd-reset" id="otdReset" type="button">Reset</button>' +
      '</div>' +
      '<h2 class="otd-title" id="otdTitle">Off-Take Dashboard</h2>' +
      '<div class="otd-kpis">' +
      '  <div class="kpi-card otd-kpi"><div class="kpi-label">Off-Take Volume (Btls) of Selected Month</div>' +
      '    <div class="kpi-value" id="otdVol">—</div><div class="otd-chgrow"><span>MoM</span><span id="otdVolMom"></span><span>YoY</span><span id="otdVolYoy"></span></div></div>' +
      '  <div class="kpi-card otd-kpi"><div class="kpi-label">Off-Take Value Inc.VAT (THB) of Selected Month</div>' +
      '    <div class="kpi-value" id="otdVal">—</div><div class="otd-chgrow"><span>MoM</span><span id="otdValMom"></span><span>YoY</span><span id="otdValYoy"></span></div></div>' +
      '</div>' +
      '<div class="otd-grid">' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title" id="otdVolTitle">Off-Take Volume (Btls)</h3>' +
      '    <div class="otd-years" id="otdYearTbl"></div><div class="otd-chart"><canvas id="otdVolChart" aria-label="Off-take volume by month"></canvas></div></section>' +
      '  <section class="card otd-card"><h3 class="card-title">Off-Take Volume (Btls) by Principle</h3>' +
      '    <div class="otd-chart otd-tall"><canvas id="otdPrinChart" aria-label="Volume by principle"></canvas></div></section>' +
      '  <section class="card otd-card"><h3 class="card-title">Top 10 Brands — Volume (Btls)</h3>' +
      '    <div class="otd-chart otd-tall"><canvas id="otdBrandChart" aria-label="Top 10 brands by volume"></canvas></div></section>' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title" id="otdValTitle">Off-Take Value Inc.VAT (THB)</h3>' +
      '    <div class="otd-chart"><canvas id="otdValChart" aria-label="Off-take value by month"></canvas></div></section>' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title" id="otdProdTitle">By Product: Selected Month vs Previous Year</h3>' +
      '    <div class="otd-tablewrap"><table class="otd-prod" id="otdProdTbl"></table></div></section>' +
      '</div>';
    return true;
  }

  function fill(sel, values, keep) {
    var cur = keep ? sel.value : '';
    sel.innerHTML = '<option value="">All</option>' + values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
    if (values.indexOf(cur) >= 0) sel.value = cur;
  }
  function refreshDependent() {
    var p = $('otdPrinciple').value, t = $('otdTeam').value;
    fill($('otdBrand'), (opts.brands || []).filter(function (b) { return !p || b.principle === p; }).map(function (b) { return b.brand; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }), true);
    fill($('otdBde'), (opts.bdes || []).filter(function (b) { return !t || b.team === t; }).map(function (b) { return b.bde; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }), true);
  }

  async function init() {
    if (!shell()) return;
    var r = await supabase.rpc('offtake_options');
    if (r.error) { $('otdTitle').textContent = 'Dashboard unavailable: ' + r.error.message; return; }
    opts = r.data || {};
    $('otdMonth').innerHTML = (opts.months || []).map(function (m) { return '<option value="' + m + '">' + monthLabel(m) + '</option>'; }).join('');
    $('otdCompanies').innerHTML = (opts.companies || []).map(function (c) {
      return '<label class="otd-chip"><input type="checkbox" value="' + esc(c) + '"> ' + esc(c) + '</label>';
    }).join('');
    fill($('otdPrinciple'), opts.principles || []);
    fill($('otdWholesaler'), opts.wholesalers || []);
    fill($('otdTeam'), opts.teams || []);
    refreshDependent();
    ['otdMonth', 'otdBrand', 'otdWholesaler', 'otdBde'].forEach(function (id) { $(id).onchange = load; });
    $('otdPrinciple').onchange = function () { refreshDependent(); load(); };
    $('otdTeam').onchange = function () { refreshDependent(); load(); };
    $('otdCompanies').onchange = load;
    $('otdReset').onclick = function () {
      ['otdPrinciple', 'otdBrand', 'otdWholesaler', 'otdTeam', 'otdBde'].forEach(function (id) { $(id).value = ''; });
      [].forEach.call($('otdCompanies').querySelectorAll('input'), function (i) { i.checked = false; });
      $('otdMonth').selectedIndex = 0; refreshDependent(); load();
    };
    load();
  }

  async function load() {
    var my = ++seq, host = $('otDashboard');
    host.classList.add('search-busy');
    var companies = [].map.call($('otdCompanies').querySelectorAll('input:checked'), function (i) { return i.value; });
    var args = {
      p_month: $('otdMonth').value, p_companies: companies.length ? companies : null,
      p_principle: $('otdPrinciple').value || null, p_brand: $('otdBrand').value || null,
      p_wholesaler: $('otdWholesaler').value || null, p_team: $('otdTeam').value || null, p_bde: $('otdBde').value || null,
    };
    var r = await supabase.rpc('offtake_dashboard', args);
    if (my !== seq) return;
    host.classList.remove('search-busy');
    if (r.error) { $('otdTitle').textContent = 'Could not load dashboard: ' + r.error.message; return; }
    render(r.data || {});
  }

  function barOpts(horizontal, unit) {
    return {
      responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
      animation: { duration: 250 },
      plugins: {
        legend: { display: !horizontal, position: 'top', align: 'end', labels: { color: INK, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10 } },
        tooltip: { callbacks: { label: function (c) { return (c.dataset.label ? c.dataset.label + ': ' : '') + fmt(c.parsed[horizontal ? 'x' : 'y']) + (unit || ''); } } },
      },
      scales: {
        /* value axis gets short numbers (12K, 3.5M); the category axis keeps its labels */
        x: { grid: { display: horizontal, color: GRID }, border: { display: false }, ticks: horizontal ? { color: MUTED, callback: function (v) { return short(v); } } : { color: MUTED } },
        y: { grid: { display: !horizontal, color: GRID }, border: { display: false }, ticks: horizontal ? { color: INK, autoSkip: false } : { color: MUTED, callback: function (v) { return short(v); } } },
      },
    };
  }
  function draw(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }

  function render(d) {
    var sel = new Date(d.month + 'T00:00:00'), Y = sel.getFullYear(), PY = Y - 1, k = d.kpi || {};
    $('otdTitle').textContent = 'Off-Take Dashboard : ' + MONTHS[sel.getMonth()].toUpperCase() + ' ' + Y;
    $('otdVol').textContent = short(k.vol_cur); $('otdVol').title = fmt(k.vol_cur) + ' bottles';
    $('otdVal').textContent = short(k.val_cur); $('otdVal').title = fmt(k.val_cur) + ' THB';
    $('otdVolMom').innerHTML = pctHtml(pct(k.vol_cur, k.vol_prev_m)); $('otdVolYoy').innerHTML = pctHtml(pct(k.vol_cur, k.vol_prev_y));
    $('otdValMom').innerHTML = pctHtml(pct(k.val_cur, k.val_prev_m)); $('otdValYoy').innerHTML = pctHtml(pct(k.val_cur, k.val_prev_y));

    var series = function (year, key) {
      var a = new Array(12).fill(null);
      (d.monthly || []).forEach(function (x) { if (x.y === year) a[x.m - 1] = Number(x[key]); });
      return a;
    };
    var ds = function (key) {
      return [
        { label: String(PY), data: series(PY, key), backgroundColor: PREV, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
        { label: String(Y), data: series(Y, key), backgroundColor: CUR, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
      ];
    };
    $('otdVolTitle').textContent = 'Off-Take Volume (Btls) ' + PY + ' – ' + Y;
    $('otdValTitle').textContent = 'Off-Take Value Inc.VAT (THB) ' + PY + ' – ' + Y;
    draw('otdVolChart', { type: 'bar', data: { labels: MONTHS, datasets: ds('vol') }, options: barOpts(false, ' btls') });
    draw('otdValChart', { type: 'bar', data: { labels: MONTHS, datasets: ds('val') }, options: barOpts(false, ' THB') });

    var yt = d.year_totals || [];
    /* year totals as text (also the text alternative for the lighter bar color) */
    $('otdYearTbl').innerHTML = yt.map(function (r) {
      return '<div class="otd-year"><span class="otd-sw" style="background:' + (r.y === Y ? CUR : PREV) + '"></span><b>' + r.y + '</b>' +
        '<span>' + fmt(r.vol) + ' btls</span><span class="otd-muted">YTD ' + MONTHS[sel.getMonth()] + ': ' + fmt(r.vol_ytd) + '</span></div>';
    }).join('');

    var prin = d.by_principle || [], total = prin.reduce(function (s, x) { return s + Number(x.vol); }, 0);
    var top = prin.slice(0, 8), rest = prin.slice(8).reduce(function (s, x) { return s + Number(x.vol); }, 0);
    if (rest > 0) top = top.concat([{ name: 'Other', vol: rest }]);
    var pOpts = barOpts(true, ' btls');
    pOpts.plugins.tooltip.callbacks.label = function (c) { return fmt(c.parsed.x) + ' btls (' + (total ? (c.parsed.x / total * 100).toFixed(1) : 0) + '%)'; };
    draw('otdPrinChart', { type: 'bar', data: {
      labels: top.map(function (x) { return x.name + '  ' + (total ? (x.vol / total * 100).toFixed(1) : 0) + '%'; }),
      datasets: [{ data: top.map(function (x) { return x.vol; }), backgroundColor: CUR, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] }, options: pOpts });

    var br = d.by_brand || [];
    draw('otdBrandChart', { type: 'bar', data: { labels: br.map(function (x) { return x.name; }),
      datasets: [{ data: br.map(function (x) { return x.vol; }), backgroundColor: CUR, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] }, options: barOpts(true, ' btls') });

    var chg = function (a, b) { var v = pct(a, b); return v == null ? '—' : (v >= 0 ? '▲ +' : '▼ ') + v.toFixed(1) + '%'; };
    $('otdProdTitle').textContent = 'By Product: ' + MONTHS[sel.getMonth()] + ' ' + Y + ' vs ' + MONTHS[sel.getMonth()] + ' ' + PY + ' (top 20 by volume)';
    $('otdProdTbl').innerHTML = '<thead><tr><th>Product</th><th>Vol ' + Y + '</th><th>Vol ' + PY + '</th><th>Change</th><th>Value ' + Y + ' (THB)</th><th>Value ' + PY + ' (THB)</th><th>Change</th></tr></thead><tbody>' +
      (d.by_product || []).map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td>' + fmt(p.vol) + '</td><td>' + fmt(p.vol_py) + '</td><td>' + chg(p.vol, p.vol_py) +
          '</td><td>' + fmt(p.val) + '</td><td>' + fmt(p.val_py) + '</td><td>' + chg(p.val, p.val_py) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function start() { if (window.Chart) init(); else setTimeout(start, 100); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
