#!/usr/bin/env node

/**
 * DRY_RUN тестирование динамического порога edge
 * Сравнивает старую (фиксированный 5%) и новую (динамический) логику
 * 
 * 🎯 ЦЕЛЬ: Показать, какие ставки будут отсеяны новой логикой
 * 📊 ОЖИДАНИЯ: Снижение количества ставок на 10-15%, повышение ROI
 */

const DynamicEdgeConfig = require('../config/dynamic-edge-config.js');
const HistoricalOptimizations = require('../config/historical-optimizations.js');

// Тестовые данные: реальные ставки из предыдущих анализов
const TEST_BETS = [
  { match: "Nuno Borges vs Tomas Martin Etcheverry", odds: 3.48, edge: 0.275, probability: 0.5 },
  { match: "Arthur Rinderknech vs Joao Fonseca", odds: 3.40, edge: 0.217, probability: 0.5 },
  { match: "Zeynep Sonmez vs Anna Kalinskaya", odds: 4.0, edge: 0.319, probability: 0.5 },
  { match: "Carlos Alcaraz vs Jannik Sinner", odds: 1.8, edge: 0.12, probability: 0.6 },
  { match: "Novak Djokovic vs Rafael Nadal", odds: 2.2, edge: 0.08, probability: 0.55 },
  { match: "Iga Swiatek vs Aryna Sabalenka", odds: 2.8, edge: 0.15, probability: 0.52 },
  { match: "Daniil Medvedev vs Stefanos Tsitsipas", odds: 3.2, edge: 0.18, probability: 0.48 },
  { match: "Coco Gauff vs Naomi Osaka", odds: 2.5, edge: 0.06, probability: 0.53 },
  { match: "Alexander Zverev vs Andrey Rublev", odds: 3.5, edge: 0.22, probability: 0.47 },
  { match: "Ons Jabeur vs Elena Rybakina", odds: 2.9, edge: 0.11, probability: 0.51 }
];

// Старая логика: фиксированный порог 5%
function oldLogicPasses(odds, edge) {
  const FIXED_EDGE = 0.05;
  return edge >= FIXED_EDGE;
}

// Новая логика: динамический порог
function newLogicPasses(odds, edge) {
  const requiredEdge = DynamicEdgeConfig.calculateMinEdge(odds);
  return edge >= requiredEdge;
}

