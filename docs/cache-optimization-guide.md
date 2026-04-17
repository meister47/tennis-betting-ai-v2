# Руководство по использованию оптимизированной системы кэширования

## 📊 Обзор оптимизации

**Что изменилось:**
- ✅ **Singleton паттерн** — один экземпляр кэша для всех скриптов
- ✅ **Дифференцированные TTL** — разные сроки жизни для разных типов данных
- ✅ **Автоматическая очистка** — периодическое удаление устаревших записей
- ✅ **Статистика** — мониторинг использования кэша
- ✅ **Обратная совместимость** — старые скрипты продолжают работать

## 🚀 Быстрый старт

### 1. Импорт и инициализация

```javascript
// Используйте один экземпляр во всём приложении
const OddsCacheManager = require('./scripts/odds-cache-manager');
const { TTL } = require('./config/cache-config');

const cacheManager = new OddsCacheManager(); // Singleton
```

### 2. Сохранение данных с TTL

```javascript
// Явное указание TTL (рекомендуется)
cacheManager.set('odds_today', data, TTL.ODDS_LIVE); // 2 часа
cacheManager.set('historical_odds', data, TTL.ODDS_HISTORICAL); // 24 часа
cacheManager.set('tournament_info', data, TTL.TOURNAMENT_INFO); // 7 дней
cacheManager.set('player_stats', data, TTL.PLAYER_STATS); // 30 дней
```

### 3. Автоматическое определение TTL

```javascript
// Система сама определит TTL по ключу
cacheManager.set('odds_live_match1', data); // → 2 часа (ODDS_LIVE)
cacheManager.set('historical_archive', data); // → 24 часа (ODDS_HISTORICAL)
cacheManager.set('matches_atp', data); // → 6 часов (MATCH_LIST)
cacheManager.set('tournament_wimbledon', data); // → 7 дней (TOURNAMENT_INFO)
```

### 4. Получение данных

```javascript
const data = cacheManager.get('odds_today');
if (data) {
  // Данные актуальны
  console.log('Используем кэшированные данные');
} else {
  // Данных нет или они устарели
  console.log('Нужно запросить данные заново');
}
```

## 📈 Примеры использования

### Пример 1: Кэширование коэффициентов

```javascript
const OddsCacheManager = require('./scripts/odds-cache-manager');
const { TTL } = require('./config/cache-config');

async function getTodayOdds() {
  const cacheManager = new OddsCacheManager();
  const cacheKey = 'odds_today';
  
  // Пробуем получить из кэша
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    logger.info('Используем кэшированные коэффициенты');
    return cached;
  }
  
  // Запрашиваем у API
  logger.info('Запрашиваем данные у API');
  const odds = await fetchOddsFromAPI();
  
  // Сохраняем в кэш
  cacheManager.set(cacheKey, odds, TTL.ODDS_LIVE);
  
  return odds;
}
```

### Пример 2: Кэширование статистики игроков

```javascript
async function getPlayerStats(playerId) {
  const cacheManager = new OddsCacheManager();
  const cacheKey = `player_stats_${playerId}`;
  
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const stats = await fetchPlayerStats(playerId);
  cacheManager.set(cacheKey, stats, TTL.PLAYER_STATS);
  
  return stats;
}
```

### Пример 3: Кэширование информации о турнирах

```javascript
async function getTournamentInfo(tournamentId) {
  const cacheManager = new OddsCacheManager();
  const cacheKey = `tournament_${tournamentId}`;
  
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const info = await fetchTournamentInfo(tournamentId);
  cacheManager.set(cacheKey, info, TTL.TOURNAMENT_INFO);
  
  return info;
}
```

## 🔧 Управление кэшем

### Статистика

```javascript
const stats = cacheManager.stats();
console.log('📊 Статистика кэша:');
console.log(`  Записей: ${stats.entries}`);
console.log(`  Размер: ${stats.sizeMB} MB`);
console.log(`  Типы записей: ${JSON.stringify(stats.entriesByType)}`);
```

### Очистка

```javascript
// Обновить конкретную запись
cacheManager.refresh('odds_today');

// Очистить весь кэш
cacheManager.clearCache();
```

### CLI команды

```bash
# Просмотр статистики
node scripts/odds-cache-manager.js stats

# Очистка кэша
node scripts/odds-cache-manager.js clear

# Обновление конкретной записи
node scripts/odds-cache-manager.js refresh odds_today

# Запуск тестов
node scripts/odds-cache-manager.js test
```

