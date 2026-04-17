# 📱 Настройка Telegram бота для системы мониторинга здоровья

## 📋 Оглавление
1. [Создание бота через @BotFather](#1-создание-бота-через-botfather)
2. [Получение Chat ID](#2-получение-chat-id)
3. [Настройка переменных окружения](#3-настройка-переменных-окружения)
4. [Тестирование бота](#4-тестирование-бота)
5. [Безопасность](#5-безопасность)
6. [Устранение неполадок](#6-устранение-неполадок)

---

## 1. Создание бота через @BotFather

### Шаг 1: Откройте Telegram
1. Убедитесь, что у вас установлен Telegram
2. Найдите @BotFather в поиске

### Шаг 2: Создание нового бота
Отправьте @BotFather команду `/newbot` и следуйте инструкциям:

```
BotFather: Alright, a new bot. How are we going to call it? Please choose a name for your bot.
You: Tennis Betting AI Monitor
BotFather: Good. Now let's choose a username for your bot. It must end in 'bot'. Like this, for example: TetrisBot or tetris_bot.
You: tennis_betting_ai_monitor_bot
BotFather: Done! Congratulations on your new bot.
```

### Шаг 3: Сохранение токена
@BotFather предоставит токен в формате:
```
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
```

**⚠️ ВАЖНО:** Сохраните этот токен в надёжном месте! Этот токен — ключ доступа к вашему боту.

### Шаг 4: Настройка бота (опционально)
Можно настроить:
- `/setdescription` - описание бота
- `/setabouttext` - информация о боте
- `/setuserpic` - установить аватар
- `/setcommands` - список команд (не обязательно для мониторинга)

---

## 2. Получение Chat ID

### Вариант 1: Через @userinfobot (рекомендуется)
1. Найдите @userinfobot в поиске Telegram
2. Начните диалог с ботом
3. Отправьте любое сообщение
4. Бот ответит с вашим **chat_id** в формате: `472156200`

### Вариант 2: Через созданного бота
1. Откройте диалог с вашим новым ботом
2. Отправьте команду `/start`
3. Скопируйте URL из адресной строки:
   ```
   https://web.telegram.org/k/#1234567890
   ```
   Где `1234567890` — ваш chat_id

### Вариант 3: Через GetIDs Bot
1. Найдите @getidsbot в поиске
2. Добавьте бота в чат или личный диалог
3. Отправьте команду `/getid`
4. Бот покажет ваш chat_id

---

## 3. Настройка переменных окружения

### Шаг 1: Копирование шаблона
```bash
cp .env.example .env
```

### Шаг 2: Редактирование .env файла
Откройте `.env` файл в текстовом редакторе:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
TELEGRAM_CHAT_ID=472156200

# Health Monitor Configuration
DRY_RUN=false
HEALTH_CHECK_INTERVAL_HOURS=1
ENABLE_HEALTH_ALERTS=true

# Rate Limiting (в секундах)
RATE_LIMIT_COMPONENT=3600    # 1 час между алертами для одного компонента
RATE_LIMIT_SUMMARY=21600     # 6 часов между сводками

# Thresholds (часы)
ANALYZER_WARN_HOURS=3
ANALYZER_ERROR_HOURS=6
CLV_TRACKER_WARN_HOURS=2
CLV_TRACKER_ERROR_HOURS=4
ODDS_CACHE_WARN_HOURS=12
ODDS_CACHE_ERROR_HOURS=24

# Active hours for CLV tracker (MSK)
CLV_ACTIVE_START_HOUR=8      # 08:00 МСК
CLV_ACTIVE_END_HOUR=22       # 22:00 МСК
```

### Шаг 3: Вставка ваших значений
1. **TELEGRAM_BOT_TOKEN**: вставьте токен из @BotFather
2. **TELEGRAM_CHAT_ID**: вставьте ваш chat_id
3. **DRY_RUN**: установите `true` для тестирования без отправки реальных сообщений

### Шаг 4: Проверка безопасности
Убедитесь, что `.env` файл добавлен в `.gitignore`:

```bash
echo ".env" >> .gitignore
echo "# Environment variables" >> .gitignore
echo "*.env" >> .gitignore
echo "secrets/" >> .gitignore
```

---

## 4. Тестирование бота

### Шаг 1: Тестовый запуск
```bash
node scripts/test-health-system.js
```

### Шаг 2: Проверка в DRY_RUN режиме
1. В `.env` файле установите `DRY_RUN=true`
2. Запустите тест:
   ```bash
   node scripts/test-health-system.js
   ```
3. Проверьте логи в консоли (сообщения не будут отправлены в Telegram)

### Шаг 3: Реальный тест
1. В `.env` файле установите `DRY_RUN=false`
2. Запустите тест:
   ```bash
   node scripts/test-health-system.js
   ```
3. Проверьте Telegram — должно прийти тестовое сообщение

### Шаг 4: Проверка конфигурации
```bash
node scripts/telegram-alert.js status
```

Ожидаемый вывод:
```
Telegram Alerter Status:
- Enabled: true
- Bot Token: SET
- Chat ID: SET
- Dry Run: false
```

---

## 5. Безопасность

### 🚨 Критические правила

**❌ НИКОГДА не делайте:**
- Не коммитьте `.env` файл в Git
- Не публикуйте токен в открытом доступе
- Не делитесь токеном с посторонними
- Не храните токен в коде JavaScript

**✅ Всегда делайте:**
- Храните токен только в `.env` файле
- Используйте `.env.example` для документации
- Регулярно обновляйте токены (рекомендуется раз в 90 дней)
- Используйте разные токены для разных окружений

### 🛡️ Защита от утечки токенов

1. **Проверка перед коммитом:**
   ```bash
   ./scripts/test-git-push.sh
   ```

2. **Git pre-commit hook:**
   ```bash
   # Создайте .githooks/pre-commit
   #!/bin/bash
   if grep -r "TELEGRAM_BOT_TOKEN\|TELEGRAM_CHAT_ID" --include="*.js" --include="*.json" --include="*.md" . | grep -v ".env.example"; then
     echo "ERROR: Possible token leak detected!"
     exit 1
   fi
   ```

3. **Регулярная проверка:**
   ```bash
   # Проверка токенов в коде
   grep -r "TELEGRAM_BOT_TOKEN\|TELEGRAM_CHAT_ID" --include="*.js" --include="*.json" .
   ```

### 🔄 Ротация токенов

Если токен был скомпрометирован:
1. Откройте @BotFather
2. Отправьте `/revoke` для текущего бота
3. Получите новый токен
4. Обновите `.env` файл
5. Перезапустите систему мониторинга

---

## 6. Устранение неполадок

### 🔴 Проблема: "Bot token is empty"
**Решение:**
1. Проверьте `.env` файл
2. Убедитесь, что `TELEGRAM_BOT_TOKEN` установлен
3. Проверьте отсутствие пробелов в конце токена

### 🔴 Проблема: "Chat not found"
**Решение:**
1. Проверьте `TELEGRAM_CHAT_ID` в `.env`
2. Убедитесь, что бот добавлен в чат
3. Отправьте команду `/start` боту

### 🔴 Проблема: "403 Forbidden: bot was blocked by the user"
**Решение:**
1. Разблокируйте бота в Telegram
2. Отправьте команду `/start`
3. Проверьте настройки приватности

### 🔴 Проблема: "DRY_RUN работает, но реальные сообщения не отправляются"
**Решение:**
1. Установите `DRY_RUN=false` в `.env`
2. Проверьте интернет-соединение
3. Проверьте доступность Telegram API

### 🔴 Проблема: "Timeout при отправке сообщения"
**Решение:**
1. Увеличьте timeout в `telegram-alert.js`
2. Проверьте файрвол/прокси
3. Проверьте DNS настройки

### 🟡 Полезные команды для отладки

```bash
# Проверка конфигурации
node -e "console.log('Token:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET')"

# Тест подключения к Telegram API
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"

# Тест отправки сообщения (через curl)
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}&text=Test+message&parse_mode=Markdown"

# Просмотр логов системы
tail -f logs/health.log 2>/dev/null || echo "No logs found"
```

---

## 📊 Дополнительные настройки

### Уровни алертов
Система поддерживает 6 уровней алертов:

| Уровень | Эмодзи | Цвет | Описание |
|---------|--------|------|----------|
| info | ℹ️ | 🔵 | Информационные сообщения |
| warn | ⚠️ | 🟡 | Предупреждения |
| error | ❌ | 🔴 | Ошибки |
| critical | 🚨 | 🟣 | Критические ошибки |
| ok | ✅ | 🟢 | Восстановление |
| success | 🎯 | 🟢 | Успешные операции |

### Кастомизация сообщений
Можно изменить формат сообщений в `scripts/telegram-alert.js`:
```javascript
formatMessage(message, level = 'info', metadata = {}) {
  // Кастомизируйте форматирование здесь
}
```

### Rate limiting
Настройки в `.env`:
- `RATE_LIMIT_COMPONENT=3600` - 1 час между алертами для одного компонента
- `RATE_LIMIT_SUMMARY=21600` - 6 часов между сводками

---

## 🎯 Итоговая проверочная таблица

| Шаг | Статус | Команда проверки |
|-----|--------|------------------|
| Бот создан | ✅ | - |
| Токен получен | ✅ | - |
| Chat ID получен | ✅ | - |
| .env настроен | ✅ | `cat .env \| grep TELEGRAM` |
| DRY_RUN тест | ✅ | `node scripts/test-health-system.js` |
| Реальный тест | ✅ | Изменить `DRY_RUN=false` и запустить тест |
| Cron настроен | ⏳ | `crontab -l \| grep health` |

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте раздел [Устранение неполадок](#6-устранение-неполадок)
2. Посмотрите логи: `tail -f logs/health.log`
3. Проверьте конфигурацию: `node scripts/telegram-alert.js status`
4. Создайте issue в репозитории

**Система готова к работе!** 🚀

После успешной настройки Telegram бота система мониторинга здоровья будет отправлять алерты при возникновении проблем с компонентами Tennis Betting AI.