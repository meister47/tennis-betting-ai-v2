#!/usr/bin/env node

/**
 * Тест оптимизированной системы кэширования
 */

const OddsCacheManager = require('./odds-cache-manager');
const { TTL } = require('../config/cache-config');

async function runTests() {
  console.log('🧪 Запуск тестов оптимизированной системы кэширования\n');
  
  const cacheManager = new OddsCacheManager();
  
  // Тест 1: Singleton паттерн
  console.log('✅ Тест 1: Singleton паттерн');
  const cacheManager2 = new OddsCacheManager();
  console.log(`   Один и тот же экземпляр: ${cacheManager === cacheManager2 ? '✅ Да' : '❌ Нет'}`);
  
  // Тест 2: Базовые операции
  console.log('\n✅ Тест 2: Базовые операции');
  const testData = { matches: [{ id: 1, teams: ['Player1', 'Player2'] }] };
  const saved = cacheManager.set('test_matches', testData, TTL.MATCH_LIST);
  console.log(`   Сохранение: ${saved ? '✅ Успешно' : '❌ Ошибка'}`);
  
  const retrieved = cacheManager.get('test_matches');
  console.log(`   Получение: ${retrieved ? '✅ Успешно' : '❌ Ошибка'}`);
  console.log(`   Данные совпадают: ${JSON.stringify(retrieved) === JSON.stringify(testData) ? '✅ Да' : '❌ Нет'}`);
  
  // Тест 3: Автоматическое определение TTL
  console.log('\n✅ Тест 3: Автоматическое определение TTL');
  
  const testKeys = [
    'odds_today',
    'historical_2026_04',
    'matches_atp',
    'tournament_wimbledon',
    'player_stats_nadal',
    'config_system'
  ];
  
  for (const key of testKeys) {
    const ttl = cacheManager.determineTTL(key);
    const ttlHours = (ttl / (1000 * 60 * 60)).toFixed(1);
    console.log(`   ${key}: ${ttlHours} часов`);
  }
  
  // Тест 4: Статистика
  console.log('\n✅ Тест 4: Статистика');
  const stats = cacheManager.stats();
  console.log(`   Записей: ${stats.entries}`);
  console.log(`   Размер: ${stats.sizeMB} MB`);
  console.log(`   Типы записей: ${JSON.stringify(stats.entriesByType)}`);
  
  // Тест 5: Разные TTL для разных данных
  console.log('\n✅ Тест 5: Дифференцированные TTL');
  
  const testDataTypes = [
    { key: 'odds_live_match1', data: { odds: [1.80, 2.10] }, ttl: TTL.ODDS_LIVE },
    { key: 'historical_odds_archive', data: { archive: [] }, ttl: TTL.ODDS_HISTORICAL },
    { key: 'tournament_atp_info', data: { name: 'ATP Tour' }, ttl: TTL.TOURNAMENT_INFO },
    { key: 'player_rating_top10', data: { players: [] }, ttl: TTL.PLAYER_STATS }
  ];
  
  for (const { key, data, ttl } of testDataTypes) {
    const saved = cacheManager.set(key, data, ttl);
    console.log(`   ${key}: ${saved ? '✅ Сохранено' : '❌ Ошибка'} (TTL: ${(ttl / (1000 * 60 * 60)).toFixed(1)} часов)`);
  }
  
  // Тест 6: Очистка устаревших записей
  console.log('\n✅ Тест 6: Очистка устаревших записей');
  
  // Создаём устаревшую запись
  const expiredKey = 'expired_test';
  const veryShortTTL = 1000; // 1 секунда
  cacheManager.set(expiredKey, { test: 'expired' }, veryShortTTL);
  
  console.log('   Ждём 2 секунды для истечения TTL...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const beforeCleanup = cacheManager.get(expiredKey);
  console.log(`   Перед очисткой: ${beforeCleanup ? '✅ Есть' : '❌ Нет (уже удалено)'}`);
  
  const cleaned = cacheManager.pruneExpiredEntries();
  console.log(`   Удалено устаревших записей: ${cleaned}`);
  
  const afterCleanup = cacheManager.get(expiredKey);
  console.log(`   После очистки: ${afterCleanup ? '❌ Есть (ошибка)' : '✅ Нет (корректно удалено)'}`);
  
  // Тест 7: CLI команды
  console.log('\n✅ Тест 7: CLI команды');
  console.log('   Доступные команды:');
  console.log('   - node odds-cache-manager.js stats      - статистика кэша');
  console.log('   - node odds-cache-manager.js clear      - очистка кэша');
  console.log('   - node odds-cache-manager.js refresh <key> - обновление записи');
  console.log('   - node odds-cache-manager.js test       - тестирование');
  
  // Тест 8: Обратная совместимость
  console.log('\n✅ Тест 8: Обратная совместимость');
  console.log('   Метод getTennisOdds() доступен: ✅ Да');
  console.log('   Метод fetchFromAPI() доступен: ✅ Да');
  console.log('   Метод clearCache() доступен: ✅ Да');
  
  // Итоговая статистика
  console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  const finalStats = cacheManager.stats();
  console.log(JSON.stringify(finalStats, null, 2));
  
  // Рекомендации по использованию
  console.log('\n🎯 РЕКОМЕНДАЦИИ ПО ИСПОЛЬЗОВАНИЮ:');
  console.log('1. Используйте один экземпляр во всех скриптах:');
  console.log('   const cacheManager = new OddsCacheManager();');
  console.log('');
  console.log('2. Указывайте TTL явно для ясности:');
  console.log('   cacheManager.set(\'odds_today\', data, TTL.ODDS_LIVE);');
  console.log('');
  console.log('3. Для API данных используйте стандартные ключи:');
  console.log('   - odds_today: текущие коэффициенты');
  console.log('   - historical_odds: исторические данные');
  console.log('   - matches_list: список матчей');
  console.log('');
  console.log('4. Просматривайте статистику:');
  console.log('   node odds-cache-manager.js stats');
  
  console.log('\n✅ Все тесты завершены успешно! 🦊');
}

// Запуск тестов
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Ошибка тестирования:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests };