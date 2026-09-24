/* Contract Master — edit rows on the Yearly / Marketing raw tabs (contracts.html).
   - "Add" / "Edit" open a form with every column of that file (Excel header names), in sections
   - Marketing: one promotion (same outlet + period + promotion) can hold several trade deals —
     "Add Marketing Contract" takes any number of trade-deal lines, "Add trade deal" adds one to an existing promotion
   - "On Doc" = who holds the document: colored list; the whole row is highlighted in that color (Blank = none)
   - lookups are searchable, scrollable dropdowns; outlet fields fill in from Outlet Master
   Saves straight to "Contract Master" (RLS: signed-in users may insert / update / delete) by row id;
   every change is kept 7 days in contract_history (History button → Restore).
   Uses globals from contracts.html: TABLE, VIEWS, VIEW, allData, cols, label, esc, norm, filterRows, buildStats, loadData, _totalCount. */

/* On Doc choices — text and color as in the team's Excel legend (Ref_General) */
const ON_DOC = [
  ["Wait for P'A (Wallop) to sign", '#FFFF00'],
  ["Wait for P'Yu (Horeca - On-Premise) to sign", '#FFCCFF'],
  ['Wait for K.Natasha', '#CCEE66'],
  ['Wait for customer to sign', '#B4C7E7'],
  ['Wait for K.Philip', '#CC99FF'],
  ['Wait for K.Yanisa', '#BF8F00'],
  ['Wait for Valen', '#A6A6A6'],
  ["Wait for P'Manaw (Finance) to Sign", '#FFF2CC'],
  ["Wait for P'Tualek (Independent,Lucas) to sign", '#DDEBF7'],
  ["Wait for P'Pak (Prestige) to sign", '#92D050'],
  ["Wait for P'Oh (Campari) to sign", '#66FFFF'],
  ['Wait for Fox (RC,Proximo) to sign', '#FF9B94'],
  ['Wait for Ice (TEG - Edtington)', '#4472C4'],
  ["Wait for K'Praiya", '#FF3399'],
  ['Wait for Arno to sign', '#FFC000'],
  ['BDE Revise', '#595959'],
  ["Wait forK'Milin (BBC)", '#C9B800'],
  ["Wait forK'Pare (BBC)", '#833C0B'],
  ["Wait forK'MIkki (BBC)", '#9C0006'],
];
const ON_DOC_COL = 'ON DOC';
const _odKey = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* older spellings that mean the same person → same color, not listed twice */
const ON_DOC_ALIAS = { [_odKey('Wait for Fox (RC) to sign')]: 'Wait for Fox (RC,Proximo) to sign' };
const onDocCanon = v => { const a = ON_DOC_ALIAS[_odKey(v)]; return a || v; };
const _odMap = Object.fromEntries(ON_DOC.map(([t, c]) => [_odKey(t), c]));
/* readable text on the row color (dark text on light colors, white on dark) */
function _fgFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const L = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return (0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2]) > 0.3 ? '#111111' : '#FFFFFF';
}
function onDocStyle(v) {
  const bg = _odMap[_odKey(onDocCanon(v))];
  return bg ? { bg, fg: _fgFor(bg) } : null;
}

/* ── small toast + copy ── */
function ctToast(msg, err) {
  const t = document.createElement('div');
  t.className = 'oti-toast' + (err ? ' err' : '');
  t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
async function ctCopy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  ctToast('Copied: ' + text);
}

/* ── save helpers: patch the loaded rows so filters / scroll stay as they are ── */
function _patchRow(row) {
  const i = allData.findIndex(r => r.id === row.id);
  if (i >= 0) allData[i] = row; else { allData.unshift(row); if (_totalCount > 0) _totalCount++; }
  buildStats(allData);
  filterRows(true);   /* keep the rows already shown */
}
async function ctDelete(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) { ctToast('Delete failed: ' + error.message, true); return false; }
  _dropRow(id);
  return true;
}
function _dropRow(id) {
  const i = allData.findIndex(r => r.id === id);
  if (i < 0) return;
  allData.splice(i, 1);
  if (_totalCount > 0) _totalCount--;
  buildStats(allData);
  filterRows(true);
}
async function ctSave(id, fields) {
  const q = id == null
    ? supabase.from(TABLE).insert(fields).select()
    : supabase.from(TABLE).update(fields).eq('id', id).select();
  const { data, error } = await q;
  if (error) { ctToast('Save failed: ' + error.message, true); return null; }
  (data || []).forEach(_patchRow);
  return data;
}

/* ── On Doc dropdown on the table (one shared popover) ── */
function onDocChoices() {
  const extra = [...new Set(allData.map(r => String(r[ON_DOC_COL] ?? '').trim())
    .filter(v => v && v !== '.' && !_odMap[_odKey(onDocCanon(v))]))];
  return ON_DOC.map(([t]) => t).concat(extra);
}
function openOnDoc(ev, id) {
  ev.stopPropagation();
  closeOnDoc();
  const row = allData.find(r => r.id === id); if (!row) return;
  const cur = onDocCanon(String(row[ON_DOC_COL] ?? '').trim());
  const pop = document.createElement('div');
  pop.id = 'odPop'; pop.className = 'od-pop'; pop.setAttribute('role', 'listbox');
  const opt = v => {
    const on = _odKey(v) === _odKey(cur), h = onDocStyle(v);
    return `<button type="button" class="od-opt${on ? ' on' : ''}" role="option" aria-selected="${on}" data-v="${esc(v)}"` +
      `${h ? ` style="background:${h.bg};color:${h.fg}"` : ''}>${esc(v)}</button>`;
  };
  pop.innerHTML = `<button type="button" class="od-opt od-blank${cur ? '' : ' on'}" data-v="">Blank (no highlight)</button>` + onDocChoices().map(opt).join('');
  document.body.appendChild(pop);
  const r = ev.currentTarget.getBoundingClientRect(), ph = Math.min(pop.offsetHeight, 440);
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = (r.bottom + ph + 8 < window.innerHeight ? r.bottom + 4 : Math.max(8, r.top - ph - 4)) + 'px';
  pop.querySelectorAll('.od-opt').forEach(b => b.onclick = async () => {
    closeOnDoc();
    const v = b.dataset.v || null;
    if ((v || '') === cur) return;
    if (await ctSave(id, { [ON_DOC_COL]: v })) ctToast(v ? 'On Doc: ' + v : 'On Doc cleared');
  });
}
function closeOnDoc() { const p = document.getElementById('odPop'); if (p) p.remove(); }
document.addEventListener('click', e => {
  const p = document.getElementById('odPop'); if (p && !p.contains(e.target)) closeOnDoc();
  document.querySelectorAll('.cb-list:not([hidden])').forEach(l => { if (!l.parentNode.contains(e.target)) l.hidden = true; });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeOnDoc(); closeRowEdit(); } });

/* ── searchable, scrollable dropdown ("combobox") for lookups: type to narrow, arrows + Enter to pick ── */
function comboHtml(attr, value, placeholder) {
  return `<div class="cb"><input type="text" ${attr} value="${esc(value)}" autocomplete="off" placeholder="${esc(placeholder || 'Select or type…')}" role="combobox" aria-expanded="false">` +
    `<button type="button" class="cb-arrow" tabindex="-1" aria-label="Show list"></button><div class="cb-list" role="listbox" hidden></div></div>`;
}
function comboBind(box, getOptions) {
  const inp = box.querySelector('input'), list = box.querySelector('.cb-list'), arrow = box.querySelector('.cb-arrow');
  let active = -1, items = [];
  const show = all => {
    const q = all ? '' : inp.value.trim().toLowerCase();
    items = getOptions().filter(o => !q || o.toLowerCase().includes(q)).slice(0, 300);
    list.innerHTML = items.length ? items.map((o, i) => `<div class="cb-opt" role="option" data-i="${i}">${esc(o)}</div>`).join('')
      : '<div class="cb-none">No match — the typed text is kept</div>';
    list.hidden = false; active = -1; inp.setAttribute('aria-expanded', 'true');
  };
  const pick = i => {
    if (items[i] == null) return;
    inp.value = items[i]; list.hidden = true; inp.setAttribute('aria-expanded', 'false');
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const mark = () => list.querySelectorAll('.cb-opt').forEach((d, i) => { d.classList.toggle('on', i === active); if (i === active) d.scrollIntoView({ block: 'nearest' }); });
  inp.addEventListener('focus', () => show(true));
  inp.addEventListener('click', () => { if (list.hidden) show(true); });
  inp.addEventListener('input', e => { if (e.isTrusted) show(false); });
  arrow.addEventListener('click', () => { if (list.hidden) { show(true); inp.focus(); } else list.hidden = true; });
  list.addEventListener('mousedown', e => { const o = e.target.closest('.cb-opt'); if (o) { e.preventDefault(); pick(+o.dataset.i); } });
  inp.addEventListener('keydown', e => {
    if (list.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { show(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); mark(); }
    else if (e.key === 'Enter' && !list.hidden && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') { list.hidden = true; }
  });
  inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }, 150));
}

