#!/usr/bin/env node

/**
 * Скрипт для добавления поля surface к существующим ставкам в bets-db.json
 * Определяет покрытие корта по турниру из названия ставки
 */

const fs = require('fs');
const path = require('path');
const SurfaceDetector = require('./surface-detector.js');

// Конфигурация
const BETS_DB_PATH = '/root/.openclaw/workspace/bets-db.json';
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Справочник турниров для определения покрытия (расширенная версия)
const TOURNAMENT_SURFACE_MAP = {
  // Grand Slams
  'Wimbledon': 'Grass',
  'Roland Garros': 'Clay',
  'French Open': 'Clay',
  'US Open': 'Hard',
  'Australian Open': 'Hard',
  
  // ATP Masters 1000
  'Monte-Carlo Masters': 'Clay',
  'Monte Carlo Masters': 'Clay',
  'Monte Carlo': 'Clay',
  'Monte Carlo Open': 'Clay',
  'Madrid Open': 'Clay',
  'Rome Masters': 'Clay',
  'Rome': 'Clay',
  'Italian Open': 'Clay',
  'Indian Wells': 'Hard',
  'Miami Open': 'Hard',
  'Miami': 'Hard',
  'Canadian Open': 'Hard',
  'Canada': 'Hard',
  'Cincinnati Masters': 'Hard',
  'Cincinnati': 'Hard',
  'Shanghai Masters': 'Hard',
  'Shanghai': 'Hard',
  'Paris Masters': 'Hard',
  'Paris': 'Hard',
  
  // ATP 500
  'ATP Barcelona': 'Clay',
  'Barcelona': 'Clay',
  'ATP Munich': 'Clay',
  'Munich': 'Clay',
  'ATP Houston': 'Clay',
  'Houston': 'Clay',
  'ATP Stuttgart': 'Grass',
  'Stuttgart': 'Grass',
  'ATP Halle': 'Grass',
  'Halle': 'Grass',
  "ATP Queen's": 'Grass',
  "Queen's": 'Grass',
  'ATP Queen\'s Club': 'Grass',
  'ATP Newport': 'Grass',
  'Newport': 'Grass',
  'ATP Washington': 'Hard',
  'Washington': 'Hard',
  'ATP Tokyo': 'Hard',
  'Tokyo': 'Hard',
  'ATP Vienna': 'Hard',
  'Vienna': 'Hard',
  'ATP Basel': 'Hard',
  'Basel': 'Hard',
  
  // WTA
  'WTA Stuttgart': 'Clay',
  'WTA Charleston': 'Clay',
  'WTA Madrid': 'Clay',
  'WTA Rome': 'Clay',
  'WTA Eastbourne': 'Grass',
  'WTA Birmingham': 'Grass',
  
  // Ключевые слова
  'Open': 'Hard', // по умолчанию для Open турниров
  'Masters': 'Clay', // по умолчанию для Masters
  'Championship': 'Hard'
};

/**
 * Извлечь название турнира из события в базе данных
 * @param {Object} bet - Ставка из bets-db.json
 * @returns {string} - Название турнира
 */
function extractTournamentFromBet(bet) {
  if (!bet.event) return null;
  
  const event = bet.event.toLowerCase();
  
  // Проверяем точные совпадения
  for (const tournament in TOURNAMENT_SURFACE_MAP) {
    if (event.includes(tournament.toLowerCase())) {
      return tournament;
    }
  }
  
  // Проверяем ключевые слова
  if (event.includes('wimbledon') || event.includes('wimb')) {
    return 'Wimbledon';
  }
  
  if (event.includes('french') || event.includes('roland') || event.includes('paris')) {
    return 'French Open';
  }
  
  if (event.includes('australian') || event.includes('melbourne')) {
    return 'Australian Open';
  }
  
  if (event.includes('us open') || event.includes('flushing')) {
    return 'US Open';
  }
  
  if (event.includes('monte carlo') || event.includes('monte-carlo')) {
    return 'Monte Carlo Masters';
  }
  
  if (event.includes('barcelona')) {
    return 'ATP Barcelona';
  }
  
  if (event.includes('munich')) {
    return 'ATP Munich';
  }
  
  if (event.includes('stuttgart')) {
    return 'ATP Stuttgart';
  }
  
  if (event.includes('halle')) {
    return 'ATP Halle';
  }
  
  if (event.includes('queen') || event.includes("queen's")) {
    return "ATP Queen's";
  }
  
  // Если есть упоминание "ATP" или "WTA", вероятно хард
  if (event.includes('atp') || event.includes('wta')) {
    return 'ATP'; // generic
  }
  
  return null;
}

