# Настройка Cron для системы CLV (Closing Line Value)

## 📋 ОБЩАЯ СТРУКТУРА

Система CLV состоит из 3 основных скриптов:

1. **`create-bets-from-analysis.js`** - Создает ставки на основе анализа
2. **`capture-closing-odds.js`** - Собирает closing коэффициенты (запускается по cron)
3. **`analyze-closing-line-value.js`** - Анализирует эффективность CLV (ручной запуск)

## ⚙️ НАСТРОЙКА CRON

### 1. Редактирование crontab
```bash
crontab -e
```

### 2. Добавление задач

#### Основной анализ (каждое утро в 08:00 МСК)
```bash
# Анализ матчей и создание ставок
0 5 * * * cd /root/.openclaw/workspace/skills/tennis-betting-ai && /usr/bin/node scripts/create-bets-from-analysis.js >> /tmp/tennis-betting-create.log 2>&1
```

#### Сбор closing коэффициентов (каждые 10 минут)
```bash
# Сбор closing коэффициентов для ставок в режиме ожидания
*/10 * * * * cd /root/.openclaw/workspace/skills/tennis-betting-ai && /usr/bin/node scripts/capture-closing-odds.js >> /tmp/tennis-betting-capture.log 2>&1
```

#### Проверка статуса (раз в день)
```bash
# Проверка статуса ставок и CLV
0 20 * * * cd /root/.openclaw/workspace/skills/tennis-betting-ai && /usr/bin/node scripts/bets-manager.js >> /tmp/tennis-betting-status.log 2>&1
```

## 🕐 РАСПИСАНИЕ РАБОТЫ

```
08:00 МСК - Основной анализ матчей
          ↓
08:10 МСК - Первый сбор closing коэффициентов
          ↓
Каждые 10 минут - Повторный сбор коэффициентов
          ↓
20:00 МСК - Статистика за день
```

## 🔧 НАСТРОЙКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ

Файл `.env.local` должен содержать:

```bash
# The Odds API ключ
THE_ODDS_API_KEY=ваш_ключ_здесь

# CLV (Closing Line Value) система
CLV_MODE_ENABLED=true           # true - использовать CLV, false - обычный режим
CLV_DRY_RUN=false               # true - только логирование, false - реальные обновления
CLV_TIME_WINDOW_MINUTES=20      # За сколько минут до матча собирать closing line
CLV_CHECK_INTERVAL_MINUTES=10   # Как часто проверять ставки для CLV
```

## 📊 МОНИТОРИНГ

### Просмотр логов
```bash
# Логи создания ставок
tail -f /tmp/tennis-betting-create.log

# Логи сбора коэффициентов
tail -f /tmp/tennis-betting-capture.log

# Логи статуса
tail -f /tmp/tennis-betting-status.log
```

### Проверка статуса вручную
```bash
cd /root/.openclaw/workspace/skills/tennis-betting-ai

# Проверить статус системы
node scripts/bets-manager.js

# Проанализировать эффективность CLV
node scripts/analyze-closing-line-value.js
```

## 🚨 УСТРАНЕНИЕ НЕИСПРАВНОСТЕЙ

### Проблема: Cron не запускается
```bash
# Проверить наличие node в PATH
which node

# Проверить права на файлы
chmod +x scripts/*.js

# Проверить синтаксис cron
crontab -l
```

### Проблема: Ошибки Odds-API
```bash
# Проверить ключ API
echo $THE_ODDS_API_KEY

# Проверить лимиты запросов
# Odds-API: 5000 запросов/месяц (бесплатно)
```

### Проблема: Ошибки записи в файлы
```bash
# Проверить права на директорию data
ls -la data/

# Создать директорию если нет
mkdir -p data/
```

## 📈 ОПТИМИЗАЦИЯ

### Уменьшение частоты запросов
Если лимиты Odds-API исчерпаны:
```bash
# Изменить в .env.local
CLV_CHECK_INTERVAL_MINUTES=30  # Вместо 10
```

### Безопасный режим для тестирования
```bash
# В .env.local
CLV_DRY_RUN=true  # Только логи, без реальных обновлений
```

## 🎯 КОМАНДЫ ДЛЯ БЫСТРОГО ТЕСТИРОВАНИЯ

```bash
# Тестирование создания ставок
cd /root/.openclaw/workspace/skills/tennis-betting-ai
node scripts/create-bets-from-analysis.js

# Тестирование сбора коэффициентов
node scripts/capture-closing-odds.js

# Тестирование анализа CLV
node scripts/analyze-closing-line-value.js

# Проверка всей системы
node scripts/bets-manager.js
```

## 🔄 ОБНОВЛЕНИЕ СИСТЕМЫ

При обновлении кода:
```bash
# Остановить cron
crontab -e  # Закомментировать задачи

# Обновить код
git pull  # или скопировать новые файлы

# Запустить тестирование
node scripts/create-bets-from-analysis.js --test

# Включить cron обратно
crontab -e  # Раскомментировать задачи
```

## 📞 ПОДДЕРЖКА

При проблемах:
1. Проверить логи: `/tmp/tennis-betting-*.log`
2. Проверить конфигурацию: `.env.local`
3. Проверить ключ Odds-API: https://the-odds-api.com/
4. Проверить cron: `crontab -l`

Система автоматически создает файл `data/bets-db.json` при первом запуске.