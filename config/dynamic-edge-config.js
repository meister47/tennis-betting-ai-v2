/**
 * Конфигурация динамического порога minEdge в зависимости от коэффициента
 * 
 * 📊 ИСТОРИЧЕСКИЙ КОНТЕКСТ:
 * - Фиксированный minEdge = 0.05 (5%) оказался недостаточным для высоких коэффициентов
 * - Волатильность на high odds (3.0+) требует более высокого перевеса
 * - Low odds (2.5) могут работать с минимальным edge
 * 
 * 🎯 ФОРМУЛА:
 * requiredEdge = BASE_EDGE + (odds - ODDS_THRESHOLD) * ODDS_MULTIPLIER
 * 
 * 📈 ПРИМЕРЫ:
 * - odds = 2.5 → edge = 0.03 + 0.5*0.02 = 0.04 (4%)
 * - odds = 3.5 → edge = 0.03 + 1.5*0.02 = 0.06 (6%)
 * - odds = 5.0 → edge = 0.03 + 3.0*0.02 = 0.09 (9%)
 */

// 🛡️ Feature flag для плавного внедрения и отката
const USE_DYNAMIC_EDGE = true;

// 📊 Конфигурация динамического порога
const EDGE_CONFIG = {
  // Базовый порог для odds <= ODDS_THRESHOLD
  BASE_EDGE: 0.03,          // 3% базовый порог
  
  // Множитель на каждый пункт кэф выше ODDS_THRESHOLD
  ODDS_MULTIPLIER: 0.02,    // +2% edge за каждый пункт odds
  
  // Порог, после которого начинает работать динамическая формула
  ODDS_THRESHOLD: 2.0,
  
  // Абсолютные границы для безопасности
  MIN_EDGE: 0.03,           // Не ниже 3% никогда
  MAX_EDGE: 0.10,           // Не выше 10% (чтобы не отсечь все ставки)
  
  // Старый фиксированный порог для отката
  OLD_FIXED_EDGE: 0.05,     // Было 5%
  
  // Уровни логирования
  LOG_LEVEL: 'detailed'     // 'none', 'basic', 'detailed'
};

// 📈 Функция расчёта динамического порога
function calculateMinEdge(odds) {
  if (!USE_DYNAMIC_EDGE) {
    return EDGE_CONFIG.OLD_FIXED_EDGE;
  }
  
  // Для коэффициентов <= порога используем базовый edge
  if (odds <= EDGE_CONFIG.ODDS_THRESHOLD) {
    return EDGE_CONFIG.BASE_EDGE;
  }
  
  // Рассчитываем дополнительный edge за превышение порога
  const extraEdge = (odds - EDGE_CONFIG.ODDS_THRESHOLD) * EDGE_CONFIG.ODDS_MULTIPLIER;
  
  // Суммируем и ограничиваем диапазоном
  const requiredEdge = EDGE_CONFIG.BASE_EDGE + extraEdge;
  
  return Math.min(
    Math.max(requiredEdge, EDGE_CONFIG.MIN_EDGE),
    EDGE_CONFIG.MAX_EDGE
  );
}

// 📊 Функция для сравнения новой и старой логики
function compareEdgeRequirements(odds) {
  const oldEdge = EDGE_CONFIG.OLD_FIXED_EDGE;
  const newEdge = calculateMinEdge(odds);
  
  return {
    odds: odds,
    oldEdge: oldEdge,
    newEdge: newEdge,
    difference: newEdge - oldEdge,
    differencePercent: ((newEdge - oldEdge) / oldEdge * 100).toFixed(1),
    isHarder: newEdge > oldEdge,
    isEasier: newEdge < oldEdge
  };
}

// 📈 Функция генерации таблицы сравнения
function generateEdgeComparisonTable(minOdds = 2.0, maxOdds = 5.0, step = 0.5) {
  const table = [];
  
  for (let odds = minOdds; odds <= maxOdds; odds += step) {
    const comparison = compareEdgeRequirements(odds);
    table.push(comparison);
  }
  
  return table;
}

