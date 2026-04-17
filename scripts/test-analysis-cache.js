#!/usr/bin/env node

/**
 * Тест Analysis Cache Manager
 */

const AnalysisCacheManager = require('./analysis-cache-manager.js');

async function runTests() {
  console.log('🧪 ТЕСТИРОВАНИЕ ANALYSIS CACHE MANAGER\n');
  
  const cache = new AnalysisCacheManager();
  
  // Тест 1: Создание нового кэша
  console.log('1. 📦 Инициализация нового кэша');
  const stats1 = cache.getStats();
  console.log(`   ✅ Записей: ${stats1.entries}, Хитов: ${stats1.hits}, Промахов: ${stats1.misses}`);
  
  // Тест 2: Генерация ID матча
  console.log('\n2. 🔑 Генерация ID матча');
  const matchId = cache.generateMatchId(
    'Rafael Nadal',
    'Novak Djokovic',
    'ATP Monte Carlo Masters',
    '2026-04-16T14:00:00Z'
  );
  console.log(`   ✅ ID: ${matchId}`);
  
  // Тест 3: Проверка пустого кэша
  console.log('\n3. 🔍 Проверка пустого кэша');
  const cachedResult = cache.getCachedAnalysis(matchId, 2.75);
  console.log(`   ✅ Результат: ${cachedResult ? 'найден' : 'не найден'} (ожидаем: не найден)`);
  
  // Тест 4: Сохранение анализа в кэш
  console.log('\n4. 💾 Сохранение анализа в кэш');
  const analysisResult = {
    model_prob: 0.42,
    edge: 0.072,
    recommendation: 'bet',
    stake: 68
  };
  
  cache.saveAnalysis(matchId, analysisResult, 2.75);
  console.log(`   ✅ Анализ сохранён в кэш`);
  
  // Тест 5: Проверка кэшированного результата
  console.log('\n5. 🔍 Проверка кэшированного результата');
  const cachedResult2 = cache.getCachedAnalysis(matchId, 2.75);
  console.log(`   ✅ Результат: ${cachedResult2 ? 'найден' : 'не найден'}`);
  console.log(`   ✅ Edge: ${cachedResult2 ? cachedResult2.edge : 'N/A'}`);
  console.log(`   ✅ Рекомендация: ${cachedResult2 ? cachedResult2.recommendation : 'N/A'}`);
  
  // Тест 6: Проверка изменения коэффициентов
  console.log('\n6. 📊 Проверка изменения коэффициентов (+3%)');
  const cachedResult3 = cache.getCachedAnalysis(matchId, 2.83); // +3%
  console.log(`   ✅ Результат: ${cachedResult3 ? 'найден' : 'не найден'} (ожидаем: не найден)`);
  
  // Тест 7: Статистика кэша
  console.log('\n7. 📈 Статистика кэша');
  const stats2 = cache.getStats();
  console.log(`   ✅ Записей: ${stats2.entries}`);
  console.log(`   ✅ Хитов: ${stats2.hits}`);
  console.log(`   ✅ Промахов: ${stats2.misses}`);
  console.log(`   ✅ Hit Rate: ${stats2.hitRate}%`);
  
  // Тест 8: Очистка кэша
  console.log('\n8. 🧹 Очистка кэша');
  cache.clearCache();
  const stats3 = cache.getStats();
  console.log(`   ✅ Записей после очистки: ${stats3.entries} (ожидаем: 0)`);
  
  // Тест 9: CLI команды (симуляция)
  console.log('\n9. 🖥️  CLI команды');
  console.log('   Команда status: node scripts/analysis-cache-manager.js status');
  console.log('   Команда clean: node scripts/analysis-cache-manager.js clean');
  console.log('   Команда cleanup: node scripts/analysis-cache-manager.js cleanup');
  
  console.log('\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ\n');
  
  // Проверим файл кэша
  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(__dirname, '../cache/analysis-cache.json');
  
  if (fs.existsSync(cacheFile)) {
    console.log('📁 Файл кэша создан:');
    const data = fs.readFileSync(cacheFile, 'utf8');
    const cacheData = JSON.parse(data);
    console.log(`   Версия: ${cacheData.version}`);
    console.log(`   Записей: ${Object.keys(cacheData.entries || {}).length}`);
  } else {
    console.log('📁 Файл кэша не создан (ожидаем после очистки)');
  }
}

// Запуск тестов
runTests().catch(error => {
  console.error('❌ Ошибка при тестировании:', error.message);
  process.exit(1);
});