/**
 * Определить покрытие для ставки
 * @param {Object} bet - Ставка из bets-db.json
 * @returns {string} - Покрытие: 'Grass', 'Clay', 'Hard', 'Unknown'
 */
function determineSurfaceForBet(bet) {
  // 1. Попробовать определить по турниру
  const tournament = extractTournamentFromBet(bet);
  
  if (tournament && TOURNAMENT_SURFACE_MAP[tournament]) {
    if (VERBOSE) console.log(`  ✅ Турнир найден: "${tournament}" -> ${TOURNAMENT_SURFACE_MAP[tournament]}`);
    return TOURNAMENT_SURFACE_MAP[tournament];
  }
  
  // 2. Попробовать определить по SurfaceDetector (если можем создать mock event)
  try {
    // Создаём mock event для SurfaceDetector
    const mockEvent = {
      sport_title: bet.event || '',
      sport_key: bet.event.toLowerCase().includes('atp') ? 'tennis_atp' : 'tennis',
      home_team: '',
      away_team: ''
    };
    
    // Извлекаем имена из события если есть "vs"
    const eventParts = bet.event.split('vs');
    if (eventParts.length === 2) {
      mockEvent.home_team = eventParts[0].trim();
      mockEvent.away_team = eventParts[1].trim().split(':')[0].trim(); // удаляем всё после ":"
    }
    
    const surface = SurfaceDetector.detectSurface(mockEvent);
    if (surface !== 'Unknown') {
      if (VERBOSE) console.log(`  ✅ SurfaceDetector определил: ${surface}`);
      return surface;
    }
  } catch (err) {
    if (VERBOSE) console.log(`  ⚠️  Ошибка SurfaceDetector: ${err.message}`);
  }
  
  // 3. Анализ по ключевым словам в event
  const eventLower = bet.event.toLowerCase();
  
  if (eventLower.includes('grass') || eventLower.includes('wimbledon') || 
      eventLower.includes('halle') || eventLower.includes('queen') ||
      eventLower.includes('stuttgart') || eventLower.includes('newport')) {
    if (VERBOSE) console.log(`  ✅ Ключевое слово "grass" найдено`);
    return 'Grass';
  }
  
  if (eventLower.includes('clay') || eventLower.includes('french') || 
      eventLower.includes('roland') || eventLower.includes('monte carlo') ||
      eventLower.includes('barcelona') || eventLower.includes('rome') ||
      eventLower.includes('madrid') || eventLower.includes('houston')) {
    if (VERBOSE) console.log(`  ✅ Ключевое слово "clay" найдено`);
    return 'Clay';
  }
  
  if (eventLower.includes('hard') || eventLower.includes('indoor') ||
      eventLower.includes('outdoor') || eventLower.includes('australian') ||
      eventLower.includes('us open') || eventLower.includes('indian wells') ||
      eventLower.includes('miami') || eventLower.includes('canada') ||
      eventLower.includes('cincinnati') || eventLower.includes('shanghai') ||
      eventLower.includes('paris') || eventLower.includes('tokyo') ||
      eventLower.includes('vienna') || eventLower.includes('basel')) {
    if (VERBOSE) console.log(`  ✅ Ключевое слово "hard" найдено`);
    return 'Hard';
  }
  
  // 4. Если есть заметки (notes), проверить их
  if (bet.notes) {
    const notesLower = bet.notes.toLowerCase();
    if (notesLower.includes('grass')) return 'Grass';
    if (notesLower.includes('clay')) return 'Clay';
    if (notesLower.includes('hard')) return 'Hard';
  }
  
  if (VERBOSE) console.log(`  ❓ Не удалось определить покрытие`);
  return 'Unknown';
}

/**
 * Основная функция
 */
