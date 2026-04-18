// Вспомогательный скрипт для добавления статистики фильтров
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'real-today-analysis-min-odds.js');
const content = fs.readFileSync(scriptPath, 'utf8');

// Найдем место для добавления статистики фильтров
const returnPattern = /    return \{[\s\S]*?recommendations,[\s\S]*?stats: \{[\s\S]*?\}\s*\};\s*\}/;
const newReturnBlock = `    return {
      recommendations,
      stats: {
        totalEvents: allEvents.length,
        filtered: todayEvents.length,
        bets: recommendations.length,
        filterStats: filterStats // НОВОЕ: включаем статистику фильтров в результат
      }
    };`;

// Найдем место перед return для добавления логирования
const beforeReturnPattern = /(\s*\/\* БЫЛО:[\\s\\S]*?рекомендаций[\s\S]*?\*\/)/;
const newBeforeReturn = `$1
    
    // НОВОЕ: Логируем статистику фильтров
    HistoricalOptimizations.logFilterStats(filterStats);`;

// Сначала добавим логирование
const contentWithLogging = content.replace(beforeReturnPattern, newBeforeReturn);

// Затем обновим return блок
const finalContent = contentWithLogging.replace(returnPattern, newReturnBlock);

fs.writeFileSync(scriptPath, finalContent, 'utf8');
console.log('✅ Статистика фильтров добавлена в скрипт');