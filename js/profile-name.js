/* Sidebar profile (bottom left): the user can change the name shown there.
   Everyone signs in with the shared account, so the name is kept per browser (localStorage)
   instead of in user_profile — changing it on one computer does not rename anyone else.
   Works on every page with .sidebar-user (#userName, #userAvatar). */
(function () {
  var KEY = 'archive_display_name';
  var get = function () { try { return (localStorage.getItem(KEY) || '').trim(); } catch (e) { return ''; } };
  var set = function (v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };

  function apply() {
    var n = get(), el = document.getElementById('userName'), av = document.getElementById('userAvatar');
    if (!el || !n) return;
    if (el.textContent !== n) el.textContent = n;
    if (av && av.textContent !== n.charAt(0).toUpperCase()) av.textContent = n.charAt(0).toUpperCase();
  }

  function edit() {
    var el = document.getElementById('userName'); if (!el || el.querySelector('input')) return;
    var old = el.textContent.trim(), inp = document.createElement('input');
    inp.className = 'pn-input'; inp.value = get() || (old === '—' || /loading/i.test(old) ? '' : old);
    inp.maxLength = 40; inp.placeholder = 'Your name'; inp.setAttribute('aria-label', 'Your display name');
    el.textContent = ''; el.appendChild(inp); inp.focus(); inp.select();
    var done = false;
    var finish = function (save) {
      if (done) return; done = true;
      var v = inp.value.trim().replace(/\s+/g, ' ');
      if (save && v) set(v);
      el.textContent = (save && v) ? v : (get() || old);
      apply();
      if (save && v) toast('Name changed to ' + v);
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function () { finish(true); });
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'pn-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2500);
  }

  function init() {
    var el = document.getElementById('userName'); if (!el) return;
    var row = el.parentNode;
    if (!document.getElementById('pnEdit')) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'pnEdit'; b.className = 'pn-edit'; b.title = 'Change your name'; b.setAttribute('aria-label', 'Change your name');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      b.onclick = edit;
      el.insertAdjacentElement('afterend', b);
      row.classList.add('pn-row');
    }
    el.addEventListener('dblclick', edit);
    /* pages fill the name after sign-in — keep the chosen name on top */
    if (window.MutationObserver) new MutationObserver(function () { if (!el.querySelector('input')) apply(); }).observe(el, { childList: true, characterData: true, subtree: true });
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
