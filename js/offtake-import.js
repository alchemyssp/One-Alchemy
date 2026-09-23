/* Off-take monthly import — the file REPLACES all rows of "Off-take 2026".
   1) read the Excel file, find the data sheet + header row, convert values
      to the table's format (month "24-Jan", prices "1,630.00", trimmed codes)
   2) upload rows to offtake_staging (500 per request)
   3) queue a job (offtake_request_replace); the Supabase worker swaps the data
      within ~1 minute and keeps a backup; the page polls the job.
   Needs: supabase (js/config.js), XLSX (SheetJS), showToast-like UI below. */
(function () {
  var TABLE = 'Off-take 2026';
  var COLS = ['Code', 'Outlets', 'Group', 'Current Team', 'Current BDE', 'BDE', 'Area', 'Wholesaler',
    'SKU Company', 'SKU Code', 'Principle', 'Category', 'Brand', 'Product', 'Size', 'Packing',
    'Price INC.VAT', 'Price EXC.VAT', 'Vol. Btls.', 'Total Price Inc.VAT', 'Total Price Exc.VAT',
    'Direct Price Exc.VAT', 'Total Direct Price Exc.VAT', 'Received Month', 'Liter'];
  var MONEY = ['Price INC.VAT', 'Price EXC.VAT', 'Total Price Inc.VAT', 'Total Price Exc.VAT',
    'Direct Price Exc.VAT', 'Total Direct Price Exc.VAT'];
  var INTS = ['Packing', 'Vol. Btls.'];
  var FLOATS = ['Liter'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var nrm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var plan = null;

  function monthText(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      var d = new Date(Math.round((v - 25569) * 86400000));
      return String(d.getUTCFullYear()).slice(2) + '-' + MON[d.getUTCMonth()];
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{2})-([A-Za-z]{3})$/);            /* already "24-Jan" */
    if (m) return m[1] + '-' + m[2].charAt(0).toUpperCase() + m[2].slice(1, 3).toLowerCase();
    var d2 = new Date(s);
    return isNaN(d2) ? s : String(d2.getFullYear()).slice(2) + '-' + MON[d2.getMonth()];
  }
  function money(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v).trim();
  }
  function num(v, int) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? (int ? Math.round(n) : n) : null;
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
    var hdr = document.querySelector('.page-header');
    if (hdr && !document.getElementById('otiOpen')) {
      var b = document.createElement('button');
      b.id = 'otiOpen'; b.className = 'btn oti-btn-open'; b.textContent = 'Import';
      b.onclick = open;
      var exp = hdr.querySelector('.btn-export');
      var box = document.createElement('div'); box.className = 'oti-actions';
      if (exp) { exp.parentNode.insertBefore(box, exp); box.appendChild(b); box.appendChild(exp); } else hdr.appendChild(b);
    }
    var ov = document.createElement('div');
    ov.className = 'oti-overlay'; ov.id = 'otiOverlay';
    ov.innerHTML =
      '<div class="oti-modal" role="dialog" aria-modal="true" aria-labelledby="otiTitle">' +
      '  <div class="oti-head"><div><h3 id="otiTitle">Import Off-take</h3>' +
      '    <p>Monthly update — the file replaces all Off-take rows (a backup of the current data is kept)</p></div>' +
      '    <button class="oti-x" id="otiClose" aria-label="Close">Close</button></div>' +
      '  <div class="oti-body">' +
      '    <label class="oti-drop" id="otiDrop"><input type="file" id="otiFile" accept=".xlsx,.xlsm,.xls" hidden>' +
      '      <span id="otiDropText">Click or drop the Off-take Excel file here</span>' +
      '      <small>.xlsx, .xlsm or .xls — the data sheet and header row are found automatically</small></label>' +
      '    <div id="otiPreview" hidden></div>' +
      '    <div class="oti-prog" id="otiProg" hidden><div id="otiBar"></div></div>' +
      '    <div class="oti-msg" id="otiMsg"></div>' +
      '  </div>' +
      '  <div class="oti-foot"><button class="oti-cancel" id="otiCancel">Cancel</button>' +
      '    <button class="oti-go" id="otiGo" hidden>Replace Off-take</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.getElementById('otiClose').onclick = close;
    document.getElementById('otiCancel').onclick = close;
    document.getElementById('otiGo').onclick = run;
    var file = document.getElementById('otiFile'), drop = document.getElementById('otiDrop');
    file.onchange = function (e) { if (e.target.files[0]) read(e.target.files[0]); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  function reset() {
    plan = null;
    document.getElementById('otiFile').value = '';
    document.getElementById('otiDropText').textContent = 'Click or drop the Off-take Excel file here';
    document.getElementById('otiPreview').hidden = true;
    document.getElementById('otiProg').hidden = true;
    document.getElementById('otiBar').style.width = '0';
    document.getElementById('otiMsg').textContent = '';
    var go = document.getElementById('otiGo'); go.hidden = true; go.disabled = false;
  }
  function open() { reset(); document.getElementById('otiOverlay').classList.add('open'); }
  function close() { if (document.getElementById('otiGo').dataset.busy === '1') return; document.getElementById('otiOverlay').classList.remove('open'); }

  /* ── read file ── */
  function read(file) {
    if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) { toast('Please choose an .xlsx, .xlsm or .xls file', true); return; }
    document.getElementById('otiDropText').textContent = 'Reading ' + file.name + '… (large files take ~20 seconds)';
    var fr = new FileReader();
    fr.onload = function (ev) {
      setTimeout(function () {   /* let the "Reading…" text paint first */
        try {
          var wb = XLSX.read(ev.target.result, { type: 'array' });
          var want = COLS.map(nrm), best = null;
          wb.SheetNames.forEach(function (name) {
            var g = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, sheetRows: 40 });
            g.forEach(function (row, i) {
              var hit = row.filter(function (c) { return want.indexOf(nrm(c)) >= 0; }).length;
              if (hit >= 15 && (!best || hit > best.hit)) best = { name: name, idx: i, hit: hit };
            });
          });
          if (!best) { toast('Could not find the Off-take header row (Code, SKU Code, Received Month…)', true); reset(); return; }
          var grid = XLSX.utils.sheet_to_json(wb.Sheets[best.name], { header: 1, defval: '', raw: true });
          var headers = grid[best.idx].map(function (h) { return String(h == null ? '' : h).trim(); });
          var map = [], missing = [];
          COLS.forEach(function (c) {
            var i = headers.findIndex(function (h) { return nrm(h) === nrm(c); });
            if (i >= 0) map.push([c, i]); else missing.push(c);
          });
          var rows = [];
          for (var r = best.idx + 1; r < grid.length; r++) {
            var src = grid[r];
            if (!src.some(function (v) { return v !== '' && v != null; })) continue;
            var o = {};
            map.forEach(function (m) {
              var c = m[0], v = src[m[1]];
              if (c === 'Received Month') o[c] = monthText(v);
              else if (MONEY.indexOf(c) >= 0) o[c] = money(v);
              else if (INTS.indexOf(c) >= 0) o[c] = num(v, true);
              else if (FLOATS.indexOf(c) >= 0) o[c] = num(v, false);
              else { v = v == null ? '' : String(v).trim(); o[c] = v === '' ? null : v; }
            });
            if (o['Code'] || o['SKU Code']) rows.push(o);
          }
          plan = { file: file.name, sheet: best.name, hdrRow: best.idx + 1, rows: rows, missing: missing };
          preview();
        } catch (err) { toast('Cannot read file: ' + err.message, true); reset(); }
      }, 30);
    };
    fr.readAsArrayBuffer(file);
  }

  async function preview() {
    var p = plan, months = {};
    p.rows.forEach(function (r) { var m = r['Received Month'] || '(blank)'; months[m] = (months[m] || 0) + 1; });
    var key = function (m) { var x = m.match(/^(\d{2})-([A-Za-z]{3})$/); return x ? (+x[1]) * 12 + MON.indexOf(x[2]) : 99999; };
    var list = Object.keys(months).sort(function (a, b) { return key(a) - key(b); });
    var cur = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
    var curRows = cur.count || 0;
    document.getElementById('otiDropText').textContent = p.file + '  (' + p.rows.length.toLocaleString() + ' rows)';
    var el = document.getElementById('otiPreview');
    el.innerHTML =
      '<div class="oti-sum"><b>' + p.rows.length.toLocaleString() + '</b> rows · <b>' + list.length + '</b> months (' +
        esc(list[0]) + ' – ' + esc(list[list.length - 1]) + ') · sheet "' + esc(p.sheet) + '", header row ' + p.hdrRow + '</div>' +
      '<div class="oti-note">Current Off-take: <b>' + curRows.toLocaleString() + '</b> rows → will be replaced by this file. A backup is kept.</div>' +
      (p.missing.length ? '<div class="oti-warn">Columns not in file (left empty): ' + p.missing.map(esc).join(', ') + '</div>' : '') +
      '<div class="oti-months">' + list.map(function (m) { return '<span>' + esc(m) + ' <i>' + months[m].toLocaleString() + '</i></span>'; }).join('') + '</div>';
    el.hidden = false;
    var go = document.getElementById('otiGo');
    go.textContent = 'Replace Off-take with ' + p.rows.length.toLocaleString() + ' rows';
    go.hidden = false;
  }

  /* ── upload + queue + wait ── */
  async function run() {
    if (!plan || !plan.rows.length) return;
    var go = document.getElementById('otiGo'), bar = document.getElementById('otiBar'), msg = document.getElementById('otiMsg');
    var batch = 'ot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), rows = plan.rows, CH = 500;
    go.disabled = true; go.dataset.busy = '1'; document.getElementById('otiProg').hidden = false;
    for (var i = 0; i < rows.length; i += CH) {
      var part = rows.slice(i, i + CH).map(function (r) { var o = Object.assign({}, r); o.batch_id = batch; return o; });
      var res = await supabase.from('offtake_staging').insert(part);
      if (res.error) {
        await supabase.from('offtake_staging').delete().eq('batch_id', batch);
        msg.textContent = 'Upload failed: ' + res.error.message + ' (nothing was changed)';
        go.disabled = false; go.dataset.busy = ''; return;
      }
      var done = Math.min(i + CH, rows.length);
      bar.style.width = Math.round(done / rows.length * 70) + '%';
      msg.textContent = 'Uploading… ' + done.toLocaleString() + ' / ' + rows.length.toLocaleString() + ' rows';
    }
    var q = await supabase.rpc('offtake_request_replace', { p_batch: batch, p_file: plan.file });
    if (q.error) {
      await supabase.from('offtake_staging').delete().eq('batch_id', batch);
      msg.textContent = q.error.message + ' (nothing was changed)'; go.disabled = false; go.dataset.busy = ''; return;
    }
    bar.style.width = '75%';
    msg.textContent = 'Uploaded. Waiting for Supabase to apply the update (up to 1–2 minutes)…';
    var t0 = Date.now();
    var poll = setInterval(async function () {
      var r = await supabase.from('data_u_import_jobs').select('*').eq('batch_id', batch).maybeSingle();
      var job = r.data; if (!job) return;
      if (job.status === 'running') { bar.style.width = '90%'; msg.textContent = 'Applying update in Supabase…'; }
      if (job.status === 'done') {
        clearInterval(poll); bar.style.width = '100%'; go.dataset.busy = '';
        toast('Off-take updated: ' + Number(job.previous_rows).toLocaleString() + ' → ' + Number(job.new_rows).toLocaleString() + ' rows');
        close(); if (typeof loadData === 'function') loadData();
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
