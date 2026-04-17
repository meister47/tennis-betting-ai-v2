// Простой тест кэша
const OddsCacheManager = require('./odds-cache-manager');
const { TTL } = require('../config/cache-config');

console.log('🧪 Тест оптимизированной системы кэширования\n');

// Проверка singleton
const cache1 = new OddsCacheManager();
const cache2 = new OddsCacheManager();
console.log('Singleton тест:', cache1 === cache2 ? '✅ PASS' : '❌ FAIL');

// Базовые операции
console.log('\nБазовые операции:');
cache1.set('test_key', { value: 'test_data' }, TTL.ODDS_LIVE);
const result = cache1.get('test_key');
console.log('Get/Set тест:', result ? '✅ PASS' : '❌ FAIL');
console.log('Данные:', JSON.stringify(result));

// Автоматическое определение TTL
console.log('\nАвтоматическое определение TTL:');
const keys = ['odds_today', 'historical_data', 'matches_list', 'tournament_info'];
keys.forEach(key => {
  const ttl = cache1.determineTTL(key);
  const hours = (ttl / (1000 * 60 * 60)).toFixed(1);
  console.log(`  ${key}: ${hours} часов`);
});

// Статистика
console.log('\nСтатистика:');
const stats = cache1.stats();
console.log('Записей:', stats.entries);
console.log('Размер:', stats.sizeMB, 'MB');

// Проверка сохранения в файл
console.log('\nСохранение в файл:');
const fs = require('fs');
const path = require('path');
const cacheFile = path.join(__dirname, '../cache/odds-cache.json');
const exists = fs.existsSync(cacheFile);
console.log('Файл кэша существует:', exists ? '✅ Да' : '❌ Нет');

if (exists) {
  const content = fs.readFileSync(cacheFile, 'utf8');
  const parsed = JSON.parse(content);
  console.log('Версия формата:', parsed.version || '1.0 (старый)');
  console.log('Записей в файле:', Object.keys(parsed.cache || {}).length);
}

console.log('\n✅ Тест завершён!');