/* ── Add / Edit row form ── */
const LONG_COLS = ['Trade Deal', 'REMARK', 'Priority SKUs'];
/* Marketing: columns that belong to one trade-deal line (the rest is shared by the promotion) */
const DEAL_COLS = ['Trade Deal', 'Priority SKUs', 'Total Sku', 'Principle', 'Brand'];
/* form sections, filled top to bottom: pick the outlet first — its details fill in, then the contract */
const FORM_SECTIONS = {
  yearly: [
    ['Outlet', 'Pick the outlet — details fill in from Outlet Master', ['OUTLET NAME', 'CODE OUTLET', 'COMPANY', 'GROUP NAME', 'Company Code', 'Field']],
    ['Location & Team', '', ['AREA', 'PROVINCE', 'TEAM', 'CURRENT BDE', 'BDE']],
    ['Contract', '', ['Promotion', 'TYPE OF CONTRACT', 'START', 'END', 'Active/Inactive', 'Code of Contract']],
    ['Target & ROI', '', ['Total Target (ROI)', 'TARGET APEROL (L.)', 'ROI']],
    ['Document', '', ['RECEIVED DATE', 'SCAN', 'STATUS OF DOC', 'ON DOC', 'REMARK']],
  ],
  marketing: [
    ['Outlet', 'Pick the outlet — details fill in from Outlet Master', ['OUTLET NAME', 'CODE OUTLET', 'COMPANY', 'Company Code']],
    ['Location & Team', '', ['AREA', 'PROVINCE', 'TEAM', 'CURRENT BDE', 'BDE']],
    ['Promotion', 'Same outlet + period + promotion = one promotion (it can hold several trade deals)', ['Promotion', 'START', 'END', 'Active/Inactive', 'Code of Contract']],
    ['Trade deal', '', DEAL_COLS],
    ['Document', '', ['RECEIVED DATE', 'SCAN', 'STATUS OF DOC', 'ON DOC', 'REMARK']],
  ],
};
/* Contract Master column ← Outlet Master column: outlet fields fill in from Outlet Master */
const OM_MAP = {
  'OUTLET NAME': 'Outlet Name', 'CODE OUTLET': 'Outlet Code', 'COMPANY': 'Company Name', 'GROUP NAME': 'Group Name',
  'TEAM': 'Team', 'CURRENT BDE': 'Current BDE', 'BDE': 'BDE', 'AREA': 'Region', 'PROVINCE': 'Province',
};
/* Outlet Master for the lookups: loaded once in the background (pages fetched in parallel) so the form opens at once */
let _om = null, _omLoading = null;
function loadOutletMaster() {
  if (_om) return Promise.resolve(_om);
  if (_omLoading) return _omLoading;
  const sel = Object.values(OM_MAP).map(c => `"${c}"`).join(',');
  _omLoading = (async () => {
    const { count } = await supabase.from('Outlet Master').select('"Outlet Code"', { count: 'exact', head: true });
    const pages = Math.max(1, Math.ceil((count || 1000) / 1000));
    const res = await Promise.all(Array.from({ length: pages }, (_, i) => supabase.from('Outlet Master').select(sel).range(i * 1000, i * 1000 + 999)));
    _om = [].concat(...res.map(r => r.data || []));
    return _om;
  })().catch(() => { _omLoading = null; return []; });
  return _omLoading;
}

/* dates: stored "1-Mar-26" (same as the Excel import) · shown "1 Mar 26" · picked with a calendar
   Received Date from the files is month only ("26-Mar" = Mar 2026) → shown "Mar 26"; a picked day is saved as "1-Mar-26" */
const _MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateShow = v => String(v ?? '').trim()
  .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, '$1 $2 $3').replace(/^(\d{2})-([A-Za-z]{3})$/, '$2 $1');
const dateDb = v => String(v ?? '').trim()
  .replace(/^(\d{1,2}) ([A-Za-z]{3}) (\d{2})$/, '$1-$2-$3').replace(/^([A-Za-z]{3}) (\d{2})$/, '$2-$1');
