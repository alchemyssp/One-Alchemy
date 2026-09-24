/* Contract Master — edit rows on the Yearly / Marketing raw tabs (contracts.html).
   - "Add row" / "Edit" open a form with every column of that file (Excel header names)
   - "On Doc" = who holds the document: pick from a colored list; the whole row is highlighted
     in that color until On Doc is changed or cleared (Blank = no highlight)
   Saves straight to "Contract Master" (RLS: signed-in users may insert / update) by row id.
   Uses globals from contracts.html: TABLE, VIEWS, VIEW, allData, cols, label, esc, filterRows, buildStats, buildFilters, loadData. */

/* On Doc choices — text and color as in the team's Excel legend */
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
  ['BDE Revise', '#595959'],
  ["Wait forK'Milin (BBC)", '#C9B800'],
  ["Wait forK'Pare (BBC)", '#833C0B'],
  ["Wait forK'MIkki (BBC)", '#9C0006'],
];
const ON_DOC_COL = 'ON DOC';
const _odKey = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const _odMap = Object.fromEntries(ON_DOC.map(([t, c]) => [_odKey(t), c]));
/* readable text on the row color (dark text on light colors, white on dark) */
function _fgFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const L = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return (0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2]) > 0.3 ? '#111111' : '#FFFFFF';
}
function onDocStyle(v) {
  const bg = _odMap[_odKey(v)];
  return bg ? { bg, fg: _fgFor(bg) } : null;
}

/* ── small toast ── */
function ctToast(msg, err) {
  const t = document.createElement('div');
  t.className = 'oti-toast' + (err ? ' err' : '');
  t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── save helpers: patch the loaded row so filters / scroll stay as they are ── */
function _patchRow(row) {
  const i = allData.findIndex(r => r.id === row.id);
  if (i >= 0) allData[i] = row; else allData.unshift(row);
  buildStats(allData);
  filterRows();
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
  filterRows();
}
async function ctSave(id, fields) {
  const q = id == null
    ? supabase.from(TABLE).insert(fields).select().single()
    : supabase.from(TABLE).update(fields).eq('id', id).select().single();
  const { data, error } = await q;
  if (error) { ctToast('Save failed: ' + error.message, true); return null; }
  _patchRow(data);
  return data;
}

/* ── On Doc dropdown (one shared popover) ── */
function openOnDoc(ev, id) {
  ev.stopPropagation();
  closeOnDoc();
  const row = allData.find(r => r.id === id); if (!row) return;
  const cur = String(row[ON_DOC_COL] ?? '').trim();
  /* values already used in the data but not in the legend stay selectable (no color) */
  const extra = [...new Set(allData.map(r => String(r[ON_DOC_COL] ?? '').trim()).filter(v => v && !_odMap[_odKey(v)]))];
  const pop = document.createElement('div');
  pop.id = 'odPop'; pop.className = 'od-pop'; pop.setAttribute('role', 'listbox');
  const opt = (v, bg) => {
    const on = _odKey(v) === _odKey(cur);
    const st = bg ? `background:${bg};color:${_fgFor(bg)}` : '';
    return `<button type="button" class="od-opt${on ? ' on' : ''}" role="option" aria-selected="${on}" data-v="${esc(v)}" style="${st}">${esc(v)}</button>`;
  };
  pop.innerHTML = `<button type="button" class="od-opt od-blank${cur ? '' : ' on'}" data-v="">Blank (no highlight)</button>` +
    ON_DOC.map(([t, c]) => opt(t, c)).join('') + extra.map(v => opt(v, null)).join('');
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
document.addEventListener('click', e => { const p = document.getElementById('odPop'); if (p && !p.contains(e.target)) closeOnDoc(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeOnDoc(); closeRowEdit(); } });

/* ── Add / Edit row form ── */
const LONG_COLS = ['Trade Deal', 'REMARK', 'Priority SKUs'];
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
    ['Promotion', '', ['Promotion', 'Trade Deal', 'START', 'END', 'Active/Inactive', 'Code of Contract']],
    ['Products', '', ['Principle', 'Brand', 'Priority SKUs', 'Total Sku']],
    ['Document', '', ['RECEIVED DATE', 'SCAN', 'STATUS OF DOC', 'ON DOC', 'REMARK']],
  ],
};

/* Contract Master column ← Outlet Master column: searchable dropdowns (Outlet Master values);
   picking an Outlet Name (or Outlet Code) fills the other fields from that outlet */
