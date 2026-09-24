/* Contract Master dashboard (contracts.html, default view).
   Summary of both contract types from one RPC: contract_dashboard() (counts distinct contracts,
   Active = "Active/Inactive" column). Chart colors: Yearly #B0120A, Marketing #F36C60 (same validated
   pair as the Off-take charts); values are also shown as text / tooltips. Summary cards: Yearly orange,
   Marketing yellow (css/ssp-type.css). Map: Leaflet + Esri light gray tiles, points by PROVINCE name.
   Needs: supabase (js/config.js), Chart.js 4, Leaflet 1.9. */
window.ContractDashboard = (function () {
  var YEARLY = '#B0120A', MKT = '#F36C60', INK = '#111111', MUTED = '#666666', GRID = '#EEEEEE';
  /* chart colors follow the color theme (js/theme.js); map pins stay red */
  var themed = function () { if (window.themeColor) { YEARLY = themeColor('--c1', '#B0120A'); MKT = themeColor('--c2', '#F36C60'); } };
  var lastBox = null;
  window.addEventListener('themechange', function () { if (lastBox && !lastBox.hidden) { lastBox.dataset.ready = ''; load(lastBox); } });
  var charts = {}, map = null, mapLayer = null;

  /* ── locations: "PROVINCE" text as written in the files → map point.
        Islands / resort towns get their own point (Koh Samui, Pattaya, Hua Hin …). ── */
  var PLACES = {
    bangkok: ['Bangkok', 13.7563, 100.5018], nonthaburi: ['Nonthaburi', 13.8621, 100.5144], samutprakan: ['Samut Prakan', 13.5991, 100.5998],
    chiangmai: ['Chiang Mai', 18.7883, 98.9853], chiangrai: ['Chiang Rai', 19.9105, 99.8406], lampang: ['Lampang', 18.2888, 99.4909],
    phrae: ['Phrae', 18.1446, 100.1403], phitsanulok: ['Phitsanulok', 16.8211, 100.2659], phetchabun: ['Phetchabun', 16.419, 101.1591],
    tak: ['Tak', 16.884, 99.1258], lopburi: ['Lopburi', 14.7995, 100.6534], khaoyai: ['Khao Yai', 14.439, 101.372],
    nakhonratchasima: ['Nakhon Ratchasima', 14.9799, 102.0977], khonkaen: ['Khon Kaen', 16.4419, 102.836], udonthani: ['Udon Thani', 17.4138, 102.787],
    ubonratchathani: ['Ubon Ratchathani', 15.2448, 104.8473], chaiyaphum: ['Chaiyaphum', 15.8068, 102.0317], prachinburi: ['Prachin Buri', 14.0509, 101.3727],
    chonburi: ['Chonburi', 13.3611, 100.9847], pattaya: ['Pattaya', 12.9236, 100.8825], rayong: ['Rayong', 12.6814, 101.2816],
    chanthaburi: ['Chanthaburi', 12.6114, 102.1039], trat: ['Trat', 12.2436, 102.5151], phetchaburi: ['Phetchaburi', 13.1119, 99.9398],
    prachuapkhirikhan: ['Prachuap Khiri Khan', 11.8124, 99.7973], huahin: ['Hua Hin', 12.5684, 99.9577], chumphon: ['Chumphon', 10.493, 99.18],
    suratthani: ['Surat Thani', 9.1382, 99.3215], samui: ['Koh Samui', 9.512, 100.0136], phangan: ['Koh Phangan', 9.7378, 100.0217],
    kohtao: ['Koh Tao', 10.0956, 99.8404], phuket: ['Phuket', 7.8804, 98.3923], krabi: ['Krabi', 8.0863, 98.9063],
    phangnga: ['Phang Nga', 8.4509, 98.5255], nakhonsithammarat: ['Nakhon Si Thammarat', 8.4304, 99.9631], trang: ['Trang', 7.5594, 99.6114],
    songkhla: ['Songkhla', 7.1898, 100.5951], hatyai: ['Hat Yai', 7.0086, 100.4747], satun: ['Satun', 6.6238, 100.0674],
  };
  var ALIAS = { lumpang: 'lampang', korat: 'nakhonratchasima', chonburi: 'chonburi', surat: 'suratthani', phanga: 'phangnga',
    phetchauri: 'phetchaburi', petchaburi: 'phetchaburi', nakornsritamarath: 'nakhonsithammarat', satul: 'satun', songkla: 'songkhla' };
  function place(name) {
    var k = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (/samui/.test(k)) k = 'samui';
    else if (/phangan/.test(k)) k = 'phangan';
    else if (/tao$|kohtao/.test(k)) k = 'kohtao';
    else if (/huahin/.test(k)) k = 'huahin';
    else if (/pattaya/.test(k)) k = 'pattaya';
    else if (/hadyai|hatyai/.test(k)) k = 'hatyai';
    else if (/^suratthani/.test(k)) k = 'suratthani';
    k = ALIAS[k] || k;
    return PLACES[k] ? { key: k, label: PLACES[k][0], lat: PLACES[k][1], lng: PLACES[k][2] } : null;
  }
  function drawMap(list) {
    if (!window.L) { $('ctdMap').textContent = 'Map could not load (no internet connection?)'; return; }
    var pts = {}, unmapped = [];
    list.forEach(function (x) {
      var p = place(x.name);
      if (!p) { unmapped.push(x); return; }
      var o = pts[p.key] || (pts[p.key] = { p: p, yearly: 0, marketing: 0, outlets: 0, names: [] });
      o.yearly += x.yearly; o.marketing += x.marketing; o.outlets += x.outlets; o.names.push(x.name);
    });
    if (!map) {
      map = L.map('ctdMap', { scrollWheelZoom: false, zoomSnap: 0.25 }).setView([13.2, 100.9], 5.25);
      /* Esri light gray canvas: free, no API key (attribution required) */
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 12, attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
      }).addTo(map);
    }
    if (mapLayer) mapLayer.remove();
    mapLayer = L.layerGroup().addTo(map);
    var arr = Object.keys(pts).map(function (k) { return pts[k]; }).sort(function (a, b) { return (b.yearly + b.marketing) - (a.yearly + a.marketing); });
    var max = Math.max.apply(null, arr.map(function (o) { return o.yearly + o.marketing; }).concat([1]));
    arr.forEach(function (o) {
      var tot = o.yearly + o.marketing;
      /* red location pin; bigger pin = more active contracts */
      const h = Math.round(26 + 22 * Math.sqrt(tot / max)), w = Math.round(h * 0.75);
      L.marker([o.p.lat, o.p.lng], { title: o.p.label, riseOnHover: true, icon: L.divIcon({
        className: 'ctd-pin', iconSize: [w, h], iconAnchor: [w / 2, h], tooltipAnchor: [0, -h + 4],
        html: '<svg viewBox="0 0 24 32" width="' + w + '" height="' + h + '" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z" fill="#D7191C" stroke="#FFFFFF" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4.6" fill="#FFFFFF"/></svg>',
      }) }).bindTooltip('<b>' + esc(o.p.label) + '</b><br>' + fmt(tot) + ' active contracts<br>Yearly ' + fmt(o.yearly) +
        ' · Marketing ' + fmt(o.marketing) + '<br>' + fmt(o.outlets) + ' outlets', { direction: 'top' }).addTo(mapLayer);
    });
    if (arr.length) map.fitBounds(arr.map(function (o) { return [o.p.lat, o.p.lng]; }), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 44], maxZoom: 7 });
    setTimeout(function () { map.invalidateSize(); }, 50);
    $('ctdUnmapped').textContent = unmapped.length
      ? 'Not on the map (unknown location name): ' + unmapped.map(function (x) { return x.name + ' (' + (x.yearly + x.marketing) + ')'; }).join(', ')
      : '';
  }
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('en-US'); };

  function skeleton(box) {
    if (map) { map.remove(); map = null; mapLayer = null; }   /* rebuilt (e.g. theme change) → new map */
    box.innerHTML =
      '<div class="ctd-kpis">' +
      kpiCard('yearly', 'Yearly Contract') + kpiCard('marketing', 'Marketing Contract') +
      '</div>' +
      '<div class="otd-grid">' +
      '  <section class="card otd-card"><h3 class="card-title">Active Contracts by Team</h3>' +
      '    <div class="ctd-legend">' + legend() + '</div><div class="otd-chart"><canvas id="ctdTeam" aria-label="Active contracts by team"></canvas></div></section>' +
      '  <section class="card otd-card ctd-map-card"><h3 class="card-title">Active Contracts by Location</h3>' +
      '    <div class="ctd-legend"><span>Pin size = active contracts · hover or tap a pin for details</span></div>' +
      '    <div id="ctdMap" class="ctd-map" role="img" aria-label="Map of Thailand with contract locations"></div>' +
      '    <div class="ctd-unmapped" id="ctdUnmapped"></div></section>' +
      '  <section class="card otd-card"><h3 class="card-title">Marketing Active Contracts by Principle</h3>' +
      '    <div class="otd-chart"><canvas id="ctdPrin" aria-label="Active marketing contracts by principle"></canvas></div></section>' +
      '  <section class="card otd-card"><h3 class="card-title">Yearly — Active Contracts by Type</h3>' +
      '    <div class="ctd-two"><div class="otd-tablewrap"><table class="otd-prod" id="ctdYcType"></table></div>' +
      '    <div class="otd-tablewrap"><table class="otd-prod" id="ctdYcCt"></table></div></div></section>' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title">Marketing — Top 10 Active Promotions</h3>' +
      '    <div class="otd-tablewrap"><table class="otd-prod" id="ctdPromo"></table></div></section>' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title" id="ctdExpTitle">Expiring in the Next 90 Days</h3>' +
      '    <div class="otd-tablewrap ctd-exp-wrap"><table class="otd-prod" id="ctdExp"></table></div></section>' +
      '</div>';
  }
  function kpiCard(kind, title) {
    return '<div class="kpi-card ctd-kpi ' + kind + '">' +
      '<div class="ctd-kpi-head"><div class="kpi-label">' + title + '</div>' +
      '<a class="ctd-open" href="#' + kind + '">Open raw data</a></div>' +
      '<div class="ctd-nums">' +
      num(kind, 'active_contracts', 'Active contracts') + num(kind, 'active_outlets', 'Active outlets') +
      num(kind, 'expiring_90', 'Expiring in 90 days') + num(kind, 'contracts', 'All contracts') +
      '</div></div>';
  }
  function num(kind, key, label) {
    return '<div><div class="kpi-value" id="ctd_' + kind + '_' + key + '">—</div><div class="ctd-sub">' + label + '</div></div>';
  }
  function legend() {
    return '<span><i style="background:' + YEARLY + '"></i>Yearly</span><span><i style="background:' + MKT + '"></i>Marketing</span>';
  }

  function draw(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }
  function barOpts(horizontal) {
    var val = { beginAtZero: true, grid: { color: GRID }, border: { display: false }, ticks: { color: MUTED, precision: 0 } };
    var cat = { grid: { display: false }, border: { display: false }, ticks: { color: INK, autoSkip: false } };
    return {
      responsive: true, maintainAspectRatio: false, indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + (c.dataset.label || '') + ': ' + fmt(c.parsed[horizontal ? 'x' : 'y']) + ' contracts'; } } } },
      scales: horizontal ? { x: val, y: cat } : { x: cat, y: val },
    };
  }
  function pair(list, horizontal) {
    return {
      type: 'bar',
      data: { labels: list.map(function (x) { return x.name; }), datasets: [
        { label: 'Yearly', data: list.map(function (x) { return x.yearly; }), backgroundColor: YEARLY, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
        { label: 'Marketing', data: list.map(function (x) { return x.marketing; }), backgroundColor: MKT, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
      ] },
      options: barOpts(horizontal),
    };
  }
  function table(id, head, rows) {
    $(id).innerHTML = '<thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>'; }).join('')
                   : '<tr><td colspan="' + head.length + '" class="ctd-empty">No active contracts</td></tr>') + '</tbody>';
  }

  async function load(box) {
    themed(); lastBox = box;
    if (!box.dataset.ready) { skeleton(box); box.dataset.ready = '1'; }
    box.classList.add('ctd-loading');
    var r = await supabase.rpc('contract_dashboard');
    box.classList.remove('ctd-loading');
    if (r.error) { box.insertAdjacentHTML('afterbegin', '<div class="oti-warn">Dashboard failed: ' + esc(r.error.message) + '</div>'); return; }
    var d = r.data || {}, k = d.kpi || {};
    ['yearly', 'marketing'].forEach(function (kind) {
      ['active_contracts', 'active_outlets', 'expiring_90', 'contracts'].forEach(function (key) {
        $('ctd_' + kind + '_' + key).textContent = fmt((k[kind] || {})[key]);
      });
    });
    draw('ctdTeam', pair((d.by_team || []).filter(function (x) { return x.name !== '(blank)'; }), true));
    drawMap(d.by_location || []);
    var pr = (d.mkt_principle || []).slice(0, 10);
    /* bars: dark grey gradient (lighter at the base → dark at the end); principle names in the theme red */
    var greyBar = function (ctx) {
      var a = ctx.chart.chartArea; if (!a) return '#374151';
      var g = ctx.chart.ctx.createLinearGradient(a.left, 0, a.right, 0);
      g.addColorStop(0, '#6B7280'); g.addColorStop(1, '#1F2328'); return g;
    };
    var prOpts = barOpts(true);
    prOpts.scales.y = Object.assign({}, prOpts.scales.y, { ticks: { color: window.themeColor ? themeColor('--c1', '#B0120A') : '#B0120A', autoSkip: false, font: { weight: '600' } } });
    draw('ctdPrin', { type: 'bar',
      data: { labels: pr.map(function (x) { return x.name; }), datasets: [{ label: 'Marketing', data: pr.map(function (x) { return x.contracts; }), backgroundColor: greyBar, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] },
      options: prOpts });
    table('ctdYcType', ['Type', 'Contracts'], (d.yc_types || []).map(function (x) { return [esc(x.name), fmt(x.contracts)]; }));
    table('ctdYcCt', ['Contract Type', 'Contracts'], (d.yc_contract_types || []).map(function (x) { return [esc(x.name), fmt(x.contracts)]; }));
    table('ctdPromo', ['Promotion', 'Active contracts', 'Outlets'], (d.mkt_promotions || []).map(function (x) { return [esc(x.name), fmt(x.contracts), fmt(x.outlets)]; }));
    var ex = d.expiring || [];
    $('ctdExpTitle').textContent = 'Expiring in the Next 90 Days (' + fmt(ex.length) + ')';
    table('ctdExp', ['End Date', 'Contract', 'Outlet', 'Outlet Code', 'Promotion / Contract Type', 'Current BDE'], ex.map(function (x) {
      var days = Math.round((new Date(x.d_end) - new Date(d.today)) / 86400000);
      return [esc(x.end_text) + ' <span class="ctd-days' + (days <= 30 ? ' soon' : '') + '">' + days + ' days</span>',
        '<span class="ctd-tag ' + x.kind + '">' + (x.kind === 'yearly' ? 'Yearly' : 'Marketing') + '</span>',
        esc(x.outlet_name), esc(x.outlet), esc(x.detail), esc(x.bde)];
    }));
  }
  return { load: load };
})();