function dateIso(v) {   /* "1-Mar-26" / "1 Mar 26" / "26-Mar" → "2026-03-01" for the calendar */
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2})$/);
  if (!m) { const k = s.match(/^(\d{2})-([A-Za-z]{3})$/) || s.match(/^([A-Za-z]{3}) (\d{2})$/); if (k) m = /^\d/.test(k[1]) ? [0, '1', k[2], k[1]] : [0, '1', k[1], k[2]]; }
  const mi = m ? _MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase()) : -1;
  return mi < 0 ? '' : `20${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
const DATE_COLS = ['START', 'END', 'RECEIVED DATE'];
const FIELD_OPTS = ['MOT', 'HRC', 'TOT'];                       /* Yearly "Field" values in the file */
const CONTRACT_TYPES = ['Primary', 'Secondary', 'Exclusive'];   /* Yearly "Contract Type" */
const TYPE_OPTS = ['NEW OUTLET', 'RENEWAL', 'PERMANENTLY CLOSED', 'EXPIRED', 'CANCELED', 'HOLD', 'TERMINATED'];   /* Yearly "TYPE" */
/* check boxes: ticked value / unticked value as used in the files */
const CHECK_COLS = { 'SCAN': ['scanned', null], 'ROI': ['TRUE', 'FALSE'] };
const isOn = (c, v) => c === 'ROI' ? /^(true|1|yes)$/i.test(String(v ?? '').trim()) : String(v ?? '').trim() !== '';
function isoShow(iso) { const [y, mo, d] = iso.split('-'); return `${+d} ${_MON[+mo - 1]} ${y.slice(2)}`; }
const mmyy = v => { const iso = dateIso(v); return iso ? iso.slice(5, 7) + iso.slice(2, 4) : 'MMYY'; };

/* Number of Contract — running number, same pattern as the files:
     Yearly    YC-SAYU-S-0319-0220-001  = YC-<4 letters of outlet>-<S/E/P contract type>-<start MMYY>-<end MMYY>-<next no.>
     Marketing ZOEIN-CP-0726-1226-5783  = <5 letters of outlet>-<promotion initials>-<start MMYY>-<end MMYY>-<next no.> */
function nextRunning() {
  const n = allData.map(r => String(r['Code of Contract'] ?? '').match(/-(\d+)$/)).filter(Boolean).map(m => +m[1]);
  return (n.length ? Math.max(...n) : 0) + 1;
}
function autoCode(get) {
  const letters = (s, k) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, k) || 'X'.repeat(k);
  const no = nextRunning();
  if (VIEW === 'yearly')
    return ['YC', letters(get('OUTLET NAME'), 4), (String(get('Promotion') || 'S').trim()[0] || 'S').toUpperCase(),
            mmyy(get('START')), mmyy(get('END')), String(no).padStart(3, '0')].join('-');
  const initials = String(get('Promotion') || '').replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean)
    .map(w => w[0].toUpperCase()).join('').replace(/[^A-Z0-9]/g, '') || 'PROMO';
  return [letters(get('OUTLET NAME'), 5), initials, mmyy(get('START')), mmyy(get('END')), String(no).padStart(4, '0')].join('-');
}
const usedValues = c => [...new Set(allData.map(r => r[c]).filter(x => x != null && String(x).trim() !== '').map(x => String(x).trim()))]
  .sort((a, b) => a.localeCompare(b, 'th'));
const selectHtml = (attr, v, opts, blank = true) => {
  const list = opts.slice(); if (v && !list.includes(v)) list.push(v);
  return `<select ${attr}>${blank ? '<option value=""></option>' : ''}${list.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
};

