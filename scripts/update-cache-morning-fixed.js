#!/usr/bin/env node
/**
 * Утреннее обновление кэша теннисных коэффициентов
 * Исправленная версия для cron
 */

console.log('🌅 УТРЕННЕЕ ОБНОВЛЕНИЕ КЭША ТЕННИСНЫХ КОЭФФИЦИЕНТОВ');
console.log('====================================================');
console.log(`⏰ Время: ${new Date().toLocaleString('ru-RU')}`);
console.log(`📅 Дата: ${new Date().toISOString().split('T')[0]}`);
console.log(`🎯 Цель: Обновить кэш для матчей на сегодня/завтра`);
console.log('====================================================\n');

// Проверяем наличие API ключа
const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Использую демо-данные для кэша');
  
  // Создаём демо-кэш для тестирования
  const fs = require('fs');
  const path = require('path');
  
  const CACHE_DIR = '/root/.openclaw/workspace/skills/tennis-betting-ai/cache';
  const CACHE_FILE = path.join(CACHE_DIR, 'odds-cache.json');
  
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  // Демо-матчи на сегодня
  const demoEvents = [
    {
      id: 'demo-1',
      sport_key: 'tennis',
      sport_title: 'Tennis',
      commence_time: new Date(Date.now() + 3600000 * 4).toISOString(), // через 4 часа
      home_team: 'Novak Djokovic',
      away_team: 'Carlos Alcaraz',
      bookmakers: [
        {
          key: 'bet365',
          title: 'Bet365',
          markets: [{
            key: 'h2h',
            outcomes: [
              { name: 'Novak Djokovic', price: 1.65 },
              { name: 'Carlos Alcaraz', price: 2.25 }
            ]
          }]
        }
      ]
    },
    {
      id: 'demo-2',
      sport_key: 'tennis',
      sport_title: 'Tennis',
      commence_time: new Date(Date.now() + 3600000 * 6).toISOString(), // через 6 часов
      home_team: 'Iga Swiatek',
      away_team: 'Aryna Sabalenka',
      bookmakers: [
        {
          key: 'bet365',
          title: 'Bet365',
          markets: [{
            key: 'h2h',
            outcomes: [
              { name: 'Iga Swiatek', price: 1.40 },
              { name: 'Aryna Sabalenka', price: 3.00 }
            ]
          }]
        }
      ]
    }
  ];
  
  const cache = {
    timestamp: Date.now(),
    data: demoEvents,
    requests: 0,
    isDemo: true,
    message: 'Демо-кэш (API ключ не установлен)'
  };
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`✅ Создан демо-кэш с ${demoEvents.length} матчами`);
  console.log(`📁 Путь: ${CACHE_FILE}`);
  process.exit(0);
}

// Используем простой запрос к API без сложных зависимостей
const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = '/root/.openclaw/workspace/skills/tennis-betting-ai/cache';
const CACHE_FILE = path.join(CACHE_DIR, 'odds-cache.json');

// Создаём директорию кэша
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

console.log('📡 ЗАПРАШИВАЕМ ДАННЫЕ С THE ODDS API...');
console.log(`🔑 API ключ: ${API_KEY.substring(0, 10)}...`);

const params = new URLSearchParams({
  apiKey: API_KEY,
  regions: 'eu,us',
  markets: 'h2h',
  oddsFormat: 'decimal',
  dateFormat: 'iso',
  bookmakers: 'bet365,pinnacle,williamhill'
});

const options = {
  hostname: 'api.the-odds-api.com',
  path: `/v4/sports/tennis/odds?${params.toString()}`,
  headers: { 
    'User-Agent': 'TennisBettingAI/1.5-morning-update',
    'Accept': 'application/json'
  },
  timeout: 30000 // 30 секунд
};

console.log(`🌐 URL: https://api.the-odds-api.com${options.path.replace(API_KEY, 'API_KEY_HIDDEN')}`);

const req = https.get(options, (res) => {
  console.log(`📥 Ответ API: ${res.statusCode} ${res.statusMessage}`);
  
  if (res.statusCode !== 200) {
    console.error(`❌ Ошибка API: ${res.statusCode}`);
    console.error(`   Проверьте API ключ и доступность сервиса`);
    createBackupCache();
    return;
  }
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const events = JSON.parse(data);
      console.log(`✅ Получено ${events.length} теннисных событий`);
      
      // Фильтруем только актуальные события (сегодня/завтра)
      const now = Date.now();
      const tomorrow = now + 24 * 60 * 60 * 1000;
      
      const filteredEvents = events.filter(event => {
        if (!event.commence_time) return false;
        const eventTime = new Date(event.commence_time).getTime();
        return eventTime >= now && eventTime <= tomorrow;
      });
      
      console.log(`🎯 Актуальных событий (сегодня/завтра): ${filteredEvents.length}`);
      
      // Сохраняем кэш
      const cache = {
        timestamp: now,
        data: filteredEvents,
        requests: 1,
        source: 'api.the-odds-api.com',
        region: 'eu,us',
        totalReceived: events.length,
        filteredTo: filteredEvents.length
      };
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
      console.log(`✅ Кэш успешно сохранён`);
      console.log(`📁 Путь: ${CACHE_FILE}`);
      
      // Статистика
      if (filteredEvents.length > 0) {
        console.log('\n📊 СТАТИСТИКА:');
        
        // Группируем по времени
        const byHour = {};
        filteredEvents.forEach(event => {
          const time = new Date(event.commence_time);
          const hour = time.getHours();
          byHour[hour] = (byHour[hour] || 0) + 1;
        });
        
        console.log(`   Распределение по часам:`);
        Object.keys(byHour).sort().forEach(hour => {
          console.log(`     ${hour}:00 - ${byHour[hour]} матчей`);
        });
        
        // Средние коэффициенты
        let totalMatches = 0;
        let totalOdds = 0;
        
        filteredEvents.forEach(event => {
          if (event.bookmakers && event.bookmakers.length > 0) {
            const market = event.bookmakers[0].markets[0];
            if (market && market.outcomes && market.outcomes.length === 2) {
              const avgOdds = (market.outcomes[0].price + market.outcomes[1].price) / 2;
              totalOdds += avgOdds;
              totalMatches++;
            }
          }
        });
        
        if (totalMatches > 0) {
          const avgOdds = totalOdds / totalMatches;
          console.log(`   Средний коэффициент: ${avgOdds.toFixed(2)}`);
        }
      }
      
      console.log('\n🎉 УТРЕННЕЕ ОБНОВЛЕНИЕ КЭША ЗАВЕРШЕНО УСПЕШНО!');
      
    } catch (err) {
      console.error('❌ Ошибка парсинга данных:', err.message);
      createBackupCache();
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Ошибка сетевого запроса:', err.message);
  console.error('   Проблема с подключением к API');
  createBackupCache();
});

req.setTimeout(30000, () => {
  console.error('❌ Таймаут запроса (30 секунд)');
  req.destroy();
  createBackupCache();
});

// Функция создания резервного кэша
function createBackupCache() {
  console.log('\n🔄 СОЗДАНИЕ РЕЗЕРВНОГО КЭША...');
  
  const backupCache = {
    timestamp: Date.now(),
    data: [],
    requests: 0,
    isBackup: true,
    message: 'Резервный кэш (ошибка API)',
    warning: 'Требуется ручное обновление'
  };
  
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const oldCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (oldCache.data && oldCache.data.length > 0) {
        backupCache.data = oldCache.data;
        backupCache.message = 'Резервный кэш (используются старые данные)';
        console.log(`   Использую ${oldCache.data.length} старых событий`);
      }
    } catch (e) {
      console.log('   Не удалось прочитать старый кэш');
    }
  }
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(backupCache, null, 2), 'utf8');
  console.log(`✅ Резервный кэш создан`);
  console.log(`📁 Путь: ${CACHE_FILE}`);
}