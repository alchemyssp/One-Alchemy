/* Contract Master — tools on the Yearly / Marketing tabs (contracts.html)
   · Monthly summary: contracts that are COMPLETE in a month — no On Doc, and Status On Doc is "Signed" or blank.
     Summary Excel = the team's "Monthly Contract Summary" layout (Yearly + Marketing together, one line per
     contract / promotion), plus a Cover Performance page and a BDE × Contract Type / Promotion sheet.
     Send with Outlook = an e-mail file (.eml) with the Summary Excel already attached; it opens as a new
     message in Outlook, ready to send.
   · History: every add / edit / delete made on the website in the last 7 days (contract_history), with Restore.
     Older history is removed automatically every night.
   Uses globals from contracts.html / contract-edit.js: VIEW, VIEWS, allData, ctKey, groupKey, label, esc, dateShow,
   dateIso, onDocStyle, exportExcel, ctToast, loadData, TABLE. */
window.ContractTools = (function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var $ = function (id) { return document.getElementById(id); };

  /* popup with one Close button (top right) */
  function modal(id, title, sub, body, foot) {
    close(id);
    var ov = document.createElement('div');
    ov.className = 'oti-overlay open'; ov.id = id;
    ov.innerHTML = '<div class="oti-modal ct-tool-modal" role="dialog" aria-modal="true" aria-labelledby="' + id + 'T">' +
      '<div class="oti-head"><div><h3 id="' + id + 'T">' + esc(title) + '</h3><p>' + esc(sub) + '</p></div>' +
      '<button class="oti-x" type="button" data-close>Close</button></div>' +
      '<div class="oti-body">' + body + '</div>' + (foot ? '<div class="oti-foot">' + foot + '</div>' : '') + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(id); });
    ov.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { close(id); }; });
    return ov;
  }
  function close(id) { var o = $(id); if (o) o.remove(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close('ctMonthly'); close('ctHistory'); } });

  /* ── Monthly summary of complete contracts ── */
  var isComplete = function (r) {
    var od = String(r['ON DOC'] == null ? '' : r['ON DOC']).trim(), st = String(r['STATUS OF DOC'] == null ? '' : r['STATUS OF DOC']).trim();
    return (od === '' || od === '.') && (st === '' || /^signed$/i.test(st));
  };
  var isYearly = function (r) { return /year/i.test(String(r['Type'] || '')); };
  var monthOf = function (r, basis) { var iso = dateIso(r[basis]); return iso ? iso.slice(0, 7) : ''; };
  /* rows → contracts (Yearly: per contract · Marketing: per promotion); complete only when every row of it is complete */
  function completeContracts(rows, basis, month) {
    var byKey = {};
    rows.forEach(function (r) { if (monthOf(r, basis) !== month) return; var k = (isYearly(r) ? 'Y|' : 'M|') + ctKey(r); (byKey[k] = byKey[k] || []).push(r); });
    return Object.keys(byKey).filter(function (k) { return byKey[k].every(isComplete); }).map(function (k) { return byKey[k]; });
  }

  function monthly() {
    if (!VIEWS[VIEW]) return;
    var V = VIEWS[VIEW];
    var body =
      '<div class="ct-mrow"><label>Month of <select id="ctmBasis"><option value="RECEIVED DATE">Received Date</option><option value="START">Start Date</option></select></label>' +
      '<label>Month <select id="ctmMonth"></select></label>' +
      '<label>BDE <select id="ctmBde"><option value="">All</option></select></label>' +
      '<label>Team <select id="ctmTeam"><option value="">All</option></select></label>' +
      '<label class="ct-mto">E-mail to <input type="email" id="ctmTo" placeholder="name@alchemy-asia.com (optional)"></label></div>' +
      '<div class="ct-mnote">Complete = no On Doc, and Status On Doc is Signed or blank. The Summary Excel lists Yearly and Marketing contracts of the month together.</div>' +
      '<div id="ctmSum" class="ct-msum"></div><div class="otd-tablewrap ct-mwrap"><table class="otd-prod ct-mtbl" id="ctmTbl"></table></div>';
    var foot = '<button class="ct-tool" type="button" id="ctmXlsx">Excel (data)</button>' +
      '<button class="ct-tool" type="button" id="ctmSumXlsx">Summary Excel</button>' +
      '<button class="oti-go" type="button" id="ctmOutlook">Send with Outlook</button>';
    modal('ctMonthly', 'Monthly Summary — ' + V.title, 'Contracts that are complete in the chosen month', body, foot);
    var contracts = [], rowsFor = [];
    var bdeOk = function (r) { var b = $('ctmBde').value; return !b || (r['CURRENT BDE'] || r['BDE'] || '') === b; };
    var teamOk = function (r) { var t = $('ctmTeam').value; return !t || String(r['TEAM'] || '').trim().toLowerCase() === t.toLowerCase(); };
    var fillMonths = function () {
      var basis = $('ctmBasis').value, seen = {};
      allData.forEach(function (r) { var m = monthOf(r, basis); if (m) seen[m] = 1; });
      var list = Object.keys(seen).sort().reverse();   /* latest month first, and selected */
      $('ctmMonth').innerHTML = list.map(function (m, i) { return '<option value="' + m + '"' + (i === 0 ? ' selected' : '') + '>' + MONTHS[+m.slice(5) - 1] + ' ' + m.slice(0, 4) + '</option>'; }).join('');
      draw();
    };
    var uniqSorted = function (col) { return [...new Set(allData.map(function (r) { return String(r[col] || '').trim(); }).filter(Boolean))].sort(); };
    $('ctmBde').innerHTML = '<option value="">All</option>' + uniqSorted('CURRENT BDE').map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('');
    $('ctmTeam').innerHTML = '<option value="">All</option>' + [...new Set(uniqSorted('TEAM').map(function (t) { return t.toUpperCase(); }))].map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
    var draw = function () {
      var basis = $('ctmBasis').value, m = $('ctmMonth').value;
      contracts = completeContracts(allData.filter(function (r) { return bdeOk(r) && teamOk(r); }), basis, m);
      rowsFor = [].concat.apply([], contracts);
      var byBde = {};
      contracts.forEach(function (g) { var b = g[0]['CURRENT BDE'] || g[0]['BDE'] || '—'; byBde[b] = (byBde[b] || 0) + 1; });
      $('ctmSum').innerHTML = '<b>' + contracts.length.toLocaleString() + '</b> complete ' + esc(V.title) + (contracts.length === 1 ? '' : 's') +
        (m ? ' in ' + MONTHS[+m.slice(5) - 1] + ' ' + m.slice(0, 4) : '') +
        (contracts.length ? ' · ' + Object.keys(byBde).sort(function (a, b) { return byBde[b] - byBde[a]; }).map(function (b) { return esc(b) + ' ' + byBde[b]; }).join(' · ') : '');
      var head = VIEW === 'yearly'
        ? ['Number of Contract', 'Outlet', 'Contract Type', 'TYPE', 'Start Date', 'End Date', 'Current BDE', 'Status On Doc']
        : ['Code of Contract', 'Outlet', 'Promotion', 'Trade deals', 'Start Date', 'End Date', 'Current BDE', 'Status Doc.'];
      $('ctmTbl').innerHTML = '<thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (contracts.length ? contracts.map(function (g) {
          var r = g[0];
          return '<tr><td>' + esc(r['Code of Contract'] || '—') + '</td><td>' + esc(r['OUTLET NAME'] || r['CODE OUTLET'] || '') + '</td><td>' + esc(r['Promotion'] || '') + '</td>' +
            '<td>' + (VIEW === 'yearly' ? esc(r['TYPE OF CONTRACT'] || '') : g.length) + '</td><td>' + esc(dateShow(r['START'])) + '</td><td>' + esc(dateShow(r['END'])) + '</td>' +
            '<td>' + esc(r['CURRENT BDE'] || r['BDE'] || '') + '</td><td>' + esc(r['STATUS OF DOC'] || 'Blank') + '</td></tr>';
        }).join('') : '<tr><td colspan="8" class="ctd-empty">No complete contracts in this month</td></tr>') + '</tbody>';
    };
    $('ctmBasis').onchange = fillMonths;
    $('ctmMonth').onchange = $('ctmBde').onchange = $('ctmTeam').onchange = draw;
    fillMonths();

    var opts = function () {
      var m = $('ctmMonth').value;
      return { basis: $('ctmBasis').value, basisLabel: $('ctmBasis').value === 'START' ? 'Start Date' : 'Received Date', month: m,
        monthName: m ? MONTHS[+m.slice(5) - 1] + ' ' + m.slice(0, 4) : '', monthShort: m ? MON3[+m.slice(5) - 1] + '-' + m.slice(2, 4) : '',
        bde: $('ctmBde').value, team: $('ctmTeam').value };
    };
    var fileName = function (o) { return 'Monthly Contract Summary ' + o.monthShort + (o.bde ? ' ' + o.bde : '') + (o.team ? ' ' + o.team : '') + '.xlsx'; };
    var working = function (btn, on) { btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = 'Preparing…'; } else btn.textContent = btn.dataset.t; };
    $('ctmXlsx').onclick = function () {
      if (!rowsFor.length) { ctToast('No complete contracts in this month', true); return; }
      exportExcel(rowsFor, V.file + '_Complete_' + $('ctmMonth').value);
    };
    $('ctmSumXlsx').onclick = async function () {
      var b = this, o = opts(); if (!o.month) return;
      working(b, true);
      try { var r = await buildSummary(o); download(r.blob, fileName(o)); ctToast('Summary Excel downloaded (' + r.count + ' contracts)'); }
      catch (e) { ctToast('Summary failed: ' + e.message, true); }
      working(b, false);
    };
    /* Send with Outlook: an .eml e-mail with the Summary Excel attached → opens in Outlook as a new message */
    $('ctmOutlook').onclick = async function () {
      var b = this, o = opts(); if (!o.month) return;
      working(b, true);
      try {
        var r = await buildSummary(o), name = fileName(o);
        var eml = await buildEml($('ctmTo').value.trim(), 'Monthly Contract Summary — ' + o.monthShort + (o.bde ? ' — ' + o.bde : '') + ' (' + r.count + ' contracts)',
          '<p>Hi,</p><p>Please find attached the Monthly Contract Summary for <b>' + esc(o.monthName) + '</b> (month of ' + esc(o.basisLabel) + ')' +
          (o.bde ? ', BDE <b>' + esc(o.bde) + '</b>' : '') + (o.team ? ', team <b>' + esc(o.team) + '</b>' : '') + ':</p>' +
          '<ul><li>Yearly contracts complete: <b>' + r.yearly + '</b></li><li>Marketing promotions complete: <b>' + r.marketing + '</b></li><li>Total: <b>' + r.count + '</b></li></ul>' +
          '<p>Complete = no On Doc, and Status On Doc is Signed or blank.</p><p>Archive — One for All</p>',
          name, r.blob);
        download(eml, name.replace(/\.xlsx$/, '.eml'));
        ctToast('E-mail file downloaded — open it: Outlook shows the new message with the Excel attached');
      } catch (e) { ctToast('Could not prepare the e-mail: ' + e.message, true); }
      working(b, false);
    };
  }

  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  /* e-mail file: "X-Unsent: 1" makes Outlook open it as a new, unsent message (attachment included) */
  async function buildEml(to, subject, html, attName, attBlob) {
    var b64 = await new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(',')[1]); }; fr.readAsDataURL(attBlob); });
    var utf8b64 = function (s) { return btoa(unescape(encodeURIComponent(s))); };
    var enc = function (s) { return '=?UTF-8?B?' + utf8b64(s) + '?='; };
    var wrap = function (s) { return s.replace(/(.{76})/g, '$1\r\n'); };
    var bnd = '----=_Archive_' + Date.now().toString(36);
    var lines = [
      'X-Unsent: 1', 'To: ' + (to || ''), 'Subject: ' + enc(subject), 'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="' + bnd + '"', '',
      '--' + bnd, 'Content-Type: text/html; charset="utf-8"', 'Content-Transfer-Encoding: base64', '',
      wrap(utf8b64('<html><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt">' + html + '</body></html>')), '',
      '--' + bnd, 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="' + enc(attName) + '"',
      'Content-Transfer-Encoding: base64', 'Content-Disposition: attachment; filename="' + enc(attName) + '"', '',
      wrap(b64), '', '--' + bnd + '--', '',
    ];
    return new Blob([lines.join('\r\n')], { type: 'message/rfc822' });
  }

  /* both contract types of that month, straight from Supabase (the page holds only one type) */
  async function monthRows(o) {
    var mon = MON3[+o.month.slice(5) - 1], yy = o.month.slice(2, 4), col = '"' + o.basis + '"';
    var f = o.basis === 'RECEIVED DATE' ? col + '.eq.' + yy + '-' + mon + ',' + col + '.ilike.*-' + mon + '-' + yy : col + '.ilike.*-' + mon + '-' + yy;
    var out = [], from = 0;
    while (true) {
      var r = await supabase.from(TABLE).select('*').or(f).range(from, from + 999);
      if (r.error) throw new Error(r.error.message);
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < 1000) break;
      from += 1000;
    }
    return out;
  }

  var excelJsLoading = null;
  function loadExcelJs() {
    if (window.ExcelJS) return Promise.resolve();
    return excelJsLoading || (excelJsLoading = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.onload = ok; s.onerror = function () { excelJsLoading = null; fail(new Error('Excel library did not load')); };
      document.head.appendChild(s);
    }));
  }

  /* ── Summary Excel ── */
  async function buildSummary(o) {
    var got = await Promise.all([monthRows(o), loadExcelJs()]);
    var rows = got[0].filter(function (r) {
      return (!o.bde || (r['CURRENT BDE'] || r['BDE'] || '') === o.bde) && (!o.team || String(r['TEAM'] || '').trim().toLowerCase() === o.team.toLowerCase());
    });
    var list = completeContracts(rows, o.basis, o.month);
    var yearly = list.filter(function (g) { return isYearly(g[0]); }), mkt = list.filter(function (g) { return !isYearly(g[0]); });
    var byName = function (a, b) { return String(a[0]['OUTLET NAME'] || '').localeCompare(String(b[0]['OUTLET NAME'] || '')) || String(a[0]['Promotion'] || '').localeCompare(String(b[0]['Promotion'] || '')); };
    yearly.sort(byName); mkt.sort(byName);
    var all = yearly.concat(mkt);
    var typeOf = function (g) { return isYearly(g[0]) ? 'Yearly Contract' : String(g[0]['Promotion'] || '').trim(); };
    var bdeOf = function (g) { return g[0]['CURRENT BDE'] || g[0]['BDE'] || ''; };

    var wb = new ExcelJS.Workbook();
    wb.creator = 'Archive — One for All'; wb.created = new Date();
    var F = function (size, bold) { return { name: 'Aptos Narrow', size: size, bold: !!bold }; };
    var solid = function (argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; };
    var thin = { style: 'thin', color: { argb: 'FFBFBFBF' } }, box = { top: thin, left: thin, bottom: thin, right: thin };
    var GRAY = 'FFD8D8D8', LIGHT = 'FFF2F2F2';

    /* 1) Monthly Contract Summary — the team's layout (landscape A4, fits the width) */
    var ws = wb.addWorksheet('Contract Summary', { views: [{ showGridLines: false }] });
    ws.columns = [16.1, 56.7, 56.7, 29, 61, 25.1, 22.6, 99].map(function (w) { return { width: w }; });
    ws.getRow(1).height = 34.5;
    ws.getCell('A1').value = 'Monthly Contract Summary'; ws.getCell('A1').font = F(20, true);
    [['BDE:', o.bde || ''], ['TEAM:', o.team || ''], ['Month:', o.monthShort]].forEach(function (x, i) {
      var r = 2 + i; ws.getRow(r).height = 18.75;
      ws.getCell('A' + r).value = x[0]; ws.getCell('A' + r).font = F(14, true);
      ws.mergeCells('B' + r + ':E' + r);
      var c = ws.getCell('B' + r); c.value = x[1]; c.font = F(14, true); c.fill = solid(LIGHT); c.alignment = { horizontal: 'left', vertical: 'middle' };
    });
    var head = ['No.', 'Outlet Name', 'BDE NAME', 'Area', 'Type of Contract', 'No.SKUs in Contract', 'SKUs Already List', 'Remark'];
    var hr = ws.getRow(7); hr.height = 18.75;
    head.forEach(function (h, i) { var c = hr.getCell(i + 1); c.value = h; c.font = F(14, true); c.fill = solid(GRAY); c.border = box; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
    all.forEach(function (g, i) {
      var r = g[0], row = ws.getRow(8 + i); row.height = 18.75;
      var skus = isYearly(r) ? '' : (g.map(function (x) { return +x['Total Sku'] || 0; }).reduce(function (a, b) { return a + b; }, 0) || '');
      var vals = [i + 1, r['OUTLET NAME'] || r['CODE OUTLET'] || '', bdeOf(g), r['AREA'] || '', typeOf(g), skus, '', r['REMARK'] || ''];
      vals.forEach(function (v, j) {
        var c = row.getCell(j + 1); c.value = v === '' ? null : v; c.font = F(14); c.border = box;
        c.alignment = { horizontal: [0, 2, 3, 5, 6].indexOf(j) >= 0 ? 'center' : 'left', vertical: 'middle' };
        if (j >= 2 && j <= 4) c.fill = solid(LIGHT);
      });
    });
    var last = 8 + all.length;   /* closing gray row under the table, like the original */
    for (var cI = 1; cI <= 8; cI++) { var lc = ws.getRow(last).getCell(cI); lc.fill = solid(GRAY); lc.border = box; }
    ws.getRow(last).height = 18.75;
    [['RequestFrom :', last + 3], ['Approval             :', last + 6]].forEach(function (x) {
      var c = ws.getCell('A' + x[1]); c.value = x[0]; c.font = F(14, true);
      ws.getCell('B' + x[1]).border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
      ws.getRow(x[1]).height = 18.75;
    });
    ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, printArea: 'A1:H' + (last + 7), printTitlesRow: '7:7' };

    /* 2) Cover Performance (print page) — totals + by BDE + by type of contract */
    var main = ((window.themeColor ? themeColor('--c1', '#B0120A') : '#B0120A').replace('#', '')).toUpperCase(), tint = ((window.themeColor ? themeColor('--c3', '#FDE0DC') : '#FDE0DC').replace('#', '')).toUpperCase();
    var cv = wb.addWorksheet('Cover Performance', { views: [{ showGridLines: false }] });
    cv.columns = [3, 28, 12, 11, 9, 3, 34, 12, 9].map(function (w) { return { width: w }; });
    var count = function (fn) { var x = {}; all.forEach(function (g) { var k = fn(g) || '(blank)'; x[k] = (x[k] || 0) + 1; }); return x; };
    var byBde = count(bdeOf), byType = count(typeOf);
    var bdes = Object.keys(byBde).sort(function (a, b) { return byBde[b] - byBde[a] || a.localeCompare(b); });
    var types = Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a] || a.localeCompare(b); });
    var outletsOf = function (arr) { var x = {}; arr.forEach(function (g) { x[g[0]['CODE OUTLET'] || g[0]['OUTLET NAME']] = 1; }); return Object.keys(x).length; };
    var total = all.length;
    cv.mergeCells('B2:I2'); cv.getCell('B2').value = 'Cover Performance'; cv.getCell('B2').font = { size: 26, bold: true, color: { argb: 'FF' + main } }; cv.getRow(2).height = 34;
    cv.mergeCells('B3:I3'); cv.getCell('B3').value = 'Monthly Contract Summary — ' + o.monthName + ' (month of ' + o.basisLabel + ')' + (o.bde ? ' · BDE ' + o.bde : '') + (o.team ? ' · ' + o.team : '');
    cv.getCell('B3').font = { size: 13, bold: true };
    cv.mergeCells('B4:I4'); cv.getCell('B4').value = 'Complete = no On Doc, and Status On Doc is Signed or blank  ·  Prepared ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    cv.getCell('B4').font = { size: 9, color: { argb: 'FF666666' } };
    [['B', 'Complete contracts', total], ['C', 'Yearly', yearly.length], ['D', 'Marketing', mkt.length], ['G', 'Outlets', outletsOf(all)], ['H', 'BDEs', bdes.length]].forEach(function (k) {
      cv.getCell(k[0] + '6').value = k[1]; cv.getCell(k[0] + '6').font = { size: 9, color: { argb: 'FF666666' } };
      cv.getCell(k[0] + '7').value = k[2]; cv.getCell(k[0] + '7').font = { size: 22, bold: true, color: { argb: 'FF' + main } }; cv.getCell(k[0] + '7').alignment = { horizontal: 'left' };
    });
    cv.getRow(7).height = 30;
    var hc = function (c) { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = solid('FF' + main); c.border = box; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; };
    var bc = function (c, t) { c.border = box; c.alignment = { vertical: 'middle', wrapText: true }; if (t) { c.font = { bold: true }; c.fill = solid('FF' + tint); } };
    var r0 = 9;
    cv.getCell('B' + r0).value = 'Summary by BDE'; cv.getCell('B' + r0).font = { bold: true, size: 12 };
    cv.getCell('G' + r0).value = 'Summary by Type of Contract'; cv.getCell('G' + r0).font = { bold: true, size: 12 };
    var h1 = cv.getRow(r0 + 1);
    [[2, 'BDE'], [3, 'Contracts'], [4, 'Outlets'], [5, '%'], [7, 'Type of Contract'], [8, 'Contracts'], [9, '%']].forEach(function (x) { h1.getCell(x[0]).value = x[1]; hc(h1.getCell(x[0])); });
    var n = Math.max(bdes.length, types.length) + 1;
    for (var i = 0; i < n; i++) {
      var row = cv.getRow(r0 + 2 + i);
      if (i <= bdes.length) {
        var t = i === bdes.length, b = bdes[i];
        row.getCell(2).value = t ? 'Total' : b; row.getCell(3).value = t ? total : byBde[b];
        row.getCell(4).value = t ? outletsOf(all) : outletsOf(all.filter(function (g) { return (bdeOf(g) || '(blank)') === b; }));
        row.getCell(5).value = t ? 1 : (total ? byBde[b] / total : 0); row.getCell(5).numFmt = '0%';
        [2, 3, 4, 5].forEach(function (c) { bc(row.getCell(c), t); });
      }
      if (i <= types.length) {
        var tt = i === types.length, ty = types[i];
        row.getCell(7).value = tt ? 'Total' : ty; row.getCell(8).value = tt ? total : byType[ty];
        row.getCell(9).value = tt ? 1 : (total ? byType[ty] / total : 0); row.getCell(9).numFmt = '0%';
        [7, 8, 9].forEach(function (c) { bc(row.getCell(c), tt); });
      }
    }
    var rs = r0 + 2 + n + 3, line = { bottom: { style: 'thin', color: { argb: 'FF333333' } } };
    [[['B', 'C'], 'Prepared by'], [['D', 'E'], 'Checked by'], [['H', 'I'], 'Approved by']].forEach(function (p) {
      p[0].forEach(function (c) { cv.getCell(c + rs).border = line; });
      cv.getCell(p[0][0] + (rs + 1)).value = p[1] + '  ·  Date ___/___/____'; cv.getCell(p[0][0] + (rs + 1)).font = { size: 9, color: { argb: 'FF666666' } };
    });
    cv.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, printArea: 'A1:I' + (rs + 2) };

    /* 3) By BDE by Type of Contract (matrix) */
    var mx = wb.addWorksheet('By BDE by Type of Contract', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
    mx.columns = [{ width: 24 }].concat(types.map(function () { return { width: 18 }; })).concat([{ width: 10 }]);
    var mh = mx.addRow(['BDE'].concat(types).concat(['Total'])); mh.eachCell(hc); mh.height = 44;
    bdes.forEach(function (b) {
      var r = mx.addRow([b].concat(types.map(function (ty) { return all.filter(function (g) { return (bdeOf(g) || '(blank)') === b && (typeOf(g) || '(blank)') === ty; }).length || null; })).concat([byBde[b]]));
      for (var c = 1; c <= types.length + 2; c++) bc(r.getCell(c), false);
    });
    var tr = mx.addRow(['Total'].concat(types.map(function (ty) { return byType[ty]; })).concat([total]));
    for (var c2 = 1; c2 <= types.length + 2; c2++) bc(tr.getCell(c2), true);
    mx.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    var buf = await wb.xlsx.writeBuffer();
    return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), count: all.length, yearly: yearly.length, marketing: mkt.length };
  }

  /* ── History (7 days) + Restore ── */
  var ACTION = { INSERT: 'Added', UPDATE: 'Edited', DELETE: 'Deleted' };
  async function history() {
    if (!VIEWS[VIEW]) return;
    var V = VIEWS[VIEW];
    modal('ctHistory', 'History — ' + V.title, 'Changes made on the website in the last 7 days. Restore puts a row back the way it was before that change.',
      '<div class="ct-hwrap" id="cthList"><p class="ctd-empty">Loading…</p></div>');
    var since = new Date(Date.now() - 7 * 86400000).toISOString();
    var r = await supabase.from('contract_history').select('*').ilike('kind', V.pattern).gte('changed_at', since)
      .order('changed_at', { ascending: false }).limit(500);
    if (!$('cthList')) return;
    if (r.error) { $('cthList').innerHTML = '<p class="oti-warn">' + esc(r.error.message) + '</p>'; return; }
    var list = r.data || [];
    if (!list.length) { $('cthList').innerHTML = '<p class="ctd-empty">No changes in the last 7 days</p>'; return; }
    var fmtT = function (t) { var d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    var show = function (c, v) { return v == null || v === '' ? '—' : (['START', 'END', 'RECEIVED DATE'].indexOf(c) >= 0 ? dateShow(v) : String(v)); };
    $('cthList').innerHTML = '<table class="otd-prod ct-htbl"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Contract</th><th>What changed</th><th></th></tr></thead><tbody>' +
      list.map(function (h) {
        var d = h.new_data || h.old_data || {}, what = '';
        if (h.op === 'UPDATE') {
          what = Object.keys(h.new_data || {}).filter(function (k) { return k !== 'id' && JSON.stringify(h.old_data[k]) !== JSON.stringify(h.new_data[k]); })
            .map(function (k) { return '<div><b>' + esc(label(k)) + '</b>: ' + esc(show(k, h.old_data[k])) + ' → ' + esc(show(k, h.new_data[k])) + '</div>'; }).join('');
        } else what = esc([d['Promotion'], d['Trade Deal'], show('START', d['START']) + ' – ' + show('END', d['END'])].filter(Boolean).join(' · '));
        return '<tr><td class="nowrap">' + fmtT(h.changed_at) + '</td><td>' + esc(String(h.changed_by || '').split('@')[0]) + '</td>' +
          '<td><span class="ct-hop ' + h.op.toLowerCase() + '">' + ACTION[h.op] + '</span></td>' +
          '<td>' + esc(d['OUTLET NAME'] || d['CODE OUTLET'] || '') + '<div class="ct-hsub">' + esc(d['Code of Contract'] || '') + '</div></td>' +
          '<td>' + (what || '—') + '</td><td><button type="button" class="ct-tool" data-h="' + h.id + '">Restore</button></td></tr>';
      }).join('') + '</tbody></table>';
    $('cthList').querySelectorAll('button[data-h]').forEach(function (b) {
      b.onclick = async function () {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirm restore'; b.classList.add('ce-danger'); return; }
        b.disabled = true;
        var res = await supabase.rpc('contract_restore', { p_history_id: +b.dataset.h });
        if (res.error) { ctToast('Restore failed: ' + res.error.message, true); b.disabled = false; return; }
        ctToast('Restored'); close('ctHistory'); loadData();
      };
    });
  }
  return { monthly: monthly, history: history };
})();