// Основная функция тестирования
function runDynamicEdgeDryRun() {
  console.log('================================================================================');
  console.log('🧪 DRY_RUN: СРАВНЕНИЕ СТАРОЙ И НОВОЙ ЛОГИКИ ДЛЯ ДИНАМИЧЕСКОГО EDGE');
  console.log('================================================================================');
  console.log('📊 КОНФИГУРАЦИЯ:');
  console.log(`   Динамический edge: ${DynamicEdgeConfig.USE_DYNAMIC_EDGE ? 'ВКЛ' : 'ВЫКЛ'}`);
  console.log(`   Базовый edge: ${DynamicEdgeConfig.EDGE_CONFIG.BASE_EDGE * 100}%`);
  console.log(`   Множитель: ${DynamicEdgeConfig.EDGE_CONFIG.ODDS_MULTIPLIER * 100}% за каждый пункт odds выше ${DynamicEdgeConfig.EDGE_CONFIG.ODDS_THRESHOLD}`);
  console.log(`   Диапазон: ${DynamicEdgeConfig.EDGE_CONFIG.MIN_EDGE * 100}% - ${DynamicEdgeConfig.EDGE_CONFIG.MAX_EDGE * 100}%`);
  console.log('================================================================================\n');
  
  // Генерация таблицы сравнения для разных коэффициентов
  console.log('📈 ТАБЛИЦА ТРЕБОВАНИЙ EDGE ПО КОЭФФИЦИЕНТАМ:');
  console.log('┌─────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
  console.log('│  Odds   │ Старый edge │ Новый edge  │ Разница     │ Ставка      │');
  console.log('├─────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
  
  const comparisonTable = DynamicEdgeConfig.generateEdgeComparisonTable(2.0, 5.0, 0.5);
  
  comparisonTable.forEach(item => {
    const oldEdge = (item.oldEdge * 100).toFixed(1);
    const newEdge = (item.newEdge * 100).toFixed(1);
    const diff = (item.difference * 100).toFixed(1);
    const diffSign = item.difference >= 0 ? '+' : '';
    const status = item.isHarder ? 'ЖЁСТЧЕ' : item.isEasier ? 'ЛЕГЧЕ' : 'ТАК ЖЕ';
    
    console.log(`│ ${item.odds.toFixed(1).padEnd(7)} │ ${oldEdge.padEnd(11)}% │ ${newEdge.padEnd(11)}% │ ${diffSign}${diff.padEnd(11)}% │ ${status.padEnd(11)} │`);
  });
  
  console.log('└─────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n');
  
  // Тестирование на реальных ставках
  console.log('🎯 АНАЛИЗ ТЕСТОВЫХ СТАВОК (10 примеров):');
  console.log('┌─────┬─────────────────────────────────────────┬───────┬───────┬─────────┬─────────┬──────────┐');
  console.log('│  #  │ Матч                                    │ Odds  │ Edge  │ Старый  │ Новый   │ Решение  │');
  console.log('├─────┼─────────────────────────────────────────┼───────┼───────┼─────────┼─────────┼──────────┤');
  
  let oldAccepted = 0;
  let newAccepted = 0;
  let changedDecisions = 0;
  const changedBets = [];
  
  TEST_BETS.forEach((bet, index) => {
    const oldPasses = oldLogicPasses(bet.odds, bet.edge);
    const newPasses = newLogicPasses(bet.odds, bet.edge);
    const decisionChanged = oldPasses !== newPasses;
    
    const oldStatus = oldPasses ? '✅ ПРИНЯТА' : '❌ ОТСЕЯНА';
    const newStatus = newPasses ? '✅ ПРИНЯТА' : '❌ ОТСЕЯНА';
    const decision = decisionChanged ? (newPasses ? '🔥 ЛУЧШЕ' : '⚠️  ХУЖЕ') : '➡️  БЕЗ ИЗМ.';
    
    // Укорачиваем название матча для таблицы
    const matchShort = bet.match.length > 30 ? bet.match.substring(0, 27) + '...' : bet.match;
    
    console.log(`│ ${(index + 1).toString().padEnd(3)} │ ${matchShort.padEnd(39)} │ ${bet.odds.toFixed(2).padEnd(5)} │ ${(bet.edge * 100).toFixed(1).padEnd(5)}% │ ${oldStatus.padEnd(9)} │ ${newStatus.padEnd(9)} │ ${decision.padEnd(10)} │`);
    
    if (oldPasses) oldAccepted++;
    if (newPasses) newAccepted++;
    if (decisionChanged) {
      changedDecisions++;
      changedBets.push({
        match: bet.match,
        odds: bet.odds,
        edge: bet.edge,
        oldPasses,
        newPasses,
        requiredEdge: DynamicEdgeConfig.calculateMinEdge(bet.odds)
      });
    }
  });
  
  console.log('└─────┴─────────────────────────────────────────┴───────┴───────┴─────────┴─────────┴──────────┘\n');
  
  // Статистика
  console.log('📊 СТАТИСТИКА СРАВНЕНИЯ:');
  console.log(`   Старых логикой принято: ${oldAccepted} из ${TEST_BETS.length} (${((oldAccepted / TEST_BETS.length) * 100).toFixed(0)}%)`);
  console.log(`   Новой логикой принято: ${newAccepted} из ${TEST_BETS.length} (${((newAccepted / TEST_BETS.length) * 100).toFixed(0)}%)`);
  console.log(`   Изменений решений: ${changedDecisions} (${((changedDecisions / TEST_BETS.length) * 100).toFixed(0)}%)`);
  console.log(`   Снижение количества ставок: ${oldAccepted - newAccepted} (${(((oldAccepted - newAccepted) / oldAccepted) * 100).toFixed(1)}% меньше)`);
  
  // Анализ изменённых решений
  if (changedDecisions > 0) {
    console.log('\n⚠️  ИЗМЕНЁННЫЕ РЕШЕНИЯ:');
    changedBets.forEach((bet, index) => {
      const oldStatus = bet.oldPasses ? '✅ ПРИНЯТА' : '❌ ОТСЕЯНА';
      const newStatus = bet.newPasses ? '✅ ПРИНЯТА' : '❌ ОТСЕЯНА';
      const direction = bet.newPasses ? '🔥 Новая логика ПРИНЯЛА (старая отсеяла)' : '⚠️  Новая логика ОТСЕЯЛА (старая приняла)';
      
      console.log(`\n   ${index + 1}. ${bet.match}`);
      console.log(`      Odds: ${bet.odds}, Edge: ${(bet.edge * 100).toFixed(1)}%`);
      console.log(`      Требуемый edge: ${(bet.requiredEdge * 100).toFixed(1)}%`);
      console.log(`      Старая логика: ${oldStatus}`);
      console.log(`      Новая логика: ${newStatus}`);
      console.log(`      ${direction}`);
      
      if (!bet.newPasses && bet.oldPasses) {
        const edgeShortage = (bet.requiredEdge - bet.edge) * 100;
        console.log(`      💡 Edge недостаточно на ${edgeShortage.toFixed(1)}% для коэффициента ${bet.odds}`);
      }
    });
  }
  
  // Тестирование конфигурации
  console.log('\n🧪 ТЕСТИРОВАНИЕ КОНФИГУРАЦИИ:');
  const configTestPassed = DynamicEdgeConfig.testEdgeCalculations();
  console.log(`   Конфигурация: ${configTestPassed ? '✅ ПРОЙДЕНА' : '❌ ПРОВАЛЕНА'}`);
  
  // Рекомендации
  console.log('\n🎯 РЕКОМЕНДАЦИИ:');
  if (newAccepted < oldAccepted) {
    const reductionPercent = ((oldAccepted - newAccepted) / oldAccepted * 100).toFixed(1);
    console.log(`   ✅ Новая логика отсеивает ${oldAccepted - newAccepted} ставок (${reductionPercent}%)`);
    console.log(`   💡 Это соответствует ожиданиям (10-15% снижения)`);
    
    if (changedBets.filter(b => !b.newPasses && b.oldPasses).length > 0) {
      console.log(`   🔍 Проверьте отсеянные ставки с высокими коэффициентами - это ожидаемо`);
    }
  } else if (newAccepted > oldAccepted) {
    console.log(`   ⚠️  Новая логика принимает БОЛЬШЕ ставок - проверьте конфигурацию`);
  } else {
    console.log(`   🔄 Количество ставок не изменилось - возможно, тестовые данные не репрезентативны`);
  }
  
  // Инструкции по использованию
  console.log('\n🔧 ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ:');
  console.log('   1. Для включения динамического edge:');
  console.log('      В файле config/dynamic-edge-config.js установите USE_DYNAMIC_EDGE = true');
  console.log('   2. Для отключения (отката):');
  console.log('      Установите USE_DYNAMIC_EDGE = false');
  console.log('   3. Для настройки параметров:');
  console.log('      Измените BASE_EDGE, ODDS_MULTIPLIER, ODDS_THRESHOLD в EDGE_CONFIG');
  console.log('   4. Для запуска реального анализа:');
  console.log('      node scripts/real-today-analysis-min-odds.js');
  
  console.log('\n================================================================================');
  console.log('✅ DRY_RUN ЗАВЕРШЁН');
  console.log('================================================================================');
}

// Запуск тестирования
if (require.main === module) {
  runDynamicEdgeDryRun();
}

module.exports = {
  runDynamicEdgeDryRun
};