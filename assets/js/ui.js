/* ============================================================
   ui.js — загрузка, разделы, витрина, группы товаров, карточка
   работы, фотолента «о мастере», Telegram.
   Фазы: boot → reveal → live.
   ============================================================ */
window.FHh = window.FHh || {};

(function (NS) {
  'use strict';

  var S = NS.store, B = NS.bot, BR = NS.brand;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var body = document.body;
  var pre = null, hero = null, wiper = null;
  var currentGroup = null;      // открытая группа товаров
  var groupCat = 'all';         // подфильтр внутри группы
  var currentItem = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- блокировка прокрутки со счётчиком ----------------
     Карточка работы открывается поверх страницы группы: без счётчика
     закрытие карточки вернуло бы прокрутку фону, который ещё закрыт. */
  var locks = 0;
  function lockScroll(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    body.style.overflow = locks ? 'hidden' : '';
  }

  /* ---------------- настройки → DOM ---------------- */
  function applySettings() {
    var st = S.state.settings;
    var r = document.documentElement.style;

    ['paper', 'ink', 'rust', 'olive', 'emerald'].forEach(function (k) {
      if (st[k]) r.setProperty('--' + k, st[k]);
    });
    // роли: значение роли — имя токена, поэтому ссылаемся на его переменную
    r.setProperty('--accent', 'var(--' + (st.roleAccent || 'rust') + ')');
    r.setProperty('--band-bg', 'var(--' + (st.roleBand || 'olive') + ')');
    r.setProperty('--badge', 'var(--' + (st.roleBadge || 'rust') + ')');
    r.setProperty('--seal', 'var(--' + (st.roleSeal || 'emerald') + ')');
    r.setProperty('--logo-ring', 'var(--' + (st.roleLogo || 'olive') + ')');
    r.setProperty('--logo-body', 'var(--rust)');
    r.setProperty('--logo-ink', 'var(--ink)');
    r.setProperty('--anim', st.anim);
    r.setProperty('--fs', st.fontScale || 1);

    body.dataset.font = st.fontPreset || 'rune';
    body.dataset.lineart = st.lineart ? '1' : '0';
    body.dataset.drift = st.aboutDrift ? '1' : '0';

    var tc = $('#themeColor'); if (tc) tc.setAttribute('content', st.paper);
    var fav = $('#favicon');
    if (fav && BR) {
      fav.setAttribute('href', BR.faviconURL({
        paper: st.paper,
        ink: st.ink,
        ring: st[st.roleLogo] || st.olive,
        body: st.rust
      }));
    }

    $$('[data-bind]').forEach(function (el) {
      var v = st[el.getAttribute('data-bind')];
      if (v !== undefined) el.textContent = v;
    });
    $$('[data-bind-html]').forEach(function (el) {
      var v = st[el.getAttribute('data-bind-html')];
      if (v !== undefined) el.innerHTML = v;
    });
    document.title = st.siteTitle + ' — ' + st.siteTagline;

    var tg = tgLink();
    $$('#tgTop, #tgContacts, #tgFoot').forEach(function (a) { a.href = tg; });

    var n = S.state.items.filter(function (i) { return !i.hidden; }).length;
    $('#heroCount').textContent = n + ' ' + plural(n, 'работа', 'работы', 'работ') + ' в витрине';

    paintMarks();
  }

  /* пустая витрина: маскот вместо голой строки */
  function paintEmpty() {
    var el = $('#gridEmpty');
    if (!el || $('i', el) || !BR) return;
    var i = document.createElement('i');
    i.setAttribute('aria-hidden', 'true');
    i.innerHTML = BR.mascotSVG();
    el.insertBefore(i, el.firstChild);
  }

  /* маскот и печать: одни и те же пути, разные размеры и роли */
  function paintMarks() {
    if (!BR) return;
    var mascot = BR.mascotSVG();
    ['#navMark', '#preMark', '#footMark'].forEach(function (sel) {
      var el = $(sel); if (el) el.innerHTML = mascot;
    });
    var seal = $('#aboutSeal'); if (seal) seal.innerHTML = BR.sealSVG('currentColor');
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

  /* ---------------- карточки ---------------- */
  function statusPill(st) {
    if (st !== 'sold' && st !== 'order') return '';
    return '<span class="st st--' + st + '">' + S.statusLabel(st) + '</span>';
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
        '<div class="card__pricebox">' +
          '<div class="card__price">' + (it.old ? '<s>' + S.money(it.old) + '</s>' : '') + S.money(it.price) + '</div>' +
          /* дубль статуса рядом с ценником — как и на обложке */
          statusPill(it.status) +
        '</div>' +
      '</div>';
  }

  /* Подложка под вырезанное изображение: та же сгенерированная ботаника,
     что показывается у работ без фото. Иначе PNG с прозрачным фоном висел бы
     на голой бумаге. */
  function backdrop(el, it, w, h) {
    el.classList.add('is-cutout');
    el.style.backgroundImage = 'url("' + B.placeholder(it.id + it.title, w, h) + '")';
  }

  /* Обложка работы: первое медиа в списке. Видео показывается кадром,
     на наведение — проигрывается. */
  function setCardImage(node, it) {
    var ref = (it.images || [])[0];
    var media = node.closest ? node.closest('.card__media') : null;

    if (!ref) { node.src = B.placeholder(it.id + it.title, 720, 900); return; }

    if (S.mediaKind(ref) === 'video' && media) {
      var v = document.createElement('video');
      v.className = 'card__img';
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'metadata';
      node.parentNode.replaceChild(v, node);
      media.classList.add('has-video');
      if (!$('.card__play', media)) {
        var badge = document.createElement('span');
        badge.className = 'card__play';
        badge.setAttribute('aria-hidden', 'true');
        media.appendChild(badge);
      }
      // #t=0.1 — просит браузер отрисовать первый кадр вместо пустого места
      S.resolveMedia(ref).then(function (u) { if (u) v.src = u + '#t=0.1'; });
      media.addEventListener('mouseenter', function () { v.play().catch(function () {}); });
      media.addEventListener('mouseleave', function () { v.pause(); });
      return;
    }

    S.resolveMedia(ref).then(function (u) {
      node.src = u || B.placeholder(it.id + it.title, 720, 900);
    });
    S.hasAlpha(ref).then(function (yes) { if (yes) backdrop(node, it, 720, 900); });
  }

  /* Универсальная отрисовка сетки: и главная витрина, и страница группы */
  function renderCards(grid, list, animate, io) {
    grid.innerHTML = '';
    list.forEach(function (it) {
      var el = document.createElement('article');
      el.className = 'card';
      el.dataset.id = it.id;
      el.innerHTML = cardHTML(it);
      setCardImage($('.card__img', el), it);
      el.addEventListener('click', function () { openProduct(it.id); });
      grid.appendChild(el);
      if (!animate) el.classList.add('is-in');
    });
    if (animate) {
      var obs = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          var idx = Array.prototype.indexOf.call(e.target.parentNode.children, e.target);
          e.target.style.transitionDelay = (idx % 3) * 80 + 'ms';
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        });
      }, { root: grid.closest('.gpanel__inner') || null, rootMargin: '0px 0px -6% 0px', threshold: .05 });
      $$('.card', grid).forEach(function (c) { obs.observe(c); });
      return obs;
    }
    return null;
  }

  /* ---------------- главная витрина ---------------- */
  var io = null;
  function visibleItems() {
    return S.state.items.filter(function (i) { return !i.hidden; });
  }
  function renderGrid(animate) {
    var grid = $('#grid');
    var list = visibleItems();
    paintEmpty();
    $('#gridEmpty').hidden = list.length > 0;
    if (io) io.disconnect();
    io = renderCards(grid, list, animate);
  }

  /* Фильтры на главной = группы товаров. Клик открывает страницу группы. */
  function renderFilters() {
    var wrap = $('#filters');
    var groups = S.state.groups || [];
    var html = '<button data-cat="all" class="' + (currentGroup ? '' : 'is-on') + '"><span>все</span></button>';
    html += groups.map(function (g) {
      var n = S.itemsOfGroup(g.id).length;
      return '<button data-cat="' + esc(g.id) + '" class="' + (currentGroup === g.id ? 'is-on' : '') + '">' +
             '<span>' + esc(String(g.name).toLowerCase()) + '</span><i>' + n + '</i></button>';
    }).join('');
    wrap.innerHTML = html;

    $$('button', wrap).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.cat;
        if (id === 'all') { closeGroup(); return; }
        openGroup(id);
      });
    });
  }

  /* ============================================================
     СТРАНИЦА ГРУППЫ ТОВАРОВ
     Выезжает снизу вверх, оставляя зазор сверху. Новая группа
     перелистывается поверх старой, старая гаснет в фоне.
     ============================================================ */
  function groupPanelHTML(g) {
    var subs = S.catsOfGroup(g.id);
    var subHTML = '';
    if (subs.length > 1) {
      subHTML = '<div class="gpanel__subs mono">' +
        '<button data-sub="all" class="is-on"><span>все</span></button>' +
        subs.map(function (c) {
          return '<button data-sub="' + esc(c.id) + '"><span>' + esc(String(c.name).toLowerCase()) + '</span></button>';
        }).join('') + '</div>';
    }
    return '' +
      '<div class="gpanel__handle" data-ghandle aria-hidden="true"><i class="gpanel__grip"></i></div>' +
      '<button class="gpanel__close" data-gclose aria-label="Закрыть группу">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '<span>выйти из группы</span>' +
      '</button>' +
      '<div class="gpanel__inner">' +
        '<header class="gpanel__head">' +
          '<span class="gpanel__seal" aria-hidden="true">' + (BR ? BR.sealSVG('currentColor') : '') + '</span>' +
          '<p class="gpanel__kicker mono">группа товаров</p>' +
          '<h2 class="gpanel__title">' + esc(g.name) + '<em>.</em></h2>' +
          (g.note ? '<p class="gpanel__note">' + esc(g.note) + '</p>' : '') +
          subHTML +
        '</header>' +
        '<div class="grid" data-ggrid></div>' +
        '<p class="gpanel__empty mono" data-gempty hidden>в этой группе пока пусто</p>' +
      '</div>';
  }

  function fillGroupGrid(panel, gid) {
    var list = S.itemsOfGroup(gid);
    if (groupCat !== 'all') list = list.filter(function (it) { return it.cat === groupCat; });
    var grid = $('[data-ggrid]', panel);
    $('[data-gempty]', panel).hidden = list.length > 0;
    renderCards(grid, list, true);
  }

  /* Свайп вниз за полоску-ручку закрывает группу. Работает и пальцем,
     и мышью: pointer-события одинаковы, а touch-action:none на ручке не
     даёт странице прокручиваться под пальцем во время перетаскивания. */
  function wireGrabToClose(panel) {
    var handle = $('[data-ghandle]', panel);
    var inner = $('.gpanel__inner', panel);
    var startX = 0, startY = 0, dy = 0, startT = 0;
    var armed = false, dragging = false, moved = false;

    /* После протягивания браузер может добить тапом по карточке под пальцем —
       гасим такой клик в фазе перехвата, пока не улеглось. */
    panel.addEventListener('click', function (e) {
      if (!moved) return;
      e.stopPropagation();
      e.preventDefault();
    }, true);

    function scrim() { return $('.gsheet__scrim'); }
    function height() { return panel.getBoundingClientRect().height || 1; }

    /* Тянуть можно за что угодно, но пока содержимое прокручено — жест
       достаётся прокрутке. Ручка тянет всегда, даже из середины списка. */
    function begin(x, y, viaHandle) {
      startX = x; startY = y; dy = 0; startT = Date.now();
      armed = viaHandle || !inner || inner.scrollTop <= 0;
      dragging = !!viaHandle;
      if (dragging) panel.classList.add('is-dragging');
    }

    function move(x, y) {
      if (!armed) return false;
      var d = y - startY, dx = x - startX;
      if (!dragging) {
        // порог: вниз и вертикально, иначе это прокрутка или свайп вбок
        if (d > 10 && Math.abs(d) > Math.abs(dx)) {
          dragging = true;
          panel.classList.add('is-dragging');
        } else {
          if (d < -4 || Math.abs(dx) > 12) armed = false;
          return false;
        }
      }
      dy = Math.max(0, d);
      if (dy > 6) moved = true;
      panel.style.transform = 'translateY(' + dy + 'px)';
      var s = scrim();
      if (s) s.style.opacity = Math.max(0, 1 - dy / (height() * 0.9));
      return true;
    }

    function release() {
      armed = false;
      if (moved) setTimeout(function () { moved = false; }, 350);
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-dragging');
      var speed = dy / Math.max(1, Date.now() - startT);      // px/мс
      var s = scrim();
      // либо утащили заметно вниз, либо резко смахнули — но не на пару пикселей
      if (dy > height() * 0.26 || (speed > 0.55 && dy > 60)) {
        // закрываем: сначала снимаем is-up, и только потом отпускаем
        // инлайновый transform — иначе панель прыгнула бы вверх и поехала вниз
        closeGroup();
        requestAnimationFrame(function () {
          panel.style.transform = '';
          if (s) s.style.opacity = '';
        });
      } else {
        panel.style.transform = '';
        if (s) s.style.opacity = '';
      }
    }

    /* --- палец: слушаем всю панель, прокрутку перехватываем только
           когда жест уже опознан как «тянем вниз» --- */
    panel.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      begin(t.clientX, t.clientY, !!(handle && handle.contains(e.target)));
    }, { passive: true });

    panel.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      if (move(t.clientX, t.clientY)) e.preventDefault();
    }, { passive: false });

    panel.addEventListener('touchend', release);
    panel.addEventListener('touchcancel', release);

    /* --- мышь: только за полоску-ручку, иначе мешали бы выделение и клики --- */
    if (handle && window.PointerEvent) {
      handle.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.button) return;
        begin(e.clientX, e.clientY, true);
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      });
      handle.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        move(e.clientX, e.clientY);
      });
      handle.addEventListener('pointerup', function (e) {
        if (e.pointerType === 'touch') return;
        release();
      });
      handle.addEventListener('pointercancel', function (e) {
        if (e.pointerType === 'touch') return;
        release();
      });
    }
  }

  function openGroup(gid) {
    var g = S.group(gid);
    if (!g) return;
    if (currentGroup === gid) return;

    var wasOpen = !!currentGroup;
    currentGroup = gid;
    groupCat = 'all';

    var sheet = $('#gsheet');
    if (!$('.gsheet__scrim', sheet)) {
      var scrim = document.createElement('div');
      scrim.className = 'gsheet__scrim';
      scrim.addEventListener('click', closeGroup);
      sheet.insertBefore(scrim, sheet.firstChild);
    }

    var stack = $('#gsheetStack');
    var old = $$('.gpanel', stack);
    var panel = document.createElement('section');
    panel.className = 'gpanel';
    panel.dataset.g = gid;
    panel.innerHTML = groupPanelHTML(g);
    stack.appendChild(panel);

    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    if (!wasOpen) lockScroll(true);
    body.classList.add('is-gsheet');

    // reflow, иначе браузер склеит начальное и конечное состояние
    void panel.offsetWidth;
    panel.classList.add('is-up');
    old.forEach(function (p) {
      p.classList.add('is-under');
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 700);
    });

    fillGroupGrid(panel, gid);
    wireGrabToClose(panel);

    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-gclose]')) { closeGroup(); return; }
      var sb = e.target.closest('[data-sub]');
      if (sb) {
        groupCat = sb.dataset.sub;
        $$('[data-sub]', panel).forEach(function (x) { x.classList.toggle('is-on', x === sb); });
        fillGroupGrid(panel, gid);
      }
    });

    renderFilters();
    if (location.hash !== '#/g/' + gid) history.replaceState(null, '', '#/g/' + gid);
  }

  function closeGroup(silent) {
    if (!currentGroup) return;
    currentGroup = null;
    var sheet = $('#gsheet');
    var panels = $$('.gpanel', $('#gsheetStack'));
    panels.forEach(function (p) { p.classList.remove('is-up'); });
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    body.classList.remove('is-gsheet');
    lockScroll(false);
    setTimeout(function () {
      var stack = $('#gsheetStack');
      if (!currentGroup && stack) stack.innerHTML = '';
    }, 780);
    renderFilters();
    if (!silent && location.hash.indexOf('#/g/') === 0) history.replaceState(null, '', '#/');
  }

  /* ---------------- карточка работы ---------------- */
  function openProduct(id) {
    var it = S.state.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    currentItem = it;
    // никакого перехода: панель просто выезжает сбоку поверх витрины
    fillProduct(it);
  }

  function fillProduct(it) {
    $('#prodCat').textContent = String(S.catName(it.cat)).toLowerCase();
    $('#prodTitle').textContent = it.title;
    $('#prodPrice').innerHTML = (it.old ? '<s style="opacity:.45;font-size:.68em">' + S.money(it.old) + '</s> ' : '') + S.money(it.price);
    var stEl = $('#prodStatus');
    stEl.textContent = S.statusLabel(it.status);
    stEl.className = 'mono st st--' + (it.status || 'available');
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
      var isVideo = ref && S.mediaKind(ref) === 'video';
      var node;

      if (isVideo) {
        node = document.createElement('video');
        node.controls = true; node.loop = true; node.playsInline = true;
        node.setAttribute('playsinline', '');
        node.preload = 'metadata';
        S.resolveMedia(ref).then(function (u) {
          if (u) node.src = u;
          if (i === 0) requestAnimationFrame(function () { node.classList.add('is-on'); });
        });
      } else {
        node = document.createElement('img');
        var set = function (u) {
          node.src = u;
          if (i === 0) requestAnimationFrame(function () { node.classList.add('is-on'); });
        };
        if (ref) {
          S.resolveMedia(ref).then(function (u) { set(u || B.placeholder(it.id + i, 1200, 1500)); });
          S.hasAlpha(ref).then(function (yes) { if (yes) backdrop(node, it, 1200, 1500); });
        } else {
          set(B.placeholder(it.id + it.title, 1200, 1500));
        }
      }
      wrap.appendChild(node);

      if (refs.length > 1) {
        var b = document.createElement('button');
        b.className = (i === 0 ? 'is-on' : '') + (isVideo ? ' is-video' : '');
        var ti = document.createElement(isVideo ? 'video' : 'img');
        if (isVideo) { ti.muted = true; ti.preload = 'metadata'; }
        b.appendChild(ti);
        if (ref) S.resolveMedia(ref).then(function (u) { ti.src = u + (isVideo ? '#t=0.1' : ''); });
        else ti.src = node.src;
        b.addEventListener('click', function () {
          $$('img,video', wrap).forEach(function (x, k) {
            x.classList.toggle('is-on', k === i);
            if (k !== i && x.pause) x.pause();
          });
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

    if (!$('#product').classList.contains('is-open')) lockScroll(true);
    $('#product').classList.add('is-open');
    $('#product').setAttribute('aria-hidden', 'false');
  }

  function closeProduct() {
    if (!$('#product').classList.contains('is-open')) return;
    $$('#prodImgWrap video, #prodThumbs video').forEach(function (v) { v.pause(); });
    $('#product').classList.remove('is-open');
    $('#product').setAttribute('aria-hidden', 'true');
    lockScroll(false);
    currentItem = null;
  }

  /* ============================================================
     «О МАСТЕРЕ»: дрейфующие фотографии
     Слоты заданы в процентах, поэтому раскладка не зависит от
     ширины экрана; на телефоне лента превращается в обычную сетку.
     ============================================================ */
  var SLOTS = [
    [2, 1, 30], [37, 6, 24], [66, 0, 31],
    [0, 27, 24], [30, 30, 29], [64, 33, 28],
    [6, 50, 27], [37, 55, 26], [69, 57, 27],
    [22, 17, 19], [52, 21, 18], [12, 41, 17]
  ];

  /* Ленту собираем только когда раздел «о мастере» открыт: иначе браузер
     тянет почти мегабайт фотографий ещё на главной. */
  function driftActive() {
    var v = $('.view[data-view="about"]');
    return v && v.classList.contains('is-active');
  }

  function renderDrift(force) {
    var box = $('#drift');
    if (!box) return;
    if (!force && !driftActive()) { box.innerHTML = ''; return; }
    var refs = (S.state.settings.aboutPhotos || []).filter(Boolean);
    box.innerHTML = '';
    if (!refs.length) return;

    refs.forEach(function (ref, i) {
      var s = SLOTS[i % SLOTS.length];
      var d = document.createElement('figure');
      d.className = 'drift__ph';
      // «случайность» детерминированная: раскладка не прыгает при перерисовке
      var k = (i * 37) % 11;
      d.style.cssText =
        '--x:' + s[0] + '%;--y:' + s[1] + '%;--w:' + s[2] + '%;' +
        '--r:' + ((k % 5) - 2) * 0.7 + 'deg;' +
        '--dx:' + (((k % 4) - 1.5) * 9).toFixed(1) + 'px;' +
        '--dy:' + (((k % 3) - 1) * 13).toFixed(1) + 'px;' +
        '--dur:' + (15 + (k % 7) * 2.2).toFixed(1) + 's;' +
        '--delay:-' + (k * 1.7).toFixed(1) + 's;' +
        // слой держим переменной, а не z-index: инлайновый z-index пересилил бы
        // правило :hover, и подсвеченное фото осталось бы под соседями
        '--z:' + (1 + (i % 3)) + ';margin:0';
      var isVideo = S.mediaKind(ref) === 'video';
      var img = document.createElement(isVideo ? 'video' : 'img');
      if (isVideo) {
        img.muted = true; img.loop = true; img.playsInline = true; img.autoplay = true;
        img.setAttribute('playsinline', '');
        img.preload = 'metadata';
      } else {
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
      }
      d.appendChild(img);
      box.appendChild(d);
      S.resolveMedia(ref).then(function (u) {
        if (u) img.src = u; else d.remove();
      });
    });
  }

  /* ---------------- разделы ---------------- */
  function currentRoute() {
    var h = location.hash || '';
    if (h.indexOf('#/') !== 0) return null;       // «#shelf» и подобное — якоря, не маршруты
    var name = h.slice(2);
    if (name.indexOf('g/') === 0) return 'home';
    if (name === '') return 'home';
    if (name === 'about' || name === 'contacts') return name;
    return 'home';
  }
  function hashGroup() {
    var h = location.hash || '';
    return h.indexOf('#/g/') === 0 ? h.slice(4) : null;
  }

  function route(name, silent) {
    var views = $$('.view');
    var target = views.filter(function (v) { return v.dataset.view === name; })[0] || views[0];
    var apply = function () {
      views.forEach(function (v) { v.classList.toggle('is-active', v === target); });
      $$('.nav__links a').forEach(function (a) { a.classList.toggle('is-active', a.dataset.route === name); });
      window.scrollTo(0, 0);
      if (name === 'home') renderGrid(true);
      if (name === 'about') renderDrift(true);
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
      if (r && r.changed) { applySettings(); renderFilters(); renderGrid(false); renderDrift(); }
      var g = hashGroup();
      if (g) setTimeout(function () { openGroup(g); }, 300);
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

    // Escape закрывает по одному слою: сначала карточка, потом группа
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('#product').classList.contains('is-open')) { closeProduct(); return; }
      if (currentGroup) closeGroup();
    });

    $$('[data-nav]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        closeGroup(true);
        var href = a.getAttribute('href');
        if (location.hash !== href) location.hash = href;
        else route(currentRoute() || 'home');
        setMenu(false);
      });
    });
    window.addEventListener('hashchange', function () {
      var g = hashGroup();
      if (g) { openGroup(g); return; }
      var r = currentRoute();
      if (r) { closeGroup(true); route(r); }
    });

    $('#burger').addEventListener('click', function () {
      setMenu(!$('#topbar').classList.contains('is-menu'));
    });

    window.addEventListener('scroll', function () {
      $('#topbar').classList.toggle('is-solid', (window.scrollY || 0) > 20);
    }, { passive: true });
  }

  function setMenu(on) {
    $('#topbar').classList.toggle('is-menu', on);
    $('#burger').setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  /* ---------------- публичное ---------------- */
  NS.ui = {
    applySettings: applySettings,
    refresh: function () {
      applySettings();
      renderFilters();
      renderGrid(false);
      renderDrift();
      var panel = $('.gpanel');
      if (panel && currentGroup) fillGroupGrid(panel, currentGroup);
      if (hero) hero.redraw();
    },
    openGroup: openGroup,
    closeGroup: closeGroup,
    openProduct: openProduct,
    lockScroll: lockScroll,
    cardHTML: cardHTML,
    setCardImage: setCardImage,
    statusPill: statusPill,
    toast: toast
  };

  wire();
  boot();
})(window.FHh);
