# 📊 Анализ эффективности ставок по покрытиям и турнирам

## 🎯 Назначение

Скрипт `analyze-surface-tournament.js` — профессиональный инструмент для Senior Data Analyst, который анализирует эффективность теннисных ставок в разрезе:

1. **Покрытий корта** (Grass, Clay, Hard)
2. **Категорий турниров** (Grand Slam, Masters 1000, ATP 500, ATP 250)
3. **Диапазонов коэффициентов** (2.0-2.5, 2.5-3.0, 3.0-3.5, 3.5+)
4. **Кросс-анализа** (покрытие + диапазон коэффициентов)

## 📁 Структура файлов

```
tennis-betting-ai/
├── scripts/
│   └── analyze-surface-tournament.js  # Основной скрипт анализа
├── data/
│   └── surface-tournament-analysis.json  # Результаты анализа (генерируется)
└── docs/
    └── surface-tournament-analysis.md    # Эта документация
```

## 🚀 Быстрый старт

### 1. Запуск анализа

```bash
cd /root/.openclaw/workspace/skills/tennis-betting-ai/scripts
node analyze-surface-tournament.js
```

### 2. Параметры запуска

В текущей версии параметры захардкожены в константы:

```javascript
// Константы в скрипте
const MIN_SAMPLE_SIZE = 5;           // Минимальный размер выборки
const ODDS_RANGES = [/*...*/];       // Диапазоны коэффициентов
const TOURNAMENT_CATEGORIES = {/*...*/}; // Категории турниров
```

## 📊 Формат вывода

Скрипт выводит отчёт в формате:

```
════════════════════════════════════════════════════════════
📊 АНАЛИЗ ПО ПОКРЫТИЯМ
════════════════════════════════════════════════════════════

🟢 ТРАВА (Grass)
   Ставок: 12 | Win Rate: 41.7% | ROI: +8.2% | Средний кэф: 2.71
   🔥 Лучший диапазон: 2.5-3.0 → ROI +15.3% (8 ставок)

🟤 ГРУНТ (Clay)
   Ставок: 28 | Win Rate: 39.3% | ROI: +1.8% | Средний кэф: 2.64

🔵 ХАРД (Hard)
   Ставок: 45 | Win Rate: 37.8% | ROI: -1.2% | Средний кэф: 2.58

════════════════════════════════════════════════════════════
🏆 АНАЛИЗ ПО ТУРНИРАМ
════════════════════════════════════════════════════════════

Masters 1000: Ставок: 22 | ROI: +6.5% ✅
ATP 500: Ставок: 18 | ROI: +2.1% 
ATP 250: Ставок: 30 | ROI: -0.8%
Grand Slam: Ставок: 15 | ROI: -4.2% ⚠️

════════════════════════════════════════════════════════════
💡 РЕКОМЕНДАЦИИ:
════════════════════════════════════════════════════════════

✅ Трава + 2.5-3.0 — увеличить уверенность
⚠️ Hard — пересмотреть порог edge
❌ Grand Slam >3.0 — исключить (исторически -14.3%)
```

## 🎯 Метрики анализа

### Для покрытий:
- **Количество ставок** — статистическая значимость
- **Win Rate (%)** — процент выигрышных ставок
- **ROI (%)** — возврат на инвестиции
- **Средний коэффициент** — среднее значение odds
- **Диапазон коэффициентов** — лучшие/худшие диапазоны

### Для турниров:
- **Категория** — Grand Slam, Masters 1000, ATP 500, ATP 250
- **ROI** — эффективность по категориям
- **Win Rate** — процент побед
- **Достаточность данных** — метка [INSUFFICIENT DATA]

## 🔧 Конфигурация

### Ключевые константы:

```javascript
const MIN_SAMPLE_SIZE = 5; // Минимальный размер выборки

const ODDS_RANGES = [
    { name: '2.0-2.5', min: 2.0, max: 2.5 },
    { name: '2.5-3.0', min: 2.5, max: 3.0 },
    { name: '3.0-3.5', min: 3.0, max: 3.5 },
    { name: '3.5+', min: 3.5, max: Infinity }
];

const TOURNAMENT_CATEGORIES = {
    'Grand Slam': ['Wimbledon', 'US Open', 'Australian Open', 'French Open', 'Roland Garros'],
    'Masters 1000': ['Monte-Carlo', 'Indian Wells', 'Miami', 'Madrid', 'Rome', 'Canada', 'Cincinnati', 'Shanghai', 'Paris'],
    'ATP 500': ['Dubai', 'Acapulco', 'Barcelona', 'Hamburg', 'Washington', 'Beijing', 'Tokyo', 'Vienna', 'Basel'],
    'ATP 250': ['Doha', 'Adelaide', 'Auckland', 'Marseille', 'Rotterdam', 'Santiago', 'Estoril', 'Munich', 'Geneva', 'Stuttgart'],
    'Challenger/ITF': ['Challenger', 'ITF', 'Futures']
};
```

