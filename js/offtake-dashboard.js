/* Off-take Analytics dashboard (Off-take page).
   All totals are computed in Supabase (offtake_options / offtake_dashboard RPCs),
   so the page never downloads the ~75k raw rows.
   Colors: previous year light yellow #F8D77A fading to cream #FFF3D6 (bars) / #D99500 (line), selected year #B0120A; the light
   colors are under 3:1 on white, so values are also shown as text / in tables and tooltips. */
(function () {
  var PREV = '#F8D77A', CUR = window.themeColor ? themeColor('--c1', '#B0120A') : '#B0120A', PREV_LINE = '#D99500',   /* CUR follows the color theme */
        /* previous year: light yellow bars (user choice; lighter than the validator band, so totals are shown as text) / yellow line */
      INK = '#111111', MUTED = '#666666', GRID = '#EEEEEE';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var opts = null, charts = {}, seq = 0;
  /* categorical palette (validated reference order) — fixed per principle name, never by rank */
  var CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'], OTHER = '#9E9E9E', colorMap = {};
  var colorOf = function (name) {
    if (name === 'Other') return OTHER;
    if (!colorMap[name]) { var used = Object.keys(colorMap).length; colorMap[name] = used < CAT.length ? CAT[used] : OTHER; }
    return colorMap[name];
  };
  /* neon two-tone gradients for the 3D ring (infographic style), same fixed slot per principle */
  var NEON = [['#FFD23F', '#FF3D7F'], ['#9D4DFF', '#FF4FD8'], ['#3EE6FF', '#2F6BFF'], ['#B8FF5C', '#12C7B0'],
              ['#FF9A3C', '#FF4E4E'], ['#FF7AD9', '#8A5CFF'], ['#5CFFB4', '#3A8DFF']], NEON_OTHER = ['#C9C3E6', '#7D74A8'];
  var neonOf = function (name) { var i = CAT.indexOf(colorOf(name)); return i >= 0 ? NEON[i] : NEON_OTHER; };
  var neonCss = function (name) { var p = neonOf(name); return 'linear-gradient(135deg,' + p[0] + ',' + p[1] + ')'; };
  var $ = function (id) { return document.getElementById(id); };

  /* ── 3D pie: tilted ellipse, side walls, per-slice gradients, soft shadow, hover lift + tooltip ── */
  var mix = function (hex, to, t) {   /* blend a hex color toward white (to=255) or black (to=0) */
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(c + (to - c) * t); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  };
  var pie3d = {
    items: [], hidden: {}, hover: -1, share: null, geo: null,
    set: function (items, share) { this.items = items; this.hidden = {}; this.hover = -1; this.share = share; this.bind(); this.draw(); },
    toggle: function (i) { this.hidden[i] = !this.hidden[i]; this.draw(); return !this.hidden[i]; },
    bind: function () {
      var cv = $('otdPrinChart'), self = this;
      if (!cv || cv.dataset.bound) return;
      cv.dataset.bound = '1';
      var tip = document.createElement('div'); tip.className = 'otd-pie-tip'; tip.hidden = true; cv.parentElement.appendChild(tip);
      cv.addEventListener('mousemove', function (e) {
        var r = cv.getBoundingClientRect(), i = self.hit(e.clientX - r.left, e.clientY - r.top);
        if (i !== self.hover) { self.hover = i; self.draw(); }
        if (i < 0) { tip.hidden = true; cv.style.cursor = ''; return; }
        var it = self.items[i]; cv.style.cursor = 'pointer';
        tip.innerHTML = '<span class="otd-dot" style="background:' + neonCss(it.name) + '"></span><b>' + esc(it.name) + '</b><br>' +
          fmt(it.vol) + ' btls · ' + self.share(it.vol) + '%';
        tip.hidden = false;
        tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 170) + 'px';
        tip.style.top = (e.clientY - r.top + 14) + 'px';
      });
      cv.addEventListener('mouseleave', function () { self.hover = -1; tip.hidden = true; self.draw(); });
      if (window.ResizeObserver) new ResizeObserver(function () { self.draw(); }).observe(cv.parentElement);
    },
    slices: function () {
      var vis = this.items.map(function (it, i) { return { it: it, i: i }; }).filter(function (s) { return !this.hidden[s.i] && s.it.vol > 0; }, this);
      var tot = vis.reduce(function (s, x) { return s + x.it.vol; }, 0), a = -Math.PI / 2;
      return vis.map(function (s) { var a0 = a, a1 = a + (tot ? s.it.vol / tot : 0) * Math.PI * 2; a = a1; return { i: s.i, it: s.it, a0: a0, a1: a1 }; });
    },
    hit: function (x, y) {
      var g = this.geo; if (!g) return -1;
      var dx = (x - g.cx) / g.rx, dy = (y - g.cy) / g.ry;
      var rr = dx * dx + dy * dy; if (rr > 1 || rr < (g.hole || 0) * (g.hole || 0)) return -1;
      var ang = Math.atan2(dy, dx); if (ang < -Math.PI / 2) ang += Math.PI * 2;
      var s = this.slices().filter(function (s) { return ang >= s.a0 && ang < s.a1; })[0];
      return s ? s.i : -1;
    },
    draw: function () {
      /* neon 3D ring (infographic style): thick isometric doughnut, two-tone gradient per slice,
         inner wall of the hole, glow on a dark card */
      var cv = $('otdPrinChart'); if (!cv) return;
      var box = cv.parentElement, W = box.clientWidth, H = box.clientHeight, dpr = window.devicePixelRatio || 1;
      if (!W || !H) return;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      var TILT = 0.55, DEPTH = 0.34, HOLE = 0.42;
      var rx = Math.min(W * 0.46, (H - 30) / (2 * TILT + DEPTH)), ry = rx * TILT, depth = rx * DEPTH;
      var cx = W / 2, cy = (H - depth) / 2, irx = rx * HOLE, iry = ry * HOLE;
      this.geo = { cx: cx, cy: cy, rx: rx, ry: ry, hole: HOLE };
      var sl = this.slices(), self = this;
      var lift = function (s) { return s.i === self.hover ? 10 : 0; };
      var off = function (s) { var m = (s.a0 + s.a1) / 2, d = lift(s); return { x: Math.cos(m) * d, y: Math.sin(m) * d * TILT - d * 0.35 }; };
      var pair = function (s) { return neonOf(s.it.name); };
      var grad = function (x0, y0, x1, y1, p, dark) {
        var g = c.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, dark ? mix(p[0], 0, dark) : p[0]); g.addColorStop(1, dark ? mix(p[1], 0, dark) : p[1]); return g;
      };
      /* wall between two ellipses (outer or inner) for angles b0..b1 */
      var wall = function (x, y, ax, ay, b0, b1, fill) {
        c.beginPath();
        c.ellipse(x, y, ax, ay, 0, b0, b1);
        c.lineTo(x + Math.cos(b1) * ax, y + Math.sin(b1) * ay + depth);
        c.ellipse(x, y + depth, ax, ay, 0, b1, b0, true);
        c.closePath(); c.fillStyle = fill; c.fill();
      };

      /* glow under the ring */
      c.save(); c.filter = 'blur(28px)';
      var glow = c.createRadialGradient(cx, cy + depth, 0, cx, cy + depth, rx * 1.1);
      glow.addColorStop(0, 'rgba(130, 90, 255, 0.55)'); glow.addColorStop(1, 'rgba(130, 90, 255, 0)');
      c.fillStyle = glow; c.beginPath(); c.ellipse(cx, cy + depth * 0.9, rx * 1.05, ry * 1.1, 0, 0, Math.PI * 2); c.fill(); c.restore();

      /* 1) inner wall of the hole: its back half (π..2π) is visible through the hole */
      c.save(); c.beginPath(); c.ellipse(cx, cy, irx, iry, 0, 0, Math.PI * 2); c.clip();
      c.fillStyle = '#1A1133'; c.fillRect(cx - irx, cy - iry, irx * 2, iry * 2 + depth);
      sl.forEach(function (s) {
        var o = off(s), p = pair(s);
        [[s.a0, s.a1], [s.a0 + Math.PI * 2, s.a1 + Math.PI * 2]].forEach(function (r) {
          var b0 = Math.max(r[0], Math.PI), b1 = Math.min(r[1], Math.PI * 2); if (b1 <= b0) return;
          wall(cx + o.x, cy + o.y, irx, iry, b0, b1, grad(cx - irx, 0, cx + irx, 0, p, 0.45));
        });
      });
      c.restore();

      /* 2) outer wall: front half (0..π) */
      sl.forEach(function (s) {
        var o = off(s), p = pair(s);
        [[s.a0, s.a1], [s.a0 + Math.PI * 2, s.a1 + Math.PI * 2]].forEach(function (r) {
          var b0 = Math.max(r[0], 0), b1 = Math.min(r[1], Math.PI); if (b1 <= b0) return;
          wall(cx + o.x, cy + o.y, rx, ry, b0, b1, grad(cx - rx, cy, cx + rx, cy + depth, p, 0.22));
        });
      });

      /* 3) tops: annular sectors with a diagonal two-tone gradient + soft glow */
      sl.forEach(function (s) {
        var o = off(s), x = cx + o.x, y = cy + o.y, p = pair(s);
        c.save();
        c.shadowColor = p[1]; c.shadowBlur = s.i === self.hover ? 26 : 14;
        c.beginPath();
        c.ellipse(x, y, rx, ry, 0, s.a0, s.a1);
        c.ellipse(x, y, irx, iry, 0, s.a1, s.a0, true);
        c.closePath();
        c.fillStyle = grad(x - rx, y - ry, x + rx, y + ry, p); c.fill();
        c.restore();
        c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
      });

      /* top sheen */
      c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.ellipse(cx, cy, irx, iry, 0, Math.PI * 2, 0, true); c.clip('evenodd');
      var sh = c.createLinearGradient(0, cy - ry, 0, cy + ry);
      sh.addColorStop(0, 'rgba(255,255,255,0.30)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
      c.fillStyle = sh; c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2); c.restore();

      /* % labels on slices ≥ 9% (smaller ones: legend + tooltip) */
      c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 14px Kanit, sans-serif';
      sl.forEach(function (s) {
        var frac = (s.a1 - s.a0) / (Math.PI * 2); if (frac < 0.09) return;
        var m = (s.a0 + s.a1) / 2, o = off(s), rr = (1 + HOLE) / 2;
        c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 6; c.fillStyle = '#FFFFFF';
        c.fillText((frac * 100).toFixed(1) + '%', cx + o.x + Math.cos(m) * rx * rr, cy + o.y + Math.sin(m) * ry * rr);
      });
      c.restore();
    },
  };
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
    /* KPI change badge: light green up, light red down, light yellow no data (arrow + sign too) */
    if (v == null || !isFinite(v)) return '<span class="otd-chg flat">— no data</span>';
    var up = v >= 0;
    return '<span class="otd-chg ' + (up ? 'up' : 'down') + '">' + (up ? '▲ +' : '▼ ') + v.toFixed(2) + '%</span>';
  };
  var monthLabel = function (iso) { var d = new Date(iso + 'T00:00:00'); return MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear(); };

  function shell() {
    var host = $('otDashboard'); if (!host) return false;
    host.innerHTML =
      '<div class="otd-filters" role="group" aria-label="Dashboard filters">' +
      '  <div class="otd-f otd-company"><span class="otd-lbl">Company</span><div id="otdCompanies" class="otd-chips"></div></div>' +
      '  <div class="otd-f otd-mp"><span class="otd-lbl">Year, Month</span>' +
      '    <button type="button" id="otdMpBtn" class="otd-mp-btn" aria-haspopup="true" aria-expanded="false">—</button>' +
      '    <div id="otdMpPanel" class="otd-mp-panel" hidden></div></div>' +
      '  <label class="otd-f"><span class="otd-lbl">Principle</span><select id="otdPrinciple"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Brand</span><select id="otdBrand"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Wholesaler</span><select id="otdWholesaler"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">Team</span><select id="otdTeam"><option value="">All</option></select></label>' +
      '  <label class="otd-f"><span class="otd-lbl">BDE</span><select id="otdBde"><option value="">All</option></select></label>' +
      '  <button class="otd-reset" id="otdReset" type="button">Reset</button>' +
      '</div>' +
      '<h2 class="otd-title" id="otdTitle">Off-Take Dashboard</h2>' +
      '<div class="otd-kpis">' +
      '  <div class="kpi-card otd-kpi"><div class="kpi-label">Selling by Bottle as of the month</div>' +
      '    <div class="kpi-value" id="otdVol">—</div><div class="otd-chgrow"><span class="otd-k otd-k-mom">MoM</span><span id="otdVolMom"></span><span class="otd-k">YoY</span><span id="otdVolYoy"></span></div></div>' +
      '  <div class="kpi-card otd-kpi"><div class="kpi-label">Value Inc.VAT(THB) as of the month</div>' +
      '    <div class="kpi-value" id="otdVal">—</div><div class="otd-chgrow"><span class="otd-k otd-k-mom">MoM</span><span id="otdValMom"></span><span class="otd-k">YoY</span><span id="otdValYoy"></span></div></div>' +
      '</div>' +
      '<div class="otd-grid">' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title" id="otdVolTitle">Off-Take Volume (Btls)</h3>' +
      '    <div class="otd-years" id="otdYearTbl"></div><div class="otd-chart"><canvas id="otdVolChart" aria-label="Off-take volume by month"></canvas></div></section>' +
      '  <section class="card otd-card otd-neon"><h3 class="card-title">Off-Take Volume (Btls) by Principle</h3>' +
      '    <div class="otd-pie"><div class="otd-chart otd-pie-canvas"><canvas id="otdPrinChart" aria-label="Volume by principle"></canvas></div><ul class="otd-legend" id="otdPrinLegend"></ul></div></section>' +
      '  <section class="card otd-card"><h3 class="card-title">Top 10 Brands — Volume (Btls)</h3>' +
      '    <div class="otd-chart otd-tall"><canvas id="otdBrandChart" aria-label="Top 10 brands by volume"></canvas></div></section>' +
      '  <section class="card otd-card otd-wide" id="otdBoCard" hidden><h3 class="card-title" id="otdBoTitle">Outlets buying this brand</h3>' +
      '    <div class="otd-years" id="otdBoSum"></div><div class="otd-tablewrap otd-bo-wrap"><table class="otd-prod" id="otdBoTbl"></table></div></section>' +
      '  <section class="card otd-card otd-wide"><h3 class="card-title" id="otdValTitle">Off-Take Value Inc.VAT (THB)</h3>' +
      '    <div class="otd-years" id="otdValYears"></div><div class="otd-chart"><canvas id="otdValChart" aria-label="Off-take value by month"></canvas></div></section>' +
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
  /* ── Year, Month picker: tick any months under each year (like a Power BI slicer) ── */
  var picked = [], mpTimer = null;
  var one = function (iso, short) { return MONTHS[+iso.slice(5, 7) - 1] + ' ' + (short ? iso.slice(2, 4) : iso.slice(0, 4)); };
  var monthIdx = function (iso) { return +iso.slice(0, 4) * 12 + +iso.slice(5, 7) - 1; };
  /* "Aug 2026", "Dec 2025 – Feb 2026" (consecutive) or "Jan 2026, Mar 2026" / "5 months" */
  var period = function (list, short) {
    list = (list || []).slice().sort(); if (!list.length) return '—';
    if (list.length === 1) return one(list[0], short);
    var consecutive = list.every(function (m, i) { return !i || monthIdx(m) - monthIdx(list[i - 1]) === 1; });
    if (consecutive) return one(list[0], short) + ' – ' + one(list[list.length - 1], short);
    return list.length <= 3 ? list.map(function (m) { return one(m, short); }).join(', ') : list.length + ' months';
  };
  var shiftYear = function (iso, n) { return (+iso.slice(0, 4) + n) + iso.slice(4); };
  function mpRender() {
    var byYear = {};
    (opts.months || []).forEach(function (m) { (byYear[m.slice(0, 4)] = byYear[m.slice(0, 4)] || []).push(m); });
    var years = Object.keys(byYear).sort().reverse(), latestYear = years[0];
    $('otdMpPanel').innerHTML =
      '<div class="otd-mp-tools"><button type="button" data-act="latest">Latest month</button>' +
      '<button type="button" data-act="ytd">This year</button><button type="button" data-act="done" class="otd-mp-done">Done</button></div>' +
      years.map(function (y) {
        var ms = byYear[y].slice().sort(), all = ms.every(function (m) { return picked.indexOf(m) >= 0; });
        var some = ms.some(function (m) { return picked.indexOf(m) >= 0; });
        var open = some || y === latestYear;
        return '<div class="otd-mp-year' + (open ? ' open' : '') + '">' +
          '<div class="otd-mp-yhead"><button type="button" class="otd-mp-tog" data-year="' + y + '" aria-label="Show months of ' + y + '">' + (open ? '▾' : '▸') + '</button>' +
          '<label><input type="checkbox" data-yall="' + y + '"' + (all ? ' checked' : '') + '> <b>' + y + '</b></label>' +
          (some && !all ? '<span class="otd-mp-cnt">' + ms.filter(function (m) { return picked.indexOf(m) >= 0; }).length + ' selected</span>' : '') + '</div>' +
          '<div class="otd-mp-months">' + ms.map(function (m) {
            return '<label class="otd-mp-m"><input type="checkbox" data-m="' + m + '"' + (picked.indexOf(m) >= 0 ? ' checked' : '') + '> ' + MONTHS[+m.slice(5, 7) - 1] + '</label>';
          }).join('') + '</div></div>';
      }).join('');
    [].forEach.call(document.querySelectorAll('input[data-yall]'), function (el) {
      var ms = byYear[el.dataset.yall]; el.indeterminate = !el.checked && ms.some(function (m) { return picked.indexOf(m) >= 0; });
    });
    $('otdMpBtn').textContent = period(picked);
  }
  function mpChanged() {
    mpRender();
    clearTimeout(mpTimer);
    if (picked.length) mpTimer = setTimeout(load, 400);
  }
  function mpSetup() {
    var btn = $('otdMpBtn'), panel = $('otdMpPanel');
    picked = (opts.months || []).length ? [opts.months[0]] : [];   /* latest month */
    mpRender();
    btn.onclick = function () { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', !panel.hidden); };
    document.addEventListener('click', function (e) { if (!panel.hidden && !e.target.closest('.otd-mp')) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    panel.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.year) { t.closest('.otd-mp-year').classList.toggle('open'); t.textContent = t.closest('.otd-mp-year').classList.contains('open') ? '▾' : '▸'; return; }
      if (t.dataset.act === 'latest') { picked = [opts.months[0]]; mpChanged(); }
      if (t.dataset.act === 'ytd') { var y = opts.months[0].slice(0, 4); picked = opts.months.filter(function (m) { return m.slice(0, 4) === y; }); mpChanged(); }
      if (t.dataset.act === 'done') { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    panel.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.m) {
        if (t.checked) picked.push(t.dataset.m); else picked = picked.filter(function (m) { return m !== t.dataset.m; });
      } else if (t.dataset.yall) {
        var ms = opts.months.filter(function (m) { return m.slice(0, 4) === t.dataset.yall; });
        picked = picked.filter(function (m) { return ms.indexOf(m) < 0; });
        if (t.checked) picked = picked.concat(ms);
      }
      if (!picked.length) { $('otdMpBtn').textContent = 'Select at least one month'; mpRender(); $('otdMpBtn').textContent = 'Select at least one month'; return; }
      mpChanged();
    });
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
    mpSetup();   /* Year, Month picker — latest month selected by default */
    $('otdCompanies').innerHTML = (opts.companies || []).map(function (c) {
      return '<label class="otd-chip"><input type="checkbox" value="' + esc(c) + '"> ' + esc(c) + '</label>';
    }).join('');
    fill($('otdPrinciple'), opts.principles || []);
    fill($('otdWholesaler'), opts.wholesalers || []);
    fill($('otdTeam'), opts.teams || []);
    refreshDependent();
    ['otdBrand', 'otdWholesaler', 'otdBde'].forEach(function (id) { $(id).onchange = load; });
    $('otdPrinciple').onchange = function () { refreshDependent(); load(); };
    $('otdTeam').onchange = function () { refreshDependent(); load(); };
    $('otdCompanies').onchange = load;
    $('otdReset').onclick = function () {
      ['otdPrinciple', 'otdBrand', 'otdWholesaler', 'otdTeam', 'otdBde'].forEach(function (id) { $(id).value = ''; });
      [].forEach.call($('otdCompanies').querySelectorAll('input'), function (i) { i.checked = false; });
      picked = [opts.months[0]]; mpRender(); refreshDependent(); load();
    };
    load();
  }

  async function load() {
    var my = ++seq, host = $('otDashboard');
    host.classList.add('search-busy');
    var companies = [].map.call($('otdCompanies').querySelectorAll('input:checked'), function (i) { return i.value; });
    var args = {
      p_months: picked.slice().sort(), p_companies: companies.length ? companies : null,
      p_principle: $('otdPrinciple').value || null, p_brand: $('otdBrand').value || null,
      p_wholesaler: $('otdWholesaler').value || null, p_team: $('otdTeam').value || null, p_bde: $('otdBde').value || null,
    };
    var boArgs = null;
    if (args.p_brand) boArgs = { p_months: args.p_months, p_brand: args.p_brand, p_companies: args.p_companies, p_principle: args.p_principle,
      p_wholesaler: args.p_wholesaler, p_team: args.p_team, p_bde: args.p_bde };
    var res = await Promise.all([supabase.rpc('offtake_dashboard', args), boArgs ? supabase.rpc('offtake_brand_outlets', boArgs) : null]);
    var r = res[0];
    if (my !== seq) return;
    host.classList.remove('search-busy');
    if (r.error) { $('otdTitle').textContent = 'Could not load dashboard: ' + r.error.message; return; }
    render(r.data || {});
    renderBrandOutlets(res[1]);
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
    /* MoM (label kept for any selection) = the same number of months just before the selection */
    var P = period(d.selected || [d.month]);
    $('otdTitle').textContent = 'Off-Take Dashboard : ' + P.toUpperCase();
    $('otdVol').textContent = short(k.vol_cur); $('otdVol').title = fmt(k.vol_cur) + ' bottles';
    $('otdVal').textContent = short(k.val_cur); $('otdVal').title = fmt(k.val_cur) + ' THB';
    $('otdVolMom').innerHTML = pctHtml(pct(k.vol_cur, k.vol_prev_m)); $('otdVolYoy').innerHTML = pctHtml(pct(k.vol_cur, k.vol_prev_y));
    $('otdValMom').innerHTML = pctHtml(pct(k.val_cur, k.val_prev_m)); $('otdValYoy').innerHTML = pctHtml(pct(k.val_cur, k.val_prev_y));

    var series = function (year, key) {
      var a = new Array(12).fill(null);
      (d.monthly || []).forEach(function (x) { if (x.y === year) a[x.m - 1] = Number(x[key]); });
      return a;
    };
    /* 2025 bars: light yellow at the top fading to egg-shell cream at the base */
    var prevGradient = function (ctx) {
      var a = ctx.chart.chartArea; if (!a) return PREV;
      var g = ctx.chart.ctx.createLinearGradient(0, a.bottom, 0, a.top);
      g.addColorStop(0, '#FFF3D6'); g.addColorStop(1, PREV); return g;
    };
    var ds = function (key) {
      return [
        { label: String(PY), data: series(PY, key), backgroundColor: key === 'vol' ? prevGradient : PREV, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
        { label: String(Y), data: series(Y, key), backgroundColor: CUR, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
      ];
    };
    $('otdVolTitle').textContent = 'Off-Take Volume (Btls) ' + PY + ' – ' + Y;
    $('otdValTitle').textContent = 'Off-Take Value Inc.VAT (THB) ' + PY + ' – ' + Y;
    draw('otdVolChart', { type: 'bar', data: { labels: MONTHS, datasets: ds('vol') }, options: barOpts(false, ' btls') });
    /* value: line chart, previous year yellow, selected year red; hover shows both years for a month */
    var line = function (label, data, color) {
      return { label: label, data: data, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.25,
        pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: color, pointBorderColor: '#FFFFFF', pointBorderWidth: 2, spanGaps: false };
    };
    var vOpts = barOpts(false, ' THB');
    vOpts.interaction = { mode: 'index', intersect: false };
    vOpts.plugins.legend.labels.pointStyle = 'circle';
    draw('otdValChart', { type: 'line', data: { labels: MONTHS, datasets: [
      line(String(PY), series(PY, 'val'), PREV_LINE), line(String(Y), series(Y, 'val'), CUR)] }, options: vOpts });

    var yt = d.year_totals || [];
    /* year totals as text (also the text alternative for the lighter bar color) */
    $('otdYearTbl').innerHTML = yt.map(function (r) {
      return '<div class="otd-year"><span class="otd-sw" style="background:' + (r.y === Y ? CUR : 'linear-gradient(180deg,' + PREV + ',#FFF3D6)') + '"></span><b>' + r.y + '</b>' +
        '<span>' + fmt(r.vol) + ' btls</span><span class="otd-muted">YTD ' + MONTHS[sel.getMonth()] + ': ' + fmt(r.vol_ytd) + '</span></div>';
    }).join('');

    $('otdValYears').innerHTML = yt.map(function (r) {
      return '<div class="otd-year"><span class="otd-sw" style="background:' + (r.y === Y ? CUR : PREV_LINE) + '"></span><b>' + r.y + '</b>' +
        '<span>' + short(r.val) + ' THB</span><span class="otd-muted">YTD ' + MONTHS[sel.getMonth()] + ': ' + short(r.val_ytd) + '</span></div>';
    }).join('');

    /* principle share: pie, top 7 + Other; each principle keeps its color across filters */
    var prin = d.by_principle || [], total = prin.reduce(function (s, x) { return s + Number(x.vol); }, 0);
    var top = prin.slice(0, 7), rest = prin.slice(7).reduce(function (s, x) { return s + Number(x.vol); }, 0);
    if (rest > 0) top = top.concat([{ name: 'Other', vol: rest }]);
    var share = function (v) { return total ? (v / total * 100).toFixed(1) : '0.0'; };
    /* 3D pie (custom canvas — Chart.js has no 3D), shaded slices; HTML legend with share bars */
    pie3d.set(top.map(function (x) { return { name: x.name, vol: Number(x.vol), color: colorOf(x.name) }; }), share);
    $('otdPrinLegend').innerHTML = top.map(function (x, i) {
      var col = neonCss(x.name);
      return '<li><button type="button" data-i="' + i + '" aria-pressed="true">' +
        '<span class="otd-dot" style="background:' + col + '"></span><span class="otd-lg-name" title="' + esc(x.name) + '">' + esc(x.name) + '</span>' +
        '<span class="otd-lg-val">' + fmt(x.vol) + '</span><span class="otd-lg-pct">' + share(x.vol) + '%</span>' +
        '<span class="otd-lg-bar"><i style="width:' + share(x.vol) + '%;background:' + col + '"></i></span></button></li>';
    }).join('');
    [].forEach.call($('otdPrinLegend').querySelectorAll('button'), function (b) {
      b.onclick = function () {
        var on = pie3d.toggle(+b.dataset.i);
        b.setAttribute('aria-pressed', on); b.classList.toggle('off', !on);
      };
    });

    var br = d.by_brand || [];
    draw('otdBrandChart', { type: 'bar', data: { labels: br.map(function (x) { return x.name; }),
      datasets: [{ data: br.map(function (x) { return x.vol; }), backgroundColor: CUR, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] },
      options: Object.assign(barOpts(true, ' btls'), {
        onClick: function (e, els) {   /* click a brand bar → filter by that brand (shows its outlets) */
          if (!els.length) return;
          var name = br[els[0].index].name, sel = $('otdBrand');
          if (![].some.call(sel.options, function (o) { return o.value === name; })) { $('otdPrinciple').value = ''; refreshDependent(); }
          sel.value = name; load();
          setTimeout(function () { var c = $('otdBoCard'); if (c && !c.hidden) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 900);
        },
        onHover: function (e, els) { e.native.target.style.cursor = els.length ? 'pointer' : ''; },
      }) });

    /* change badge: up = light green, down = light red, no change / no data = light yellow (arrow + sign too, not color alone) */
    var chg = function (a, b) {
      var v = pct(a, b);
      if (v == null || !isFinite(v)) return '<span class="otd-pill flat">— no data</span>';
      if (Math.abs(v) < 0.05) return '<span class="otd-pill flat">■ 0.0%</span>';
      return v > 0 ? '<span class="otd-pill up">▲ +' + v.toFixed(1) + '%</span>' : '<span class="otd-pill down">▼ ' + v.toFixed(1) + '%</span>';
    };
    $('otdProdTitle').textContent = 'By Product: ' + P + ' vs ' + period((d.selected || [d.month]).map(function (m) { return shiftYear(m, -1); })) + ' (top 20 by volume)';
    $('otdProdTbl').innerHTML = '<thead><tr><th>Product</th><th>Vol ' + Y + '</th><th>Vol ' + PY + '</th><th>Change</th><th>Value ' + Y + ' (THB)</th><th>Value ' + PY + ' (THB)</th><th>Change</th></tr></thead><tbody>' +
      (d.by_product || []).map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td>' + fmt(p.vol) + '</td><td>' + fmt(p.vol_py) + '</td><td>' + chg(p.vol, p.vol_py) +
          '</td><td>' + fmt(p.val) + '</td><td>' + fmt(p.val_py) + '</td><td>' + chg(p.val, p.val_py) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function renderBrandOutlets(res) {
    var card = $('otdBoCard'); if (!card) return;
    if (!res || res.error || !res.data) { card.hidden = true; return; }
    var d = res.data, rows = d.rows || [], m = new Date(d.month + 'T00:00:00'), mon = period(d.selected || [d.month]), sp = period(d.selected || [d.month], true);
    card.hidden = false;
    $('otdBoTitle').textContent = 'Outlets buying ' + d.brand + ' — ' + mon + ' (most bottles first)';
    $('otdBoSum').innerHTML = '<div class="otd-year"><b>' + fmt(d.outlets_month) + '</b><span>outlets bought in ' + mon + '</span></div>' +
      '<div class="otd-year"><b>' + fmt(d.outlets_ytd) + '</b><span class="otd-muted">outlets bought Jan – ' + MONTHS[m.getMonth()] + ' ' + m.getFullYear() + '</span></div>';
    var max = rows.reduce(function (a, r) { return Math.max(a, Number(r.vol)); }, 0) || 1;
    $('otdBoTbl').innerHTML = '<thead><tr><th>#</th><th>Outlet Code</th><th>Outlet</th><th>Group</th><th>BDE</th><th>Btls ' + sp + '</th><th>Value ' + sp + ' (THB)</th><th>Btls YTD</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r, i) {
        var w = Math.round(Number(r.vol) / max * 100);
        return '<tr class="' + (Number(r.vol) ? '' : 'otd-dim') + '"><td>' + (i + 1) + '</td><td>' + esc(r.outlet_code) + '</td><td class="otd-bo-name">' + esc(r.outlet_name || '-') + '</td><td>' + esc(r.outlet_group || '-') +
          '</td><td>' + esc(r.bde || '-') + '</td><td class="otd-bo-vol"><span class="otd-bo-bar"><i style="width:' + w + '%"></i></span>' + fmt(r.vol) +
          '</td><td>' + fmt(r.val) + '</td><td>' + fmt(r.vol_ytd) + '</td></tr>';
      }).join('') : '<tr><td colspan="8" style="text-align:center;color:#777">No outlets bought this brand in this period</td></tr>') + '</tbody>';
  }

  /* color theme changed (js/theme.js) → redraw with the new main color */
  window.addEventListener('themechange', function () { CUR = themeColor('--c1', '#B0120A'); if (opts) load(); });

  function start() { if (window.Chart) init(); else setTimeout(start, 100); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
