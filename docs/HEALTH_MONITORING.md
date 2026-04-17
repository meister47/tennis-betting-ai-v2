# 🏥 Система мониторинга здоровья Tennis Betting AI

## 📋 Оглавление
1. [Обзор системы](#1-обзор-системы)
2. [Архитектура](#2-архитектура)
3. [Компоненты мониторинга](#3-компоненты-мониторинга)
4. [Правила алертов](#4-правила-алертов)
5. [Интеграция в скрипты](#5-интеграция-в-скрипты)
6. [Настройка cron](#6-настройка-cron)
7. [Тестирование](#7-тестирование)
8. [Безопасность](#8-безопасность)
9. [Устранение неполадок](#9-устранение-неполадок)

---

## 1. Обзор системы

Система мониторинга здоровья предназначена для непрерывного наблюдения за состоянием компонентов Tennis Betting AI и отправки алертов в Telegram при обнаружении проблем.

### 🎯 Основные цели:
- **Проактивное обнаружение** проблем до их эскалации
- **Автоматические алерты** в Telegram при изменении статуса компонентов
- **Централизованное логирование** состояния системы
- **Статистика и аналитика** uptime компонентов
- **Безопасность** через защиту токенов и конфиденциальных данных

### 🚀 Ключевые особенности:
- ✅ Мониторинг 5 ключевых компонентов системы
- ✅ Умные алерты (отправка только при изменении статуса)
- ✅ Rate limiting для предотвращения спама
- ✅ DRY_RUN режим для безопасного тестирования
- ✅ Полная история алертов и статистика
- ✅ Graceful degradation (работает без Telegram)

---

## 2. Архитектура

### Структура файлов:
```
scripts/
├── telegram-alert.js              # Модуль Telegram алертов (6 уровней)
├── health-check.js                # Основной скрипт проверки здоровья
├── health-integration.js          # Утилиты для интеграции в скрипты
├── update-scripts-with-health.js  # Автоматическое обновление скриптов
├── test-health-system.js          # Комплексный тест системы
└── quick-health-check.sh          # Быстрая проверка (bash)

data/
├── health-state.json              # База данных состояния здоровья
├── alert-history.json             # История алертов
└── health-results.json            # Результаты проверок

docs/
├── TELEGRAM_SETUP.md              # Инструкция по настройке Telegram
└── HEALTH_MONITORING.md           # Эта документация

.env.example                       # Шаблон конфигурации
```

### Поток данных:
1. **Cron запускает** `health-check.js` каждый час
2. **Скрипт проверяет** состояние всех компонентов
3. **Сравнивает** с предыдущим состоянием
4. **При изменении статуса** отправляет алерт в Telegram
5. **Сохраняет** состояние в `health-state.json`
6. **Логирует** результаты в `health-results.json`

---

## 3. Компоненты мониторинга

### 📊 Отслеживаемые компоненты:

| Компонент | Описание | Критичность |
|-----------|----------|-------------|
| **analyzer** | Основной анализатор теннисных матчей | Высокая |
| **clv-tracker** | Трекер Customer Lifetime Value | Средняя |
| **odds-cache** | Кэш коэффициентов | Средняя |
| **odds-fetcher** | Получение коэффициентов с API | Высокая |
| **stats-adapter** | Адаптер статистики игроков | Низкая |
| **health-monitor** | Сама система мониторинга | Критическая |

### 🔍 Что проверяется:
- **Время последнего запуска** (сколько часов назад)
- **Статус выполнения** (OK, WARN, ERROR)
- **Uptime компонента** (процент успешных запусков)
- **Размер кэша** (для odds-cache)
- **Активность в рабочее время** (для clv-tracker)

---

## 4. Правила алертов

### ⏰ Пороговые значения (часы):

| Компонент | WARN | ERROR | Особые условия |
|-----------|------|-------|----------------|
| **analyzer** | 3 | 6 | Всегда |
| **clv-tracker** | 2 | 4 | Только 08:00-22:00 МСК |
| **odds-cache** | 12 | 24 | Размер файла > 1KB |
| **odds-fetcher** | 6 | 12 | Всегда |
| **stats-adapter** | 8 | 16 | Всегда |
| **health-monitor** | 1 | 3 | Критический компонент |

### 📨 Типы алертов:

#### 1. **Компонентные алерты**
Отправляются при изменении статуса компонента:
- `OK → WARN` - Предупреждение
- `OK/WARN → ERROR` - Ошибка
- `ERROR/WARN → OK` - Восстановление

**Формат:**
```
⚠️ *Tennis Betting AI - WARN*

Component: analyzer
Status: WARN (не запускался 4 часа)
Last run: 2026-04-17T10:30:00Z
Active: 2 дня 3 часа
```

#### 2. **Сводки здоровья**
Отправляются:
- При наличии проблем (WARN/ERROR)
- Раз в 6 часов при стабильной работе
- В 12:00 по UTC каждый день

**Формат:**
```
📊 *Сводка здоровья Tennis Betting AI*

Time: 17.04.2026, 15:30 (MSK)
Overall status: WARN
Message: 1 компонент требует внимания

📊 Statistics:
✅ OK: 4
⚠️ WARN: 1
❌ ERROR: 0
📦 Total: 5

🔍 Component details:
✅ Анализатор теннисных матчей: OK
✅ CLV-трекер ставок: OK
✅ Кэш коэффициентов: OK
⚠️ Получение коэффициентов: WARN • 5.2h • Не обновлялся
✅ Адаптер статистики: OK
```

#### 3. **Критические алерты**
Отправляются при:
- Падении системы мониторинга
- Проблемах с доступом к Telegram API
- Ошибках выполнения скрипта проверки

### 🚫 Rate limiting:
- **Компонентные алерты**: 1 раз в час для одного компонента
- **Сводки здоровья**: 1 раз в 6 часов
- **Тестовые сообщения**: без ограничений (только в DRY_RUN)

---

## 5. Интеграция в скрипты

### Автоматическая интеграция:
```bash
# Обновить все скрипты системы с мониторингом
node scripts/update-scripts-with-health.js
```

### Ручная интеграция:

#### Вариант 1: Использование декоратора
```javascript
const { withHealthMonitoring } = require('./health-integration');

async function mainFunction() {
  // Ваш основной код
}

// Обернуть функцию мониторингом
module.exports = withHealthMonitoring(mainFunction, 'analyzer');
```

#### Вариант 2: Явное обновление состояния
```javascript
const { updateHealth } = require('./health-integration');

async function runAnalysis() {
  try {
    // Обновляем статус перед запуском
    updateHealth('analyzer', 'running');
    
    // Ваш код анализа
    
    // Обновляем статус после успешного выполнения
    updateHealth('analyzer', 'ok', { matchesAnalyzed: 10 });
    
  } catch (error) {
    // Обновляем статус при ошибке
    updateHealth('analyzer', 'error', { error: error.message });
    throw error;
  }
}
```

#### Вариант 3: Graceful shutdown handlers
```javascript
const { createGracefulShutdownHandlers } = require('./health-integration');

// Создать обработчики graceful shutdown
const cleanup = createGracefulShutdownHandlers('analyzer');

// Использовать в основном скрипте
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

---

## 6. Настройка cron

### Рекомендуемая конфигурация:

```bash
# Открыть crontab
crontab -e
```

### Добавить строки:
```bash
# Проверка здоровья каждый час
0 * * * * cd /path/to/tennis-betting-ai && node scripts/health-check.js >> logs/health-cron.log 2>&1

# Быстрая проверка каждые 15 минут (опционально)
*/15 * * * * cd /path/to/tennis-betting-ai && ./scripts/quick-health-check.sh >> logs/quick-check.log 2>&1

# Ежедневная сводка в 12:00 МСК
0 9 * * * cd /path/to/tennis-betting-ai && node scripts/health-check.js --summary-only >> logs/daily-summary.log 2>&1
```

### Проверка cron:
```bash
# Просмотр настроенных задач
crontab -l

# Проверка логов cron
grep CRON /var/log/syslog | tail -20

# Ручной запуск проверки
node scripts/health-check.js
```

---

## 7. Тестирование

### Полный тест системы:
```bash
# Запустить все тесты
node scripts/test-health-system.js
```

### Отдельные тесты:
```bash
# Тест только Telegram модуля
node scripts/test-health-system.js test-telegram

# Тест Health Check
node scripts/test-health-system.js test-health-check

# Симуляция проблемы
node scripts/test-health-system.js simulate-problem

# Симуляция восстановления
node scripts/test-health-system.js simulate-recovery
```

### Быстрая проверка (bash):
```bash
./scripts/quick-health-check.sh
```

### DRY_RUN режим:
1. Установите `DRY_RUN=true` в `.env`
2. Запустите тесты:
   ```bash
   node scripts/test-health-system.js
   ```
3. Проверьте логи в консоли (сообщения не отправляются)

### Интеграционные тесты:
```bash
# Проверка обновления скриптов
node scripts/update-scripts-with-health.js --dry-run

# Тест graceful shutdown
node scripts/test-health-system.js test-shutdown
```

---

## 8. Безопасность

### 🚨 Критические правила:

**❌ НИКОГДА не делайте:**
- Не коммитьте `.env` файл в Git
- Не публикуйте токены в открытом доступе
- Не делитесь токенами с посторонними
- Не храните токены в коде JavaScript

**✅ Всегда делайте:**
- Храните токены только в `.env` файле
- Используйте `.env.example` для документации
- Регулярно обновляйте токены
- Используйте разные токены для разных окружений

### Проверка безопасности:
```bash
# Проверка токенов в коде
./scripts/test-git-push.sh

# Проверка .gitignore
grep -E "\.env|secrets/" .gitignore

# Проверка прав доступа
find . -name "*.env*" -exec ls -la {} \;
```

### Git pre-commit hook:
```bash
# Создайте .githooks/pre-commit
#!/bin/bash
if grep -r "TELEGRAM_BOT_TOKEN\|TELEGRAM_CHAT_ID" --include="*.js" --include="*.json" --include="*.md" . | grep -v ".env.example"; then
  echo "ERROR: Possible token leak detected!"
  exit 1
fi
```

---

## 9. Устранение неполадок

### 🔴 Общие проблемы:

#### Проблема: Telegram бот не отправляет сообщения
**Решение:**
1. Проверьте `DRY_RUN` в `.env` (должно быть `false`)
2. Проверьте токен и chat_id: `node scripts/telegram-alert.js status`
3. Проверьте доступность Telegram API: `curl -s api.telegram.org`
4. Проверьте интернет-соединение

#### Проблема: Health check не обнаруживает компоненты
**Решение:**
1. Проверьте `health-state.json`: `cat data/health-state.json`
2. Запустите скрипты вручную для создания записей
3. Проверьте права доступа к файлам

#### Проблема: Cron не запускает проверки
**Решение:**
1. Проверьте crontab: `crontab -l`
2. Проверьте пути в cron (используйте абсолютные пути)
3. Проверьте логи cron: `grep CRON /var/log/syslog`
4. Проверьте права на выполнение скриптов: `chmod +x scripts/*.js`

#### Проблема: Слишком много алертов (спам)
**Решение:**
1. Увеличьте rate limiting в `.env`
2. Проверьте логи на частые изменения статуса
3. Настройте активные часы для компонентов

### 🟡 Полезные команды:

```bash
# Просмотр состояния системы
cat data/health-state.json | jq .

# Просмотр истории алертов
cat data/telegram-state/component-alerts.json | jq .

# Просмотр результатов проверок
tail -f logs/health-cron.log

# Принудительный запуск проверки
node scripts/health-check.js --force

# Тест отправки сообщения
node scripts/telegram-alert.js test
```

### 📊 Мониторинг логов:

```bash
# Мониторинг логов в реальном времени
tail -f logs/health-cron.log logs/quick-check.log

# Поиск ошибок
grep -i "error\|fail\|warn" logs/*.log

# Статистика алертов
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('data/telegram-state/component-alerts.json'));console.log(Object.keys(d).length,'alerts recorded')"
```

---

## 🎯 Итоговая таблица настройки

| Компонент | Статус | Проверка |
|-----------|--------|----------|
| Telegram бот | ✅ | `node scripts/telegram-alert.js status` |
| .env конфигурация | ✅ | `cat .env \| grep TELEGRAM` |
| Health check | ✅ | `node scripts/health-check.js` |
| Интеграция скриптов | ✅ | `node scripts/update-scripts-with-health.js --dry-run` |
| Cron настройка | ✅ | `crontab -l \| grep health` |
| Тестирование | ✅ | `node scripts/test-health-system.js` |
| Безопасность | ✅ | `./scripts/test-git-push.sh` |

---

## 📞 Поддержка и обновления

### Регулярное обслуживание:
1. **Ежедневно**: Проверка логов на ошибки
2. **Еженедельно**: Ротация логов, проверка состояния
3. **Ежемесячно**: Обновление токенов, проверка безопасности

### Обновление системы:
```bash
# Получить обновления
git pull origin master

# Обновить зависимости
npm install

# Обновить скрипты с мониторингом
node scripts/update-scripts-with-health.js

# Протестировать обновление
node scripts/test-health-system.js
```

### Резервное копирование:
```bash
# Копирование состояния системы
cp -r data/health-state.json data/health-state-backup.json
cp -r data/telegram-state/ data/telegram-state-backup/

# Восстановление
cp data/health-state-backup.json data/health-state.json
cp -r data/telegram-state-backup/* data/telegram-state/
```

---

**Система мониторинга здоровья готова к работе!** 🚀

После полной настройки система будет автоматически отслеживать состояние Tennis Betting AI и отправлять алерты при возникновении проблем, обеспечивая высокую доступность и оперативное реагирование на инциденты.