// 📝 Функция логирования
function logEdgeCalculation(odds, actualEdge, requiredEdge, decision) {
  if (EDGE_CONFIG.LOG_LEVEL === 'none') return;
  
  const percent = (requiredEdge * 100).toFixed(1);
  const actualPercent = (actualEdge * 100).toFixed(1);
  
  if (EDGE_CONFIG.LOG_LEVEL === 'detailed') {
    console.log(`[EDGE] odds=${odds.toFixed(2)}: required=${percent}%, actual=${actualPercent}% → ${decision}`);
  } else if (decision.includes('SKIP') || decision.includes('REJECT')) {
    console.log(`[EDGE] REJECTED: odds=${odds.toFixed(2)}: edge=${actualPercent}% < required=${percent}%`);
  }
}

// 🧪 Функция для тестирования и валидации
function testEdgeCalculations() {
  console.log('🧪 ТЕСТИРОВАНИЕ ДИНАМИЧЕСКОГО PORTА');
  console.log('========================================');
  
  const testCases = [
    { odds: 2.0, expectedEdge: 0.03 },
    { odds: 2.5, expectedEdge: 0.04 },
    { odds: 3.0, expectedEdge: 0.05 },
    { odds: 3.5, expectedEdge: 0.06 },
    { odds: 4.0, expectedEdge: 0.07 },
    { odds: 4.5, expectedEdge: 0.08 },
    { odds: 5.0, expectedEdge: 0.09 }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const calculatedEdge = calculateMinEdge(testCase.odds);
    const tolerance = 0.001; // Допуск 0.1%
    
    if (Math.abs(calculatedEdge - testCase.expectedEdge) <= tolerance) {
      console.log(`✅ odds=${testCase.odds}: ${(calculatedEdge*100).toFixed(1)}% (expected ${(testCase.expectedEdge*100).toFixed(1)}%)`);
      passed++;
    } else {
      console.log(`❌ odds=${testCase.odds}: ${(calculatedEdge*100).toFixed(1)}% (expected ${(testCase.expectedEdge*100).toFixed(1)}%)`);
      failed++;
    }
  }
  
  console.log('========================================');
  console.log(`Результат: ${passed} пройдено, ${failed} провалено`);
  
  if (failed === 0) {
    console.log('✅ Все тесты пройдены');
    return true;
  } else {
    console.log('❌ Требуются исправления');
    return false;
  }
}

// 📊 Экспорт статистики для аналитики
function getEdgeStatsForBet(odds, actualEdge, accepted) {
  const requiredEdge = calculateMinEdge(odds);
  
  return {
    odds: odds,
    actualEdge: actualEdge,
    requiredEdge: requiredEdge,
    edgeDifference: actualEdge - requiredEdge,
    accepted: accepted,
    timestamp: new Date().toISOString(),
    config: {
      baseEdge: EDGE_CONFIG.BASE_EDGE,
      oddsMultiplier: EDGE_CONFIG.ODDS_MULTIPLIER,
      oddsThreshold: EDGE_CONFIG.ODDS_THRESHOLD
    }
  };
}

// 🔧 Функция для быстрой настройки параметров
function getEdgeConfig() {
  return {
    ...EDGE_CONFIG,
    useDynamicEdge: USE_DYNAMIC_EDGE
  };
}

// 🛡️ Функция для отключения динамического edge (для отката)
function disableDynamicEdge() {
  return {
    oldValue: USE_DYNAMIC_EDGE,
    newValue: false,
    message: 'Динамический edge отключен, используется фиксированный порог 5%'
  };
}

// 🔄 Функция для включения динамического edge
function enableDynamicEdge() {
  return {
    oldValue: USE_DYNAMIC_EDGE,
    newValue: true,
    message: 'Динамический edge включен'
  };
}

// 📈 Модуль экспорта
module.exports = {
  // Константы
  USE_DYNAMIC_EDGE,
  EDGE_CONFIG,
  
  // Основные функции
  calculateMinEdge,
  compareEdgeRequirements,
  generateEdgeComparisonTable,
  
  // Вспомогательные функции
  logEdgeCalculation,
  testEdgeCalculations,
  getEdgeStatsForBet,
  
  // Управление конфигурацией
  getEdgeConfig,
  disableDynamicEdge,
  enableDynamicEdge
};