/* ============================================================
   ui.js — загрузка, разделы, витрина, карточка работы, Telegram.
   Фазы: boot → reveal → live. Герой и витрина живут на одной
   странице, переход между ними — обычный скролл.
   ============================================================ */
window.FHh = window.FHh || {};

(function (NS) {
  'use strict';

  var S = NS.store, B = NS.bot;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var body = document.body;
  var pre = null, hero = null, wiper = null;
  var currentFilter = 'all';
  var currentItem = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- настройки → DOM ---------------- */
  function applySettings() {
    var st = S.state.settings;
    var r = document.documentElement.style;
    r.setProperty('--paper', st.paper);
    r.setProperty('--ink', st.ink);
    r.setProperty('--moss', st.moss);
    r.setProperty('--brass', st.brass);
    r.setProperty('--anim', st.anim);

    $$('[data-bind]').forEach(function (el) {
      var v = st[el.getAttribute('data-bind')];
      if (v !== undefined) el.textContent = v;
    });
    $$('[data-bind-html]').forEach(function (el) {
      var v = st[el.getAttribute('data-bind-html')];
      if (v !== undefined) el.innerHTML = v;
    });
    document.title = st.siteTitle + ' — Fantasy Hobbyhorse';

    var tg = tgLink();
    $$('#tgTop, #tgContacts, #tgFoot').forEach(function (a) { a.href = tg; });

    var n = S.state.items.filter(function (i) { return !i.hidden; }).length;
    $('#heroCount').textContent = n + ' ' + plural(n, 'работа', 'работы', 'работ') + ' в витрине';
  }

  function plural(n, a, b, c) {
    var m = n % 100;
    if (m > 4 && m < 20) return c;
    m = n % 10;
    return m === 1 ? a : (m > 1 && m < 5) ? b : c;
  }

  /* ---------------- тост ---------------- */
  var toastT = 0;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }

  /* ---------------- Telegram ---------------- */
  function tgLink() {
    return 'https://t.me/' + String(S.state.settings.telegram || '').replace(/^@/, '');
  }
  function orderText(it) {
    var lines = [
      'Здравствуйте! Хочу заказать работу с сайта:',
      '',
      '• ' + it.title + ' (' + S.catName(it.cat) + ')',
      '• Цена: ' + S.money(it.price),
      '• Артикул: ' + it.id
    ];
    if (it.status === 'order') lines.push('• Статус: под заказ');
    return lines.join('\n');
  }
  function buy(it) {
    var text = orderText(it);
    var open = function () { window.open(tgLink(), '_blank', 'noopener'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { toast('Текст заявки скопирован — вставьте в чат'); })
        .catch(function () { toast('Открываю Telegram'); })
        .then(open, open);
    } else {
      toast('Открываю Telegram');
      open();
    }
  }

  /* ---------------- витрина ---------------- */
  function visibleItems() {
    var list = S.state.items.filter(function (i) { return !i.hidden; });
    if (currentFilter !== 'all') list = list.filter(function (i) { return i.cat === currentFilter; });
    return list;
  }

  function cardHTML(it) {
    var badge = it.status === 'sold' ? '<span class="card__badge">продано</span>'
              : it.status === 'order' ? '<span class="card__badge card__badge--order">под заказ</span>' : '';
    return '' +
      '<div class="card__media">' + badge +
        '<img class="card__img" alt="' + esc(it.title) + '" loading="lazy">' +
        '<span class="card__over"><b>' + (it.status === 'sold' ? 'продано' : 'смотреть работу') + '</b></span>' +
      '</div>' +
      '<div class="card__cap">' +
        '<div><h3 class="card__name">' + esc(it.title) + '</h3>' +
        '<p class="card__cat">' + esc(String(S.catName(it.cat)).toLowerCase()) + '</p></div>' +
        '<div class="card__price">' + (it.old ? '<s>' + S.money(it.old) + '</s>' : '') + S.money(it.price) + '</div>' +
      '</div>';
  }

  function setCardImage(img, it) {
    var ref = (it.images || [])[0];
    if (ref) {
      S.resolveImage(ref).then(function (u) {
        img.src = u || B.placeholder(it.id + it.title, 720, 900);
      });
    } else {
      img.src = B.placeholder(it.id + it.title, 720, 900);
    }
  }

  var io = null;
  function renderGrid(animate) {
    var grid = $('#grid');
    var list = visibleItems();
    $('#gridEmpty').hidden = list.length > 0;

    if (io) io.disconnect();
    grid.innerHTML = '';

    list.forEach(function (it) {
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.id = it.id;
      el.innerHTML = cardHTML(it);
      el.style.transitionDelay = '';
      setCardImage($('.card__img', el), it);
      el.addEventListener('click', function () { openProduct(it.id); });
      grid.appendChild(el);
      if (!animate) el.classList.add('is-in');
    });

    if (animate) {
      io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          var idx = Array.prototype.indexOf.call(e.target.parentNode.children, e.target);
          e.target.style.transitionDelay = (idx % 3) * 80 + 'ms';
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: .05 });
      $$('.card', grid).forEach(function (c) { io.observe(c); });
    }
  }

  function renderFilters() {
    var wrap = $('#filters');
    var cats = [{ id: 'all', name: 'все' }].concat(S.state.categories);
    wrap.innerHTML = cats.map(function (c) {
      return '<button data-cat="' + c.id + '" class="' + (c.id === currentFilter ? 'is-on' : '') +
             '"><span>' + esc(String(c.name).toLowerCase()) + '</span></button>';
    }).join('');
    $$('button', wrap).forEach(function (b) {
      b.addEventListener('click', function () {
        if (currentFilter === b.dataset.cat) return;
        currentFilter = b.dataset.cat;
        $$('button', wrap).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        $$('.card').forEach(function (c, i) {
          c.style.transitionDelay = (i % 4) * 20 + 'ms';
          c.classList.add('is-out');
        });
        setTimeout(function () { renderGrid(true); }, 240);
      });
    });
  }

  /* ---------------- карточка работы ---------------- */
  function openProduct(id) {
    var it = S.state.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    currentItem = it;
    wiper.run(Math.random() * 999, 1150, function () { fillProduct(it); });
  }

  function fillProduct(it) {
    $('#prodCat').textContent = String(S.catName(it.cat)).toLowerCase();
    $('#prodTitle').textContent = it.title;
    $('#prodPrice').innerHTML = (it.old ? '<s style="opacity:.45;font-size:.68em">' + S.money(it.old) + '</s> ' : '') + S.money(it.price);
    $('#prodStatus').textContent = it.status === 'sold' ? 'продано' : it.status === 'order' ? 'под заказ' : 'в наличии';
    $('#prodDesc').innerHTML = it.desc || '';
    $('#prodSpecs').innerHTML = (it.specs || []).map(function (s) {
      return '<li><span>' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></li>';
    }).join('');

    var buyB = $('#buyBtn');
    buyB.disabled = it.status === 'sold';
    $('.cta__label', buyB).textContent = it.status === 'sold' ? 'продано' :
      it.status === 'order' ? 'заказать в telegram' : 'купить в telegram';

    var refs = (it.images && it.images.length) ? it.images : [null];
    var wrap = $('#prodImgWrap'); wrap.innerHTML = '';
    var thumbs = $('#prodThumbs'); thumbs.innerHTML = '';

    refs.forEach(function (ref, i) {
      var img = document.createElement('img');
      wrap.appendChild(img);
      var set = function (u) {
        img.src = u;
        if (i === 0) requestAnimationFrame(function () { img.classList.add('is-on'); });
      };
      if (ref) S.resolveImage(ref).then(function (u) { set(u || B.placeholder(it.id + i, 1200, 1500)); });
      else set(B.placeholder(it.id + it.title, 1200, 1500));

      if (refs.length > 1) {
        var b = document.createElement('button');
        b.className = i === 0 ? 'is-on' : '';
        var ti = document.createElement('img');
        b.appendChild(ti);
        if (ref) S.resolveImage(ref).then(function (u) { ti.src = u; }); else ti.src = img.src;
        b.addEventListener('click', function () {
          $$('img', wrap).forEach(function (x, k) { x.classList.toggle('is-on', k === i); });
          $$('button', thumbs).forEach(function (x, k) { x.classList.toggle('is-on', k === i); });
        });
        thumbs.appendChild(b);
      }
    });

    var bodyEl = $('.sheet__body');
    bodyEl.classList.remove('sheet__stagger');
    void bodyEl.offsetWidth;
    bodyEl.classList.add('sheet__stagger');
    $$('.sheet__body > *').forEach(function (el, i) { el.style.animationDelay = (0.16 + i * 0.055) + 's'; });

    $('#product').classList.add('is-open');
    $('#product').setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
  }

  function closeProduct() {
    $('#product').classList.remove('is-open');
    $('#product').setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
    currentItem = null;
  }

  /* ---------------- разделы ---------------- */
  function currentRoute() {
    var h = location.hash || '';
    if (h.indexOf('#/') !== 0) return null;       // «#shelf» и подобное — якоря, не маршруты
    var name = h.slice(2);
    if (name === '') return 'home';
    if (name === 'about' || name === 'contacts') return name;
    return 'home';
  }

  function route(name, silent) {
    var views = $$('.view');
    var target = views.filter(function (v) { return v.dataset.view === name; })[0] || views[0];
    var apply = function () {
      views.forEach(function (v) { v.classList.toggle('is-active', v === target); });
      $$('.nav__links a').forEach(function (a) { a.classList.toggle('is-active', a.dataset.route === name); });
      window.scrollTo(0, 0);
      if (name === 'home') renderGrid(true);
    };
    if (silent) { apply(); return; }
    wiper.run(Math.random() * 999, 1150, apply);
  }

  /* ---------------- загрузка ---------------- */
  function boot() {
    applySettings();
    renderFilters();
    renderGrid(false);
    route(currentRoute() || 'home', true);

    // опубликованное содержимое приезжает уже после первой отрисовки,
    // чтобы заставка не ждала сеть
    S.hydrate().then(function (r) {
      if (r && r.changed) { applySettings(); renderFilters(); renderGrid(false); }
    });

    wiper = B.wipe($('#wipe-canvas'));
    hero = B.heroBotany($('#hero-botany'), {});
    pre = B.preloader($('#fern-canvas'), { density: S.state.settings.density });

    var minMs = B.reducedMotion ? 350 : (S.state.settings.preloaderMs || 2200);
    var t0 = performance.now();
    var assetsReady = false;
    var fill = $('#loadFill'), num = $('#loadNum');

    Promise.all([
      new Promise(function (r) {
        if (document.readyState === 'complete') r();
        else window.addEventListener('load', r, { once: true });
      }),
      (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve()
    ]).then(function () { assetsReady = true; }, function () { assetsReady = true; });

    var started = false;
    function once() { if (!started) { started = true; startReveal(); } }

    (function tick() {
      var timeT = Math.min(1, (performance.now() - t0) / minMs);
      var p = assetsReady ? timeT : Math.min(timeT, 0.84);
      pre.set(p);
      fill.style.width = (p * 100).toFixed(1) + '%';
      num.textContent = p >= 1 ? '100' : ('0' + Math.floor(p * 100)).slice(-2);
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(once, 200);
    })();

    // страховка, если вкладка ушла в фон и rAF замер
    setTimeout(once, minMs + 1500);

    // последний рубеж: что бы ни случилось со сценой загрузки, страница
    // не должна остаться пустой
    setTimeout(function () {
      if (body.dataset.phase !== 'live') {
        revealed = true;
        body.dataset.phase = 'live';
        var el = $('#preloader');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    }, minMs + 6000);
  }

  var revealed = false;
  function startReveal() {
    body.dataset.phase = 'reveal';
    pre.reveal(function () {
      if (revealed) return;
      revealed = true;
      body.dataset.phase = 'live';
      pre.destroy();
      var el = $('#preloader');
      if (el && el.parentNode) setTimeout(function () { el.parentNode.removeChild(el); }, 900);
      setTimeout(function () { renderGrid(true); }, 200);
    });
  }

  /* ---------------- события ---------------- */
  function wire() {
    $('#prodClose').addEventListener('click', closeProduct);
    $('.sheet__scrim').addEventListener('click', closeProduct);
    $('#buyBtn').addEventListener('click', function () { if (currentItem) buy(currentItem); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeProduct(); });

    $$('[data-nav]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var href = a.getAttribute('href');
        if (location.hash !== href) location.hash = href;
        else route(currentRoute() || 'home');
        $('#topbar').classList.remove('is-menu');
      });
    });
    window.addEventListener('hashchange', function () {
      var r = currentRoute();
      if (r) route(r);
    });

    $('#burger').addEventListener('click', function () { $('#topbar').classList.toggle('is-menu'); });

    window.addEventListener('scroll', function () {
      $('#topbar').classList.toggle('is-solid', (window.scrollY || 0) > 20);
    }, { passive: true });
  }

  /* ---------------- публичное ---------------- */
  NS.ui = {
    applySettings: applySettings,
    refresh: function () {
      applySettings();
      renderFilters();
      renderGrid(false);
      if (hero) hero.redraw();
    },
    toast: toast
  };

  wire();
  boot();
})(window.FHh);