/* open the form: id = row to edit · id null = new row · opts.prefill = copy the promotion fields of that row (Marketing "Add trade deal") */
async function openRowEdit(id, opts) {
  closeRowEdit();
  const V = VIEWS[VIEW]; if (!V) return;
  opts = opts || {};
  const isNew = id == null;
  const base = isNew ? (opts.prefill || {}) : allData.find(r => r.id === id);
  if (!base) return;
  const row = isNew ? Object.fromEntries(Object.entries(base).filter(([k]) => !DEAL_COLS.includes(k) && k !== 'id')) : base;
  const addDeal = isNew && !!opts.prefill;                        /* adding a trade deal to an existing promotion */
  const multiDeal = isNew && VIEW === 'marketing';                /* new marketing rows: many trade-deal lines */
  loadOutletMaster();   /* usually ready already (started when the tab opened); the lists fill in as soon as it arrives */
  const omCache = {};
  const omValues = c => {
    if (!_om) return [];
    return omCache[c] || (omCache[c] = [...new Set(_om.map(r => r[c]).filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim()))]
      .sort((a, b) => a.localeCompare(b, 'th')));
  };
  const optionsFor = c => OM_MAP[c] ? omValues(OM_MAP[c]) : usedValues(c);
  const fields = V.cols.concat(cols.filter(c => !V.cols.includes(c)));

  /* one input for column c; attr = data-col (shared) or data-dcol (trade-deal line) */
  const control = (c, v, attr) => {
    v = v == null ? '' : String(v);
    if (c === 'Active/Inactive') return selectHtml(attr, v || (isNew ? 'Active' : ''), ['Active', 'Inactive']);
    if (c === ON_DOC_COL) {   /* colored like the legend; the box takes the chosen color */
      const cv = onDocCanon(v), hl = onDocStyle(cv);
      const st = h => h ? ` style="background:${h.bg} !important;color:${h.fg} !important;-webkit-text-fill-color:${h.fg} !important"` : ' style="background:#FFFFFF;color:#111111"';
      const list = onDocChoices(); if (cv && !list.includes(cv)) list.push(cv);
      return `<select ${attr} data-ondoc="1"${hl ? st(hl) : ''}><option value=""${st(null)}>Blank (no highlight)</option>` +
        list.map(t => `<option${t === cv ? ' selected' : ''}${st(onDocStyle(t))}>${esc(t)}</option>`).join('') + '</select>';
    }
    if (c === 'Field') return selectHtml(attr, v, [...new Set(FIELD_OPTS.concat(usedValues(c)))]);
    if (c === 'Company Code') return selectHtml(attr, v, ['AAT', 'BBC']);
    if (c === 'Promotion' && VIEW === 'yearly') return selectHtml(attr, v, CONTRACT_TYPES);
    if (c === 'TYPE OF CONTRACT') return selectHtml(attr, v.toUpperCase(), [...new Set(TYPE_OPTS.concat(usedValues(c).map(x => x.toUpperCase())))]);
    if (CHECK_COLS[c]) return `<input type="checkbox" ${attr}${isOn(c, v) ? ' checked' : ''}>`;
    if (DATE_COLS.includes(c))
      return `<span class="ce-date"><input type="text" readonly ${attr} data-date="1" value="${esc(dateShow(v))}" placeholder="e.g. 31 Dec 26">` +
        `<input type="date" class="ce-date-pick" tabindex="-1" aria-hidden="true" value="${dateIso(v)}"></span>`;
    if (c === 'Code of Contract') return `<input type="text" ${attr} value="${esc(v)}"${isNew && !addDeal ? ' data-auto="1"' : ''}>`;
    if (LONG_COLS.includes(c)) return `<textarea ${attr} rows="2">${esc(v)}</textarea>`;
    if (OM_MAP[c] || optionsFor(c).length) return comboHtml(attr + ` data-combo="${esc(c)}"`, v);
    return `<input type="text" ${attr} value="${esc(v)}">`;
  };
  const field = c => {
    if (CHECK_COLS[c] && (c !== 'ROI' || VIEW === 'yearly'))
      return `<label class="ce-f ce-check">${control(c, row[c], `data-col="${esc(c)}"`)}<span>${esc(label(c))}</span></label>`;
    const wide = LONG_COLS.includes(c) || c === ON_DOC_COL;
    const hint = c === 'Code of Contract' && isNew && !addDeal ? '<small class="ce-hint">Running number — fills in automatically</small>' : '';
    return `<label class="ce-f${wide ? ' ce-wide' : ''}"><span>${esc(label(c))}</span>${control(c, row[c], `data-col="${esc(c)}"`)}${hint}</label>`;
  };
  /* Marketing new rows: repeatable trade-deal lines */
  const dealBlock = n => `<div class="ce-deal" data-deal="${n}"><div class="ce-deal-head"><b>Trade deal ${n + 1}</b>` +
    `<button type="button" class="ce-deal-del" title="Remove this trade deal">Remove</button></div><div class="ce-grid">` +
    DEAL_COLS.filter(c => fields.includes(c)).map(c => `<label class="ce-f${LONG_COLS.includes(c) ? ' ce-wide' : ''}"><span>${esc(label(c))}</span>${control(c, '', `data-dcol="${esc(c)}"`)}</label>`).join('') +
    '</div></div>';
  const sectionsHtml = () => {
    const secs = (FORM_SECTIONS[VIEW] || []).map(([t, h, cs]) => [t, h, cs.filter(c => fields.includes(c))]);
    const listed = secs.flatMap(x => x[2]), rest = fields.filter(c => !listed.includes(c));
    if (rest.length) secs.push(['Other', '', rest]);
    return secs.filter(x => x[2].length).map(([t, h, cs], i) => {
      const head = `<div class="ce-sec-head"><span class="ce-sec-no">${i + 1}</span><b>${esc(multiDeal && t === 'Trade deal' ? 'Trade deals' : t)}</b>${h ? `<small>${esc(h)}</small>` : ''}</div>`;
      if (multiDeal && t === 'Trade deal')
        return `<section class="ce-sec">${head}<div id="ceDeals">${dealBlock(0)}</div>` +
          '<button type="button" class="ce-deal-add" id="ceDealAdd">+ Add another trade deal</button></section>';
      return `<section class="ce-sec">${head}<div class="ce-grid">${cs.map(field).join('')}</div></section>`;
    }).join('');
  };

  const title = addDeal ? 'Add Trade Deal' : (isNew ? 'Add ' : 'Edit ') + V.title;
  const sub = addDeal ? 'To promotion: ' + (row['Promotion'] || '') + ' · ' + (row['OUTLET NAME'] || '')
    : isNew ? 'Fill in each section from top to bottom, then check the summary before saving'
    : (row['OUTLET NAME'] || '') + ' · ' + (row['Code of Contract'] || row['CODE OUTLET'] || '');
  const ov = document.createElement('div');
  ov.className = 'oti-overlay open'; ov.id = 'ceOverlay';
  ov.innerHTML =
    `<div class="oti-modal ce-modal" role="dialog" aria-modal="true" aria-labelledby="ceTitle">
      <div class="oti-head"><div><h3 id="ceTitle">${esc(title)}</h3><p>${esc(sub)}</p></div>
        <button class="oti-x" type="button" id="ceClose">Close</button></div>
      <div class="ce-msg" id="ceMsg" role="alert"></div>
      <form class="oti-body ce-form" id="ceForm">${sectionsHtml()}</form>
      <div class="oti-body ce-preview" id="cePreview" hidden></div>
      <div class="oti-foot">${isNew ? '' : '<button class="ce-del" type="button" id="ceDelete">Delete record</button>'}` +
      `${!isNew && VIEW === 'marketing' ? '<button class="ce-deal-add" type="button" id="ceAddDeal">+ Add trade deal to this promotion</button>' : ''}` +
      `<button class="oti-cancel" type="button" id="ceCancel">Cancel</button>
        <button class="oti-go" type="button" id="ceSave">${isNew ? esc(title) : 'Save changes'}</button></div>
    </div>`;
  document.body.appendChild(ov);
  const form = ov.querySelector('#ceForm');
  const inp = c => form.querySelector(`[data-col="${c}"]`);
  const get = c => { const el = inp(c); return el ? el.value.trim() : ''; };

  /* wire the controls inside an element (whole form, or a new trade-deal block) */
  const wire = root => {
    root.querySelectorAll('.cb').forEach(box => { const c = box.querySelector('input').dataset.combo; comboBind(box, () => optionsFor(c)); });
    root.querySelectorAll('.ce-date').forEach(box => {   /* calendar: click the box → date picker → "31 Dec 26" */
      const txt = box.querySelector('input[type=text]'), pick = box.querySelector('.ce-date-pick');
      const openPick = () => { try { pick.showPicker(); } catch (e) { pick.focus(); pick.click(); } };
      txt.addEventListener('click', openPick);
      txt.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPick(); } });
      pick.addEventListener('change', () => { txt.value = pick.value ? isoShow(pick.value) : ''; txt.dispatchEvent(new Event('input', { bubbles: true })); });
    });
    root.querySelectorAll('[data-ondoc]').forEach(od => od.addEventListener('change', () => {   /* On Doc box shows the chosen color */
      const h = onDocStyle(od.value);
      [['background', h && h.bg], ['color', h && h.fg], ['-webkit-text-fill-color', h && h.fg]]
        .forEach(([p, x]) => x ? od.style.setProperty(p, x, 'important') : od.style.removeProperty(p));
    }));
  };
  wire(form);
  /* trade-deal lines: add / remove (at least one stays) */
  let dealN = 1;
  const renumber = () => form.querySelectorAll('.ce-deal').forEach((d, i) => { d.querySelector('.ce-deal-head b').textContent = 'Trade deal ' + (i + 1); });
  const bindDeal = d => d.querySelector('.ce-deal-del').onclick = () => {
    if (form.querySelectorAll('.ce-deal').length > 1) { d.remove(); renumber(); markFilled(); }
  };
  form.querySelectorAll('.ce-deal').forEach(bindDeal);
  const addBtn = form.querySelector('#ceDealAdd');
  if (addBtn) addBtn.onclick = () => {
    const tmp = document.createElement('div'); tmp.innerHTML = dealBlock(dealN++);
    const d = tmp.firstChild; form.querySelector('#ceDeals').appendChild(d); wire(d); bindDeal(d); renumber();
    const f = d.querySelector('[data-dcol]'); if (f) f.focus();
  };

  /* Outlet Name / Outlet Code picked → fill outlet fields from Outlet Master */
  const fillFrom = col => {
    const o = (_om || []).find(r => String(r[OM_MAP[col]] ?? '').trim().toLowerCase() === get(col).toLowerCase());
    if (!o) return;
    Object.keys(OM_MAP).forEach(c => { if (c !== col && inp(c) && o[OM_MAP[c]] != null) inp(c).value = String(o[OM_MAP[c]]).trim(); });
  };
  /* running Number of Contract (new rows; stops once the user types their own) */
  const codeEl = inp('Code of Contract');
  const refreshCode = () => { if (codeEl && codeEl.dataset.auto === '1') codeEl.value = autoCode(get); };
  if (codeEl) codeEl.addEventListener('input', e => { if (e.isTrusted) codeEl.dataset.auto = '0'; });
  /* boxes that hold data turn dark gray */
  const markFilled = () => form.querySelectorAll('[data-col], [data-dcol]').forEach(el => {
    if (el.type !== 'checkbox') el.classList.toggle('ce-filled', el.value.trim() !== '');
  });
  ['OUTLET NAME', 'CODE OUTLET'].forEach(c => { const el = inp(c); if (el) el.addEventListener('change', () => { fillFrom(c); refreshCode(); markFilled(); }); });
  form.addEventListener('input', e => { if (e.target !== codeEl) refreshCode(); markFilled(); });
  form.addEventListener('change', markFilled);
  refreshCode();
  markFilled();

  ov.addEventListener('mousedown', e => { if (e.target === ov) closeRowEdit(); });
  document.getElementById('ceClose').onclick = closeRowEdit;
  const saveBtn = document.getElementById('ceSave'), cancelBtn = document.getElementById('ceCancel');
  const saveLabel = saveBtn.textContent;
  let pending = null;   /* rows waiting for confirmation on the summary preview, or 'delete' */
  const delBtn = document.getElementById('ceDelete'), dealBtn = document.getElementById('ceAddDeal');
  if (dealBtn) dealBtn.onclick = () => openRowEdit(null, { prefill: row });
  const preview = html => {
    document.getElementById('cePreview').innerHTML = html;
    form.hidden = true; document.getElementById('cePreview').hidden = false;
    cancelBtn.textContent = 'Back to edit';
    if (delBtn) delBtn.hidden = true; if (dealBtn) dealBtn.hidden = true;
    ov.querySelector('.ce-modal').scrollTop = 0;
  };
  const backToForm = () => {
    pending = null;
    form.hidden = false; document.getElementById('cePreview').hidden = true;
    saveBtn.textContent = saveLabel; cancelBtn.textContent = 'Cancel';
    saveBtn.classList.remove('ce-danger'); if (delBtn) delBtn.hidden = false; if (dealBtn) dealBtn.hidden = false;
  };
  /* Delete record: confirm first (shows what will be removed); kept in the 7-day history */
  if (delBtn) delBtn.onclick = () => {
    pending = 'delete';
    const keyCols = ['Code of Contract', 'OUTLET NAME', 'CODE OUTLET', 'Promotion', 'Trade Deal', 'START', 'END', 'Active/Inactive', ON_DOC_COL].filter(c => fields.includes(c));
    preview(`<div class="ce-del-warn"><b>Delete this ${esc(V.title)} record?</b> It is removed from Contract Master for everyone. ` +
      'It stays in History for 7 days, so it can be restored.</div>' +
      '<div class="otd-tablewrap"><table class="otd-prod ce-sum"><tbody>' +
      keyCols.map(c => `<tr><td>${esc(label(c))}</td><td>${row[c] == null || row[c] === '' ? '<span class="ce-none">—</span>' : esc(DATE_COLS.includes(c) ? dateShow(row[c]) : row[c])}</td></tr>`).join('') +
      '</tbody></table></div>');
    saveBtn.textContent = 'Yes, delete'; saveBtn.classList.add('ce-danger');
  };
  cancelBtn.onclick = () => (pending ? backToForm() : closeRowEdit());
  /* summary before saving: new = every filled field (+ each trade deal) · edit = what changes (before → after) */
  const shown = v => v == null || v === '' ? '<span class="ce-none">—</span>' : esc(v);
  const val = (c, v) => CHECK_COLS[c] ? (isOn(c, v) ? 'Yes' : 'No') : DATE_COLS.includes(c) && v ? esc(dateShow(v)) : shown(v);
  const odTd = (c, v) => { const h = c === ON_DOC_COL ? onDocStyle(v) : null; return h ? ` style="background:${h.bg};color:${h.fg}"` : ''; };
  const showPreview = (shared, deals) => {
    const keys = Object.keys(shared).filter(c => c !== 'Type');
    let html = `<div class="ce-sum-head">${isNew ? 'Please check before saving' : 'Please check the changes before saving'} ` +
      `<b>(${keys.length} field${keys.length === 1 ? '' : 's'}${deals ? ' · ' + deals.length + ' trade deal' + (deals.length === 1 ? '' : 's') : ''})</b></div>` +
      `<div class="otd-tablewrap"><table class="otd-prod ce-sum"><thead><tr><th>Field</th>${isNew ? '' : '<th>Before</th>'}<th>${isNew ? 'Value' : 'After'}</th></tr></thead><tbody>` +
      keys.map(c => `<tr><td>${esc(label(c))}</td>${isNew ? '' : `<td${odTd(c, row[c])}>${val(c, row[c])}</td>`}<td${odTd(c, shared[c])}>${val(c, shared[c])}</td></tr>`).join('') +
      '</tbody></table></div>';
    if (deals) {
      const dc = DEAL_COLS.filter(c => fields.includes(c));
      html += '<div class="ce-sum-head">Trade deals in this promotion</div><div class="otd-tablewrap"><table class="otd-prod ce-sum"><thead><tr><th>#</th>' +
        dc.map(c => `<th>${esc(label(c))}</th>`).join('') + '</tr></thead><tbody>' +
        deals.map((d, i) => `<tr><td>${i + 1}</td>${dc.map(c => `<td>${shown(d[c])}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
    }
    preview(html);
    saveBtn.textContent = 'Confirm & Save';
  };
  /* a problem is shown at the top of the form (and as a toast), and the box to fix gets focus */
  const warn = (msg, el) => {
    document.getElementById('ceMsg').textContent = msg;
    ov.querySelector('.ce-modal').scrollTop = 0; ctToast(msg, true);
    if (el) { el.focus(); el.classList.add('ce-need'); setTimeout(() => el.classList.remove('ce-need'), 2500); }
  };
  const readValue = (el, c, old) => {
    let v = el.value.trim() === '' ? null : el.value.trim();
    if (el.type === 'checkbox') v = CHECK_COLS[c][el.checked ? 0 : 1];   /* Scan: "scanned" / empty · ROI: TRUE / FALSE */
    if (v != null && el.dataset.date) v = dateDb(v);
    if (c === 'TYPE OF CONTRACT' && v) v = v.toUpperCase();
    return v;
  };
  saveBtn.onclick = async () => {
    if (pending === 'delete') {   /* confirmed → delete */
      saveBtn.disabled = true;
      const ok = await ctDelete(id);
      saveBtn.disabled = false;
      if (ok) { closeRowEdit(); ctToast(V.title + ' record deleted'); }
      return;
    }
    if (pending) {   /* confirmed on the preview → save (one or several rows) */
      saveBtn.disabled = true;
      const saved = await ctSave(isNew ? null : id, isNew ? pending : pending[0]);
      saveBtn.disabled = false;
      if (saved) { closeRowEdit(); ctToast(isNew ? (saved.length > 1 ? saved.length + ' trade deals added' : title.replace(/^Add /, '') + ' added') : 'Saved'); }
      return;
    }
    const shared = {};
    form.querySelectorAll('[data-col]').forEach(el => {
      const c = el.dataset.col, v = readValue(el, c);
      if (el.type === 'checkbox' && !isNew && el.checked === isOn(c, row[c])) return;   /* unchanged box */
      if (isNew ? v != null : (row[c] == null ? null : String(row[c])) !== v) shared[c] = v;
    });
    if (isNew && addDeal) Object.keys(row).forEach(c => { if (!(c in shared) && row[c] != null && c !== 'Type' && fields.includes(c) && !form.querySelector(`[data-col="${c}"]`)) shared[c] = row[c]; });
    let deals = null;
    if (multiDeal) {
      deals = [...form.querySelectorAll('.ce-deal')].map(d => {
        const o = {}; d.querySelectorAll('[data-dcol]').forEach(el => { const v = readValue(el, el.dataset.dcol); if (v != null) o[el.dataset.dcol] = v; });
        return o;
      }).filter(o => Object.keys(o).length);
      if (!deals.length) { warn('Please fill in at least one trade deal.', form.querySelector('[data-dcol]')); return; }
    }
    if (isNew) {
      if (!shared['CODE OUTLET']) { warn('Please pick an Outlet Name from the list (or fill in Outlet Code) before saving.', inp('OUTLET NAME')); return; }
      shared['Type'] = V.title;
    } else if (!Object.keys(shared).length) { warn('Nothing has changed.'); return; }
    document.getElementById('ceMsg').textContent = '';
    pending = deals ? deals.map(d => Object.assign({}, shared, d)) : [shared];
    showPreview(shared, deals);
  };
  const first = inp('OUTLET NAME') || form.querySelector('[data-col], [data-dcol]');
  if (first && !addDeal) first.focus(); else { const d = form.querySelector('[data-dcol]'); if (d) d.focus(); }
}
function closeRowEdit() { const o = document.getElementById('ceOverlay'); if (o) o.remove(); }

/* ── realtime: single-row edits are patched in place; imports / many changes → reload ── */
let _ctReload = null, _ctBurst = 0, _ctBurstT = null;
function ctLive(p) {
  if (!_ctReload) _ctReload = liveReload(() => loadData());
  /* an import sends thousands of changes at once → one full reload instead of patching each row */
  _ctBurst++; clearTimeout(_ctBurstT); _ctBurstT = setTimeout(() => { _ctBurst = 0; }, 3000);
  if (_ctBurst > 20) { _ctReload(); return; }
  if (VIEW && p && p.eventType === 'DELETE' && p.old && p.old.id != null) { _dropRow(p.old.id); return; }
  if (VIEW && p && (p.eventType === 'UPDATE' || p.eventType === 'INSERT') && p.new && p.new.id != null) {
    const cur = allData.find(r => r.id === p.new.id);
    if (p.eventType === 'INSERT' && !cur && !new RegExp(VIEWS[VIEW].pattern.replace(/%/g, ''), 'i').test(p.new['Type'] || '')) return;
    if (!cur || JSON.stringify(cur) !== JSON.stringify(p.new)) _patchRow(p.new);
    return;
  }
  _ctReload();
}
