const h = require('../config/historical-optimizations.js');

// Тестируем множители
console.log('🔍 ТЕСТИРОВАНИЕ МНОЖИТЕЛЕЙ:');
console.log('===========================');

const testCases = [
  { odds: 1.8, surface: 'Grass', tournament: 'ATP 250' },
  { odds: 2.3, surface: 'Clay', tournament: 'ATP 500' },
  { odds: 2.7, surface: 'Hard', tournament: 'Masters 1000' },
  { odds: 3.2, surface: 'Grass', tournament: 'Grand Slam' },
  { odds: 4.5, surface: 'Hard', tournament: 'ATP 250' }
];

testCases.forEach((tc, i) => {
  const confidence = h.calculateConfidence(0.5, tc.odds, tc.surface, tc.tournament);
  console.log(`Test ${i+1}: ${tc.odds} @ ${tc.surface} (${tc.tournament})`);
  console.log(`  Множители: odds=${confidence.multipliers.odds}, surface=${confidence.multipliers.surface}, tournament=${confidence.multipliers.tournament}`);
  console.log(`  Уверенность: raw=${(confidence.raw*100).toFixed(1)}% → adjusted=${(confidence.adjusted*100).toFixed(1)}%`);
  console.log('---');
});

console.log('✅ Тест множителей пройден!');