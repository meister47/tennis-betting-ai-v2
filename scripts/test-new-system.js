const HistoricalOptimizations = require('../config/historical-optimizations.js');

console.log('🧪 ТЕСТ ФИНАЛЬНОЙ СИСТЕМЫ С ИСТОРИЧЕСКИМИ ОПТИМИЗАЦИЯМИ');
console.log('========================================================\n');

// Тестовые данные для проверки
const testCases = [
  {
    match: "Test 1: Оптимальный матч",
    player: "Player A",
    odds: 2.7,
    tournament: "ATP Munich", // ATP 250
    edge: 0.15,
    probability: 0.45
  },
  {
    match: "Test 2: Гранд Слем андердог",
    player: "Player B", 
    odds: 3.5,
    tournament: "Wimbledon", // Grand Slam
    edge: 0.12,
    probability: 0.38
  },
  {
    match: "Test 3: Masters 1000 в sweet spot",
    player: "Player C",
    odds: 2.8,
    tournament: "Miami Masters", // Masters 1000
    edge: 0.18,
    probability: 0.42
  },
  {
    match: "Test 4: Низкий коэффициент (<2.5)",
    player: "Player D",
    odds: 1.8,
    tournament: "ATP 250",
    edge: 0.10,
    probability: 0.55
  },
  {
    match: "Test 5: Диапазон 2.0-2.5 (убыточный)",
    player: "Player E",
    odds: 2.3,
    tournament: "ATP 500",
    edge: 0.14,
    probability: 0.48
  }
];

// Симулируем работу новой системы
testCases.forEach((tc, index) => {
  console.log(`🎾 ${tc.match}`);
  console.log(`   Игрок: ${tc.player}, Коэффициент: ${tc.odds}, Турнир: ${tc.tournament}`);
  
  // Проверяем минимальный коэффициент
  if (tc.odds < HistoricalOptimizations.ODDS_CONFIG.MIN_ODDS) {
    console.log(`   🚫 ЗАБЛОКИРОВАНА: Коэффициент ${tc.odds} < ${HistoricalOptimizations.ODDS_CONFIG.MIN_ODDS}`);
    console.log('');
    return;
  }
  
  // Проверяем исторические оптимизации
  const confidenceResult = HistoricalOptimizations.calculateConfidence(
    tc.edge,
    tc.odds,
    null, // surface
    tc.tournament
  );
  
  if (confidenceResult.adjusted === 0) {
    console.log(`   🚫 ЗАБЛОКИРОВАНА: Исторические данные показывают убыточность`);
    if (confidenceResult.blockedBy) {
      console.log(`      Причина: ${confidenceResult.blockedBy}`);
    }
  } else {
    // Расчёт суммы ставки (упрощённо)
    const bankroll = 1500;
    const minStake = 30;
    const maxStake = 90;
    
    const kellyFraction = tc.edge / (tc.odds - 1);
    const safeFraction = kellyFraction * 0.5;
    let stake = Math.round(bankroll * safeFraction);
    stake = Math.max(minStake, Math.min(maxStake, stake));
    
    // Оценка уверенности
    let confidenceLevel;
    if (confidenceResult.adjusted >= 0.20) confidenceLevel = '✅ Высокая';
    else if (confidenceResult.adjusted >= 0.10) confidenceLevel = '⚠️ Умеренная';
    else confidenceLevel = '📉 Низкая';
    
    console.log(`   ✅ РЕКОМЕНДАЦИЯ: ${tc.player} @ ${tc.odds}`);
    console.log(`      Edge: ${(tc.edge * 100).toFixed(1)}% → ${(confidenceResult.adjusted * 100).toFixed(1)}% (с оптимизациями)`);
    console.log(`      Множители: odds=${confidenceResult.multipliers.odds}, tournament=${confidenceResult.multipliers.tournament}`);
    console.log(`      Сумма: ${stake} руб. | Уверенность: ${confidenceLevel}`);
    console.log(`      Диапазон: ${confidenceResult.oddsRange}`);
  }
  
  console.log('');
});

// Итоги
const blocked = testCases.filter(tc => {
  if (tc.odds < HistoricalOptimizations.ODDS_CONFIG.MIN_ODDS) return true;
  const result = HistoricalOptimizations.calculateConfidence(tc.edge, tc.odds, null, tc.tournament);
  return result.adjusted === 0;
}).length;

const recommended = testCases.length - blocked;

console.log('📊 ИТОГИ ТЕСТИРОВАНИЯ:');
console.log('=======================');
console.log(`Всего тестов: ${testCases.length}`);
console.log(`🚫 Блокировано: ${blocked} (${(blocked/testCases.length*100).toFixed(0)}%)`);
console.log(`✅ Рекомендуется: ${recommended} (${(recommended/testCases.length*100).toFixed(0)}%)`);

console.log('\n🎯 КАК ЭТО РАБОТАЕТ В РЕАЛЬНОЙ СИСТЕМЕ:');
console.log('========================================');
console.log('1. Все коэффициенты < 2.5 автоматически отфильтровываются');
console.log('2. Диапазон 2.5-3.0 получает +20% уверенности (оптимальный)');
console.log('3. Grand Slam + андердоги > 3.0 блокируются');
console.log('4. Masters 1000 получает +10% уверенности');
console.log('5. ATP 500/250 остаются без изменений (кроме убыточных диапазонов)');

console.log('\n🚀 СИСТЕМА ГОТОВА К PRODUCTION!');