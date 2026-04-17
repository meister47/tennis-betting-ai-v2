#!/usr/bin/env node

/**
 * Анализатор статистики ставок по покрытию корта
 * Группирует ставки по Grass, Clay, Hard и рассчитывает ROI, Win Rate
 */

const fs = require('fs');
const path = require('path');

// Конфигурация
const BETS_DB_PATH = '/root/.openclaw/workspace/bets-db.json';
const OUTPUT_FORMAT = process.argv.includes('--json') ? 'json' : 'table';
const INCLUDE_UNKNOWN = process.argv.includes('--include-unknown');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

/**
 * Рассчитать статистику для группы ставок
 * @param {Array} bets - Массив ставок
 * @returns {Object} - Статистика
 */
function calculateSurfaceStats(bets) {
  if (!bets || bets.length === 0) {
    return {
      count: 0,
      total_staked: 0,
      total_return: 0,
      total_profit: 0,
      roi: 0,
      won: 0,
      lost: 0,
      pending: 0,
      win_rate: 0,
      avg_odds: 0,
      avg_edge: 0,
      avg_stake: 0
    };
  }
  
  let total_staked = 0;
  let total_return = 0;
  let total_profit = 0;
  let won = 0;
  let lost = 0;
  let pending = 0;
  let total_odds = 0;
  let total_edge = 0;
  let total_stake = 0;
  
  // Рассчитываем только для завершённых ставок
  const settledBets = bets.filter(bet => bet.status === 'settled' && bet.result !== 'pending');
  
  bets.forEach(bet => {
    total_stake += bet.stake || 0;
    
    if (bet.status === 'settled') {
      total_staked += bet.stake || 0;
      total_return += bet.return || 0;
      total_profit += bet.profit || 0;
      total_odds += bet.odds || 0;
      
      if (bet.result === 'won') {
        won++;
      } else if (bet.result === 'lost') {
        lost++;
      }
    } else if (bet.status === 'active') {
      pending++;
    }
  });
  
  const settledCount = settledBets.length;
  const win_rate = settledCount > 0 ? Math.round((won / settledCount) * 100) : 0;
  const roi = total_staked > 0 ? Math.round((total_profit / total_staked) * 10000) / 100 : 0; // в процентах
  const avg_odds = settledCount > 0 ? Math.round((total_odds / settledCount) * 100) / 100 : 0;
  const avg_edge = 0; // Нужно рассчитывать из edge поля если есть
  const avg_stake = bets.length > 0 ? Math.round(total_stake / bets.length) : 0;
  
  return {
    count: bets.length,
    total_staked,
    total_return,
    total_profit,
    roi,
    won,
    lost,
    pending,
    win_rate,
    avg_odds,
    avg_edge,
    avg_stake,
    settled_count: settledCount
  };
}

/**
 * Вывести таблицу статистики
 * @param {Object} stats - Статистика по покрытиям
 */
