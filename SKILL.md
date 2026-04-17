# Tennis Betting AI

**Автоматический анализ теннисных ставок с использованием ИИ и протокола Clean Ticket.**

## 🎯 Что делает скилл

Анализирует теннисные матчи ATP/WTA, находит value-ставки (где коэффициенты завышены) и даёт рекомендации с обоснованием.

## 🚀 Быстрый старт

```bash
# Активировать скилл
tennis-betting analyze --tournament "Monte Carlo" --date "2026-04-11"

# Проверить коэффициенты
tennis-betting odds --match "Alcaraz vs Sinner"

# Получить рекомендации на сегодня
tennis-betting recommendations
```

## 📊 Возможности

### 1. **Анализ матчей**
- Сбор статистики игроков
- Head-to-head история
- Форма на текущем покрытии
- Психологические факторы

### 2. **Value betting**
- Протокол Clean Ticket для оценки value
- Поиск завышенных коэффициентов
- Расчёт математического ожидания

### 3. **Risk management**
- Критерий Келли для размера ставки
- Банкролл-менеджмент
- Отслеживание ROI

### 4. **Автоматизация**
- Ежедневный мониторинг турниров
- Уведомления о новых матчах
- Отчёты о результатах

## 🛠️ Команды

### Основные команды
```bash
# Анализ конкретного матча
tennis-betting analyze --match "Player1 vs Player2"

# Анализ всего турнира
tennis-betting analyze --tournament "Monte Carlo"

# Проверка коэффициентов
tennis-betting odds --bookmaker "Fonbet" --match "Alcaraz vs Sinner"

# Получить рекомендации
tennis-betting recommendations --risk low|medium|high

# Отследить результат
tennis-betting track --match-id "12345"
```

### Настройки
```bash
# Установить банкролл
tennis-betting config --bankroll 10000

# Установить риск-профиль
tennis-betting config --risk-profile conservative

# Добавить букмекера
tennis-betting config --add-bookmaker "Fonbet" --url "https://..."
```

## 📈 Протокол Clean Ticket

Скилл использует протокол Clean Ticket для оценки value:

1. **Сбор данных** — статистика, коэффициенты, контекст
2. **Оценка вероятности** — реальные шансы vs букмекерские
3. **Расчёт edge** — преимущество ставки
4. **Рекомендация** — ставка/не ставка с обоснованием

## 🔧 Установка

```bash
# Установить скилл
clawhub install tennis-betting-ai

# Или вручную
git clone https://github.com/meister47/openclaw-skills.git
cp -r tennis-betting-ai ~/.openclaw/workspace/skills/
```

## 📁 Структура

```
tennis-betting-ai/
├── SKILL.md              # Этот файл
├── workflow.md           # Как работает
├── scripts/
│   ├── analyze.js       # Основной анализ
│   ├── fetch-odds.js    # Сбор коэффициентов
│   └── report.js        # Генерация отчётов
├── references/
│   ├── clean-ticket.md  # Протокол Clean Ticket
│   └── tennis-stats.md  # Статистика тенниса
└── config/
    └── bookmakers.json  # Настройки БК
```

## 🤝 Совместимость

- **OpenClaw:** версия 1.0+
- **Букмекеры:** Fonbet, Bet365, 1xBet (через веб-скрапинг)
- **Источники данных:** ATP Tour, WTA, Flashscore, ESPN

## ⚠️ Ограничения

- Только для образовательных целей
- Не гарантирует выигрыш
- Риск потери денег существует
- Требует настройки под конкретного букмекера

## 📞 Поддержка

Проблемы и предложения: [GitHub Issues](https://github.com/meister47/openclaw-skills/issues)

## 📄 Лицензия

MIT License