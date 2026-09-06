/* ============================================================
   admin.js — панель управления (конструктор витрины).
   Открыть: точка в футере · Ctrl+Shift+A · #/admin
   ============================================================ */
window.FHh = window.FHh || {};

(function (NS) {
  'use strict';

  var S = NS.store;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var TABS = [
    { id: 'items', name: 'Работы' },
    { id: 'cats', name: 'Категории' },
    { id: 'look', name: 'Оформление' },
    { id: 'text', name: 'Тексты' },
    { id: 'data', name: 'Данные' }
  ];
  var tab = 'items';
  var editing = null;   // id редактируемой работы или null
  var dirty = false;
  var unlocked = false;

  /* ---------------- где панель вообще разрешена ----------------
     Настоящая защита опубликованного сайта — не пускать панель на боевой
     домен вовсе (config.js: admin: 'local'). Проверка пароля выполняется
     в браузере и защищает только от случайного захода. */
  var CFG = window.FHH_CONFIG || {};
  function isLocalHost() {
    var h = location.hostname;
    return location.protocol === 'file:' ||
           h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '';
  }
  var ADMIN_ALLOWED = (CFG.admin === 'always' || CFG.admin === 'remote') ? true
                    : CFG.admin === 'off' ? false
                    : isLocalHost();
  // в режиме remote панель есть на опубликованном сайте, но не афишируется:
  // точку в подвале убираем, вход только по #/admin или Ctrl+Shift+A
  var SHOW_DOT = ADMIN_ALLOWED && (isLocalHost() || CFG.admin === 'always');
  var CAN_PUBLISH_HERE = CFG.admin === 'remote' && !!((CFG.github || {}).owner);
  var TOKEN_KEY = 'fhh.gh.token';
  function ghToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setGhToken(v) {
    try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function sha256(str) {
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
      .then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      })
      .catch(function () { return null; });
  }

  function checkPass(value) {
    var st = S.state.settings;
    if (st.adminPassHash) {
      return sha256(value).then(function (h) {
        return h ? h === st.adminPassHash : false;
      });
    }
    return Promise.resolve(value === String(st.adminPass || ''));
  }

  /* ---------------- служебное ---------------- */
  function status(msg) { $('#adminStatus').textContent = msg || ''; }
  function touch() { dirty = true; status('есть несохранённые изменения'); }

  function persist(quiet) {
    var ok = S.save();
    dirty = false;
    status(ok ? 'сохранено ' + new Date().toLocaleTimeString('ru-RU') : 'не удалось сохранить (нет доступа к localStorage)');
    NS.ui.refresh();
    if (!quiet) NS.ui.toast(ok ? 'Изменения сохранены' : 'Браузер запретил сохранение');
  }

  function field(label, inner, hint) {
    return '<label class="field"><span>' + label + '</span>' + inner + '</label>' +
      (hint ? '<p class="hint">' + hint + '</p>' : '');
  }
  function input(key, val, type) {
    return '<input type="' + (type || 'text') + '" data-k="' + key + '" value="' + esc(val) + '">';
  }
  function area(key, val) {
    return '<textarea data-k="' + key + '">' + esc(val) + '</textarea>';
  }

  /* ============================================================
     ВКЛАДКА: РАБОТЫ
     ============================================================ */
  function viewItems() {
    if (editing) return viewItemEditor();
    var st = S.state;
    var rows = st.items.map(function (it, i) {
      var badge = it.hidden ? 'скрыта' : it.status === 'sold' ? 'продано' : it.status === 'order' ? 'под заказ' : 'в наличии';
      return '<div class="arow" data-i="' + i + '" draggable="true">' +
        '<img class="arow__thumb" data-thumb="' + i + '" alt="">' +
        '<div><p class="arow__t">' + esc(it.title) + '</p>' +
        '<p class="arow__m">' + esc(S.catName(it.cat)) + ' · ' + S.money(it.price) + ' · ' + badge + '</p></div>' +
        '<div class="arow__btns">' +
          '<span class="arow__handle" title="Перетащить">⠿</span>' +
          '<button data-act="up">↑</button>' +
          '<button data-act="down">↓</button>' +
          '<button data-act="edit">Изменить</button>' +
          '<button data-act="copy">Дубль</button>' +
          '<button data-act="hide">' + (it.hidden ? 'Показать' : 'Скрыть') + '</button>' +
          '<button data-act="del">Удалить</button>' +
        '</div></div>';
    }).join('');

    return '<div class="toolbar">' +
        '<button class="btn btn--solid" data-act="new"><span class="btn__fill"></span><span class="btn__label">+ Новая работа</span></button>' +
        '<span class="hint" style="margin:0">Порядок в списке = порядок в витрине. Строки можно перетаскивать.</span>' +
      '</div>' + (rows || '<p class="hint">Пока ни одной работы.</p>');
  }

  function afterItems() {
    var st = S.state;
    $$('[data-thumb]').forEach(function (img) {
      var it = st.items[+img.dataset.thumb];
      var ref = (it.images || [])[0];
      if (ref) S.resolveImage(ref).then(function (u) { img.src = u || NS.bot.placeholder(it.id + it.title, 160, 160); });
      else img.src = NS.bot.placeholder(it.id + it.title, 160, 160);
    });

    $('#adminBody').onclick = function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var row = e.target.closest('.arow');
      var i = row ? +row.dataset.i : -1;
      var act = b.dataset.act;

      if (act === 'new') {
        var it = {
          id: S.uid(), title: 'Новая работа', cat: (st.categories[0] || {}).id || '',
          price: 0, old: null, status: 'available', desc: '<p></p>', specs: [], images: []
        };
        st.items.unshift(it); editing = it.id; touch(); render(); return;
      }
      if (i < 0) return;
      if (act === 'edit') { editing = st.items[i].id; render(); return; }
      if (act === 'up' && i > 0) { st.items.splice(i - 1, 0, st.items.splice(i, 1)[0]); touch(); render(); return; }
      if (act === 'down' && i < st.items.length - 1) { st.items.splice(i + 1, 0, st.items.splice(i, 1)[0]); touch(); render(); return; }
      if (act === 'copy') {
        var c = S.clone(st.items[i]); c.id = S.uid(); c.title += ' (копия)';
        st.items.splice(i + 1, 0, c); touch(); render(); return;
      }
      if (act === 'hide') { st.items[i].hidden = !st.items[i].hidden; touch(); render(); return; }
      if (act === 'del') {
        if (!confirm('Удалить «' + st.items[i].title + '»? Действие необратимо после сохранения.')) return;
        (st.items[i].images || []).forEach(function (r) { S.dropImage(r); });
        st.items.splice(i, 1); touch(); render(); return;
      }
    };

    // drag & drop порядка
    var dragFrom = -1;
    $$('.arow').forEach(function (row) {
      row.addEventListener('dragstart', function () { dragFrom = +row.dataset.i; row.classList.add('is-drag'); });
      row.addEventListener('dragend', function () { row.classList.remove('is-drag'); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var to = +row.dataset.i;
        if (dragFrom < 0 || dragFrom === to) return;
        S.state.items.splice(to, 0, S.state.items.splice(dragFrom, 1)[0]);
        touch(); render();
      });
    });
  }

  /* ---------------- редактор одной работы ---------------- */
  function viewItemEditor() {
    var st = S.state;
    var it = st.items.filter(function (x) { return x.id === editing; })[0];
    if (!it) { editing = null; return viewItems(); }

    var cats = st.categories.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === it.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    var specs = (it.specs || []).map(function (s, i) {
      return '<div class="cols" data-spec="' + i + '" style="grid-template-columns:1fr 1fr 40px;align-items:end">' +
        field('Параметр', '<input type="text" data-sk="' + i + '" value="' + esc(s[0]) + '">') +
        field('Значение', '<input type="text" data-sv="' + i + '" value="' + esc(s[1]) + '">') +
        '<label class="field"><span>&nbsp;</span><button class="btn btn--ghost" data-act="specdel" data-i="' + i + '" style="padding:11px 0;width:100%">×</button></label>' +
        '</div>';
    }).join('');

    return '<div class="editor">' +
      '<div class="toolbar">' +
        '<button class="btn btn--ghost" data-act="back">← К списку</button>' +
        '<span class="hint" style="margin:0">Артикул: ' + esc(it.id) + '</span>' +
      '</div>' +

      '<h4>Основное</h4>' +
      field('Название', input('title', it.title)) +
      '<div class="cols">' +
        field('Категория', '<select data-k="cat">' + cats + '</select>') +
        field('Статус', '<select data-k="status">' +
          '<option value="available"' + (it.status === 'available' ? ' selected' : '') + '>В наличии</option>' +
          '<option value="order"' + (it.status === 'order' ? ' selected' : '') + '>Под заказ</option>' +
          '<option value="sold"' + (it.status === 'sold' ? ' selected' : '') + '>Продано</option>' +
        '</select>') +
        field('Цена', input('price', it.price, 'number')) +
        field('Старая цена (для зачёркивания)', input('old', it.old == null ? '' : it.old, 'number')) +
      '</div>' +

      '<h4>Фотографии</h4>' +
      '<div class="imgs" id="imgList"></div>' +
      '<div class="drop" id="drop">Перетащите файлы сюда или нажмите, чтобы выбрать. Первая фотография — обложка.</div>' +
      '<input type="file" id="fileInp" accept="image/*" multiple hidden>' +
      '<p class="hint">Изображения ужимаются до 1600 px и хранятся в браузере (IndexedDB). ' +
      'Чтобы перенести их на другое устройство — выгрузите бэкап во вкладке «Данные».</p>' +
      field('Или ссылка на изображение', '<input type="text" id="imgUrl" placeholder="https://…">') +
      '<button class="btn btn--ghost" data-act="imgurl" style="margin-bottom:20px">Добавить по ссылке</button>' +

      '<h4>Описание</h4>' +
      field('HTML описания', area('desc', it.desc || ''), 'Можно использовать &lt;p&gt;, &lt;h3&gt;, &lt;ul&gt;&lt;li&gt;, &lt;a&gt;, &lt;b&gt;, &lt;em&gt;.') +

      '<h4>Характеристики</h4>' + specs +
      '<button class="btn btn--ghost" data-act="specadd">+ Строка</button>' +
      '</div>';
  }

  function afterItemEditor() {
    var it = S.state.items.filter(function (x) { return x.id === editing; })[0];
    if (!it) return;

    function drawImgs() {
      var wrap = $('#imgList');
      wrap.innerHTML = '';
      (it.images || []).forEach(function (ref, i) {
        var d = document.createElement('div');
        d.className = 'imgs__item';
        d.innerHTML = '<img alt=""><button data-imgdel="' + i + '" title="Удалить">×</button>';
        wrap.appendChild(d);
        S.resolveImage(ref).then(function (u) { $('img', d).src = u; });
        d.addEventListener('click', function (e) {
          if (e.target.dataset.imgdel !== undefined) {
            S.dropImage(it.images[i]);
            it.images.splice(i, 1); touch(); drawImgs();
          } else if (i > 0) {                      // клик по фото — сделать обложкой
            it.images.unshift(it.images.splice(i, 1)[0]); touch(); drawImgs();
          }
        });
      });
      if (!it.images || !it.images.length) {
        wrap.innerHTML = '<p class="hint" style="margin:0">Фото нет — в витрине покажется сгенерированная ботаническая заставка.</p>';
      }
    }
    drawImgs();

    function ingest(files) {
      var arr = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
      if (!arr.length) return;
      status('обработка изображений…');
      Promise.all(arr.map(function (f) { return S.ingestFile(f).catch(function () { return null; }); }))
        .then(function (refs) {
          it.images = (it.images || []).concat(refs.filter(Boolean));
          touch(); drawImgs(); status('добавлено: ' + refs.filter(Boolean).length);
        });
    }

    var drop = $('#drop'), inp = $('#fileInp');
    drop.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () { ingest(inp.files); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer) ingest(e.dataTransfer.files); });

    $('#adminBody').oninput = function (e) {
      var t = e.target;
      if (t.dataset.k) {
        var k = t.dataset.k;
        var v = t.value;
        if (k === 'price') v = Number(v) || 0;
        if (k === 'old') v = v === '' ? null : (Number(v) || null);
        it[k] = v; touch();
      }
      if (t.dataset.sk !== undefined) { it.specs[+t.dataset.sk][0] = t.value; touch(); }
      if (t.dataset.sv !== undefined) { it.specs[+t.dataset.sv][1] = t.value; touch(); }
    };
    $('#adminBody').onchange = $('#adminBody').oninput;

    $('#adminBody').onclick = function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'back') { editing = null; render(); }
      if (act === 'specadd') { it.specs = it.specs || []; it.specs.push(['', '']); touch(); render(); }
      if (act === 'specdel') { it.specs.splice(+b.dataset.i, 1); touch(); render(); }
      if (act === 'imgurl') {
        var u = $('#imgUrl').value.trim();
        if (u) { it.images = (it.images || []).concat([u]); $('#imgUrl').value = ''; touch(); drawImgs(); }
      }
    };
  }

  /* ============================================================
     ВКЛАДКА: КАТЕГОРИИ
     ============================================================ */
  function viewCats() {
    var rows = S.state.categories.map(function (c, i) {
      var used = S.state.items.filter(function (x) { return x.cat === c.id; }).length;
      return '<div class="arow" data-i="' + i + '" style="grid-template-columns:1fr auto">' +
        '<div class="cols" style="grid-template-columns:1fr 1fr">' +
          field('Название', '<input type="text" data-cn="' + i + '" value="' + esc(c.name) + '">') +
          field('Код (латиницей)', '<input type="text" data-ci="' + i + '" value="' + esc(c.id) + '">') +
        '</div>' +
        '<div class="arow__btns"><button data-act="cup">↑</button><button data-act="cdown">↓</button>' +
        '<button data-act="cdel">Удалить (' + used + ')</button></div></div>';
    }).join('');
    return '<div class="toolbar"><button class="btn btn--ghost" data-act="cnew">+ Категория</button></div>' + rows;
  }

  function afterCats() {
    $('#adminBody').oninput = function (e) {
      var t = e.target, cats = S.state.categories;
      if (t.dataset.cn !== undefined) { cats[+t.dataset.cn].name = t.value; touch(); }
      if (t.dataset.ci !== undefined) {
        var i = +t.dataset.ci, oldId = cats[i].id, nid = t.value.trim();
        if (!nid) return;
        S.state.items.forEach(function (it) { if (it.cat === oldId) it.cat = nid; });
        cats[i].id = nid; touch();
      }
    };
    $('#adminBody').onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var row = e.target.closest('.arow'); var i = row ? +row.dataset.i : -1;
      var cats = S.state.categories;
      if (b.dataset.act === 'cnew') { cats.push({ id: 'cat' + (cats.length + 1), name: 'Новая категория' }); touch(); render(); }
      if (i < 0) return;
      if (b.dataset.act === 'cup' && i > 0) { cats.splice(i - 1, 0, cats.splice(i, 1)[0]); touch(); render(); }
      if (b.dataset.act === 'cdown' && i < cats.length - 1) { cats.splice(i + 1, 0, cats.splice(i, 1)[0]); touch(); render(); }
      if (b.dataset.act === 'cdel') {
        var used = S.state.items.filter(function (x) { return x.cat === cats[i].id; }).length;
        if (used && !confirm('В категории ' + used + ' работ(ы). Они останутся без категории. Удалить?')) return;
        cats.splice(i, 1); touch(); render();
      }
    };
  }

  /* ============================================================
     ВКЛАДКА: ОФОРМЛЕНИЕ
     ============================================================ */
  var THEMES = [
    { name: 'Папоротник', paper: '#ececea', ink: '#15171a', moss: '#3f5c46', brass: '#a86a38' },
    { name: 'Туман', paper: '#e7eaea', ink: '#191f22', moss: '#4a6660', brass: '#8a8474' },
    { name: 'Полночный лес', paper: '#111417', ink: '#e9ece8', moss: '#89ac84', brass: '#c9a463' },
    { name: 'Витраж', paper: '#eeeef0', ink: '#171a21', moss: '#2f6360', brass: '#bf6231' },
    { name: 'Мох и глина', paper: '#e8e7e3', ink: '#1b1a18', moss: '#5e7440', brass: '#9d5a2b' }
  ];

  function viewLook() {
    var st = S.state.settings;
    var sw = THEMES.map(function (t, i) {
      return '<button class="swatch" data-theme="' + i + '">' +
        '<i style="background:linear-gradient(90deg,' + t.paper + ' 0 40%,' + t.moss + ' 40% 70%,' + t.ink + ' 70% 85%,' + t.brass + ' 85% 100%)"></i>' +
        '<b>' + t.name + '</b></button>';
    }).join('');

    return '<div class="editor">' +
      '<h4>Готовые палитры</h4><div class="swatches">' + sw + '</div>' +
      '<h4>Цвета</h4>' +
      '<div class="cols">' +
        field('Фон / бумага', '<input type="color" data-s="paper" value="' + st.paper + '">') +
        field('Текст / чернила', '<input type="color" data-s="ink" value="' + st.ink + '">') +
        field('Акцент (ботаника)', '<input type="color" data-s="moss" value="' + st.moss + '">') +
        field('Тёплый акцент', '<input type="color" data-s="brass" value="' + st.brass + '">') +
      '</div>' +
      '<h4>Анимация</h4>' +
      field('Интенсивность анимаций: <b id="vAnim">' + st.anim + '</b>',
        '<input type="range" min="0.3" max="1.6" step="0.05" data-s="anim" value="' + st.anim + '">') +
      field('Плотность ботаники: <b id="vDens">' + st.density + '</b>',
        '<input type="range" min="0.3" max="2" step="0.1" data-s="density" value="' + st.density + '">',
        'Влияет на количество вай в прелоадере и фоне. Меньше — быстрее на слабых устройствах.') +
      field('Длительность прелоадера, мс', '<input type="number" step="100" data-s="preloaderMs" value="' + st.preloaderMs + '">') +
      '<button class="btn btn--ghost" data-act="replay">Проиграть заставку заново</button>' +
      '</div>';
  }

  function afterLook() {
    $('#adminBody').oninput = function (e) {
      var t = e.target;
      if (!t.dataset.s) return;
      var k = t.dataset.s;
      var v = t.type === 'range' || t.type === 'number' ? Number(t.value) : t.value;
      S.state.settings[k] = v;
      if (k === 'anim') $('#vAnim').textContent = v;
      if (k === 'density') $('#vDens').textContent = v;
      NS.ui.applySettings();
      touch();
    };
    $('#adminBody').onclick = function (e) {
      var th = e.target.closest('[data-theme]');
      if (th) {
        var t = THEMES[+th.dataset.theme];
        ['paper', 'ink', 'moss', 'brass'].forEach(function (k) { S.state.settings[k] = t[k]; });
        NS.ui.applySettings(); touch(); render();
        return;
      }
      var b = e.target.closest('[data-act]');
      if (b && b.dataset.act === 'replay') { persist(true); location.reload(); }
    };
  }

  /* ============================================================
     ВКЛАДКА: ТЕКСТЫ
     ============================================================ */
  function viewText() {
    var st = S.state.settings;
    return '<div class="editor">' +
      '<h4>Шапка и герой</h4>' +
      '<div class="cols">' +
        field('Название в шапке', input('siteTitle', st.siteTitle)) +
        field('Telegram (без @)', input('telegram', st.telegram)) +
        field('Валюта', input('currency', st.currency)) +
      '</div>' +
      '<div class="cols">' +
        field('Метка 1', input('heroTag1', st.heroTag1)) +
        field('Метка 2', input('heroTag2', st.heroTag2)) +
        field('Метка 3', input('heroTag3', st.heroTag3)) +
      '</div>' +
      '<div class="cols">' +
        field('Заголовок, строка 1', input('heroLine1', st.heroLine1)) +
        field('Заголовок, строка 2 (цветная)', input('heroLine2', st.heroLine2)) +
      '</div>' +
      field('Подзаголовок', area('heroSub', st.heroSub)) +
      field('Подпись внизу героя', input('heroFootL', st.heroFootL)) +
      '<h4>Цветной блок</h4>' +
      field('Крупная строка', area('bandLead', st.bandLead)) +
      field('Текст блока (HTML)', area('bandText', st.bandText)) +
      '<h4>Страница «О мастере»</h4>' + field('HTML', area('aboutText', st.aboutText)) +
      '<h4>Страница «Контакты»</h4>' + field('HTML', area('contactsText', st.contactsText)) +
      '<h4>Подвал</h4>' + field('Строка в футере', input('footerNote', st.footerNote)) +
      '</div>';
  }

  function afterText() {
    $('#adminBody').oninput = function (e) {
      var k = e.target.dataset.k; if (!k) return;
      S.state.settings[k] = e.target.value;
      NS.ui.applySettings();
      touch();
    };
  }

  /* ============================================================
     ВКЛАДКА: ДАННЫЕ
     ============================================================ */
  function viewData() {
    var st = S.state;
    var bytes = 0;
    try { bytes = (localStorage.getItem('fhh.site.v1') || '').length; } catch (e) {}
    return '<div class="editor">' +
      '<h4>Бэкап</h4>' +
      '<p class="hint">Экспорт складывает в один JSON и тексты, и фотографии. Этим же файлом сайт восстанавливается ' +
      'на другом компьютере или в другом браузере.</p>' +
      '<div class="toolbar">' +
        '<button class="btn btn--ghost" data-act="exp">Скачать бэкап</button>' +
        '<button class="btn btn--ghost" data-act="imp">Загрузить бэкап</button>' +
        '<input type="file" id="impFile" accept="application/json,.json" hidden>' +
      '</div>' +
      (CAN_PUBLISH_HERE ? (
        '<h4>Опубликовать прямо отсюда</h4>' +
        '<p class="hint">Отправляет витрину в репозиторий <b>' +
          esc(((CFG.github || {}).owner || '') + '/' + ((CFG.github || {}).repo || '')) +
        '</b>, дальше GitHub Action обновит сайт сам — примерно через минуту.<br>' +
        'Нужен <b>fine-grained</b> токен GitHub: только этот репозиторий, ' +
        'разрешение <b>Contents: Read and write</b>, срок 30–90 дней. ' +
        'Токен хранится до закрытия вкладки и никуда, кроме GitHub, не отправляется.</p>' +
        '<div class="cols">' +
          field('Токен GitHub', '<input type="password" id="ghToken" placeholder="' +
            (ghToken() ? 'токен запомнен до закрытия вкладки' : 'github_pat_…') + '">') +
          '<label class="field"><span>&nbsp;</span>' +
          '<button class="btn btn--solid" data-act="ghpub" style="width:100%">Опубликовать</button></label>' +
        '</div>' +
        '<div class="toolbar"><button class="btn btn--ghost" data-act="ghforget">Забыть токен</button></div>'
      ) : '') +

      '<h4>Публикация сайта</h4>' +
      '<p class="hint">Витрина, которую видят посетители, лежит в файле ' +
      '<b>data/site.json</b> в репозитории. Кнопка ниже собирает этот файл из текущего ' +
      'содержимого вместе с фотографиями — положите его в папку <b>data/</b>, ' +
      'закоммитьте и запушьте: GitHub Action выложит сайт сам.</p>' +
      '<div class="toolbar">' +
        '<button class="btn btn--solid" data-act="publish">Файл для публикации (site.json)</button>' +
      '</div>' +

      '<h4>Доступ</h4>' +
      '<p class="hint">Режим панели задаётся в <b>assets/js/config.js</b>. Сейчас: <b>' +
        esc(CFG.admin || 'local') + '</b>' +
        (ADMIN_ALLOWED ? '' : ' — на этом адресе панель была бы закрыта') + '.<br>' +
      (CFG.admin === 'remote'
        ? 'Режим <b>remote</b>: панель открывается и на опубликованном сайте, но только ' +
          'по адресу #/admin или Ctrl+Shift+A — точки в подвале там нет. Правки видны ' +
          'только в вашем браузере, пока вы не нажмёте «Опубликовать» с токеном.<br>'
        : '') +
      'При значении <b>local</b> панель не открывается на опубликованном домене ' +
      'ничем: ни точкой в подвале, ни Ctrl+Shift+A, ни адресом #/admin. Это и есть ' +
      'настоящая защита. Пароль ниже — только от случайного захода на вашем же ' +
      'компьютере: проверка идёт в браузере.</p>' +
      '<div class="cols">' +
        field('Новый пароль', '<input type="password" id="newPass" placeholder="оставьте пустым, чтобы не менять">') +
        '<label class="field"><span>&nbsp;</span>' +
        '<button class="btn btn--ghost" data-act="setpass" style="width:100%">Сменить пароль</button></label>' +
      '</div>' +
      '<p class="hint">' + (st.settings.adminPassHash
        ? 'Сейчас хранится хеш пароля — открытым текстом он в файлах не лежит.'
        : 'Сейчас пароль хранится открытым текстом (' + esc(st.settings.adminPass) + '). Смените его, чтобы вместо него сохранился хеш.') + '</p>' +
      '<h4>Состояние</h4>' +
      '<p class="hint">Работ: ' + st.items.length + ' · категорий: ' + st.categories.length +
      ' · объём текстовых данных: ' + Math.round(bytes / 1024) + ' КБ</p>' +
      '<div class="toolbar">' +
        '<button class="btn btn--ghost" data-act="reset">Сбросить к демо-содержимому</button>' +
      '</div>' +
      '</div>';
  }

  function afterData() {
    $('#adminBody').oninput = function (e) {
      var k = e.target.dataset.k; if (!k) return;
      S.state.settings[k] = e.target.value; touch();
    };
    $('#adminBody').onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'exp') doExport();
      if (b.dataset.act === 'publish') doExport('site.json');
      if (b.dataset.act === 'ghforget') { setGhToken(''); render(); NS.ui.toast('Токен забыт'); }
      if (b.dataset.act === 'ghpub') {
        var tok = ($('#ghToken').value || '').trim() || ghToken();
        if (!tok) { alert('Вставьте токен GitHub'); return; }
        if (dirty) persist(true);
        b.disabled = true;
        status('отправляем на GitHub…');
        S.publishToGitHub(tok).then(function (res) {
          setGhToken(tok);
          $('#ghToken').value = '';
          b.disabled = false;
          status('опубликовано, коммит ' + res.commit + ' · ' + Math.round(res.bytes / 1024) + ' КБ');
          NS.ui.toast('Отправлено. Сайт обновится через минуту');
          render();
        }).catch(function (err) {
          b.disabled = false;
          status('не опубликовано');
          alert('Не получилось опубликовать.\n\n' + err.message);
        });
      }
      if (b.dataset.act === 'setpass') {
        var v = $('#newPass').value;
        if (!v) { alert('Введите новый пароль'); return; }
        sha256(v).then(function (h) {
          if (!h) { alert('Браузер не даёт посчитать хеш (нужен https или localhost). Пароль оставлен как есть.'); return; }
          S.state.settings.adminPassHash = h;
          S.state.settings.adminPass = '';
          persist();
          render();
          NS.ui.toast('Пароль изменён');
        });
      }
      if (b.dataset.act === 'imp') $('#impFile').click();
      if (b.dataset.act === 'reset') {
        if (!confirm('Вернуть демо-содержимое? Все ваши работы и тексты в этом браузере будут потеряны.')) return;
        S.reset(); dirty = false; NS.ui.refresh(); render(); NS.ui.toast('Сброшено к демо-содержимому');
      }
    };
    var f = $('#impFile');
    if (f) f.addEventListener('change', function () {
      var file = f.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        S.importJSON(String(fr.result)).then(function () {
          NS.ui.refresh(); render(); NS.ui.toast('Бэкап загружен');
        }).catch(function (err) { alert('Не удалось прочитать файл: ' + err.message); });
      };
      fr.readAsText(file);
      f.value = '';
    });
  }

  function doExport(name) {
    status('готовим файл…');
    S.exportJSON().then(function (json) {
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name || ('fhh-site-' + new Date().toISOString().slice(0, 10) + '.json');
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      status('файл скачан: ' + a.download);
    });
  }

  /* ============================================================
     КАРКАС
     ============================================================ */
  function render() {
    $('#adminTabs').innerHTML = TABS.map(function (t) {
      return '<button data-tab="' + t.id + '" class="' + (t.id === tab ? 'is-on' : '') + '">' + t.name + '</button>';
    }).join('');

    var b = $('#adminBody');
    b.onclick = null; b.oninput = null; b.onchange = null;

    if (tab === 'items') { b.innerHTML = viewItems(); editing ? afterItemEditor() : afterItems(); }
    else if (tab === 'cats') { b.innerHTML = viewCats(); afterCats(); }
    else if (tab === 'look') { b.innerHTML = viewLook(); afterLook(); }
    else if (tab === 'text') { b.innerHTML = viewText(); afterText(); }
    else { b.innerHTML = viewData(); afterData(); }

    b.scrollTop = 0;
  }

  function open() {
    if (!ADMIN_ALLOWED) return;              // на опубликованном домене панели нет
    // в удалённом режиме не пускаем, пока пароль остаётся заводским:
    // он написан в README и в руководстве, значит известен всем
    if (CFG.admin === 'remote' && !isLocalHost()) {
      var st0 = S.state.settings;
      if (!st0.adminPassHash && (!st0.adminPass || st0.adminPass === 'fern')) {
        alert('Пароль панели ещё не менялся.\n\n' +
              'Откройте сайт у себя (start.cmd), смените пароль в «Данные → Доступ», ' +
              'опубликуйте — и панель заработает здесь.');
        return;
      }
    }
    if (!unlocked) { showLock(); return; }
    $('#admin').classList.add('is-open');
    $('#admin').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    render();
    status('');
  }
  function close() {
    if (dirty && !confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return;
    $('#admin').classList.remove('is-open');
    $('#admin').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (location.hash === '#/admin') location.hash = '#/';
  }

  function showLock() {
    $('#lock').classList.add('is-open');
    setTimeout(function () { $('#lockPass').focus(); }, 60);
  }
  function hideLock() { $('#lock').classList.remove('is-open'); $('#lockErr').textContent = ''; $('#lockPass').value = ''; }

  /* ---------------- привязки ---------------- */
  if (!SHOW_DOT) {
    var dot = $('#adminOpen');
    if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
  }
  $('#adminOpen') && $('#adminOpen').addEventListener('click', open);
  $('#adminClose').addEventListener('click', close);
  $('.admin__scrim').addEventListener('click', close);
  $('#saveBtn').addEventListener('click', function () { persist(); render(); });
  $('#expBtn').addEventListener('click', doExport);
  $('#impBtn').addEventListener('click', function () { tab = 'data'; render(); setTimeout(function () { $('#impFile').click(); }, 50); });

  $('#adminTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; editing = null; render();
  });

  $('#lockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#lockPass').value;
    checkPass(v).then(function (ok) {
      if (ok) { unlocked = true; hideLock(); open(); }
      else $('#lockErr').textContent = 'Неверный пароль';
    });
  });
  $('#lock').addEventListener('click', function (e) { if (e.target === $('#lock')) hideLock(); });

  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
      e.preventDefault(); open();
    }
    if (e.key === 'Escape' && $('#admin').classList.contains('is-open')) close();
    if (e.ctrlKey && (e.key === 's' || e.key === 'S') && $('#admin').classList.contains('is-open')) {
      e.preventDefault(); persist(); render();
    }
  });

  function checkHash() { if (location.hash === '#/admin') open(); }
  window.addEventListener('hashchange', checkHash);
  setTimeout(checkHash, 400);

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  NS.admin = { open: open, close: close };
})(window.FHh);