function printStatsTable(stats) {
  console.log('\n🎾 СТАТИСТИКА СТАВОК ПО ПОКРЫТИЮ КОРТА');
  console.log('================================================================================');
  console.log(`📊 Всего ставок: ${stats.total.count} | Завершено: ${stats.total.settled_count}`);
  console.log(`💰 Общий ROI: ${stats.total.roi.toFixed(2)}% | Win Rate: ${stats.total.win_rate}%`);
  console.log('================================================================================\n');
  
  console.log('┌─────────────────┬──────────┬──────────┬──────────┬────────────┬────────────┬────────────┬────────────┐');
  console.log('│ Поверхность     │ Ставок   │ Завершено│ Win Rate │ ROI (%)    │ Прибыль    │ Сред.коэф.│ Сред.ставка│');
  console.log('├─────────────────┼──────────┼──────────┼──────────┼────────────┼────────────┼────────────┼────────────┤');
  
  const surfaces = ['Grass', 'Clay', 'Hard'];
  if (INCLUDE_UNKNOWN && stats.Unknown && stats.Unknown.count > 0) {
    surfaces.push('Unknown');
  }
  
  surfaces.forEach(surface => {
    const s = stats[surface];
    if (!s || s.count === 0) return;
    
    const settledPercent = s.count > 0 ? Math.round((s.settled_count / s.count) * 100) : 0;
    const profitColor = s.total_profit >= 0 ? '\x1b[32m' : '\x1b[31m'; // Зелёный для прибыли, красный для убытка
    
    console.log(
      `│ ${surface.padEnd(15)} ` +
      `│ ${s.count.toString().padStart(8)} ` +
      `│ ${settledPercent.toString().padStart(8)}% ` +
      `│ ${s.win_rate.toString().padStart(8)}% ` +
      `│ ${s.roi.toFixed(2).padStart(10)}% ` +
      `${profitColor}│ ${s.total_profit.toString().padStart(10)} \x1b[0m` +
      `│ ${s.avg_odds.toFixed(2).padStart(10)} ` +
      `│ ${s.avg_stake.toString().padStart(10)} │`
    );
  });
  
  console.log('└─────────────────┴──────────┴──────────┴──────────┴────────────┴────────────┴────────────┴────────────┘');
  
  // Вывод лучшего покрытия
  const bestSurface = Object.entries(stats)
    .filter(([key]) => surfaces.includes(key))
    .filter(([, s]) => s.settled_count >= 3) // Минимум 3 завершённые ставки
    .sort(([, a], [, b]) => b.roi - a.roi)[0];
  
  if (bestSurface && bestSurface[1].settled_count >= 3) {
    console.log(`\n🏆 ЛУЧШЕЕ ПОКРЫТИЕ: ${bestSurface[0]} (ROI: ${bestSurface[1].roi.toFixed(2)}%, ставок: ${bestSurface[1].settled_count})`);
  }
  
  // Вывод гипотезы по траве (из контекста задачи)
  console.log('\n💡 ГИПОТЕЗА (из исторических данных):');
  console.log('   Трава (Grass): ROI = +9.3% для диапазона коэффициентов 2.5-3.0');
  console.log('   Источник: анализ 6,206 ATP матчей');
  
  // Рекомендации
  console.log('\n📈 РЕКОМЕНДАЦИИ:');
  
  surfaces.forEach(surface => {
    const s = stats[surface];
    if (!s || s.settled_count < 3) return;
    
    if (s.roi > 5) {
      console.log(`   ✅ ${surface}: Продолжать ставить (ROI: +${s.roi.toFixed(1)}%)`);
    } else if (s.roi < -5) {
      console.log(`   ⚠️  ${surface}: Пересмотреть стратегию (ROI: ${s.roi.toFixed(1)}%)`);
    } else {
      console.log(`   📊 ${surface}: Нейтрально (ROI: ${s.roi.toFixed(1)}%)`);
    }
  });
}

/**
 * Вывести детальную информацию по ставкам
 * @param {Object} betsDb - База данных ставок
 * @param {Object} groupedBets - Сгруппированные ставки по покрытиям
 */
function printDetailedInfo(betsDb, groupedBets) {
  console.log('\n🔍 ДЕТАЛЬНАЯ ИНФОРМАЦИЯ:');
  
  Object.entries(groupedBets).forEach(([surface, bets]) => {
    if (!bets || bets.length === 0 || (surface === 'Unknown' && !INCLUDE_UNKNOWN)) return;
    
    console.log(`\n${surface}:`);
    console.log('─'.repeat(80));
    
    const settledBets = bets.filter(bet => bet.status === 'settled');
    const activeBets = bets.filter(bet => bet.status === 'active');
    
    if (settledBets.length > 0) {
      console.log('Завершённые ставки:');
      settledBets.forEach(bet => {
        const result = bet.result === 'won' ? '✅' : '❌';
        console.log(`  ${result} #${bet.id}: ${bet.event.substring(0, 50)}...`);
        console.log(`     Коэф: ${bet.odds} | Ставка: ${bet.stake} | Результат: ${bet.profit >= 0 ? '+' : ''}${bet.profit}`);
      });
    }
    
    if (activeBets.length > 0) {
      console.log('Активные ставки:');
      activeBets.forEach(bet => {
        console.log(`  ⏳ #${bet.id}: ${bet.event.substring(0, 50)}...`);
        console.log(`     Коэф: ${bet.odds} | Ставка: ${bet.stake} | Surface: ${bet.surface || 'Не определено'}`);
      });
    }
  });
}

/**
 * Основная функция
 */
