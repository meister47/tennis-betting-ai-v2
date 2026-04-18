#!/usr/bin/env node

/**
 * Cron-скрипт для обновления кэша теннисных коэффициентов
 * Запускается вечером для подготовки данных на следующий день
 */

const path = require('path');
const fs = require('fs');

// Загружаем .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Проверяем токен
const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Проверьте файл .env.local');
  process.exit(1);
}

console.log('🔄 Cron: Обновление кэша теннисных коэффициентов');
console.log(`📅 Дата: ${new Date().toLocaleDateString('ru-RU')}`);
console.log(`⏰ Время: ${new Date().toLocaleTimeString('ru-RU')}`);
console.log('='.repeat(50));

// Импортируем OddsCacheManager
const OddsCacheManager = require('./odds-cache-manager');

async function updateCache() {
  try {
    console.log('🔍 Инициализируем кэш-менеджер...');
    const cacheManager = new OddsCacheManager();
    
    console.log('📥 Загружаем коэффициенты (force refresh)...');
    const events = await cacheManager.getTennisOdds(true); // force refresh
    
    if (!events || events.length === 0) {
      console.log('📭 Нет доступных событий');
      return;
    }
    
    // Получаем статистику
    const stats = cacheManager.getStats();
    
    console.log('✅ Кэш успешно обновлён!');
    console.log(`📊 Статистика:`);
    console.log(`   • Событий: ${events.length}`);
    console.log(`   • Возраст кэша: ${stats.cacheAgeHours.toFixed(1)} часов`);
    console.log(`   • Запросов сегодня: ${stats.requestsCount}`);
    console.log(`   • Следующее обновление: через ${stats.hoursUntilRefresh} часов`);
    
    // Сохраняем отчёт
    const report = {
      timestamp: new Date().toISOString(),
      eventsCount: events.length,
      cacheAgeHours: stats.cacheAgeHours,
      requestsCount: stats.requestsCount,
      nextRefreshHours: stats.hoursUntilRefresh
    };
    
    const reportPath = path.join(__dirname, '..', 'reports', 'cache-update-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Отчёт сохранён: ${reportPath}`);
    
    // Проверяем, есть ли матчи на завтра
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const tomorrowMatches = events.filter(event => 
      event.commence_time && event.commence_time.startsWith(tomorrowStr)
    );
    
    console.log(`\n📅 Матчи на завтра (${tomorrowStr}): ${tomorrowMatches.length}`);
    
    if (tomorrowMatches.length > 0) {
      console.log('🎾 Доступные матчи:');
      tomorrowMatches.slice(0, 5).forEach((match, i) => {
        console.log(`   ${i+1}. ${match.home_team} vs ${match.away_team}`);
      });
      
      if (tomorrowMatches.length > 5) {
        console.log(`   ... и ещё ${tomorrowMatches.length - 5} матчей`);
      }
    }
    
    console.log('\n✅ Cron задача выполнена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка обновления кэша:', error.message);
    
    // Сохраняем ошибку в лог
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    const errorPath = path.join(__dirname, '..', 'reports', 'cache-error-log.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
    
    process.exit(1);
  }
}

// Запускаем обновление
updateCache();