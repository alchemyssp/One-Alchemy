/* Contract Master import — two Excel files, each REPLACES only its own contract type:
     Yearly    file, sheet "Data_Yearly Contracts"    → rows with Type = 'Yearly Contract'
     Marketing file, sheet "Data_Marketing Contracts" → rows with Type = 'Marketing Contract'
   1) read only the data sheet (big workbooks), map Excel columns to Contract Master columns,
      convert Excel dates (START/END "1-Mar-19", RECEIVED DATE "19-Mar"), skip blank rows,
      drop helper columns and rows identical in every column
   2) upload rows to contract_staging (500 per request)
   3) queue a job (contract_request_replace); the Supabase worker swaps that type within
      ~1 minute and keeps a backup; the page polls the job.
   Needs: supabase (js/config.js), XLSX (SheetJS); dialog styles .oti-* in css/ssp-type.css. */
(function () {
  var TABLE = 'Contract Master';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Contract Master column ← Excel header(s) */
  var COMMON = {
    'CODE OUTLET': ['Outlet Code'], 'COMPANY': ['Company Name'], 'OUTLET NAME': ['Outlet Name'],
    'TEAM': ['Team'], 'CURRENT BDE': ['Current BDE'], 'BDE': ['BDE'], 'AREA': ['Region'], 'PROVINCE': ['Province'],
    'START': ['Start Dat', 'Start Date'], 'END': ['End Date'], 'RECEIVED DATE': ['Received Date'],
    'REMARK': ['Remark'], 'Active/Inactive': ['Status'], 'Company Code': ['Company'], 'SCAN': ['SCAN'],
  };
  var KINDS = {
    marketing: {
      type: 'Marketing Contract', sheet: 'Data_Marketing Contracts', code: 'Code of Contract',
      map: Object.assign({}, COMMON, {
        'Code of Contract': ['Code of Contract'], 'Promotion': ['Promotion'], 'Trade Deal': ['Trade Deal'],
        'Principle': ['Principle'], 'Brand': ['Brands'], 'STATUS OF DOC': ['Status Doc.'], 'ON DOC': ['On Doc.'],
        'Priority SKUs': ['# Priority SKUs'], 'Total Sku': ['Total Sku'],
      }),
    },
    yearly: {
      type: 'Yearly Contract', sheet: 'Data_Yearly Contracts', code: 'Number of Contract',
      map: Object.assign({}, COMMON, {
        'Code of Contract': ['Number of Contract'], 'GROUP NAME': ['Group Name'], 'Promotion': ['Contract Type'],
        'TYPE OF CONTRACT': ['TYPE'], 'ROI': ['ROI'], 'Total Target (ROI)': ['Total Target (ROI)'],
        'TARGET APEROL (L.)': ['Aperol Target (Liter)'], 'STATUS OF DOC': ['Status On Doc'], 'ON DOC': ['On Doc'],
        'Field': ['Field'],
      }),
    },
  };
  var nrm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var blank = function (v) { var s = String(v == null ? '' : v).trim(); return s === '' || s === '0' || s === '-' || s === '`'; };
  var plan = null;

  function excelDate(v) {
    if (typeof v !== 'number' || v < 20000 || v > 80000) return null;
    return new Date(Math.round((v - 25569) * 86400000));
  }
  function dayText(v) {       /* START / END → "1-Mar-19" */
    var d = excelDate(v); if (!d) return text(v);
    return d.getUTCDate() + '-' + MON[d.getUTCMonth()] + '-' + String(d.getUTCFullYear()).slice(2);
  }
  function monthText(v) {     /* RECEIVED DATE → "19-Mar" */
    var d = excelDate(v); if (!d) return text(v);
    return String(d.getUTCFullYear()).slice(2) + '-' + MON[d.getUTCMonth()];
  }
  function text(v) {
    if (v == null) return null;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';   /* Excel TRUE/FALSE cells (ROI) */
    if (typeof v === 'number') return String(Number.isInteger(v) ? v : +v.toFixed(6));
    var s = String(v).trim(); return s === '' ? null : s;
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'oti-toast' + (err ? ' err' : '');
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4500);
  }
  var $ = function (id) { return document.getElementById(id); };

  /* ── UI ── */
  function buildUI() {
    var hdr = document.querySelector('.page-header');
    if (hdr && !$('ctiOpen')) {
      var b = document.createElement('button');
      b.id = 'ctiOpen'; b.className = 'btn oti-btn-open'; b.textContent = 'Import';
      b.onclick = open;
      var exp = hdr.querySelector('.btn-exp');
      var box = document.createElement('div'); box.className = 'oti-actions';
      if (exp) { exp.parentNode.insertBefore(box, exp); box.appendChild(b); box.appendChild(exp); } else hdr.appendChild(b);
    }
    var ov = document.createElement('div');
    ov.className = 'oti-overlay'; ov.id = 'ctiOverlay';
    ov.innerHTML =
      '<div class="oti-modal" role="dialog" aria-modal="true" aria-labelledby="ctiTitle">' +
      '  <div class="oti-head"><div><h3 id="ctiTitle">Import Contracts</h3>' +
      '    <p>Upload the Yearly or the Marketing file — it replaces only that type of contract (a backup is kept). Import the other file after this one finishes.</p></div>' +
      '    <button class="oti-x" id="ctiClose" aria-label="Close">Close</button></div>' +
      '  <div class="oti-body">' +
      '    <label class="oti-drop" id="ctiDrop"><input type="file" id="ctiFile" accept=".xlsx,.xlsm,.xls" hidden>' +
      '      <span id="ctiDropText">Click or drop the Yearly or Marketing contract Excel file here</span>' +
      '      <small>Sheet "Data_Yearly Contracts" or "Data_Marketing Contracts" is found automatically</small></label>' +
      '    <div id="ctiPreview" hidden></div>' +
      '    <div class="oti-prog" id="ctiProg" hidden><div id="ctiBar"></div></div>' +
      '    <div class="oti-msg" id="ctiMsg"></div>' +
      '  </div>' +
      '  <div class="oti-foot"><button class="oti-cancel" id="ctiCancel">Cancel</button>' +
      '    <button class="oti-go" id="ctiGo" hidden>Replace</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    $('ctiClose').onclick = close;
    $('ctiCancel').onclick = close;
    $('ctiGo').onclick = run;
    var file = $('ctiFile'), drop = $('ctiDrop');
    file.onchange = function (e) { if (e.target.files[0]) read(e.target.files[0]); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  function reset() {
    plan = null;
    $('ctiFile').value = '';
    $('ctiDropText').textContent = 'Click or drop the Yearly or Marketing contract Excel file here';
    $('ctiPreview').hidden = true;
    $('ctiProg').hidden = true;
    $('ctiBar').style.width = '0';
    $('ctiMsg').textContent = '';
    var go = $('ctiGo'); go.hidden = true; go.disabled = false;
  }
  function open() { reset(); $('ctiOverlay').classList.add('open'); }
  function close() { if ($('ctiGo').dataset.busy === '1') return; $('ctiOverlay').classList.remove('open'); }

  /* ── read file ── */
  function read(file) {
    if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) { toast('Please choose an .xlsx, .xlsm or .xls file', true); return; }
    $('ctiDropText').textContent = 'Reading ' + file.name + '… (large files take up to a minute)';
    var fr = new FileReader();
    fr.onload = function (ev) {
      setTimeout(function () {   /* let the "Reading…" text paint first */
        try { parse(file, ev.target.result); }
        catch (err) { toast('Cannot read file: ' + err.message, true); reset(); }
      }, 30);
    };
    fr.readAsArrayBuffer(file);
  }

  function parse(file, buf) {
    /* sheet names only first, then parse just the data sheet (these workbooks have huge summary sheets) */
    var names = XLSX.read(buf, { type: 'array', bookSheets: true }).SheetNames;
    var kind = null, sheet = null;
    Object.keys(KINDS).forEach(function (k) {
      var s = names.find(function (n) { return nrm(n) === nrm(KINDS[k].sheet); });
      if (s && !kind) { kind = k; sheet = s; }
    });
    if (!kind) { toast('Sheet "Data_Yearly Contracts" or "Data_Marketing Contracts" not found in this file', true); reset(); return; }
    var K = KINDS[kind];
    var wb = XLSX.read(buf, { type: 'array', sheets: [sheet], dense: true });
    var grid = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: true });
    var hIdx = grid.findIndex(function (row, i) { return i < 40 && row.some(function (c) { return nrm(c) === nrm(K.code); }); });
    if (hIdx < 0) { toast('Header row with "' + K.code + '" not found in sheet ' + sheet, true); reset(); return; }
    var headers = grid[hIdx].map(nrm);
    var map = [], missing = [];
    Object.keys(K.map).forEach(function (col) {
      var i = -1;
      K.map[col].some(function (h) { i = headers.indexOf(nrm(h)); return i >= 0; });
      if (i >= 0) map.push([col, i]); else missing.push(K.map[col][0]);
    });
    var iCode = headers.indexOf(nrm(K.code)), iOutlet = headers.indexOf(nrm('Outlet Code'));
    var rows = [], seen = {}, dups = 0, skipped = 0, status = {};
    for (var r = hIdx + 1; r < grid.length; r++) {
      var src = grid[r];
      if (blank(src[iCode]) && blank(src[iOutlet])) { skipped++; continue; }
      var o = { 'Type': K.type };
      map.forEach(function (m) {
        var c = m[0], v = src[m[1]];
        o[c] = (c === 'START' || c === 'END') ? dayText(v) : c === 'RECEIVED DATE' ? monthText(v) : text(v);
        /* one spelling per value: TYPE in capitals ("New Outlet" → NEW OUTLET), On Doc aliases → the legend text */
        if (c === 'TYPE OF CONTRACT' && o[c]) o[c] = o[c].toUpperCase();
        if (c === 'ON DOC' && o[c] && typeof onDocCanon === 'function') o[c] = onDocCanon(o[c]);
      });
      var key = JSON.stringify(o);
      if (seen[key]) { dups++; continue; }
      seen[key] = 1; rows.push(o);
      var st = o['Active/Inactive'] || '(blank)'; status[st] = (status[st] || 0) + 1;
    }
    plan = { file: file.name, sheet: sheet, kind: kind, type: K.type, hdrRow: hIdx + 1, rows: rows, missing: missing, dups: dups, skipped: skipped, status: status };
    if (/ctidebug/.test(location.search)) window.__ctiPlan = plan;   /* test hook */
    preview();
  }

  async function preview() {
    var p = plan;
    var cur = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).ilike('Type', p.kind === 'yearly' ? '%year%' : '%market%');
    var curRows = cur.count || 0;
    $('ctiDropText').textContent = p.file + '  (' + p.rows.length.toLocaleString() + ' rows)';
    var el = $('ctiPreview');
    el.innerHTML =
      '<div class="oti-sum"><b>' + esc(p.type) + '</b> · <b>' + p.rows.length.toLocaleString() + '</b> rows · sheet "' + esc(p.sheet) + '", header row ' + p.hdrRow + '</div>' +
      '<div class="oti-note">Current ' + esc(p.type) + ' rows: <b>' + curRows.toLocaleString() + '</b> → will be replaced by this file. ' +
        'The other contract type is not changed. A backup is kept.</div>' +
      '<div class="oti-note">Skipped ' + p.skipped.toLocaleString() + ' empty rows · removed ' + p.dups.toLocaleString() + ' duplicate rows (identical in every column)</div>' +
      (p.missing.length ? '<div class="oti-warn">Columns not in file (left empty): ' + p.missing.map(esc).join(', ') + '</div>' : '') +
      '<div class="oti-months">' + Object.keys(p.status).map(function (s) { return '<span>' + esc(s) + ' <i>' + p.status[s].toLocaleString() + '</i></span>'; }).join('') + '</div>';
    el.hidden = false;
    var go = $('ctiGo');
    go.textContent = 'Replace ' + p.type + ' with ' + p.rows.length.toLocaleString() + ' rows';
    go.hidden = false;
  }

  /* ── upload + queue + wait ── */
  async function run() {
    if (!plan || !plan.rows.length) return;
    var go = $('ctiGo'), bar = $('ctiBar'), msg = $('ctiMsg');
    var batch = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), rows = plan.rows, CH = 500;
    go.disabled = true; go.dataset.busy = '1'; $('ctiProg').hidden = false;
    for (var i = 0; i < rows.length; i += CH) {
      var part = rows.slice(i, i + CH).map(function (r) { var o = Object.assign({}, r); o.batch_id = batch; return o; });
      var res = await supabase.from('contract_staging').insert(part);
      if (res.error) {
        await supabase.from('contract_staging').delete().eq('batch_id', batch);
        msg.textContent = 'Upload failed: ' + res.error.message + ' (nothing was changed)';
        go.disabled = false; go.dataset.busy = ''; return;
      }
      var done = Math.min(i + CH, rows.length);
      bar.style.width = Math.round(done / rows.length * 70) + '%';
      msg.textContent = 'Uploading… ' + done.toLocaleString() + ' / ' + rows.length.toLocaleString() + ' rows';
    }
    var q = await supabase.rpc('contract_request_replace', { p_batch: batch, p_type: plan.type, p_file: plan.file });
    if (q.error) {
      await supabase.from('contract_staging').delete().eq('batch_id', batch);
      msg.textContent = q.error.message + ' (nothing was changed)'; go.disabled = false; go.dataset.busy = ''; return;
    }
    bar.style.width = '75%';
    msg.textContent = 'Uploaded. Waiting for Supabase to apply the update (up to 1–2 minutes)…';
    var t0 = Date.now(), type = plan.type;
    var poll = setInterval(async function () {
      var r = await supabase.from('data_u_import_jobs').select('*').eq('batch_id', batch).maybeSingle();
      var job = r.data; if (!job) return;
      if (job.status === 'running') { bar.style.width = '90%'; msg.textContent = 'Applying update in Supabase…'; }
      if (job.status === 'done') {
        clearInterval(poll); bar.style.width = '100%'; go.dataset.busy = '';
        toast(type + ' updated: ' + Number(job.previous_rows).toLocaleString() + ' → ' + Number(job.new_rows).toLocaleString() + ' rows');
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