async function main() {
  console.log('📊 Запуск анализатора статистики по покрытию корта');
  console.log(`📁 База данных: ${BETS_DB_PATH}`);
  
  // Проверяем наличие файла
  if (!fs.existsSync(BETS_DB_PATH)) {
    console.error(`❌ Файл не найден: ${BETS_DB_PATH}`);
    console.log(`   Сначала запустите backfill-surface.js для добавления поля surface`);
    process.exit(1);
  }
  
  // Читаем базу данных
  let betsDb;
  try {
    const rawData = fs.readFileSync(BETS_DB_PATH, 'utf8');
    betsDb = JSON.parse(rawData);
    console.log(`✅ База данных загружена: ${betsDb.bets.length} ставок`);
  } catch (err) {
    console.error(`❌ Ошибка чтения файла: ${err.message}`);
    process.exit(1);
  }
  
  // Проверяем наличие поля surface
  const betsWithSurface = betsDb.bets.filter(bet => bet.surface).length;
  const betsWithoutSurface = betsDb.bets.length - betsWithSurface;
  
  console.log(`📈 Состояние поля surface:`);
  console.log(`   С surface: ${betsWithSurface} ставок (${Math.round((betsWithSurface / betsDb.bets.length) * 100)}%)`);
  console.log(`   Без surface: ${betsWithoutSurface} ставок`);
  
  if (betsWithoutSurface > 0) {
    console.log(`\n⚠️  Предупреждение: ${betsWithoutSurface} ставок без поля surface`);
    console.log(`   Запустите: node backfill-surface.js --dry-run для проверки`);
    console.log(`   Затем: node backfill-surface.js для применения изменений`);
  }
  
  // Группируем ставки по покрытию
  const groupedBets = {
    Grass: [],
    Clay: [],
    Hard: [],
    Unknown: []
  };
  
  betsDb.bets.forEach(bet => {
    const surface = bet.surface || 'Unknown';
    
    if (groupedBets[surface]) {
      groupedBets[surface].push(bet);
    } else {
      groupedBets[surface].push(bet); // fallback
    }
  });
  
  // Рассчитываем статистику для каждой группы
  const stats = {};
  
  Object.entries(groupedBets).forEach(([surface, bets]) => {
    if (bets.length > 0) {
      stats[surface] = calculateSurfaceStats(bets);
    }
  });
  
  // Общая статистика
  stats.total = calculateSurfaceStats(betsDb.bets);
  
  // Вывод результатов
  if (OUTPUT_FORMAT === 'json') {
    console.log(JSON.stringify(stats, null, 2));
  } else {
    printStatsTable(stats);
    
    if (VERBOSE) {
      printDetailedInfo(betsDb, groupedBets);
    }
    
    // Дополнительная аналитика
    console.log('\n📈 ДОПОЛНИТЕЛЬНАЯ АНАЛИТИКА:');
    
    // Анализ по диапазонам коэффициентов для травы (если есть данные)
    const grassBets = groupedBets.Grass.filter(bet => bet.status === 'settled');
    if (grassBets.length >= 3) {
      const grassBetsInRange = grassBets.filter(bet => bet.odds >= 2.5 && bet.odds <= 3.0);
      if (grassBetsInRange.length > 0) {
        const grassStats = calculateSurfaceStats(grassBetsInRange);
        console.log(`   Трава (Grass) в диапазоне 2.5-3.0:`);
        console.log(`     Ставок: ${grassStats.count} | ROI: ${grassStats.roi.toFixed(2)}%`);
        console.log(`     Подтверждает гипотезу: ${grassStats.roi > 5 ? '✅' : '❌'}`);
      }
    }
    
    // Рекомендация по сбору данных
    const surfacesWithLowData = Object.entries(groupedBets)
      .filter(([surface, bets]) => {
        const settled = bets.filter(bet => bet.status === 'settled');
        return settled.length < 3 && surface !== 'Unknown';
      })
      .map(([surface]) => surface);
    
    if (surfacesWithLowData.length > 0) {
      console.log(`\n📝 Для точного анализа нужно больше данных:`);
      surfacesWithLowData.forEach(surface => {
        const settled = groupedBets[surface].filter(bet => bet.status === 'settled');
        console.log(`   ${surface}: ${settled.length} завершённых ставок (нужно минимум 3)`);
      });
    }
  }
  
  // Создаём отчётный файл
  const report = {
    generated_at: new Date().toISOString(),
    bets_total: betsDb.bets.length,
    bets_with_surface: betsWithSurface,
    stats: stats
  };
  
  const reportDir = path.join(path.dirname(BETS_DB_PATH), 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.join(reportDir, `surface-analysis-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  console.log(`\n📄 Полный отчёт сохранён: ${reportPath}`);
  console.log(`\n🎉 Анализ завершён!`);
}

// Запуск
main().catch(err => {
  console.error(`❌ Непредвиденная ошибка: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});