# 📊 Структурированное логирование в JSON-формате

## 📁 Структура файлов

### 1. Модуль логирования
```
src/logger.js
```

### 2. Модифицированные скрипты с JSON-логированием
```
scripts/real-today-analysis-min-odds.js      → компонент 'analyzer'
scripts/capture-closing-odds.js              → компонент 'clv-tracker'
scripts/odds-cache-manager.js                → компонент 'cache'
scripts/odds-update-scheduler.js             → компонент 'scheduler'
```

### 3. Файлы логов
```
logs/
├── 2026-04-17.jsonl    ← JSON Lines формат (один файл на день)
├── 2026-04-18.jsonl
└── ...
```

## 🛠️ Как использовать логирование

### Уровни логирования
```javascript
logger.info(msg, data)     // ℹ️  Информация
logger.ok(msg, data)       // ✅ Успех
logger.warn(msg, data)     // ⚠️  Предупреждение  
logger.error(msg, data)    // ❌ Ошибка
logger.skip(msg, data)     // ⏭️  Пропуск
logger.debug(msg, data)    // 🔍 Отладка
```

### Пример использования
```javascript
// Было:
console.log(`[INFO] Fetching odds for ${matches.length} matches`);

// Стало:
logger.info('Fetching odds', { matchCount: matches.length });
```

### Консольный вывод
```
ℹ️ [analyzer] Fetching odds | {"matchCount": 42}
✅ [analyzer] Recommendation created | {"player":"Djokovic","odds":2.5,"edge":0.15}
⚠️ [clv-tracker] No data in API response | {"matchId":"abc123"}
```

## 📈 Чтение логов

### 1. Просмотр логов за сегодня
```bash
# Все логи за сегодня
cat logs/$(date +%Y-%m-%d).jsonl

# С форматированием через jq
cat logs/$(date +%Y-%m-%d).jsonl | jq '.'

# Фильтр по компоненту
cat logs/2026-04-17.jsonl | jq 'select(.component == "analyzer")'

# Фильтр по уровню
cat logs/2026-04-17.jsonl | jq 'select(.level == "ERROR")'

# Фильтр по времени
cat logs/2026-04-17.jsonl | jq 'select(.timestamp > "2026-04-17T10:00:00")'
```

### 2. Полезные команды анализа

```bash
# Статистика по уровням логирования
cat logs/2026-04-17.jsonl | jq -r '.level' | sort | uniq -c | sort -rn

# Топ-5 ошибок
cat logs/2026-04-17.jsonl | jq 'select(.level == "ERROR")' | jq -r '.message' | sort | uniq -c | sort -rn | head -5

# Анализ по компонентам
cat logs/2026-04-17.jsonl | jq -r '.component' | sort | uniq -c

# Поиск конкретного события
cat logs/2026-04-17.jsonl | jq 'select(.message | contains("bet created"))'

# Конвертация в CSV для анализа
cat logs/2026-04-17.jsonl | jq -r '[.timestamp, .component, .level, .message] | @csv' > logs_analysis.csv
```

### 3. Мониторинг в реальном времени
```bash
# Хвост логов
tail -f logs/$(date +%Y-%m-%d).jsonl

# Хвост с форматированием
tail -f logs/$(date +%Y-%m-%d).jsonl | jq --unbuffered '.'

# Хвост только ошибок
tail -f logs/$(date +%Y-%m-%d).jsonl | jq --unbuffered 'select(.level == "ERROR")'

# Создание дашборда с помощью jq
watch -n 5 "cat logs/\$(date +%Y-%m-%d).jsonl | jq -r '[.timestamp, .component, .level, .message] | @tsv' | tail -20"
```

## 📊 Пример структуры JSON-лога

```json
{
  "timestamp": "2026-04-17T11:45:23.456Z",
  "component": "analyzer",
  "level": "OK",
  "message": "Bet created",
  "betId": "bet_12345",
  "pick": "Djokovic",
  "odds": 2.5,
  "edge": 0.15,
  "stake": 45,
  "status": "active",
  "clvMode": false
}
```

## 🔧 Расширенные возможности

