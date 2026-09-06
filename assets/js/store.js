/* ============================================================
   store.js — модель данных, хранилище, дефолтный контент.
   Метаданные -> localStorage, изображения -> IndexedDB (blob).
   ============================================================ */
window.FHh = window.FHh || {};

(function (NS) {
  'use strict';

  var LS_KEY = 'fhh.site.v1';
  var DB_NAME = 'fhh-media';
  var DB_STORE = 'img';

  /* ---------------- дефолтный контент ---------------- */
  var DEFAULTS = {
    settings: {
      siteTitle: 'FHh',
      telegram: 'kip_rina',
      heroTag1: 'ручная работа',
      heroTag2: 'штучный тираж',
      heroTag3: 'отправка по России',
      heroLine1: 'fantasy',
      heroLine2: 'hobbyhorse.',
      heroSub: 'Хоббихорсы, амуниция, витражи и крафтовые изделия — сделанные так, будто выросли в лесу.',
      heroFootL: 'мастерская · Ирина Киприянова',
      bandLead: 'каждая работа существует в одном экземпляре',
      bandText:
        '<p>Я не повторяю модели: даже если основа похожа, характер, цвет и фурнитура ' +
        'собираются заново — под конкретную лошадь или под конкретного человека.</p>' +
        '<p>Готовое из витрины уезжает сразу. Всё остальное делается под заказ: ' +
        'обсуждаем породу, масть, гриву, амуницию и сроки в Telegram.</p>',
      footerNote: '© FHh · Fantasy Hobbyhorse · Ирина Киприянова',
      currency: '₽',
      aboutText:
        '<p>Меня зовут Ирина Киприянова. Я делаю вещи руками: хоббихорсов и амуницию для них, витражи, ' +
        'мягкие игрушки и крафтовые предметы для дома.</p>' +
        '<p>Каждая работа существует в одном экземпляре. Я не повторяю модели: даже если основа похожа, ' +
        'характер, цвет и фурнитура собираются заново под конкретную лошадь или конкретного человека.</p>' +
        '<h3>Как это работает</h3>' +
        '<p>Готовые работы из витрины можно забрать сразу. Всё остальное — под заказ: обсуждаем ' +
        'породу, масть, гриву, амуницию и сроки в Telegram.</p>',
      contactsText:
        '<p>Все вопросы, заказы и предзаказы — в Telegram. Отвечаю в течение дня.</p>' +
        '<h3>Доставка</h3>' +
        '<p>СДЭК и Почта России по России, отправка в течение 1–3 дней после оплаты. ' +
        'Самовывоз обсуждается отдельно.</p>' +
        '<h3>Оплата</h3>' +
        '<p>Перевод по номеру телефона. Работы под заказ — предоплата 50%.</p>',
      // оформление
      paper: '#ececea',
      ink: '#15171a',
      moss: '#3f5c46',
      brass: '#a86a38',
      anim: 1,
      density: 1,          // плотность ботаники
      preloaderMs: 2200,   // минимальная длительность прелоадера, мс
      adminPass: 'fern',   // пароль панели (используется, пока не задан хеш)
      adminPassHash: ''    // sha-256 пароля; задаётся из панели, вытесняет adminPass
    },

    categories: [
      { id: 'hh',      name: 'Хоббихорсы' },
      { id: 'ammo',    name: 'Амуниция' },
      { id: 'glass',   name: 'Витражи' },
      { id: 'toys',    name: 'Игрушки' },
      { id: 'craft',   name: 'Крафт' }
    ],

    items: [
      {
        id: 'i1', title: 'Мшистый', cat: 'hh', price: 12500, old: null,
        status: 'available',
        desc: '<p>Хоббихорс размера S на буковой палке. Голова — шерстяной драп цвета мокрого мха, ' +
              'грива из смеси искусственных локонов трёх оттенков.</p>',
        specs: [['Размер', 'S · 100 см'], ['Материал', 'драп, бук'], ['Срок изготовления', 'в наличии']],
        images: []
      },
      {
        id: 'i2', title: 'Папоротниковая уздечка', cat: 'ammo', price: 3400, old: 3900,
        status: 'available',
        desc: '<p>Уздечка на размер S–M. Натуральная кожа растительного дубления, ' +
              'латунная фурнитура, ручное тиснение вайи папоротника на налобнике.</p>',
        specs: [['Размер', 'S–M'], ['Материал', 'кожа, латунь'], ['Цвет', 'коньячный']],
        images: []
      },
      {
        id: 'i3', title: 'Витраж «Заросли»', cat: 'glass', price: 21000, old: null,
        status: 'order',
        desc: '<p>Панно 30×40 см в технике Тиффани. Опаловое и катедральное стекло, ' +
              'патинированная пайка. Подвес в комплекте.</p>',
        specs: [['Размер', '30 × 40 см'], ['Техника', 'Тиффани'], ['Срок', '3–4 недели']],
        images: []
      },
      {
        id: 'i4', title: 'Лесной дух', cat: 'toys', price: 4800, old: null,
        status: 'sold',
        desc: '<p>Интерьерная игрушка ростом 26 см. Мохер, стеклянные глаза, ' +
              'подвижные соединения на дисках.</p>',
        specs: [['Рост', '26 см'], ['Материал', 'мохер, опилки'], ['Тираж', '1 из 1']],
        images: []
      },
      {
        id: 'i5', title: 'Вороной', cat: 'hh', price: 15900, old: null,
        status: 'available',
        desc: '<p>Хоббихорс размера M. Плотный флис, скульптурная лепка морды, ' +
              'грива и хвост из канекалона.</p>',
        specs: [['Размер', 'M · 105 см'], ['Материал', 'флис, дерево'], ['Вес', '1,1 кг']],
        images: []
      },
      {
        id: 'i6', title: 'Вальтрап «Вайя»', cat: 'ammo', price: 2600, old: null,
        status: 'available',
        desc: '<p>Вальтрап из шерстяного сукна с вышивкой папоротника, кант — вощёный шнур.</p>',
        specs: [['Размер', 'универсальный'], ['Материал', 'сукно'], ['Уход', 'ручная стирка']],
        images: []
      },
      {
        id: 'i7', title: 'Сюнкатэ (подсвечник)', cat: 'craft', price: 5200, old: null,
        status: 'available',
        desc: '<p>Подсвечник из латуни и стекла, форма собрана из силуэтов листьев. ' +
              'Под чайную свечу.</p>',
        specs: [['Высота', '17 см'], ['Материал', 'латунь, стекло'], ['Тираж', 'малая серия']],
        images: []
      },
      {
        id: 'i8', title: 'Витражная подвеска «Спора»', cat: 'glass', price: 1900, old: null,
        status: 'available',
        desc: '<p>Небольшая подвеска-суncatcher диаметром 9 см. Ловит утренний свет.</p>',
        specs: [['Диаметр', '9 см'], ['Техника', 'Тиффани'], ['Крепление', 'леска + кольцо']],
        images: []
      }
    ]
  };

  /* ---------------- утилиты ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function uid() {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function deepFill(target, src) {
    // добавляет отсутствующие ключи из src (миграция старых сохранений)
    Object.keys(src).forEach(function (k) {
      if (target[k] === undefined) target[k] = clone(src[k]);
    });
    return target;
  }

  /* ---------------- IndexedDB для картинок ---------------- */
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no idb')); return; }
      var rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = function () {
        if (!rq.result.objectStoreNames.contains(DB_STORE)) rq.result.createObjectStore(DB_STORE);
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbPromise;
  }

  function idbPut(key, blob) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(blob, key);
        tx.oncomplete = function () { res(key); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function idbGet(key) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(DB_STORE, 'readonly');
        var rq = tx.objectStore(DB_STORE).get(key);
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }

  function idbDel(key) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(key);
        tx.oncomplete = res;
        tx.onerror = res;
      });
    });
  }

  /* URL картинки: либо внешняя ссылка, либо idb:<key> -> objectURL */
  var urlCache = {};
  function resolveImage(ref) {
    if (!ref) return Promise.resolve('');
    if (ref.indexOf('idb:') !== 0) return Promise.resolve(ref);
    if (urlCache[ref]) return Promise.resolve(urlCache[ref]);
    return idbGet(ref.slice(4)).then(function (blob) {
      if (!blob) return '';
      var u = URL.createObjectURL(blob);
      urlCache[ref] = u;
      return u;
    }).catch(function () { return ''; });
  }

  /* Сжатие загружаемого файла до разумного размера */
  function ingestFile(file, maxSide) {
    maxSide = maxSide || 1600;
    return new Promise(function (res, rej) {
      if (!/^image\//.test(file.type)) { rej(new Error('not an image')); return; }
      var img = new Image();
      var fr = new FileReader();
      fr.onload = function () { img.src = fr.result; };
      fr.onerror = rej;
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var s = Math.min(1, maxSide / Math.max(w, h));
        var cw = Math.round(w * s), ch = Math.round(h * s);
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        var g = c.getContext('2d');
        g.drawImage(img, 0, 0, cw, ch);
        c.toBlob(function (blob) {
          if (!blob) { rej(new Error('encode failed')); return; }
          var key = uid();
          idbPut(key, blob).then(function () {
            var ref = 'idb:' + key;
            urlCache[ref] = URL.createObjectURL(blob);
            res(ref);
          }).catch(rej);
        }, 'image/webp', 0.86);
      };
      img.onerror = function () { rej(new Error('decode failed')); };
      fr.readAsDataURL(file);
    });
  }

  /* ---------------- состояние ---------------- */
  var state = null;

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* приватный режим */ }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        parsed.settings = deepFill(parsed.settings || {}, DEFAULTS.settings);
        if (!Array.isArray(parsed.items)) parsed.items = clone(DEFAULTS.items);
        if (!Array.isArray(parsed.categories)) parsed.categories = clone(DEFAULTS.categories);
        state = parsed;
        return state;
      } catch (e) { /* битый JSON — берём дефолт */ }
    }
    state = clone(DEFAULTS);
    return state;
  }

  function save() {
    try {
      state.savedAt = new Date().toISOString();
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------- опубликованное содержимое ----------------
     data/site.json — то, что видят посетители сайта. Правки в браузере
     (localStorage) перекрывают его только пока они свежее публикации:
     как только выкладывается новый файл, он побеждает и у владельца тоже. */
  function hydrate() {
    var cfg = window.FHH_CONFIG || {};
    var url = cfg.dataUrl;
    if (!url) return Promise.resolve({ source: 'local', changed: false });

    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 'v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (pack) {
        if (!pack) return { source: 'local', changed: false };
        var site = pack.site || pack;
        if (!site || !site.settings || !site.items) return { source: 'local', changed: false };

        var published = Date.parse(pack.publishedAt || site.publishedAt || 0) || 0;
        var localAt = Date.parse((state && state.savedAt) || 0) || 0;
        if (localAt && localAt >= published) {
          return { source: 'local', changed: false, published: published };
        }

        var media = pack.media || {};
        return Promise.all(Object.keys(media).map(function (ref) {
          return fetch(media[ref]).then(function (r) { return r.blob(); })
            .then(function (b) { return idbPut(ref.slice(4), b); })
            .catch(function () { return null; });
        })).then(function () {
          // пароль панели живёт только локально и публикацией не перетирается
          var keepPass = state && state.settings ? state.settings.adminPass : undefined;
          var keepHash = state && state.settings ? state.settings.adminPassHash : undefined;
          site.settings = deepFill(site.settings, DEFAULTS.settings);
          if (keepPass !== undefined) site.settings.adminPass = keepPass;
          if (keepHash !== undefined) site.settings.adminPassHash = keepHash;
          site.savedAt = pack.publishedAt || site.publishedAt || new Date().toISOString();
          state = site;
          urlCache = {};
          try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
          return { source: 'published', changed: true, published: published };
        });
      })
      .catch(function () { return { source: 'local', changed: false }; });
  }

  function reset() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    state = clone(DEFAULTS);
    return state;
  }

  function exportJSON() {
    // выгружаем вместе с картинками в base64, чтобы бэкап был самодостаточным
    var refs = [];
    state.items.forEach(function (it) {
      (it.images || []).forEach(function (r) { if (r.indexOf('idb:') === 0 && refs.indexOf(r) < 0) refs.push(r); });
    });
    return Promise.all(refs.map(function (r) {
      return idbGet(r.slice(4)).then(function (blob) {
        if (!blob) return null;
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res({ ref: r, data: fr.result }); };
          fr.onerror = function () { res(null); };
          fr.readAsDataURL(blob);
        });
      }).catch(function () { return null; });
    })).then(function (list) {
      var media = {};
      list.forEach(function (x) { if (x) media[x.ref] = x.data; });
      var now = new Date().toISOString();
      // пароль панели в публикуемый файл не попадает: он остаётся только
      // в браузере владельца
      var pub = clone(state);
      delete pub.settings.adminPass;
      delete pub.settings.adminPassHash;
      return JSON.stringify({ v: 1, exported: now, publishedAt: now, site: pub, media: media }, null, 2);
    });
  }

  function importJSON(text) {
    var pack = JSON.parse(text);
    var site = pack.site || pack;
    if (!site.settings || !site.items) throw new Error('Не похоже на бэкап сайта');
    var media = pack.media || {};
    var keys = Object.keys(media);
    return Promise.all(keys.map(function (ref) {
      return fetch(media[ref]).then(function (r) { return r.blob(); })
        .then(function (b) { return idbPut(ref.slice(4), b); })
        .catch(function () { return null; });
    })).then(function () {
      var keepPass = state && state.settings ? state.settings.adminPass : undefined;
      var keepHash = state && state.settings ? state.settings.adminPassHash : undefined;
      site.settings = deepFill(site.settings, DEFAULTS.settings);
      if (site.settings.adminPass === undefined && keepPass !== undefined) site.settings.adminPass = keepPass;
      if (!site.settings.adminPassHash && keepHash) site.settings.adminPassHash = keepHash;
      state = site;
      urlCache = {};
      save();
      return state;
    });
  }

  /* ---------------- публичный API ---------------- */
  NS.store = {
    DEFAULTS: DEFAULTS,
    get state() { return state || load(); },
    load: load,
    save: save,
    hydrate: hydrate,
    reset: reset,
    uid: uid,
    clone: clone,
    resolveImage: resolveImage,
    ingestFile: ingestFile,
    dropImage: function (ref) { if (ref && ref.indexOf('idb:') === 0) { delete urlCache[ref]; return idbDel(ref.slice(4)); } return Promise.resolve(); },
    exportJSON: exportJSON,
    importJSON: importJSON,
    catName: function (id) {
      var c = (state.categories || []).filter(function (x) { return x.id === id; })[0];
      return c ? c.name : '';
    },
    money: function (n) {
      if (n === null || n === undefined || n === '') return '—';
      return Number(n).toLocaleString('ru-RU') + ' ' + state.settings.currency;
    }
  };

  load();
})(window.FHh);