const OM_MAP = {
  'OUTLET NAME': 'Outlet Name', 'CODE OUTLET': 'Outlet Code', 'COMPANY': 'Company Name', 'GROUP NAME': 'Group Name',
  'TEAM': 'Team', 'CURRENT BDE': 'Current BDE', 'BDE': 'BDE', 'AREA': 'Region', 'PROVINCE': 'Province',
};
let _om = null;
async function loadOutletMaster() {
  if (_om) return _om;
  const sel = Object.values(OM_MAP).map(c => `"${c}"`).join(',');
  let rows = [], from = 0;
  while (true) {
    const { data, error } = await supabase.from('Outlet Master').select(sel).range(from, from + 999);
    if (error || !data || !data.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  _om = rows;
  return rows;
}

/* dates: stored "1-Mar-26" (same as the Excel import) · shown "1 Mar 26" · picked with a calendar */
const _MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* Received Date from the files is month only ("26-Mar" = Mar 2026) → shown "Mar 26"; a picked day is saved as "1-Mar-26" */
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

async function openRowEdit(id) {
  closeRowEdit();
  const V = VIEWS[VIEW]; if (!V) return;
  const row = id == null ? {} : allData.find(r => r.id === id);
  if (!row) return;
  const isNew = id == null;
  const om = await loadOutletMaster();
  const uniq = c => [...new Set(om.map(r => r[c]).filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim()))]
    .sort((a, b) => a.localeCompare(b, 'th'));
  const fields = V.cols.concat(cols.filter(c => !V.cols.includes(c)));
  /* numbered sections; any column not listed goes to "Other" */
  const sectionsHtml = () => {
    const secs = (FORM_SECTIONS[VIEW] || []).map(([t, h, cs]) => [t, h, cs.filter(c => fields.includes(c))]);
    const listed = secs.flatMap(x => x[2]), rest = fields.filter(c => !listed.includes(c));
    if (rest.length) secs.push(['Other', '', rest]);
    return secs.filter(x => x[2].length).map(([t, h, cs], i) =>
      `<section class="ce-sec"><div class="ce-sec-head"><span class="ce-sec-no">${i + 1}</span><b>${esc(t)}</b>${h ? `<small>${esc(h)}</small>` : ''}</div>` +
      `<div class="ce-grid">${cs.map(field).join('')}</div></section>`).join('');
  };
  const field = c => {
    const v = row[c] == null ? '' : String(row[c]);
    const lbl = `<span>${esc(label(c))}</span>`;
    if (c === 'Active/Inactive')
      return `<label class="ce-f">${lbl}<select data-col="${esc(c)}">${['', 'Active', 'Inactive'].map(o => `<option${o === (v || (isNew ? 'Active' : '')) ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`;
    if (c === ON_DOC_COL) {   /* colored like the legend; the box takes the chosen color */
      const known = ON_DOC.some(([t]) => t === v), hl = onDocStyle(v);
      const st = h => h ? ` style="background:${h.bg} !important;color:${h.fg} !important;-webkit-text-fill-color:${h.fg} !important"` : ' style="background:#FFFFFF;color:#111111"';
      return `<label class="ce-f ce-wide">${lbl}<select data-col="${esc(c)}" data-ondoc="1"${hl ? st(hl) : ''}><option value=""${st(null)}>Blank (no highlight)</option>` +
        ON_DOC.map(([t]) => `<option${t === v ? ' selected' : ''}${st(onDocStyle(t))}>${esc(t)}</option>`).join('') +
        (v && !known ? `<option selected${st(null)}>${esc(v)}</option>` : '') + '</select></label>';
    }
    if (c === 'Field') {   /* fixed list from the Yearly file + any other value already in the table */
      const opts = [...new Set(FIELD_OPTS.concat(allData.map(r => String(r[c] ?? '').trim()).filter(Boolean)))];
      if (v && !opts.includes(v)) opts.push(v);
      return `<label class="ce-f">${lbl}<select data-col="${esc(c)}"><option value=""></option>${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    if (c === 'Company Code')
      return `<label class="ce-f">${lbl}<select data-col="${esc(c)}">${['', 'AAT', 'BBC'].concat(v && !['AAT', 'BBC'].includes(v) ? [v] : [])
        .map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    if (c === 'Promotion' && VIEW === 'yearly') {   /* Contract Type: only Primary / Secondary / Exclusive (an old other value stays selectable) */
      const opts = CONTRACT_TYPES.slice();
      if (v && !opts.includes(v)) opts.push(v);
      return `<label class="ce-f">${lbl}<select data-col="${esc(c)}"><option value=""></option>${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    if (CHECK_COLS[c] && (c !== 'ROI' || VIEW === 'yearly'))
      return `<label class="ce-f ce-check"><input type="checkbox" data-col="${esc(c)}"${isOn(c, row[c]) ? ' checked' : ''}><span>${esc(label(c))}</span></label>`;
    if (DATE_COLS.includes(c))
      return `<label class="ce-f">${lbl}<span class="ce-date"><input type="text" readonly data-col="${c}" data-date="1" value="${esc(dateShow(v))}" placeholder="e.g. 31 Dec 26">` +
        `<input type="date" class="ce-date-pick" tabindex="-1" aria-hidden="true" value="${dateIso(v)}"></span></label>`;
    if (c === 'Code of Contract')
      return `<label class="ce-f">${lbl}<input type="text" data-col="${esc(c)}" value="${esc(v)}"${isNew ? ' data-auto="1"' : ''}>` +
        (isNew ? '<small class="ce-hint">Running number — fills in automatically</small>' : '') + '</label>';
    if (OM_MAP[c])
      return `<label class="ce-f">${lbl}<input type="text" data-col="${esc(c)}" value="${esc(v)}" list="ceList_${norm(c)}" autocomplete="off"` +
        ` placeholder="Select or type…"><datalist id="ceList_${norm(c)}">${uniq(OM_MAP[c]).map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>`;
    if (LONG_COLS.includes(c))
      return `<label class="ce-f ce-wide">${lbl}<textarea data-col="${esc(c)}" rows="2">${esc(v)}</textarea></label>`;
    /* short-list columns (TYPE, Principle, Brands …): values already used in this file as a dropdown */
    const used = [...new Set(allData.map(r => r[c]).filter(x => x != null && String(x).trim() !== '').map(x => String(x).trim()))];
    if (used.length && used.length <= 80)
      return `<label class="ce-f">${lbl}<input type="text" data-col="${esc(c)}" value="${esc(v)}" list="ceList_${norm(c)}" autocomplete="off" placeholder="Select or type…">` +
        `<datalist id="ceList_${norm(c)}">${used.sort((a, b) => a.localeCompare(b, 'th')).map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>`;
    return `<label class="ce-f">${lbl}<input type="text" data-col="${esc(c)}" value="${esc(v)}"></label>`;
  };
  const ov = document.createElement('div');
  ov.className = 'oti-overlay open'; ov.id = 'ceOverlay';
  ov.innerHTML =
    `<div class="oti-modal ce-modal" role="dialog" aria-modal="true" aria-labelledby="ceTitle">
      <div class="oti-head"><div><h3 id="ceTitle">${isNew ? 'Add' : 'Edit'} ${esc(V.title)}</h3>
        <p>${isNew ? 'Fill in each section from top to bottom, then check the summary before saving' : esc(row['OUTLET NAME'] || '') + ' · ' + esc(row['Code of Contract'] || row['CODE OUTLET'] || '')}</p></div>
        <button class="oti-x" type="button" id="ceClose">Close</button></div>
      <div class="ce-msg" id="ceMsg" role="alert"></div>
      <form class="oti-body ce-form" id="ceForm">${sectionsHtml()}</form>
      <div class="oti-body ce-preview" id="cePreview" hidden></div>
      <div class="oti-foot">${isNew ? '' : '<button class="ce-del" type="button" id="ceDelete">Delete record</button>'}<button class="oti-cancel" type="button" id="ceCancel">Cancel</button>
        <button class="oti-go" type="button" id="ceSave">${isNew ? 'Add ' + esc(V.title) : 'Save changes'}</button></div>
    </div>`;
  document.body.appendChild(ov);
  const inp = c => ov.querySelector(`[data-col="${c}"]`);
  const get = c => { const el = inp(c); return el ? el.value.trim() : ''; };

  /* calendar: click the date box → native date picker → shown as "31 Dec 26" */
  ov.querySelectorAll('.ce-date').forEach(box => {
    const txt = box.querySelector('input[type=text]'), pick = box.querySelector('.ce-date-pick');
    const openPick = () => { try { pick.showPicker(); } catch (e) { pick.focus(); pick.click(); } };
    txt.addEventListener('click', openPick);
    txt.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPick(); } });
    pick.addEventListener('change', () => { txt.value = pick.value ? isoShow(pick.value) : ''; txt.dispatchEvent(new Event('input', { bubbles: true })); });
  });

  /* On Doc box shows the chosen status color */
  const od = ov.querySelector('[data-ondoc]');
  if (od) od.addEventListener('change', () => {
    const h = onDocStyle(od.value);
    [['background', h && h.bg], ['color', h && h.fg], ['-webkit-text-fill-color', h && h.fg]]
      .forEach(([p, x]) => x ? od.style.setProperty(p, x, 'important') : od.style.removeProperty(p));
  });

  /* Outlet Name / Outlet Code picked → fill outlet fields from Outlet Master */
  const fillFrom = col => {
    const o = om.find(r => String(r[OM_MAP[col]] ?? '').trim().toLowerCase() === get(col).toLowerCase());
    if (!o) return;
    Object.keys(OM_MAP).forEach(c => { if (c !== col && inp(c) && o[OM_MAP[c]] != null) inp(c).value = String(o[OM_MAP[c]]).trim(); });
  };

  /* running Number of Contract (new rows; stops once the user types their own) */
  const codeEl = inp('Code of Contract');
  const refreshCode = () => { if (codeEl && codeEl.dataset.auto === '1') codeEl.value = autoCode(get); };
  if (codeEl) codeEl.addEventListener('input', () => { codeEl.dataset.auto = '0'; });
  /* boxes that hold data turn dark gray */
  const markFilled = () => ov.querySelectorAll('#ceForm [data-col]').forEach(el => {
    if (el.type !== 'checkbox') el.classList.toggle('ce-filled', el.value.trim() !== '');
  });
  ['OUTLET NAME', 'CODE OUTLET'].forEach(c => { const el = inp(c); if (el) el.addEventListener('change', () => { fillFrom(c); refreshCode(); markFilled(); }); });
  ov.querySelector('#ceForm').addEventListener('input', e => { if (e.target !== codeEl) refreshCode(); markFilled(); });
  ov.querySelector('#ceForm').addEventListener('change', markFilled);
  refreshCode();
  markFilled();

  ov.addEventListener('click', e => { if (e.target === ov) closeRowEdit(); });
  document.getElementById('ceClose').onclick = closeRowEdit;
  const saveBtn = document.getElementById('ceSave'), cancelBtn = document.getElementById('ceCancel');
  const saveLabel = saveBtn.textContent;
  let pending = null;   /* fields waiting for confirmation on the summary preview, or 'delete' */
  const delBtn = document.getElementById('ceDelete');
  const backToForm = () => {
    pending = null;
    document.getElementById('ceForm').hidden = false; document.getElementById('cePreview').hidden = true;
    saveBtn.textContent = saveLabel; cancelBtn.textContent = 'Cancel';
    saveBtn.classList.remove('ce-danger'); if (delBtn) delBtn.hidden = false;
  };
  /* Delete record: confirm first (shows what will be removed); the row is kept in contract_deleted */
  if (delBtn) delBtn.onclick = () => {
    pending = 'delete';
    const keyCols = ['Code of Contract', 'OUTLET NAME', 'CODE OUTLET', 'Promotion', 'START', 'END', 'Active/Inactive', ON_DOC_COL].filter(c => fields.includes(c));
    document.getElementById('cePreview').innerHTML =
      `<div class="ce-del-warn"><b>Delete this ${esc(V.title)} record?</b> It is removed from Contract Master for everyone. ` +
      `A copy is kept in the deleted-records log in Supabase, so it can be restored if needed.</div>` +
      `<div class="otd-tablewrap"><table class="otd-prod ce-sum"><tbody>` +
      keyCols.map(c => `<tr><td>${esc(label(c))}</td><td>${row[c] == null || row[c] === '' ? '<span class="ce-none">—</span>' : esc(DATE_COLS.includes(c) ? dateShow(row[c]) : row[c])}</td></tr>`).join('') +
      '</tbody></table></div>';
    document.getElementById('ceForm').hidden = true; document.getElementById('cePreview').hidden = false;
    saveBtn.textContent = 'Yes, delete'; saveBtn.classList.add('ce-danger'); cancelBtn.textContent = 'Back to edit'; delBtn.hidden = true;
    ov.querySelector('.ce-modal').scrollTop = 0;
  };
  cancelBtn.onclick = () => (pending ? backToForm() : closeRowEdit());
  /* summary before saving: new row = every filled field · edit = what changes (before → after) */
  const showPreview = out => {
    const shown = v => v == null || v === '' ? '<span class="ce-none">—</span>' : esc(v);
    const val = (c, v) => CHECK_COLS[c] ? (isOn(c, v) ? 'Yes' : 'No') : DATE_COLS.includes(c) && v ? esc(dateShow(v)) : shown(v);
    const keys = Object.keys(out).filter(c => c !== 'Type');
    const odRow = c => { const h = c === ON_DOC_COL ? onDocStyle(out[c]) : null; return h ? ` style="background:${h.bg};color:${h.fg}"` : ''; };
    document.getElementById('cePreview').innerHTML =
      `<div class="ce-sum-head">${isNew ? 'Please check the new ' + esc(V.title) + ' before saving' : 'Please check the changes before saving'} ` +
      `<b>(${keys.length} field${keys.length === 1 ? '' : 's'})</b></div>` +
      `<div class="otd-tablewrap"><table class="otd-prod ce-sum"><thead><tr><th>Field</th>${isNew ? '' : '<th>Before</th>'}<th>${isNew ? 'Value' : 'After'}</th></tr></thead><tbody>` +
      keys.map(c => `<tr><td>${esc(label(c))}</td>${isNew ? '' : `<td>${val(c, row[c])}</td>`}<td${odRow(c)}>${val(c, out[c])}</td></tr>`).join('') +
      '</tbody></table></div>';
    document.getElementById('ceForm').hidden = true; document.getElementById('cePreview').hidden = false;
    saveBtn.textContent = 'Confirm & Save'; cancelBtn.textContent = 'Back to edit';
    ov.querySelector('.ce-modal').scrollTop = 0;
  };
  /* a problem is shown at the top of the form (and as a toast), and the box to fix gets focus */
  const warn = (msg, el) => {
    const m = document.getElementById('ceMsg'); m.textContent = msg;
    ov.querySelector('.ce-modal').scrollTop = 0; ctToast(msg, true);
    if (el) { el.focus(); el.classList.add('ce-need'); setTimeout(() => el.classList.remove('ce-need'), 2500); }
  };
  saveBtn.onclick = async () => {
    if (pending === 'delete') {   /* confirmed → delete */
      saveBtn.disabled = true;
      const ok = await ctDelete(id);
      saveBtn.disabled = false;
      if (ok) { closeRowEdit(); ctToast(V.title + ' record deleted'); }
      return;
    }
    if (pending) {   /* confirmed on the preview → save */
      saveBtn.disabled = true;
      const saved = await ctSave(id, pending);
      saveBtn.disabled = false;
      if (saved) { closeRowEdit(); ctToast(isNew ? V.title + ' added' : 'Saved'); }
      return;
    }
    const out = {};
    ov.querySelectorAll('[data-col]').forEach(el => {
      const c = el.dataset.col;
      let v = el.value.trim() === '' ? null : el.value.trim();
      if (el.type === 'checkbox') {
        if (!isNew && el.checked === isOn(c, row[c])) return;   /* unchanged */
        v = CHECK_COLS[c][el.checked ? 0 : 1];                  /* Scan: "scanned" / empty · ROI: TRUE / FALSE */
      }
      if (v != null && el.dataset.date) v = dateDb(v);
      if (isNew ? v != null : (row[c] == null ? null : String(row[c])) !== v) out[c] = v;
    });
    if (isNew) {
      if (!out['CODE OUTLET']) { warn('Please pick an Outlet Name from the list (or fill in Outlet Code) before saving.', inp('OUTLET NAME')); return; }
      out['Type'] = V.title;
    } else if (!Object.keys(out).length) { warn('Nothing has changed.'); return; }
    document.getElementById('ceMsg').textContent = '';
    pending = out;
    showPreview(out);
  };
  const first = inp('OUTLET NAME') || ov.querySelector('[data-col]'); if (first) first.focus();
}
function closeRowEdit() { const o = document.getElementById('ceOverlay'); if (o) o.remove(); }

/* ── realtime: single-row edits are patched in place; imports / many changes → reload ── */
let _ctReload = null;
function ctLive(p) {
  if (!_ctReload) _ctReload = liveReload(() => loadData());
  if (VIEW && p && p.eventType === 'DELETE' && p.old && p.old.id != null) { _dropRow(p.old.id); return; }
  if (VIEW && p && p.eventType === 'UPDATE' && p.new && allData.some(r => r.id === p.new.id)) {
    const cur = allData.find(r => r.id === p.new.id);
    if (JSON.stringify(cur) !== JSON.stringify(p.new)) _patchRow(p.new);
    return;
  }
  _ctReload();
}