async function main() {
  console.log('🔄 Запуск backfill-surface.js');
  console.log(`📊 Режим: ${DRY_RUN ? 'DRY RUN (изменения не сохраняются)' : 'PRODUCTION (изменения сохраняются)'}`);
  console.log(`🗣️  Подробный вывод: ${VERBOSE ? 'ВКЛ' : 'ВЫКЛ'}`);
  
  // Читаем базу данных
  if (!fs.existsSync(BETS_DB_PATH)) {
    console.error(`❌ Файл не найден: ${BETS_DB_PATH}`);
    process.exit(1);
  }
  
  let betsDb;
  try {
    const rawData = fs.readFileSync(BETS_DB_PATH, 'utf8');
    betsDb = JSON.parse(rawData);
    console.log(`✅ База данных загружена: ${betsDb.bets.length} ставок`);
  } catch (err) {
    console.error(`❌ Ошибка чтения файла: ${err.message}`);
    process.exit(1);
  }
  
  // Анализируем текущее состояние
  let betsWithSurface = 0;
  let betsWithoutSurface = 0;
  
  betsDb.bets.forEach(bet => {
    if (bet.surface) {
      betsWithSurface++;
    } else {
      betsWithoutSurface++;
    }
  });
  
  console.log(`📈 Текущее состояние:`);
  console.log(`   С surface: ${betsWithSurface} ставок`);
  console.log(`   Без surface: ${betsWithoutSurface} ставок`);
  
  if (betsWithoutSurface === 0) {
    console.log('✅ Все ставки уже имеют поле surface');
    return;
  }
  
  console.log(`\n🔍 Определяем покрытие для ${betsWithoutSurface} ставок...`);
  
  // Обновляем ставки
  const updates = [];
  const unknownSurfaceBets = [];
  
  for (const bet of betsDb.bets) {
    if (bet.surface) {
      continue; // Уже есть surface
    }
    
    if (VERBOSE) console.log(`\n📝 Ставка #${bet.id}: "${bet.event}"`);
    
    const surface = determineSurfaceForBet(bet);
    
    if (VERBOSE) console.log(`   Результат: ${surface}`);
    
    updates.push({
      id: bet.id,
      old: bet.surface,
      new: surface,
      event: bet.event
    });
    
    // В DRY_RUN не изменяем объект
    if (!DRY_RUN) {
      bet.surface = surface;
    }
    
    if (surface === 'Unknown') {
      unknownSurfaceBets.push(bet.id);
    }
  }
  
  // Выводим статистику
  console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
  console.log(`   Обновлено ставок: ${updates.length}`);
  
  const surfaceStats = {
    Grass: 0,
    Clay: 0,
    Hard: 0,
    Unknown: 0
  };
  
  updates.forEach(update => {
    surfaceStats[update.new]++;
  });
  
  console.log(`   Распределение по покрытиям:`);
  for (const [surface, count] of Object.entries(surfaceStats)) {
    if (count > 0) {
      const percentage = Math.round((count / updates.length) * 100);
      console.log(`     ${surface}: ${count} (${percentage}%)`);
    }
  }
  
  if (unknownSurfaceBets.length > 0) {
    console.log(`\n⚠️  Не удалось определить покрытие для ставок: ${unknownSurfaceBets.join(', ')}`);
    console.log(`   Рекомендация: Проверить эти ставки вручную`);
  }
  
  // Сохраняем изменения (если не DRY_RUN)
  if (!DRY_RUN) {
    // Обновляем время последнего изменения
    betsDb.updated_at = new Date().toISOString();
    
    try {
      const backupPath = BETS_DB_PATH + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(backupPath, JSON.stringify(betsDb, null, 2), 'utf8');
      console.log(`✅ Создан бэкап: ${backupPath}`);
      
      fs.writeFileSync(BETS_DB_PATH, JSON.stringify(betsDb, null, 2), 'utf8');
      console.log(`✅ База данных сохранена: ${BETS_DB_PATH}`);
    } catch (err) {
      console.error(`❌ Ошибка сохранения: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(`\n⚠️  DRY RUN: изменения не сохранены`);
    console.log(`   Для применения изменений запустите без --dry-run`);
    
    // Показываем пример обновлений
    if (VERBOSE && updates.length > 0) {
      console.log(`\n📋 Пример обновлений (первые 5):`);
      updates.slice(0, 5).forEach(update => {
        console.log(`   #${update.id}: "${update.event.substring(0, 40)}..." -> ${update.new}`);
      });
    }
  }
  
  // Создаём отчёт
  const report = {
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    total_bets: betsDb.bets.length,
    updated: updates.length,
    surface_stats: surfaceStats,
    unknown_bets: unknownSurfaceBets,
    detection_rate: Math.round(((updates.length - surfaceStats.Unknown) / updates.length) * 100)
  };
  
  const reportPath = path.join(path.dirname(BETS_DB_PATH), 'surface-backfill-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 Отчёт сохранён: ${reportPath}`);
  
  console.log(`\n🎉 Backfill завершён!`);
}

// Запуск
main().catch(err => {
  console.error(`❌ Непредвиденная ошибка: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});