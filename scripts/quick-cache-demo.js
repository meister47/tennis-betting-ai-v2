// Простой скрипт создания демо-кэша
const fs = require('fs');
const path = require('path');

console.log('🌅 СОЗДАНИЕ УТРЕННЕГО ДЕМО-КЭША');

const CACHE_DIR = '/root/.openclaw/workspace/skills/tennis-betting-ai/cache';
const CACHE_FILE = path.join(CACHE_DIR, 'odds-cache.json');

// Создаём директорию
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`📁 Создана директория кэша: ${CACHE_DIR}`);
}

// Демо-матчи на сегодня
const now = Date.now();
const demoEvents = [
  {
    id: 'morning-1',
    sport_key: 'tennis',
    sport_title: 'Tennis',
    commence_time: new Date(now + 3600000 * 2).toISOString(), // через 2 часа
    home_team: 'Novak Djokovic',
    away_team: 'Jannik Sinner',
    bookmakers: [
      {
        key: 'bet365',
        title: 'Bet365',
        markets: [{
          key: 'h2h',
          outcomes: [
            { name: 'Novak Djokovic', price: 1.85 },
            { name: 'Jannik Sinner', price: 1.95 }
          ]
        }]
      }
    ]
  },
  {
    id: 'morning-2',
    sport_key: 'tennis',
    sport_title: 'Tennis',
    commence_time: new Date(now + 3600000 * 3).toISOString(), // через 3 часа
    home_team: 'Iga Swiatek',
    away_team: 'Coco Gauff',
    bookmakers: [
      {
        key: 'bet365',
        title: 'Bet365',
        markets: [{
          key: 'h2h',
          outcomes: [
            { name: 'Iga Swiatek', price: 1.50 },
            { name: 'Coco Gauff', price: 2.60 }
          ]
        }]
      }
    ]
  },
  {
    id: 'morning-3',
    sport_key: 'tennis',
    sport_title: 'Tennis',
    commence_time: new Date(now + 3600000 * 4).toISOString(), // через 4 часа
    home_team: 'Carlos Alcaraz',
    away_team: 'Daniil Medvedev',
    bookmakers: [
      {
        key: 'bet365',
        title: 'Bet365',
        markets: [{
          key: 'h2h',
          outcomes: [
            { name: 'Carlos Alcaraz', price: 1.70 },
            { name: 'Daniil Medvedev', price: 2.15 }
          ]
        }]
      }
    ]
  }
];

const cache = {
  timestamp: now,
  data: demoEvents,
  requests: 0,
  isDemo: true,
  message: 'Утренний демо-кэш (API ключ не установлен)',
  created: new Date().toLocaleString('ru-RU'),
  matches: demoEvents.length
};

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');

console.log(`✅ Демо-кэш создан`);
console.log(`📁 Файл: ${CACHE_FILE}`);
console.log(`🎾 Матчей: ${demoEvents.length}`);
console.log(`⏰ Время создания: ${new Date(now).toLocaleString('ru-RU')}`);

// Вывод информации о матчах
console.log('\n📅 МАТЧИ В КЭШЕ:');
demoEvents.forEach((event, index) => {
  const time = new Date(event.commence_time);
  const odds1 = event.bookmakers[0].markets[0].outcomes[0].price;
  const odds2 = event.bookmakers[0].markets[0].outcomes[1].price;
  console.log(`   ${index + 1}. ${event.home_team} (${odds1}) vs ${event.away_team} (${odds2})`);
  console.log(`      Время: ${time.toLocaleTimeString('ru-RU')}`);
});

console.log('\n🎉 УТРЕННЕЕ ОБНОВЛЕНИЕ ЗАВЕРШЕНО!');