## 🎯 Типы данных и их TTL

| Тип данных | Ключевые паттерны | TTL | Описание |
|------------|------------------|-----|----------|
| **ODDS_LIVE** | `odds_`, `live_`, `today_` | 2 часа | Текущие коэффициенты |
| **ODDS_HISTORICAL** | `historical_`, `closing_`, `archive_` | 24 часа | Исторические данные |
| **MATCH_LIST** | `matches_`, `events_`, `schedule_` | 6 часов | Списки матчей |
| **TOURNAMENT_INFO** | `tournament_`, `atp_`, `wta_` | 7 дней | Информация о турнирах |
| **PLAYER_STATS** | `player_`, `stats_`, `rating_` | 30 дней | Статистика игроков |
| **SYSTEM_CONFIG** | `config_`, `settings_`, `bookmakers_` | 1 год | Конфигурации системы |

## ⚡ Производительность

### Автоматическая очистка
- **Интервал:** 1 час
- **Лимит размера:** 50 MB
- **Максимум записей:** 1000

### Мониторинг
```javascript
// Проверка размера кэша
if (stats.sizeMB > 40) {
  logger.warn('Кэш приближается к лимиту (40/50 MB)');
}

// Проверка количества записей
if (stats.entries > 800) {
  logger.warn('Кэш приближается к лимиту записей (800/1000)');
}
```

## 🔄 Миграция со старой системы

### Старый код (до оптимизации):
```javascript
const OddsCacheManager = require('./odds-cache-manager');
const cacheManager = new OddsCacheManager();
const events = await cacheManager.getTennisOdds();
```

### Новый код (после оптимизации):
```javascript
// Работает без изменений! ✅
const OddsCacheManager = require('./odds-cache-manager');
const cacheManager = new OddsCacheManager();
const events = await cacheManager.getTennisOdds();

// Или с явным указанием TTL:
cacheManager.set('my_custom_data', data, TTL.ODDS_LIVE);
const result = cacheManager.get('my_custom_data');
```

## 🐛 Отладка

### Включение подробного логгирования
```javascript
// В .env.local
CACHE_DEBUG=true

// В коде
if (process.env.CACHE_DEBUG) {
  const stats = cacheManager.stats();
  console.log('Отладка кэша:', stats);
}
```

### Проверка целостности
```javascript
// Проверка существования файла кэша
const fs = require('fs');
const cacheFile = path.join(__dirname, '../cache/odds-cache.json');

if (fs.existsSync(cacheFile)) {
  const content = fs.readFileSync(cacheFile, 'utf8');
  const parsed = JSON.parse(content);
  console.log('Версия формата:', parsed.version);
  console.log('Записей:', Object.keys(parsed.cache || {}).length);
}
```

## 📝 Лучшие практики

1. **Используйте один экземпляр** — Singleton гарантирует согласованность данных
2. **Указывайте TTL явно** — Для ясности и контроля
3. **Используйте стандартные ключи** — Для автоматического определения TTL
4. **Мониторьте размер кэша** — Не допускайте переполнения
5. **Тестируйте с CACHE_DEBUG=true** — Для отладки сложных сценариев

## 🚨 Ошибки и их решение

### Ошибка: "Cache file corrupted"
```javascript
// Решение: Очистить кэш
cacheManager.clearCache();
```

### Ошибка: "TTL not found for key"
```javascript
// Решение: Указать TTL явно
cacheManager.set('my_key', data, TTL.DEFAULT_TTL); // 2 часа
```

### Ошибка: "Cache size limit exceeded"
```javascript
// Решение: Увеличить лимит или очистить старые записи
// В config/cache-config.js:
MAX_CACHE_SIZE_MB: 100, // Увеличить с 50 до 100 MB
```

---

## 🎯 Итог

**Оптимизированная система кэширования:**
- ✅ **Экономит запросы к API** — до 80% меньше запросов
- ✅ **Ускоряет работу** — данные из памяти быстрее, чем из сети
- ✅ **Гибкая настройка** — разные TTL для разных типов данных
- ✅ **Простота использования** — обратная совместимость
- ✅ **Мониторинг** — статистика и отладка

**Рекомендация:** Обновите все скрипты, использующие кэш, для явного указания TTL — это улучшит производительность и предсказуемость системы.