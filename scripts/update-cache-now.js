#!/usr/bin/env node
/**
 * Прямое обновление кэша теннисных коэффициентов
 * Для cron-задач и ручного запуска
 */

console.log('🔁 ЗАПУСК ОБНОВЛЕНИЯ КЭША ТЕННИСНЫХ КОЭФФИЦИЕНТОВ');
console.log('====================================================');
console.log(`⏰ Время: ${new Date().toLocaleString('ru-RU')}`);
console.log(`📅 Дата: ${new Date().toISOString().split('T')[0]}`);
console.log('====================================================\n');

// Пытаемся использовать OddsCacheManager
try {
  const OddsCacheManager = require('./odds-cache-manager');
  const SurfaceDetector = require('./surface-detector.js');
  
  const cacheManager = new OddsCacheManager();
  
  // Проверяем текущий кэш
  console.log('📊 ПРОВЕРКА ТЕКУЩЕГО КЭША...');
  const stats = cacheManager.getStats();
  console.log(`   Возраст кэша: ${stats.cacheAgeHours || 'N/A'} часов`);
  console.log(`   Запросов к API: ${stats.requestsCount || 0}`);
  
  // Всегда обновляем для вечернего кэша
  console.log('\n🔄 ОБНОВЛЯЕМ КЭШ...');
  
  const events = await cacheManager.refreshCache();
  
  console.log(`✅ КЭШ ОБНОВЛЁН!`);
  console.log(`   Событий получено: ${events ? events.length : 0}`);
  
  // Статистика по покрытиям
  if (events && events.length > 0) {
    const surfaceStats = SurfaceDetector.getSurfaceStats(events);
    console.log('\n🎾 СТАТИСТИКА ПОКРЫТИЙ:');
    console.log(`   Определено: ${surfaceStats.detectionRate}%`);
    
    for (const [surface, data] of Object.entries(surfaceStats.bySurface)) {
      if (data.count > 0) {
        console.log(`   ${surface}: ${data.count} матчей`);
      }
    }
    
    // Матчи на завтра
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const tomorrowEvents = events.filter(e => 
      e.commence_time && e.commence_time.startsWith(tomorrowStr)
    );
    
    console.log(`\n📅 МАТЧИ НА ЗАВТРА (${tomorrowStr}): ${tomorrowEvents.length}`);
    
    if (tomorrowEvents.length > 0) {
      console.log('   Примеры:');
      tomorrowEvents.slice(0, 3).forEach((event, index) => {
        const surface = SurfaceDetector.detectSurface(event);
        console.log(`   ${index + 1}. ${event.home_team} vs ${event.away_team} (${surface})`);
      });
    }
  }
  
  console.log('\n🎉 ОБНОВЛЕНИЕ КЭША ЗАВЕРШЕНО УСПЕШНО!');
  
} catch (error) {
  console.error('❌ ОШИБКА:', error.message);
  console.error('Стек ошибки:', error.stack);
  
  // Альтернативный метод
  console.log('\n🔄 ПРОБУЮ АЛЬТЕРНАТИВНЫЙ МЕТОД...');
  
  try {
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    
    const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  process.exit(1);
}
    const CACHE_FILE = '/root/.openclaw/workspace/skills/tennis-betting-ai/cache/odds-cache.json';
    
    const params = new URLSearchParams({
      apiKey: API_KEY,
      regions: 'eu',
      markets: 'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso'
    });

    const options = {
      hostname: 'api.the-odds-api.com',
      path: `/v4/sports/tennis/odds?${params.toString()}`,
      headers: { 'User-Agent': 'TennisBettingAI/1.5-cron' }
    };

    const req = https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          console.log(`✅ Получено ${events.length} событий (альтернативный метод)`);
          
          // Сохраняем кэш
          const cache = {
            timestamp: Date.now(),
            data: events,
            requests: 1
          };
          
          fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
          console.log(`✅ Кэш сохранён в ${CACHE_FILE}`);
          
          console.log('\n🎉 ОБНОВЛЕНИЕ КЭША ЗАВЕРШЕНО!');
          
        } catch (err) {
          console.error('❌ Ошибка парсинга данных:', err.message);
          process.exit(1);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Ошибка запроса:', err.message);
      process.exit(1);
    });
    
    req.setTimeout(30000, () => {
      console.error('❌ Таймаут запроса (30 секунд)');
      req.destroy();
      process.exit(1);
    });
    
  } catch (fallbackError) {
    console.error('❌ Альтернативный метод тоже не сработал:', fallbackError.message);
    process.exit(1);
  }
}