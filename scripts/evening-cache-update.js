#!/usr/bin/env node

/**
 * Вечернее обновление кэша теннисных коэффициентов
 * Запускается по cron в 18:00 для обновления данных на следующий день
 */

const OddsCacheManager = require('./odds-cache-manager');
const SurfaceDetector = require('./surface-detector.js');

async function updateEveningCache() {
  console.log('🌙 ВЕЧЕРНЕЕ ОБНОВЛЕНИЕ КЭША ТЕННИСНЫХ КОЭФФИЦИЕНТОВ');
  console.log('================================================================');
  console.log(`🕕 Время: ${new Date().toLocaleString('ru-RU')}`);
  console.log(`📅 Дата: ${new Date().toISOString().split('T')[0]}`);
  console.log('================================================================\n');
  
  const cacheManager = new OddsCacheManager();
  
  console.log('🔍 Проверяю текущий кэш...');
  const statsBefore = cacheManager.getStats();
  const cacheAgeHours = parseFloat(statsBefore.cacheAgeHours) || 0;
  const requestsCount = statsBefore.requestsCount || 0;
  
  console.log(`📊 Текущий кэш: возраст ${cacheAgeHours.toFixed(1)} часов, запросов: ${requestsCount}`);
  
  // Проверяем возраст кэша
  if (cacheAgeHours < 4) {
    console.log(`✅ Кэш достаточно свежий (<4 часов). Пропускаю обновление.`);
    
    // Всё равно показываем статистику по покрытиям
    try {
      const currentEvents = await cacheManager.getTennisOdds(false); // Не форсируем обновление
      const stats = SurfaceDetector.getSurfaceStats(currentEvents);
      
      console.log('\n🎾 СТАТИСТИКА ПОКРЫТИЙ ИЗ КЭША:');
      console.log('─'.repeat(50));
      console.log(`Всего событий: ${stats.total}`);
      console.log(`Определено покрытий: ${stats.detectionRate}%`);
      
      for (const [surface, data] of Object.entries(stats.bySurface)) {
        if (data.count > 0) {
          console.log(`  ${surface}: ${data.count} (${data.percentage}%)`);
        }
      }
      
      // Показываем матчи на завтра
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const tomorrowEvents = currentEvents.filter(e => 
        e.commence_time && e.commence_time.startsWith(tomorrowStr)
      );
      
      if (tomorrowEvents.length > 0) {
        console.log(`\n📅 МАТЧИ НА ЗАВТРА (${tomorrowStr}): ${tomorrowEvents.length}`);
        console.log('─'.repeat(50));
        
        tomorrowEvents.slice(0, 5).forEach((event, index) => {
          const surface = SurfaceDetector.detectSurface(event);
          const time = event.commence_time ? 
            new Date(event.commence_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'Время не указано';
          
          console.log(`${index + 1}. ${event.home_team} vs ${event.away_team}`);
          console.log(`   Турнир: ${event.sport_title} | Покрытие: ${surface}`);
          console.log(`   Время: ${time}`);
          console.log('');
        });
        
        if (tomorrowEvents.length > 5) {
          console.log(`... и ещё ${tomorrowEvents.length - 5} матчей`);
        }
      } else {
        console.log(`\n📭 На завтра (${tomorrowStr}) матчей не найдено`);
      }
      
    } catch (err) {
      console.log(`⚠️  Не удалось проанализировать кэш: ${err.message}`);
    }
    
    return;
  }
  
  console.log(`🔄 Кэш устарел (>4 часов). Обновляю...`);
  
  try {
    // Удаляем старый кэш
    console.log('🗑️ Очищаю старый кэш...');
    const fs = require('fs');
    const path = require('path');
    const CACHE_FILE = path.join(__dirname, '../cache/odds-cache.json');
    
    if (fs.existsSync(CACHE_FILE)) {
      const backupFile = CACHE_FILE + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(CACHE_FILE, backupFile);
      console.log(`✅ Создан бэкап: ${path.basename(backupFile)}`);
      fs.unlinkSync(CACHE_FILE);
      console.log('🗑️ Файл кэша удалён');
    }
    
    // Запрашиваем свежие данные
    console.log('📡 Запрашиваю свежие данные через API...');
    const freshEvents = await cacheManager.refreshCache();
    
    const statsAfter = cacheManager.getStats();
    console.log(`✅ Новый кэш создан, запросов: ${statsAfter.requestsCount || 0}`);
    
    if (freshEvents && Array.isArray(freshEvents)) {
      console.log(`📈 Всего событий получено: ${freshEvents.length}`);
      
      // Статистика по покрытиям
      const surfaceStats = SurfaceDetector.getSurfaceStats(freshEvents);
      console.log('\n🎾 СТАТИСТИКА ПОКРЫТИЙ:');
      console.log('─'.repeat(50));
      console.log(`Определено покрытий: ${surfaceStats.detectionRate}%`);
      
      for (const [surface, data] of Object.entries(surfaceStats.bySurface)) {
        if (data.count > 0) {
          console.log(`  ${surface}: ${data.count} (${data.percentage}%)`);
        }
      }
      
      // Анализ по дням
      console.log('\n📅 РАСПРЕДЕЛЕНИЕ ПО ДНЯМ:');
      
      const eventsByDay = {};
      freshEvents.forEach(event => {
        if (event.commence_time) {
          const date = event.commence_time.split('T')[0];
          eventsByDay[date] = (eventsByDay[date] || 0) + 1;
        }
      });
      
      const sortedDays = Object.keys(eventsByDay).sort();
      sortedDays.forEach(date => {
        console.log(`  ${date}: ${eventsByDay[date]} матчей`);
      });
      
      // Матчи на завтра
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const tomorrowEvents = freshEvents.filter(e => 
        e.commence_time && e.commence_time.startsWith(tomorrowStr)
      );
      
      if (tomorrowEvents.length > 0) {
        console.log(`\n📅 МАТЧИ НА ЗАВТРА (${tomorrowStr}): ${tomorrowEvents.length}`);
        console.log('─'.repeat(50));
        
        // Группируем по турнирам
        const tournaments = {};
        tomorrowEvents.forEach(event => {
          const tournament = event.sport_title || 'Неизвестный турнир';
          tournaments[tournament] = (tournaments[tournament] || 0) + 1;
        });
        
        console.log('Турниры:');
        Object.entries(tournaments).forEach(([tournament, count], index) => {
          const surface = SurfaceDetector.detectSurface({ sport_title: tournament });
          console.log(`  ${index + 1}. ${tournament}: ${count} матчей (${surface})`);
        });
        
        // Примеры матчей
        console.log('\nПримеры матчей:');
        tomorrowEvents.slice(0, 3).forEach((event, index) => {
          const surface = SurfaceDetector.detectSurface(event);
          const time = event.commence_time ? 
            new Date(event.commence_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'Время не указано';
          
          console.log(`${index + 1}. ${event.home_team} vs ${event.away_team}`);
          console.log(`   Время: ${time} | Покрытие: ${surface}`);
          
          if (event.bookmakers && event.bookmakers.length > 0) {
            const bookmaker = event.bookmakers[0];
            const market = bookmaker.markets?.[0];
            if (market && market.outcomes && market.outcomes.length === 2) {
              const odds1 = market.outcomes[0].price;
              const odds2 = market.outcomes[1].price;
              console.log(`   Коэффициенты: ${odds1} - ${odds2}`);
            }
          }
          console.log('');
        });
      } else {
        console.log(`\n📭 На завтра (${tomorrowStr}) матчей не найдено`);
      }
      
      // Сохраняем отчёт
      const report = {
        updated_at: new Date().toISOString(),
        total_events: freshEvents.length,
        surface_stats: surfaceStats,
        events_by_day: eventsByDay,
        tomorrow_events: tomorrowEvents.length,
        cache_stats: statsAfter
      };
      
      const reportPath = path.join(__dirname, '../cache/evening-update-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`\n📄 Отчёт сохранён: ${path.basename(reportPath)}`);
      
    } else {
      console.log('⚠️  Получены пустые данные или не массив');
    }
    
    console.log('\n✅ Вечернее обновление кэша завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении кэша:', error.message);
    console.error(error.stack);
    
    // Пробуем fallback
    try {
      console.log('🔄 Пробую fallback - получить данные без кэша...');
      const fallbackEvents = await cacheManager.getTennisOdds(true); // force refresh
      console.log(`✅ Fallback успешен: получено ${fallbackEvents?.length || 0} событий`);
    } catch (fallbackError) {
      console.error('❌ Fallback тоже не сработал:', fallbackError.message);
    }
    
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  updateEveningCache().catch(err => {
    console.error('❌ Непредвиденная ошибка:', err.message);
    process.exit(1);
  });
}

module.exports = updateEveningCache;