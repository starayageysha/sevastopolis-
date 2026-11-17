/* Севастополис — рыбалка: FishDatabase (v185)
   Виды улова, места, наживки, снасти, достижения. Только данные. */
(function () {
  'use strict';
  var F = window.SevFish = window.SevFish || {};
  // zones: веса по местам; bait: множители по наживке; power — сила в вываживании (0..1.5)
  var SP = [
    // ---- обычная рыба ----
    { id: 'bychok', n: 'Бычок', k: 'fish', r: 'common', w: [.05, .3], l: [8, 18], col: ['#8a6d3b', '#c9a86a'], shape: 'goby', p: .35, c: 2,
      zones: { beach: 30, rocks: 30, pier: 25, bay: 25, sea: 5 }, bait: { bread: 1, worm: 1.6, shrimp: 1.2, lure: .3 } },
    { id: 'kefal', n: 'Кефаль', k: 'fish', r: 'common', w: [.3, 1.6], l: [25, 50], col: ['#9fb2bf', '#e9f0f4'], shape: 'long', p: .6, c: 4,
      zones: { beach: 22, rocks: 12, pier: 30, bay: 22, sea: 15 }, bait: { bread: 1.8, worm: .8, shrimp: .8, lure: .5 } },
    { id: 'stavrida', n: 'Ставрида', k: 'fish', r: 'common', w: [.1, .5], l: [15, 30], col: ['#6c8fa8', '#e6d36a'], shape: 'long', p: .5, c: 3,
      zones: { beach: 18, rocks: 10, pier: 28, bay: 18, sea: 30 }, bait: { bread: .6, worm: 1, shrimp: 1.4, lure: 1.8 } },
    { id: 'kambala', n: 'Камбала', k: 'fish', r: 'common', w: [.3, 2.5], l: [20, 45], col: ['#a08a62', '#d9c79a'], shape: 'flat', p: .55, c: 5,
      zones: { beach: 18, rocks: 6, pier: 10, bay: 14, sea: 8 }, bait: { bread: .5, worm: 1.6, shrimp: 1.3, lure: .4 } },
    { id: 'barabulka', n: 'Барабулька', k: 'fish', r: 'common', w: [.05, .25], l: [10, 20], col: ['#e0705a', '#f6d0b0'], shape: 'goby', p: .3, c: 3,
      zones: { beach: 20, rocks: 18, pier: 12, bay: 20, sea: 4 }, bait: { bread: .7, worm: 1.5, shrimp: 1.4, lure: .3 } },
    // ---- редкая рыба ----
    { id: 'gubanr', n: 'Радужный губан', k: 'fish', r: 'rare', w: [.2, .8], l: [15, 30], col: ['#2fc6a8', '#ff6fae'], shape: 'round', p: .55, c: 15,
      zones: { beach: 1, rocks: 7, pier: 2, bay: 6, sea: 1 }, bait: { bread: .4, worm: 1.2, shrimp: 1.6, lure: .8 } },
    { id: 'petukh', n: 'Морской петух', k: 'fish', r: 'rare', w: [.4, 1.8], l: [25, 45], col: ['#d8432a', '#4fb3ff'], shape: 'wing', p: .7, c: 18,
      zones: { beach: .6, rocks: 4, pier: 2, bay: 4, sea: 3 }, bait: { bread: .3, worm: 1, shrimp: 1.8, lure: 1 } },
    { id: 'lobang', n: 'Великан-лобан', k: 'fish', r: 'epic', w: [4, 9], l: [60, 95], col: ['#7d8f99', '#c8d4da'], shape: 'long', p: 1.35, c: 40, big: true,
      zones: { beach: .3, rocks: .6, pier: 2.4, bay: 1, sea: 3 }, bait: { bread: 1.4, worm: .6, shrimp: .8, lure: 1.6 } },
    { id: 'zolotaya', n: 'Золотая рыбка', k: 'fish', r: 'legend', w: [.3, 1.2], l: [18, 32], col: ['#ffcf2e', '#ff8a00'], shape: 'round', p: .9, c: 100, gold: true,
      zones: { beach: .15, rocks: .25, pier: .3, bay: .6, sea: .5 }, bait: { bread: .8, worm: 1, shrimp: 1.4, lure: 1.2 } },
    // ---- морские жители ----
    { id: 'krab', n: 'Краб', k: 'creature', r: 'common', w: [.1, .6], l: [8, 18], e: '🦀', p: .4, c: 4,
      zones: { beach: 8, rocks: 20, pier: 8, bay: 8, sea: 1 }, bait: { bread: .6, worm: 1.2, shrimp: 1.6, lure: .2 } },
    { id: 'osminog', n: 'Осьминог', k: 'creature', r: 'rare', w: [.5, 3], l: [30, 80], e: '🐙', p: .9, c: 20,
      zones: { beach: .5, rocks: 4, pier: 2, bay: 2, sea: 2 }, bait: { bread: .3, worm: .8, shrimp: 2, lure: .8 } },
    { id: 'zvezda', n: 'Морская звезда', k: 'creature', r: 'common', w: [.05, .3], l: [10, 25], e: '⭐', p: .15, c: 5,
      zones: { beach: 6, rocks: 8, pier: 4, bay: 6, sea: 1 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: .5 } },
    // ---- мусор и странное ----
    { id: 'botinok', n: 'Старый ботинок', k: 'junk', r: 'common', w: [.4, 1.2], l: [25, 32], e: '🥾', p: .2, c: 1,
      zones: { beach: 5, rocks: 3, pier: 6, bay: 4, sea: 2 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.3 } },
    { id: 'banka', n: 'Ржавая банка', k: 'junk', r: 'common', w: [.05, .2], l: [10, 12], e: '🥫', p: .1, c: 1,
      zones: { beach: 5, rocks: 2, pier: 6, bay: 4, sea: 1 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.3 } },
    { id: 'vedro', n: 'Дырявое ведро', k: 'junk', r: 'common', w: [.8, 2], l: [25, 30], e: '🪣', p: .3, c: 1,
      zones: { beach: 3, rocks: 1, pier: 4, bay: 3, sea: 1 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.3 } },
    { id: 'podlodka', n: 'Игрушечная подлодка', k: 'junk', r: 'rare', w: [.2, .5], l: [20, 30], e: '🛥️', p: .2, c: 10,
      zones: { beach: .8, rocks: .5, pier: 1, bay: 1.2, sea: .8 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.3 } },
    // ---- сокровища ----
    { id: 'monety', n: 'Горсть старых монет', k: 'treasure', r: 'rare', w: [.1, .4], l: [5, 8], e: '🪙', p: .2, c: 0, coins: [8, 20],
      zones: { beach: 1, rocks: 1, pier: 2.5, bay: 1.5, sea: 2 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.4 } },
    { id: 'butylka', n: 'Бутылка с посланием', k: 'treasure', r: 'rare', w: [.3, .6], l: [25, 30], e: '🍾', p: .15, c: 5, bottle: true,
      zones: { beach: 2, rocks: 1, pier: 1.2, bay: 1.5, sea: 1.5 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.2 } },
    { id: 'sunduk', n: 'Сундук со дна', k: 'treasure', r: 'epic', w: [5, 12], l: [50, 70], e: '🧰', p: 1.1, c: 0, coins: [40, 90], chest: true,
      zones: { beach: .25, rocks: .4, pier: 1.2, bay: .6, sea: 1.4 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1.5 } },
    { id: 'karta', n: 'Карта сокровищ', k: 'treasure', r: 'epic', w: [.05, .1], l: [20, 30], e: '🗺️', p: .1, c: 0, map: true,
      zones: { beach: .2, rocks: .3, pier: .3, bay: .4, sea: .5 }, bait: { bread: 1, worm: 1, shrimp: 1, lure: 1 } }
  ];
  F.DB = {
    species: SP,
    byId: SP.reduce(function (a, s) { a[s.id] = s; return a; }, {}),
    rarity: { common: { n: 'Обычная', c: '#7a8a99' }, rare: { n: 'Редкая', c: '#2f8fd8' }, epic: { n: 'Очень редкая', c: '#9b4dff' }, legend: { n: 'Легендарная', c: '#e0a000' } },
    kinds: { fish: 'Рыба', creature: 'Морской житель', junk: 'Находка', treasure: 'Сокровище' },
    zones: { beach: 'Песчаный пляж', rocks: 'Каменистый берег', pier: 'Пирс', bay: 'Бухта', sea: 'Открытое море' },
    baits: {
      bread: { n: 'Хлеб', e: '🍞', price: 0, speed: 1 },
      worm: { n: 'Червь', e: '🪱', price: 2, speed: 1.25 },
      shrimp: { n: 'Креветка', e: '🦐', price: 4, speed: 1.35, luck: 1.3 },
      lure: { n: 'Блесна', e: '🪝', price: 0, speed: 1.1, luck: 1.15, unlock: 'c30' }
    },
    rods: [
      { id: 'basic', n: 'Простая удочка', e: '🎣', reel: 1, tough: 1, col: '#8a5a2b' },
      { id: 'bamboo', n: 'Бамбуковая удочка', e: '🎋', reel: 1.25, tough: 1.1, col: '#c9a84f', unlock: 'c10' },
      { id: 'carbon', n: 'Карбоновая удочка', e: '⚫', reel: 1.4, tough: 1.3, col: '#2b2f36', unlock: 'rival' },
      { id: 'gold', n: 'Золотая удочка', e: '✨', reel: 1.7, tough: 1.55, col: '#f2c230', unlock: 'gold', luck: 1.4 }
    ],
    lines: [
      { id: 'basic', n: 'Обычная леска', str: 100, price: 0 },
      { id: 'strong', n: 'Прочная леска', str: 130, price: 40 },
      { id: 'braid', n: 'Плетёный шнур', str: 165, price: 100 }
    ],
    bobbers: [
      { id: 'red', n: 'Красный поплавок', top: '#e32626', bot: '#ffffff' },
      { id: 'duck', n: 'Поплавок-уточка', top: '#ffd21f', bot: '#ff8a00', unlock: 'c5' },
      { id: 'star', n: 'Звёздный поплавок', top: '#7c4dff', bot: '#ffe680', unlock: 'map' }
    ],
    achievements: [
      { id: 'first', n: 'Первый улов', e: '🐟', d: 'Поймать что-нибудь' },
      { id: 'c5', n: 'Начинающий рыбак', e: '🦆', d: '5 уловов — поплавок-уточка' },
      { id: 'c10', n: 'Рыбак', e: '🎋', d: '10 уловов — бамбуковая удочка' },
      { id: 'c30', n: 'Опытный рыбак', e: '🪝', d: '30 уловов — блесна' },
      { id: 'allc', n: 'Знаток Чёрного моря', e: '📘', d: 'Все 5 обычных рыб' },
      { id: 'big', n: 'Трофей', e: '🏆', d: 'Рыба тяжелее 5 кг' },
      { id: 'gold', n: 'Золотая рыбка', e: '✨', d: 'Поймать золотую рыбку — золотая удочка' },
      { id: 'chest', n: 'Сундук со дна', e: '🧰', d: 'Выловить сундук' },
      { id: 'junk3', n: 'Барахольщик', e: '🥾', d: '3 разные находки' },
      { id: 'map', n: 'Кладоискатель', e: '🗺️', d: 'Найти клад по карте — звёздный поплавок' },
      { id: 'rain', n: 'Под дождём', e: '🌧️', d: 'Поймать рыбу в дождь' },
      { id: 'night', n: 'Ночной рыбак', e: '🌙', d: 'Поймать рыбу ночью' },
      { id: 'gull', n: 'Отбился от чайки', e: '🕊️', d: 'Не отдать улов чайке' },
      { id: 'rival', n: 'Обогнал Михалыча', e: '🦝', d: 'Выиграть соревнование дня — карбоновая удочка' },
      { id: 'album', n: 'Полный альбом', e: '📖', d: 'Собрать все виды' }
    ],
    // секретные места для карт сокровищ (суша Парка Победы и окрестностей)
    secrets: [
      { x: -96, z: 760, n: 'у старого маяка-фонаря на набережной' }, { x: 98, z: 12, n: 'в кустах у восточного входа в парк' },
      { x: -70, z: -118, n: 'возле южной аллеи' }, { x: 75, z: 640, n: 'у фонтана в северной части парка' },
      { x: -120, z: 420, n: 'у края парка, за деревьями' }, { x: 290, z: 850, n: 'в дальнем конце пляжа' }
    ],
    // бухты (для таблицы улова «Бухта»)
    bays: [{ x0: -1400, z0: -600, x1: -900, z1: 0, n: 'Бухта Омега' }, { x0: -2600, z0: -1500, x1: -1700, z1: -500, n: 'Казачья бухта' }],
    rival: { n: 'Рыбак Михалыч', x: -4.5, z: 933 }
  };
})();
