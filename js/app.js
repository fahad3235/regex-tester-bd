/* regex-tester-bd -- DOM wiring. Pure ASCII (Bengali via \\uXXXX in logic.js). */
(function () {
  'use strict';
  var L = window.REGEX_LOGIC;
  var LS_LANG = 'regex-tester-bd-lang';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function lang() { return document.documentElement.lang === 'bn' ? 'bn' : 'en'; }
  function t(key) { return L.I18N[lang()][key] || L.I18N.en[key] || key; }
  function num(n) { return L.fmtNum(n, lang()); }

  function getFlags() {
    var out = '';
    ['g', 'i', 'm', 's', 'u', 'y'].forEach(function (f) {
      if ($('flag-' + f).checked) out += f;
    });
    return out;
  }

  function renderStatic() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var ph = el.getAttribute('data-i18n-ph');
      if (ph) el.setAttribute('placeholder', t(key));
      else el.textContent = t(key);
    });
    // Flag labels
    ['g', 'i', 'm', 's', 'u', 'y'].forEach(function (f) {
      $('flag-label-' + f).textContent = t('flag_' + f);
    });
    renderLibrary();
    renderCheat();
  }

  function renderLibrary() {
    var box = $('library');
    box.innerHTML = '';
    L.LIBRARY.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lib-btn';
      b.textContent = item.name;
      b.title = item.pattern;
      b.addEventListener('click', function () {
        $('pattern').value = item.pattern;
        ['g', 'i', 'm', 's', 'u', 'y'].forEach(function (f) {
          $('flag-' + f).checked = item.flags.indexOf(f) !== -1;
        });
        $('test-text').value = item.sample;
        $('replacement').value = item.replacement || '$&';
        update();
      });
      box.appendChild(b);
    });
  }

  function renderCheat() {
    var tbody = $('cheat-body');
    tbody.innerHTML = '';
    L.CHEAT.forEach(function (row) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var code = document.createElement('code');
      code.textContent = row.token;
      td1.appendChild(code);
      var td2 = document.createElement('td');
      td2.textContent = lang() === 'bn' ? row.bn : row.en;
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    });
  }

  function buildHighlight(text, matches) {
    if (!matches.length) return esc(text);
    var out = '';
    var pos = 0;
    matches.forEach(function (m) {
      if (m.index < pos) return; /* skip overlapping (should not happen) */
      out += esc(text.slice(pos, m.index));
      if (m.text.length > 0) out += '<mark>' + esc(m.text) + '</mark>';
      pos = m.index + m.text.length;
    });
    out += esc(text.slice(pos));
    return out;
  }

  function update() {
    var pattern = $('pattern').value;
    var flags = getFlags();
    var text = $('test-text').value;
    var errBox = $('error');
    var countBox = $('match-count');
    var hlBox = $('highlight');
    var listBox = $('match-list');
    var cappedBox = $('capped-note');

    if (!pattern) {
      errBox.textContent = '';
      errBox.hidden = true;
      countBox.textContent = '';
      hlBox.innerHTML = '<span class="muted">' + esc(t('emptyPattern')) + '</span>';
      listBox.innerHTML = '';
      cappedBox.hidden = true;
      updateReplace(null);
      return;
    }
    var res = L.runTest(pattern, flags, text);
    if (!res.ok) {
      errBox.textContent = t('errorPrefix') + res.error;
      errBox.hidden = false;
      countBox.textContent = '';
      hlBox.innerHTML = esc(text);
      listBox.innerHTML = '';
      cappedBox.hidden = true;
      updateReplace(null);
      return;
    }
    errBox.textContent = '';
    errBox.hidden = true;
    countBox.textContent = t('matchCount') + ': ' + num(res.matches.length);
    if (!text) {
      hlBox.innerHTML = '<span class="muted">' + esc(t('emptyText')) + '</span>';
    } else {
      hlBox.innerHTML = buildHighlight(text, res.matches);
    }
    cappedBox.hidden = !res.capped;
    if (res.capped) cappedBox.textContent = t('capped');

    // Match list
    listBox.innerHTML = '';
    if (!res.matches.length) {
      var p = document.createElement('p');
      p.className = 'muted';
      p.textContent = t('noMatches');
      listBox.appendChild(p);
    } else {
      res.matches.forEach(function (m, i) {
        var div = document.createElement('div');
        div.className = 'match-item';
        var head = document.createElement('div');
        head.innerHTML = '<strong>#' + num(i + 1) + ' ' + esc(t('matchText')) + ':</strong> ' +
          '<code>' + esc(m.text) + '</code> ' +
          '<span class="muted">' + esc(t('matchIndex')) + ': ' + num(m.index) + '</span>';
        div.appendChild(head);
        var g = document.createElement('div');
        g.className = 'muted small';
        if (!m.groups.length) {
          g.textContent = t('noGroups');
        } else {
          g.textContent = t('matchGroups') + ': ' + m.groups.map(function (grp, gi) {
            return '$' + (gi + 1) + '=' + (grp === undefined ? t('groupUnset') : JSON.stringify(grp));
          }).join(', ');
        }
        div.appendChild(g);
        listBox.appendChild(div);
      });
    }
    updateReplace(res);
  }

  function updateReplace(testRes) {
    var box = $('replace-panel');
    if (!$('replace-toggle').checked) { box.hidden = true; return; }
    box.hidden = false;
    var pattern = $('pattern').value;
    var flags = getFlags();
    var text = $('test-text').value;
    var out = $('replace-output');
    var errBox = $('replace-error');
    if (!pattern) { out.textContent = ''; errBox.hidden = true; return; }
    var res = L.applyReplace(pattern, flags, text, $('replacement').value);
    if (!res.ok) {
      errBox.textContent = t('errorPrefix') + res.error;
      errBox.hidden = false;
      out.textContent = '';
    } else {
      errBox.hidden = true;
      out.textContent = res.output;
    }
    void testRes;
  }

  function setLang(l) {
    document.documentElement.lang = l;
    try { localStorage.setItem(LS_LANG, l); } catch (e) { /* storage may be unavailable */ }
    renderStatic();
    update();
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(LS_LANG); } catch (e) { /* ignore */ }
    document.documentElement.lang = saved === 'bn' ? 'bn' : 'en';
    renderStatic();
    $('pattern').addEventListener('input', update);
    $('test-text').addEventListener('input', update);
    $('replacement').addEventListener('input', update);
    ['g', 'i', 'm', 's', 'u', 'y'].forEach(function (f) {
      $('flag-' + f).addEventListener('change', update);
    });
    $('replace-toggle').addEventListener('change', update);
    $('lang-btn').addEventListener('click', function () {
      setLang(lang() === 'bn' ? 'en' : 'bn');
    });
    $('clear-btn').addEventListener('click', function () {
      $('pattern').value = '';
      $('test-text').value = '';
      $('replacement').value = '';
      $('flag-g').checked = true;
      ['i', 'm', 's', 'u', 'y'].forEach(function (f) { $('flag-' + f).checked = false; });
      update();
    });
    $('copy-btn').addEventListener('click', function () {
      var out = $('replace-output').textContent;
      if (!out) return;
      var done = function () { $('copy-btn').textContent = t('copied'); setTimeout(function () { $('copy-btn').textContent = t('copyBtn'); }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = out;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
      }
    });
    // Default demo state: a small example so the page is not blank.
    $('pattern').value = '\\b\\w+@\\w+\\.\\w+\\b';
    $('test-text').value = 'Contact meem@example.com or fahad@test.org for details.';
    update();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
