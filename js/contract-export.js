/* Contract Master → Excel in the SAME format as the team's files (Yearly / Marketing).
   templates/<kind>_contracts.xlsx is a slim copy of the original workbook: header row, column widths,
   cell styles, conditional formatting (incl. the On Doc colors that read Ref_General), frozen header,
   filter and Excel table — without data. This script writes the rows into it, one cell style per column
   (templates/<kind>_contracts.json, made from the original file), and fixes the ranges to the new row count.
   Needs: JSZip. */
window.ContractExport = (function () {
  /* Excel header → Contract Master column */
  var MAP = {
    yearly: {
      'Number of Contract': 'Code of Contract', 'Outlet Code': 'CODE OUTLET', 'Region': 'AREA', 'Company': 'Company Code',
      'Province': 'PROVINCE', 'Field': 'Field', 'Company Name': 'COMPANY', 'Outlet Name': 'OUTLET NAME', 'Group Name': 'GROUP NAME',
      'Team': 'TEAM', 'Current BDE': 'CURRENT BDE', 'BDE': 'BDE', 'Contract Type': 'Promotion', 'Total Target (ROI)': 'Total Target (ROI)',
      'Aperol Target (Liter)': 'TARGET APEROL (L.)', 'Start Dat': 'START', 'End Date': 'END', 'Status': 'Active/Inactive',
      'TYPE': 'TYPE OF CONTRACT', 'Received Date': 'RECEIVED DATE', 'ROI': 'ROI', 'SCAN': 'SCAN', 'Status On Doc': 'STATUS OF DOC',
      'On Doc': 'ON DOC', 'Remark': 'REMARK',
    },
    marketing: {
      'Code of Contract': 'Code of Contract', 'Outlet Code': 'CODE OUTLET', 'Region': 'AREA', 'Company': 'Company Code',
      'Province': 'PROVINCE', 'Company Name': 'COMPANY', 'Outlet Name': 'OUTLET NAME', 'Team': 'TEAM', 'Current BDE': 'CURRENT BDE',
      'BDE': 'BDE', 'Promotion': 'Promotion', 'Trade Deal': 'Trade Deal', 'Start Dat': 'START', 'End Date': 'END',
      'Status': 'Active/Inactive', '# Priority SKUs': 'Priority SKUs', 'Total Sku': 'Total Sku', 'Principle': 'Principle',
      'Brands': 'Brand', 'Received Date': 'RECEIVED DATE', 'SCAN': 'SCAN', 'Status Doc.': 'STATUS OF DOC', 'On Doc.': 'ON DOC', 'Remark': 'REMARK',
    },
  };
  var DATE_COLS = ['START', 'END', 'RECEIVED DATE'];
  var NUM_COLS = ['Total Target (ROI)', 'TARGET APEROL (L.)', 'Total Sku'];
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  /* "1-Mar-26" / "26-Mar" (month only) → Excel date serial */
  function serial(v) {
    var s = String(v == null ? '' : v).trim(), m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/), y, mo, d;
    if (m) { d = +m[1]; mo = MON[m[2].toLowerCase()]; y = 2000 + +m[3]; }
    else if ((m = s.match(/^(\d{2})-([A-Za-z]{3})$/))) { d = 1; mo = MON[m[2].toLowerCase()]; y = 2000 + +m[1]; }
    if (mo == null) return null;
    return Math.round((Date.UTC(y, mo, d) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  var xesc = function (s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  function cell(ref, style, dbCol, v) {
    var s = style ? ' s="' + style + '"' : '';
    if (v == null || String(v).trim() === '') return '';
    if (DATE_COLS.indexOf(dbCol) >= 0) { var n = serial(v); if (n != null) return '<c r="' + ref + '"' + s + '><v>' + n + '</v></c>'; }
    if (dbCol === 'ROI') return '<c r="' + ref + '"' + s + ' t="b"><v>' + (/^(true|1|yes)$/i.test(String(v).trim()) ? 1 : 0) + '</v></c>';
    if (NUM_COLS.indexOf(dbCol) >= 0 && /^-?\d+(\.\d+)?$/.test(String(v).trim())) return '<c r="' + ref + '"' + s + '><v>' + String(v).trim() + '</v></c>';
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
  }
  /* A1:X9999 style ranges → same columns, rows 2..last (header stays row 1) */
  function fitRanges(text, last) {
    return text.replace(/([A-Z]{1,3})(\$?)(\d+):(\$?)([A-Z]{1,3})(\$?)(\d+)/g, function (all, c1, d1, r1, d2, c2, d3, r2) {
      if (+r2 >= 1048576 || +r2 < 2) return all;
      return c1 + d1 + r1 + ':' + d2 + c2 + d3 + Math.max(last, +r1);
    });
  }

  async function run(kind, rows, fileName) {
    if (!window.JSZip) throw new Error('JSZip did not load');
    var base = 'templates/' + kind + '_contracts';
    var got = await Promise.all([fetch(base + '.xlsx', { cache: 'no-cache' }), fetch(base + '.json', { cache: 'no-cache' })]);
    if (!got[0].ok || !got[1].ok) throw new Error('Export template not found');
    var zip = await JSZip.loadAsync(await got[0].arrayBuffer()), meta = await got[1].json(), map = MAP[kind];
    var cols = meta.columns, last = rows.length + 1, lastCol = cols[cols.length - 1].col;
    var sheet = await zip.file(meta.dataSheet).async('string');

    /* rows 2.. with the original cell style of each column */
    var rowOpen = (meta.rowOpen || '<row>').replace('<row', '<row r="{R}"');
    var parts = [];
    rows.forEach(function (r, i) {
      var R = i + 2, cells = '';
      cols.forEach(function (c) {
        var db = map[c.name];
        if (db) cells += cell(c.col + R, c.style, db, r[db]);
        else if (c.style) cells += '<c r="' + c.col + R + '" s="' + c.style + '"/>';
      });
      parts.push(rowOpen.replace('{R}', R) + cells + '</row>');
    });
    sheet = sheet.replace(/<sheetData>([\s\S]*?)<\/sheetData>/, function (all, head) { return '<sheetData>' + head + parts.join('') + '</sheetData>'; });
    sheet = sheet.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:' + lastCol + last + '"/>');
    sheet = sheet.replace(/(<autoFilter ref=")([^"]*)(")/, function (a, p, ref, q) { return p + fitRanges(ref, last) + q; });
    sheet = sheet.replace(/(<conditionalFormatting[^>]* sqref=")([^"]*)(")/g, function (a, p, ref, q) { return p + fitRanges(ref, last) + q; });
    sheet = sheet.replace(/(<xm:sqref>)([^<]*)(<\/xm:sqref>)/g, function (a, p, ref, q) { return p + fitRanges(ref, last) + q; });
    sheet = sheet.replace(/(<formula>)([^<]*)(<\/formula>)/g, function (a, p, f, q) { return p + fitRanges(f, last) + q; });
    zip.file(meta.dataSheet, sheet);
    /* Excel table (Marketing) + filter name follow the new size */
    for (var t = 0; t < (meta.tables || []).length; t++) {
      var tx = await zip.file(meta.tables[t]).async('string');
      zip.file(meta.tables[t], tx.replace(/( ref=")([^"]*)(")/g, function (a, p, ref, q) { return p + fitRanges(ref, last) + q; }));
    }
    var wb = await zip.file('xl/workbook.xml').async('string');
    zip.file('xl/workbook.xml', wb.replace(/(<definedName name="_xlnm._FilterDatabase"[^>]*>)([^<]*)(<\/definedName>)/g, function (a, p, ref, q) { return p + fitRanges(ref, last) + q; }));

    var blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  return { run: run };
})();
