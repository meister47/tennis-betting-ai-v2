#!/usr/bin/env node

/**
 * Утреннее обновление кэша теннисных коэффициентов
 * Запускается по cron в 8:00 для получения свежих данных на день
 */

const OddsCacheManager = require('./odds-cache-manager');

async function updateCache() {
  console.log('🕖 УТРЕННЕЕ ОБНОВЛЕНИЕ КЭША ТЕННИСНЫХ КОЭФФИЦИЕНТОВ');
  console.log('================================================================');
  
  const cacheManager = new OddsCacheManager();
  
  console.log('🔍 Проверяю текущий кэш...');
  const statsBefore = cacheManager.getStats();
  const cacheAgeHours = parseFloat(statsBefore.cacheAgeHours) || 0;
  const requestsCount = statsBefore.requestsCount || 0;
  
  console.log(`📊 Текущий кэш: возраст ${cacheAgeHours} часов, запросов: ${requestsCount}`);
  
  // Всегда обновляем утром для свежих данных
  console.log('🔄 Обновляю кэш для утренних матчей...');
  
  try {
    console.log('🗑️ Очищаю старый кэш...');
    // Удаляем файл кэша напрямую
    const fs = require('fs');
    const path = require('path');
    const CACHE_FILE = path.join(__dirname, '../cache/odds-cache.json');
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('🗑️ Файл кэша удалён');
    }
    
    console.log('📡 Запрашиваю свежие данные...');
    const freshEvents = await cacheManager.refreshCache();
    
    const statsAfter = cacheManager.getStats();
    console.log(`✅ Новый кэш создан, запросов: ${statsAfter.requestsCount || 0}`);
    
    if (freshEvents && Array.isArray(freshEvents)) {
      console.log(`📈 Событий получено: ${freshEvents.length}`);
      
      const today = new Date().toISOString().split('T')[0];
      const todayEvents = freshEvents.filter(e => e.commence_time && e.commence_time.startsWith(today));
      console.log(`🎾 Сегодняшних матчей (${today}): ${todayEvents.length}`);
      
      // Показываем первые 5 матчей для проверки
      if (todayEvents.length > 0) {
        console.log('\n📋 ПЕРВЫЕ 5 МАТЧЕЙ НА СЕГОДНЯ:');
        console.log('================================');
        todayEvents.slice(0, 5).forEach((event, i) => {
          const time = event.commence_time ? new Date(event.commence_time).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : 'не указано';
          console.log(`${i+1}. ${event.home_team || 'TBD'} vs ${event.away_team || 'TBD'} (${time})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении кэша:', error.message);
    console.log('⚠️ Пробую получить данные напрямую...');
    
    // Fallback: пробуем получить данные напрямую
    try {
      const events = await cacheManager.getTennisOdds(false);
      if (events && Array.isArray(events)) {
        console.log(`📊 Получено ${events.length} событий (fallback)`);
      }
    } catch (fallbackError) {
      console.error('❌ Fallback также не сработал:', fallbackError.message);
    }
  }
  
  console.log('');
  console.log('🎯 НАСТРОЙКИ СИСТЕМЫ С ИСТОРИЧЕСКИМИ ОПТИМИЗАЦИЯМИ:');
  const HistoricalOptimizations = require('../config/historical-optimizations.js');
  console.log(`   • MIN_ODDS: ${HistoricalOptimizations.ODDS_CONFIG.MIN_ODDS}`);
  console.log(`   • SWEET_SPOT: ${HistoricalOptimizations.ODDS_CONFIG.SWEET_SPOT.MIN}-${HistoricalOptimizations.ODDS_CONFIG.SWEET_SPOT.MAX}`);
  console.log(`   • Оптимизации: ${HistoricalOptimizations.USE_HISTORICAL_OPTIMIZATIONS ? 'ВКЛ' : 'ВЫКЛ'}`);
  
  console.log('');
  console.log('🕒 Время завершения:', new Date().toLocaleString('ru-RU'));
  console.log('================================================================');
  
  // Запускаем анализ с новыми данными
  console.log('\n🎾 ЗАПУСК АНАЛИЗА С НОВЫМИ ДАННЫМИ:');
  console.log('====================================');
  
  try {
    // Просто импортируем и запускаем как отдельный файл
    require('./real-today-analysis-min-odds.js');
  } catch (error) {
    console.error('❌ Ошибка при анализе:', error.message);
    console.log('⚠️ Попробуйте запустить анализ вручную: node real-today-analysis-min-odds.js');
  }
}

// Запуск
updateCache().catch(error => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});