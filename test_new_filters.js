#!/usr/bin/env node

/**
 * Тестирование новых фильтров на основе анализа 2644 матчей ATP 2025
 */

const HistoricalOptimizations = require('./config/historical-optimizations.js');

console.log('🧪 ТЕСТИРОВАНИЕ НОВЫХ ФИЛЬТРОВ');
console.log('='.repeat(60));

// Тест 1: Проверка функции getPlayerRank
console.log('\n📊 ТЕСТ 1: getPlayerRank()');
console.log('-'.repeat(40));

const testPlayers = [
  'Novak Djokovic',
  'Rafael Nadal',  // Должен вернуть 999 (не в справочнике)
  'Iga Swiatek',
  'Unknown Player'
];

for (const player of testPlayers) {
  const rank = HistoricalOptimizations.getPlayerRank(player);
  console.log(`  ${player}: ${rank}`);
}

// Тест 2: Проверка функции applyAdditionalFilters
console.log('\n📊 ТЕСТ 2: applyAdditionalFilters()');
console.log('-'.repeat(40));

const testMatches = [
  {
    name: 'Топ-игрок vs Топ-игрок',
    matchData: {
      player1: { name: 'Novak Djokovic', rank: 1 },
      player2: { name: 'Jannik Sinner', rank: 2 },
      tournament: { name: 'ATP Masters 1000', tier: 'Masters 1000' }
    },
    odds: 2.1
  },
  {
    name: 'Низкий рейтинг',
    matchData: {
      player1: { name: 'Unknown Player 1', rank: 150 },
      player2: { name: 'Unknown Player 2', rank: 200 },
      tournament: { name: 'Challenger', tier: 'Challenger' }
    },
    odds: 3.5
  },
  {
    name: 'Разница в рейтинге > 50',
    matchData: {
      player1: { name: 'Novak Djokovic', rank: 1 },
      player2: { name: 'Qualifier', rank: 300 },
      tournament: { name: 'ATP 250', tier: 'ATP 250' }
    },
    odds: 1.5
  },
  {
    name: 'Коэффициент вне оптимального диапазона',
    matchData: {
      player1: { name: 'Taylor Fritz', rank: 9 },
      player2: { name: 'Holger Rune', rank: 10 },
      tournament: { name: 'ATP 500', tier: 'ATP 500' }
    },
    odds: 3.2  // > 2.3
  }
];

for (const test of testMatches) {
  const result = HistoricalOptimizations.applyAdditionalFilters(
    test.matchData, 
    test.odds, 
    test.matchData.player1.name
  );
  
  console.log(`\n  ${test.name}:`);
  console.log(`    Статус: ${result.allowed ? '✅ РАЗРЕШЕНО' : '❌ ЗАБЛОКИРОВАНО'}`);
  if (!result.allowed) {
    console.log(`    Причина: ${result.reason}`);
    console.log(`    Фильтр: ${result.filter}`);
  }
}

// Тест 3: Проверка конфигурации
console.log('\n📊 ТЕСТ 3: Конфигурация ADDITIONAL_FILTERS');
console.log('-'.repeat(40));

const { ADDITIONAL_FILTERS } = HistoricalOptimizations;
console.log(`  MAX_RANK: ${ADDITIONAL_FILTERS.MAX_RANK}`);
console.log(`  MAX_RANK_DIFF: ${ADDITIONAL_FILTERS.MAX_RANK_DIFF}`);
console.log(`  Оптимальный диапазон: ${ADDITIONAL_FILTERS.OPTIMAL_ODDS_RANGE.MIN}-${ADDITIONAL_FILTERS.OPTIMAL_ODDS_RANGE.MAX}`);
console.log(`  Категории турниров: ${ADDITIONAL_FILTERS.ALLOWED_TOURNAMENT_TIERS.join(', ')}`);

console.log('\n  Включенные фильтры:');
for (const [filter, enabled] of Object.entries(ADDITIONAL_FILTERS.ENABLED)) {
  console.log(`    ${filter}: ${enabled ? '✅' : '❌'}`);
}

// Тест 4: Проверка логирования статистики
console.log('\n📊 ТЕСТ 4: logFilterStats()');
console.log('-'.repeat(40));

const testStats = {
  total_analyzed: 100,
  total_passed: 25,
  total_blocked: 75,
  rank_filter: 20,
  tournament_tier_filter: 15,
  rank_diff_filter: 10,
  optimal_odds_filter: 12,
  min_odds_filter: 8,
  max_odds_filter: 5,
  edge_filter: 3,
  probability_filter: 2
};

HistoricalOptimizations.logFilterStats(testStats);

console.log('\n✅ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');