### 1. Поиск аномалий
```bash
# Ставки с edge > 0.2
cat logs/*.jsonl | jq 'select(.edge > 0.2)'

# Ошибки с определенным паттерном
cat logs/*.jsonl | jq 'select(.message | contains("timeout"))'

# Анализ производительности
cat logs/*.jsonl | jq 'select(.component == "cache")' | jq 'select(.cacheAgeHours)'
```

### 2. Агрегация статистики
```bash
# Количество ставок по дням
for file in logs/*.jsonl; do 
  echo "$(basename $file): $(cat $file | jq 'select(.message | contains("Bet created"))' | wc -l)"; 
done

# Средний edge по ставкам
cat logs/*.jsonl | jq 'select(.edge)' | jq -s 'map(.edge) | add / length'

# Распределение коэффициентов
cat logs/*.jsonl | jq 'select(.odds)' | jq -r '.odds' | awk '{ 
  if ($1 < 2.0) a++; 
  else if ($1 < 3.0) b++; 
  else c++; 
} END { print "2.0-: " a, "2.0-3.0: " b, "3.0+: " c }'
```

### 3. Визуализация логов
```bash
# Установите jq и terminal-plot для графиков
# Пример: распределение edge по времени
cat logs/*.jsonl | jq 'select(.edge)' | jq -r '[.timestamp, .edge] | @tsv' | terminal-plot
```

## ⚙️ Настройки логирования

### Флаги управления
```javascript
// В каждом скрипте
const USE_JSON_LOGGER = true; // false для отключения JSON записи
```

### Директория логов
```javascript
// Настройка в logger.js
this.logDir = path.join(__dirname, '../logs');
```

### Ротация логов
Логи автоматически ротируются по дням:
- `2026-04-17.jsonl`
- `2026-04-18.jsonl`
- `2026-04-19.jsonl`

### Очистка старых логов
```bash
# Удалить логи старше 30 дней
find logs/ -name "*.jsonl" -mtime +30 -delete
```

## 🔒 Безопасность

### Резервные копии
Каждый скрипт имеет backup:
```
scripts/real-today-analysis-min-odds.js.backup-before-logging
scripts/capture-closing-odds.js.backup-before-logging
scripts/odds-cache-manager.js.backup-before-logging
scripts/odds-update-scheduler.js.backup-before-logging
```

### Обработка ошибок записи
При ошибке записи в файл:
1. Выводится сообщение в консоль
2. Работа продолжается
3. JSON логирование отключается для этого сеанса

## 📋 Проверка работоспособности

```bash
# 1. Проверка структуры
cd /root/.openclaw/workspace/skills/tennis-betting-ai
ls -la src/logger.js
ls -la logs/

# 2. Запуск тестового анализа
node scripts/real-today-analysis-min-odds.js

# 3. Проверка логов
cat logs/$(date +%Y-%m-%d).jsonl | head -5

# 4. Верификация формата
cat logs/$(date +%Y-%m-%d).jsonl | jq -e '.' > /dev/null && echo "✅ JSON валидный" || echo "❌ JSON повреждён"
```

## 🚀 Преимущества JSON-логирования

1. **Структурированные данные** — легкий парсинг и анализ
2. **Автоматическая агрегация** — jq, grep, awk для анализа
3. **Интеграция с мониторингом** — ELK Stack, Grafana, Splunk
4. **Отладка** — полный контекст каждого события
5. **Аудит** — трассировка всех действий системы
6. **Производительность** — append-only файлы, быстрая запись

## 🔄 Откат изменений

```bash
# Восстановить оригинальные файлы
cd /root/.openclaw/workspace/skills/tennis-betting-ai/scripts
cp real-today-analysis-min-odds.js.backup-before-logging real-today-analysis-min-odds.js
cp capture-closing-odds.js.backup-before-logging capture-closing-odds.js
cp odds-cache-manager.js.backup-before-logging odds-cache-manager.js
cp odds-update-scheduler.js.backup-before-logging odds-update-scheduler.js
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте наличие jq: `which jq`
2. Проверьте права на запись: `ls -la logs/`
3. Проверьте JSON валидность: `jq . logs/*.jsonl`

Структурированное логирование готово к использованию! 🎉