## 📈 Логика рекомендаций

### Пороговые значения:
- **ROI > +5%** → Увеличить уверенность (✅)
- **ROI < -2%** → Пересмотреть порог edge (⚠️)
- **ROI < -5%** → Исключить категорию (❌)
- **ROI > +8%** → Горячая зона (🔥)

### Маркеры достаточности данных:
- **<5 ставок** → [INSUFFICIENT DATA]
- **5-10 ставок** → Предварительные выводы
- **>10 ставок** → Статистически значимые выводы

## 🎯 Использование результатов

### 1. Оптимизация стратегии
```javascript
// Пример: Фокус на Grass + Masters 1000
if (surface === 'Grass' && tournament === 'Masters 1000') {
    confidenceMultiplier = 1.5;
}
```

### 2. Динамическое управление ставками
```javascript
// Пример: Изменение размера ставки
function calculateStake(baseStake, surfaceROI, tournamentROI) {
    const surfaceFactor = 1 + (surfaceROI / 100);
    const tournamentFactor = 1 + (tournamentROI / 100);
    return baseStake * surfaceFactor * tournamentFactor;
}
```

### 3. Отсев неэффективных зон
```javascript
// Пример: Исключение зон с отрицательным ROI
function shouldPlaceBet(surface, tournament, odds) {
    const surfaceData = analysis.surfaces[surface];
    const tournamentData = analysis.tournaments[tournament];
    
    if (!surfaceData.sufficient_data || !tournamentData.sufficient_data) {
        return false; // Недостаточно данных
    }
    
    if (surfaceData.roi < -5 || tournamentData.roi < -5) {
        return false; // Убыточные зоны
    }
    
    return true;
}
```

## 🛡️ Требования к данным

### 1. Формат bets-db.json
```json
{
    "bets": [
        {
            "id": 1,
            "event": "Wimbledon: Federer vs Nadal",
            "surface": "Grass", // Обязательное поле
            "odds": 2.8,
            "stake": 30,
            "result": "won",
            "status": "settled",
            "return": 84,
            "profit": 54
        }
    ]
}
```

### 2. Минимальные требования:
- **Поле surface** (Grass, Clay, Hard, Unknown)
- **Статус settled** — только завершённые ставки
- **Результаты** (won/lost) для расчёта win rate
- **Ставка и возврат** для расчёта ROI

## 🔄 Частота обновления

| Период | Рекомендация |
|--------|--------------|
| Каждые 10 ставок | Обновить анализ покрытий |
| Каждые 20 ставок | Обновить анализ турниров |
| Каждые 50 ставок | Пересмотреть стратегию |
| После турнира | Анализ конкретных событий |

## 📊 Примеры использования

### 1. Ежедневный анализ
```bash
# Добавить в cron
0 9 * * * cd /tennis-betting-ai && node scripts/analyze-surface-tournament.js
```

### 2. Мониторинг эффективности
```javascript
// Интеграция с основной системой
const analyzer = require('./scripts/analyze-surface-tournament.js');
const results = analyzer.run();
updateBettingStrategy(results.recommendations);
```

### 3. Отчёт для стейкхолдеров
```bash
# Генерация отчёта + отправка
node scripts/analyze-surface-tournament.js > report.txt
mail -s "Анализ эффективности ставок" team@example.com < report.txt
```

## 🚨 Ограничения и предупреждения

### 1. Статистическая значимость
- **<5 ставок** → Выводы ненадёжны
- **5-10 ставок** → Тенденции, но не закономерности
- **>20 ставок** → Достаточно для выводов

### 2. Временные факторы
- Сезонность (Grass сезон: июнь-июль)
- Форма игроков
- Погодные условия

### 3. Риски переобучения
- Избегать экстраполяции на малых выборках
- Тестировать изменения на исторических данных
- Использовать кросс-валидацию

## 🎯 Следующие шаги

### 1. Улучшения скрипта
- [ ] Добавить параметры командной строки
- [ ] Поддержка экспорта в CSV/Excel
- [ ] Графическая визуализация
- [ ] Веб-интерфейс для анализа

### 2. Интеграции
- [ ] API для доступа к результатам
- [ ] Автоматическая оптимизация стратегии
- [ ] Алгоритмическая торговля на основе анализа

### 3. Расширения
- [ ] Анализ по игрокам
- [ ] Временные тренды
- [ ] Корреляция с другими факторами

## 📞 Поддержка

### Вопросы и проблемы:
1. Проверьте формат bets-db.json
2. Убедитесь в наличии поля `surface`
3. Проверьте права доступа к файлам
4. Запустите с флагом `--debug` (в будущих версиях)

### Контакты:
- Разработчик: Senior Data Analyst / JavaScript Developer
- Репозиторий: tennis-betting-ai-v2
- Документация: этот файл

---

**🎯 Цель:** Сделать анализ эффективности ставок прозрачным, автоматизированным и научно обоснованным.

**📊 Результат:** Data-driven стратегия, основанная на статистике, а не на интуиции.