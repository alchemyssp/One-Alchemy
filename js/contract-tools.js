/* Contract Master — tools on the Yearly / Marketing tabs (contracts.html)
   · Monthly summary: contracts that are COMPLETE in a month — no On Doc, and Status On Doc is "Signed" or blank.
     Shows the list, downloads it in the team's Excel format, and opens an e-mail with the summary.
   · History: every add / edit / delete made on the website in the last 7 days (contract_history), with Restore.
     Older history is removed automatically every night.
   Uses globals from contracts.html / contract-edit.js: VIEW, VIEWS, allData, ctKey, label, esc, dateShow, dateIso,
   onDocStyle, exportExcel, ctToast, loadData. */
window.ContractTools = (function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var $ = function (id) { return document.getElementById(id); };

  function modal(id, title, sub, body, foot) {
    close(id);
    var ov = document.createElement('div');
    ov.className = 'oti-overlay open'; ov.id = id;
    ov.innerHTML = '<div class="oti-modal ct-tool-modal" role="dialog" aria-modal="true" aria-labelledby="' + id + 'T">' +
      '<div class="oti-head"><div><h3 id="' + id + 'T">' + esc(title) + '</h3><p>' + esc(sub) + '</p></div>' +
      '<button class="oti-x" type="button" data-close>Close</button></div>' +
      '<div class="oti-body">' + body + '</div><div class="oti-foot">' + (foot || '') + '</div></div>';
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
  function monthly() {
    if (!VIEWS[VIEW]) return;
    var V = VIEWS[VIEW];
    var body =
      '<div class="ct-mrow"><label>Month of <select id="ctmBasis"><option value="START">Start Date</option><option value="RECEIVED DATE">Received Date</option></select></label>' +
      '<label>Month <select id="ctmMonth"></select></label>' +
      '<label class="ct-mto">E-mail to <input type="email" id="ctmTo" placeholder="name@alchemy-asia.com (optional)"></label></div>' +
      '<div class="ct-mnote">Complete = no On Doc, and Status On Doc is Signed or blank.</div>' +
      '<div id="ctmSum" class="ct-msum"></div><div class="otd-tablewrap ct-mwrap"><table class="otd-prod ct-mtbl" id="ctmTbl"></table></div>';
    var foot = '<button class="oti-cancel" type="button" data-close>Close</button>' +
      '<button class="ct-tool" type="button" id="ctmXlsx">Download Excel</button>' +
      '<button class="ct-tool" type="button" id="ctmCopy">Copy summary</button>' +
      '<button class="ct-tool" type="button" id="ctmMail">Mail app</button>' +
      '<button class="oti-go" type="button" id="ctmOutlook">Send with Outlook</button>';
    var ov = modal('ctMonthly', 'Monthly Summary — ' + V.title, 'Contracts that are complete in the chosen month', body, foot);
    var rowsFor = null, contracts = [];
    var fillMonths = function () {
      var basis = $('ctmBasis').value, seen = {};
      allData.forEach(function (r) { var iso = dateIso(r[basis]); if (iso) seen[iso.slice(0, 7)] = 1; });
      var list = Object.keys(seen).sort().reverse(), now = new Date().toISOString().slice(0, 7);
      $('ctmMonth').innerHTML = list.map(function (m) { return '<option value="' + m + '"' + (m === now ? ' selected' : '') + '>' + MONTHS[+m.slice(5) - 1] + ' ' + m.slice(0, 4) + '</option>'; }).join('');
      draw();
    };
    var draw = function () {
      var basis = $('ctmBasis').value, m = $('ctmMonth').value;
      rowsFor = allData.filter(function (r) { var iso = dateIso(r[basis]); return iso && iso.slice(0, 7) === m && isComplete(r); });
      var byKey = {};
      rowsFor.forEach(function (r) { var k = ctKey(r); (byKey[k] = byKey[k] || []).push(r); });
      /* a contract counts as complete only when every one of its rows is complete */
      contracts = Object.keys(byKey).filter(function (k) {
        return allData.every(function (r) { return ctKey(r) !== k || isComplete(r); });
      }).map(function (k) { return byKey[k]; });
      rowsFor = [].concat.apply([], contracts);
      var byBde = {};
      contracts.forEach(function (g) { var b = g[0]['CURRENT BDE'] || g[0]['BDE'] || '—'; byBde[b] = (byBde[b] || 0) + 1; });
      $('ctmSum').innerHTML = '<b>' + contracts.length.toLocaleString() + '</b> complete contract' + (contracts.length === 1 ? '' : 's') +
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
    $('ctmMonth').onchange = draw;
    fillMonths();
    var monthName = function () { var m = $('ctmMonth').value; return m ? MONTHS[+m.slice(5) - 1] + ' ' + m.slice(0, 4) : ''; };
    $('ctmXlsx').onclick = function () {
      if (!rowsFor.length) { ctToast('No complete contracts in this month', true); return; }
      exportExcel(rowsFor, V.file + '_Complete_' + $('ctmMonth').value);
    };
    /* e-mail text (subject + body); the body is also copied, so it can be pasted if a mail window does not open */
    var mailText = function (maxLines) {
      var lines = contracts.slice(0, maxLines).map(function (g, i) {
        var r = g[0];
        return (i + 1) + '. ' + (r['OUTLET NAME'] || r['CODE OUTLET'] || '') + ' — ' + (r['Code of Contract'] || '') + ' — ' +
          (r['Promotion'] || '') + ' — ' + dateShow(r['START']) + ' to ' + dateShow(r['END']) + ' — ' + (r['CURRENT BDE'] || r['BDE'] || '');
      });
      return {
        subject: 'Complete ' + V.title + 's — ' + monthName() + ' (' + contracts.length + ')',
        body: 'Hi,\n\n' + contracts.length + ' ' + V.title + (contracts.length === 1 ? ' is' : 's are') + ' complete in ' + monthName() +
          ' (no On Doc; Status On Doc Signed or blank):\n\n' + lines.join('\n') +
          (contracts.length > maxLines ? '\n… and ' + (contracts.length - maxLines) + ' more (see the attached Excel).' : '') +
          '\n\nFull details: Archive → Contract Master → ' + V.title + ' → Monthly summary.\n',
      };
    };
    var ready = function () { if (!contracts.length) { ctToast('No complete contracts in this month', true); return false; } return true; };
    var copyBody = async function (t) {
      try { await navigator.clipboard.writeText(t.subject + '\n\n' + t.body); return true; } catch (e) { return false; }
    };
    $('ctmCopy').onclick = async function () {
      if (!ready()) return;
      ctToast(await copyBody(mailText(1000)) ? 'Summary copied — paste it into any e-mail' : 'Could not copy', !navigator.clipboard);
    };
    /* Outlook on the web (Office 365): opens a new e-mail with everything filled in */
    $('ctmOutlook').onclick = async function () {
      if (!ready()) return;
      var t = mailText(150), to = $('ctmTo').value.trim();
      await copyBody(t);
      var url = 'https://outlook.office.com/mail/deeplink/compose?to=' + encodeURIComponent(to) +
        '&subject=' + encodeURIComponent(t.subject) + '&body=' + encodeURIComponent(t.body);
      var w = window.open(url, '_blank', 'noopener');
      ctToast(w ? 'Opening Outlook — the summary is also copied' : 'Pop-up blocked — allow pop-ups, or paste the copied summary', !w);
    };
    /* the computer's mail program (mailto) — kept short, mail programs refuse very long links */
    $('ctmMail').onclick = async function () {
      if (!ready()) return;
      var n = Math.min(contracts.length, 25), t = mailText(n), to = $('ctmTo').value.trim(), link;
      while (true) {
        link = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(t.subject) + '&body=' + encodeURIComponent(t.body);
        if (link.length < 1900 || n <= 3) break;
        n = Math.max(3, n - 3); t = mailText(n);
      }
      await copyBody(mailText(1000));
      window.location.href = link;
      ctToast('If no mail window opens, paste the copied summary into your e-mail');
    };
  }
  /* ── History (7 days) + Restore ── */
  var ACTION = { INSERT: 'Added', UPDATE: 'Edited', DELETE: 'Deleted' };
  async function history() {
    if (!VIEWS[VIEW]) return;
    var V = VIEWS[VIEW];
    var ov = modal('ctHistory', 'History — ' + V.title, 'Changes made on the website in the last 7 days. Restore puts a row back the way it was before that change.',
      '<div class="ct-hwrap" id="cthList"><p class="ctd-empty">Loading…</p></div>', '<button class="oti-cancel" type="button" data-close>Close</button>');
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
