// In-page search with ready answers to common questions.
// Runs entirely in the browser: no server and no AI service. It matches the
// words of the question (with spelling slips, Hebrew prefixes and English/Hebrew
// synonyms) against a list of prepared answers and against the page text.
(function () {
  var SYN = [
    ['arm', 'arming', 'armed', 'דריכה', 'לדרוך', 'דרוך', 'דרוכה', 'נדרכת', 'דורכים'],
    ['disarm', 'disarming', 'disarmed', 'ניטרול', 'לנטרל', 'מנוטרל', 'מנוטרלת', 'נוטרל', 'נוטרלה', 'מנטרלים'],
    ['screw', 'screws', 'terminal', 'terminals', 'connector', 'בורג', 'ברגים', 'מהדק', 'מהדקים'],
    ['notification', 'notifications', 'notify', 'alert', 'alerts', 'push', 'התראה', 'התראות'],
    ['zone', 'zones', 'sector', 'אזור', 'אזורים'],
    ['wire', 'wires', 'core', 'cores', 'cable', 'lead', 'leads', 'חוט', 'חוטים', 'גיד', 'גידים', 'כבל'],
    ['power', 'voltage', 'supply', '12v', 'מתח', 'הזנה', 'חשמל'],
    ['alarm', 'siren', 'אזעקה', 'צופר'],
    ['app', 'application', 'phone', 'mobile', 'אפליקציה', 'טלפון', 'נייד'],
    ['setting', 'settings', 'setup', 'configure', 'configuration', 'הגדרה', 'הגדרות', 'להגדיר'],
    ['solder', 'soldering', 'soldered', 'הלחמה', 'הלחמות', 'להלחים', 'הולחם'],
    ['internet', 'wifi', 'wi-fi', 'network', 'cloud', 'אינטרנט', 'רשת', 'ענן'],
    ['bypass', 'skip', 'exclude', 'partial', 'עקיפה', 'לעקוף', 'חלקית'],
    ['time', 'hours', 'long', 'took', 'זמן', 'שעות', 'לקח'],
    ['parts', 'part', 'buy', 'components', 'shopping', 'חלקים', 'חלק', 'לקנות', 'רכיבים'],
    ['earth', 'ground', 'הארקה'],
    ['battery', 'סוללה'],
    ['outage', 'cut', 'blackout', 'הפסקת'],
    ['antenna', 'אנטנה'],
    ['detached', 'toggle', 'mode', 'מצב'],
    ['key', 'keyswitch', 'מפתח'],
    ['keypad', 'keyboard', 'מקלדת', 'מקשים'],
    ['manual', 'guide', 'חוברת', 'מדריך'],
    ['green', 'ירוק'], ['red', 'אדום'], ['black', 'שחור'], ['white', 'לבן'],
    ['yellow', 'צהוב'], ['brown', 'חום'], ['orange', 'כתום']
  ];
  var STOP = ['what', 'which', 'how', 'is', 'are', 'the', 'a', 'an', 'do', 'does', 'i', 'can', 'to', 'of', 'in', 'on',
    'for', 'it', 'my', 'me', 'and', 'or', 'with', 'why', 'where', 'when', 'should', 'be', 'there', 'this', 'that',
    'מה', 'איך', 'האם', 'של', 'את', 'זה', 'זו', 'יש', 'אני', 'עם', 'על', 'אם', 'גם', 'כל', 'איפה', 'למה', 'מתי',
    'צריך', 'אפשר', 'הוא', 'היא', 'או', 'כן'];
  var GROUP = {};
  SYN.forEach(function (g, i) { g.forEach(function (w) { GROUP[w] = i; }); });

  function norm(s) {
    return s.toLowerCase().replace(/[֑-ׇ]/g, '').replace(/["'׳״`]/g, '')
      .replace(/[^0-9a-zא-ת+\-]+/g, ' ').trim();
  }
  function variants(t) {
    var v = [t];
    // Hebrew prefixes: ו ה ב ל מ ש כ (up to two, e.g. "ולבורג").
    var x = t;
    for (var k = 0; k < 2 && /^[והבלמשכ][א-ת]{2,}/.test(x); k++) { x = x.slice(1); v.push(x); }
    if (/^[a-z]{4,}s$/.test(t)) v.push(t.slice(0, -1));
    if (t.charAt(0) === '+' || t.charAt(0) === '-') v.push(t.slice(1));
    return v;
  }
  function tokens(s) {
    return norm(s).split(/\s+/).filter(function (t) { return t && STOP.indexOf(t) < 0; });
  }
  function near(a, b) { // at most one edit apart, for words of 5+ letters
    if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
    var i = 0, j = 0, e = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++e > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return e + (a.length - i) + (b.length - j) <= 1;
  }
  function wordScore(q, words) {
    var best = 0, qv = variants(q);
    for (var w = 0; w < words.length && best < 3; w++) {
      var dv = variants(words[w]);
      for (var a = 0; a < qv.length; a++) for (var b = 0; b < dv.length; b++) {
        var x = qv[a], y = dv[b], s = 0;
        if (x === y) s = 3;
        else if (x.length >= 3 && y.indexOf(x) === 0) s = 2;
        else if (GROUP[x] !== undefined && GROUP[x] === GROUP[y]) s = 2.5;
        else if (near(x, y)) s = 1.5;
        if (s > best) best = s;
      }
    }
    return best;
  }
  function score(qt, text) {
    var words = tokens(text), total = 0, hit = 0;
    qt.forEach(function (q) { var s = wordScore(q, words); if (s) { hit++; total += s; } });
    if (!qt.length || hit < Math.ceil(qt.length * 0.5)) return 0;
    return total * (hit / qt.length);
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, qt) {
    return esc(text).replace(/[0-9A-Za-zא-ת+\-]+/g, function (w) {
      var n = norm(w);
      return n && qt.some(function (q) { return wordScore(q, [n]) >= 2; }) ? '<mark>' + w + '</mark>' : w;
    });
  }
  function snippet(text, qt) {
    if (text.length <= 180) return text;
    var words = text.split(/\s+/), at = 0;
    for (var i = 0; i < words.length; i++) {
      var n = norm(words[i]);
      if (n && qt.some(function (q) { return wordScore(q, [n]) >= 2; })) { at = i; break; }
    }
    var from = Math.max(0, at - 8), part = words.slice(from, from + 30).join(' ');
    return (from ? '… ' : '') + part + (from + 30 < words.length ? ' …' : '');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('search');
    if (!box) return;
    var input = box.querySelector('input'), out = box.querySelector('.search-results'), L = box.dataset;
    var faq = [];
    try { faq = JSON.parse(document.getElementById('faq').textContent); } catch (e) {}

    // Index the page: every paragraph, list item, table row and caption, with its section.
    var passages = [], h2s = Array.prototype.slice.call(document.querySelectorAll('h2'));
    function sectionOf(el) {
      var found = null;
      h2s.forEach(function (h) { if (h === el || (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) found = h; });
      return found ? found.textContent : '';
    }
    document.querySelectorAll('body p, body li, body tr, body figcaption, body h2, body h3').forEach(function (el) {
      if (el.closest('header, nav, footer, #search, svg')) return;
      if (el.tagName === 'P' && el.closest('li, td')) return;
      var text = (el.tagName === 'TR' ? Array.prototype.map.call(el.cells, function (c) { return c.textContent; }).join(' · ') : el.textContent).replace(/\s+/g, ' ').trim();
      if (text.length < 3) return;
      passages.push({ el: el, text: text, section: sectionOf(el) });
    });

    function go(el) {
      out.hidden = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
    function render() {
      var q = input.value.trim(), qt = tokens(q);
      out.innerHTML = '';
      if (q.length < 2 || !qt.length) { out.hidden = true; return; }
      // The question's own words count more than its extra keywords.
      var answers = faq.map(function (f) { return { f: f, s: score(qt, f.q) * 1.6 + score(qt, f.q + ' ' + f.k) }; })
        .filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
      var hits = passages.map(function (p) { return { p: p, s: score(qt, p.text) }; })
        .filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 6);
      if (!answers.length && !hits.length) {
        out.innerHTML = '<p class="none">' + esc(L.none) + '</p>';
      }
      if (answers.length) {
        out.insertAdjacentHTML('beforeend', '<p class="sr-h">' + esc(L.answers) + '</p>');
        answers.forEach(function (r) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'sr answer';
          b.innerHTML = '<strong>' + esc(r.f.q) + '</strong><span>' + esc(r.f.a) + '</span><em>' + esc(L.goto) + ' ' + esc(document.getElementById(r.f.h.slice(1)) ? document.getElementById(r.f.h.slice(1)).textContent : '') + '</em>';
          b.addEventListener('click', function () { var t = document.getElementById(r.f.h.slice(1)); if (t) go(t); });
          out.appendChild(b);
        });
      }
      if (hits.length) {
        out.insertAdjacentHTML('beforeend', '<p class="sr-h">' + esc(L.inpage) + '</p>');
        hits.forEach(function (r) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'sr';
          b.innerHTML = '<span>' + mark(snippet(r.p.text, qt), qt) + '</span><em>' + esc(r.p.section) + '</em>';
          b.addEventListener('click', function () { go(r.p.el); });
          out.appendChild(b);
        });
      }
      out.hidden = false;
    }
    var timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 120); });
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { out.hidden = true; input.blur(); }
      if (e.key === 'Enter') { var first = out.querySelector('.sr'); if (first) first.click(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) out.hidden = true; });
  });
})();
