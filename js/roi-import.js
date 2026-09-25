/* ROI import — the file REPLACES all rows of "Return of investment".
   1) read the Excel file (sheet "ROI" or the sheet with the ROI header row), convert values to the table's format
      (dates "1-Feb-24", received month "23-Dec", amounts "4,708.00", rebate "5%")
   2) upload rows to roi_staging (500 per request)
   3) queue a job (roi_request_replace); the Supabase worker swaps the data within ~1 minute,
      keeps a backup and refreshes the ROI analysis; the page polls the job.
   Needs: supabase (js/config.js), XLSX (SheetJS); dialog styles .oti-* in css/ssp-type.css. */
(function () {
  var TABLE = 'Return of investment';
  var COLS = ['Outlets Code', 'Outlet', 'Group', 'BDE', 'Area', 'Start Date', 'End Date', 'Outlets Contract', 'SKU Company', 'SKU Code',
    'Principle', 'Category', 'Brand', 'Product', 'Size', 'Packing', 'Approx WS Price', 'Monthly Vol (btl)', 'Monthly Value(THB)',
    'Yearly Vol (btl)', 'Yearly Value (THB)', 'Proposed for', '% Rebate MAX', '% Rebate from BDE', 'Total Discount (Net) (THB)',
    'Total Price net in Value (THB)', 'Received Month', 'Yearly Vol (Liter)', 'Tier'];
  var MONEY = ['Approx WS Price', 'Monthly Vol (btl)', 'Monthly Value(THB)', 'Yearly Value (THB)', 'Total Discount (Net) (THB)',
    'Total Price net in Value (THB)', 'Yearly Vol (Liter)'];
  var NUMS = ['Packing', 'Yearly Vol (btl)'];
  var PCT = ['% Rebate MAX', '% Rebate from BDE'];
  var DAYS = ['Start Date', 'End Date'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var nrm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9%]/g, ''); };
  var plan = null;
  var $ = function (id) { return document.getElementById(id); };

  var serial = function (v) { return typeof v === 'number' && v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 86400000)) : null; };
  function dayText(v, w) {            /* "1-Feb-24" */
    var d = serial(v);
    if (d) return d.getUTCDate() + '-' + MON[d.getUTCMonth()] + '-' + String(d.getUTCFullYear()).slice(2);
    var s = String(w || v || '').trim(); return s || null;
  }
  function monthText(v, w) {          /* "23-Dec" (year-month, like Off-take) */
    var d = serial(v);
    if (d) return String(d.getUTCFullYear()).slice(2) + '-' + MON[d.getUTCMonth()];
    var s = String(w || v || '').trim(), m;
    if ((m = s.match(/^([A-Za-z]{3})[-\s](\d{2})$/))) return m[2] + '-' + m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();   /* Dec-23 */
    if ((m = s.match(/^(\d{2})-([A-Za-z]{3})$/))) return m[1] + '-' + m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();       /* 23-Dec */
    return s || null;
  }
  function money(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (String(v).trim() || null);
  }
  function num(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }
  function pct(v, w) {                 /* 0.05 or "5%" → "5%" */
    if (typeof v === 'number') return +(Math.abs(v) <= 1 ? v * 100 : v).toFixed(2) + '%';
    var s = String(w || v || '').trim(); return s || null;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'oti-toast' + (err ? ' err' : '');
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4500);
  }

  /* ── UI ── */
  function buildUI() {
    var slot = $('roiImportSlot');
    if (slot && !$('roiOpen')) {
      var b = document.createElement('button');
      b.id = 'roiOpen'; b.type = 'button'; b.className = 'btn oti-btn-open'; b.textContent = 'Import ROI file';
      b.onclick = open; slot.appendChild(b);
    }
    var ov = document.createElement('div');
    ov.className = 'oti-overlay'; ov.id = 'roiOverlay';
    ov.innerHTML =
      '<div class="oti-modal" role="dialog" aria-modal="true" aria-labelledby="roiTitle">' +
      '  <div class="oti-head"><div><h3 id="roiTitle">Import ROI file</h3>' +
      '    <p>The file replaces all ROI rows (a backup of the current data is kept). The analysis is recalculated automatically.</p></div>' +
      '    <button class="oti-x" id="roiClose" aria-label="Close">Close</button></div>' +
      '  <div class="oti-body">' +
      '    <label class="oti-drop" id="roiDrop"><input type="file" id="roiFile" accept=".xlsx,.xlsm,.xls" hidden>' +
      '      <span id="roiDropText">Click or drop the ROI Excel file here</span>' +
      '      <small>e.g. "ROI DEC 23 - AUG 26.xlsx" — the sheet and header row are found automatically</small></label>' +
      '    <div id="roiPreview" hidden></div>' +
      '    <div class="oti-prog" id="roiProg" hidden><div id="roiBar"></div></div>' +
      '    <div class="oti-msg" id="roiMsg" role="status" aria-live="polite"></div>' +
      '  </div>' +
      '  <div class="oti-foot"><button class="oti-cancel" id="roiCancel">Cancel</button>' +
      '    <button class="oti-go" id="roiGo" hidden>Replace ROI data</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    $('roiClose').onclick = close; $('roiCancel').onclick = close; $('roiGo').onclick = run;
    var file = $('roiFile'), drop = $('roiDrop');
    file.onchange = function (e) { if (e.target.files[0]) read(e.target.files[0]); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('open')) close(); });
  }
  function reset() {
    plan = null;
    $('roiFile').value = '';
    $('roiDropText').textContent = 'Click or drop the ROI Excel file here';
    $('roiPreview').hidden = true; $('roiProg').hidden = true; $('roiBar').style.width = '0'; $('roiMsg').textContent = '';
    var go = $('roiGo'); go.hidden = true; go.disabled = false;
  }
  function open() { reset(); $('roiOverlay').classList.add('open'); }
  function close() { if ($('roiGo').dataset.busy === '1') return; $('roiOverlay').classList.remove('open'); }

  /* ── read file ── */
  function read(file) {
    if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) { toast('Please choose an .xlsx, .xlsm or .xls file', true); return; }
    $('roiDropText').textContent = 'Reading ' + file.name + '… (about 10–20 seconds)';
    var fr = new FileReader();
    fr.onload = function (ev) {
      setTimeout(function () {
        try {
          var wb = XLSX.read(ev.target.result, { type: 'array' });
          var want = COLS.map(nrm), best = null;
          wb.SheetNames.forEach(function (name) {
            var g = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, sheetRows: 30 });
            g.forEach(function (row, i) {
              var hit = row.filter(function (c) { return want.indexOf(nrm(c)) >= 0; }).length;
              if (hit >= 15 && (!best || hit > best.hit)) best = { name: name, idx: i, hit: hit };
            });
          });
          if (!best) { toast('Could not find the ROI header row (Outlets Code, SKU Code, Yearly Vol (btl)…)', true); reset(); return; }
          var ws = wb.Sheets[best.name];
          var raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
          var txt = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });   /* as shown in Excel */
          var headers = raw[best.idx].map(function (h) { return String(h == null ? '' : h).trim(); });
          var map = [], missing = [];
          COLS.forEach(function (c) {
            var i = headers.findIndex(function (h) { return nrm(h) === nrm(c); });
            if (i >= 0) map.push([c, i]); else missing.push(c);
          });
          var rows = [];
          for (var r = best.idx + 1; r < raw.length; r++) {
            var src = raw[r], shown = txt[r] || [];
            if (!src.some(function (v) { return v !== '' && v != null; })) continue;
            var o = {};
            map.forEach(function (m) {
              var c = m[0], v = src[m[1]], w = shown[m[1]];
              if (DAYS.indexOf(c) >= 0) o[c] = dayText(v, w);
              else if (c === 'Received Month') o[c] = monthText(v, w);
              else if (NUMS.indexOf(c) >= 0) o[c] = num(v);
              else if (PCT.indexOf(c) >= 0) o[c] = pct(v, w);
              else if (MONEY.indexOf(c) >= 0) o[c] = money(v);
              else { v = v == null ? '' : String(v).trim(); o[c] = v === '' ? null : v; }
            });
            if (o['Outlets Code'] || o['SKU Code']) rows.push(o);
          }
          plan = { file: file.name, sheet: best.name, hdrRow: best.idx + 1, rows: rows, missing: missing };
          preview();
        } catch (err) { toast('Cannot read file: ' + err.message, true); reset(); }
      }, 30);
    };
    fr.readAsArrayBuffer(file);
  }

  async function preview() {
    var p = plan, months = {}, contracts = {}, outlets = {};
    p.rows.forEach(function (r) {
      var m = r['Received Month'] || '(blank)'; months[m] = (months[m] || 0) + 1;
      if (r['Outlets Contract']) contracts[r['Outlets Contract']] = 1; if (r['Outlets Code']) outlets[r['Outlets Code']] = 1;
    });
    var key = function (m) { var x = m.match(/^(\d{2})-([A-Za-z]{3})$/); return x ? (+x[1]) * 12 + MON.indexOf(x[2]) : 99999; };
    var list = Object.keys(months).sort(function (a, b) { return key(a) - key(b); });
    var cur = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
    $('roiDropText').textContent = p.file + '  (' + p.rows.length.toLocaleString() + ' rows)';
    var el = $('roiPreview');
    el.innerHTML =
      '<div class="oti-sum"><b>' + p.rows.length.toLocaleString() + '</b> rows · <b>' + Object.keys(contracts).length.toLocaleString() +
        '</b> contracts · <b>' + Object.keys(outlets).length.toLocaleString() + '</b> outlets · sheet "' + esc(p.sheet) + '", header row ' + p.hdrRow + '</div>' +
      '<div class="oti-note">Current ROI data: <b>' + (cur.count || 0).toLocaleString() + '</b> rows → will be replaced by this file. A backup is kept.</div>' +
      (p.missing.length ? '<div class="oti-warn">Columns not in file (left empty): ' + p.missing.map(esc).join(', ') + '</div>' : '') +
      '<div class="oti-note">Received months: ' + esc(list[0]) + ' – ' + esc(list[list.length - 1]) + '</div>';
    el.hidden = false;
    var go = $('roiGo'); go.textContent = 'Replace ROI data with ' + p.rows.length.toLocaleString() + ' rows'; go.hidden = false;
  }

  /* ── upload + queue + wait ── */
  async function run() {
    if (!plan || !plan.rows.length) return;
    var go = $('roiGo'), bar = $('roiBar'), msg = $('roiMsg');
    var batch = 'roi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), rows = plan.rows, CH = 500;
    go.disabled = true; go.dataset.busy = '1'; $('roiProg').hidden = false;
    for (var i = 0; i < rows.length; i += CH) {
      var part = rows.slice(i, i + CH).map(function (r, j) { return { batch_id: batch, rn: i + j + 1, data: r }; });
      var res = await supabase.from('roi_staging').insert(part);
      if (res.error) {
        await supabase.from('roi_staging').delete().eq('batch_id', batch);
        msg.textContent = 'Upload failed: ' + res.error.message + ' (nothing was changed)';
        go.disabled = false; go.dataset.busy = ''; return;
      }
      var done = Math.min(i + CH, rows.length);
      bar.style.width = Math.round(done / rows.length * 70) + '%';
      msg.textContent = 'Uploading… ' + done.toLocaleString() + ' / ' + rows.length.toLocaleString() + ' rows';
    }
    var q = await supabase.rpc('roi_request_replace', { p_batch: batch, p_file: plan.file });
    if (q.error) {
      await supabase.from('roi_staging').delete().eq('batch_id', batch);
      msg.textContent = q.error.message + ' (nothing was changed)'; go.disabled = false; go.dataset.busy = ''; return;
    }
    bar.style.width = '75%';
    msg.textContent = 'Uploaded. Waiting for Supabase to apply the update and recalculate (up to 1–2 minutes)…';
    var t0 = Date.now();
    var poll = setInterval(async function () {
      var r = await supabase.from('data_u_import_jobs').select('*').eq('batch_id', batch).maybeSingle();
      var job = r.data; if (!job) return;
      if (job.status === 'running') { bar.style.width = '90%'; msg.textContent = 'Applying update and recalculating ROI…'; }
      if (job.status === 'done') {
        clearInterval(poll); bar.style.width = '100%'; go.dataset.busy = '';
        toast('ROI updated: ' + Number(job.previous_rows).toLocaleString() + ' → ' + Number(job.new_rows).toLocaleString() + ' rows');
        close(); if (typeof window.roiReload === 'function') window.roiReload();
      }
      if (job.status === 'error') {
        clearInterval(poll); go.dataset.busy = ''; go.disabled = false;
        msg.textContent = 'Import stopped: ' + job.message + ' (current data was not changed)';
      }
      if (Date.now() - t0 > 10 * 60 * 1000) { clearInterval(poll); go.dataset.busy = ''; msg.textContent = 'Still processing — check again in a few minutes.'; }
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI); else buildUI();
})();
