/**
 * Конфигурация оптимизаций на основе исторического анализа 6,206 матчей ATP (2024-2026)
 * Результаты бэктеста на 12,402 ставках:
 * - Диапазон 2.5-3.0: ROI +2.7%, Win Rate 38.2% → ОПТИМАЛЬНЫЙ
 * - Диапазон <2.0: ROI -0.6% → Без прибыли
 * - Диапазон 2.0-2.5: ROI -2.8% → Убыточный
 * - Диапазон 3.0+: ROI -5.4% → Убыточный
 * - Лучшая поверхность: Трава (ROI +9.3% для 2.5-3.0)
 * - Лучшие турниры: Masters 1000 (все диапазоны +ROI)
 * - Худшие для андердогов: Grand Slam (ROI -14.3% для 3.0+)
 */

// Флаг для постепенного внедрения
const USE_HISTORICAL_OPTIMIZATIONS = true;

// Конфигурация коэффициентов на основе исторических данных
const ODDS_CONFIG = {
  // Старые значения (для отката)
  OLD_MIN_ODDS: 1.5,
  OLD_MAX_ODDS: 4.0,
  
  // Новые значения на основе анализа
  MIN_ODDS: 2.5,           // Было 1.5 → меняем на 2.5
  MAX_ODDS: 3.0,           // НОВОЕ: Было 10.0 → режем до 3.0 (анализ 15 ставок)
  SWEET_SPOT: {
    MIN: 2.5,
    MAX: 3.0,
    CONFIDENCE_BOOST: 1.2  // +20% уверенности для оптимального диапазона
  },
  UNDERDOG_PENALTY: {
    THRESHOLD: 2.8,        // НОВОЕ: Было 3.0 → снижаем до 2.8 (анализ проигрышей)
    CONFIDENCE_PENALTY: 0.6 // НОВОЕ: Было 0.7 → усиление -40% уверенности
  }
};

// Множители для поверхностей на основе ROI
const SURFACE_BOOST = {
  'Grass': 1.15,    // ROI +9.3% → +15% уверенности
  'Clay': 1.05,     // ROI +2.1% → +5% уверенности
  'Hard': 1.0,      // Базовый уровень
  'Carpet': 0.95    // Реже используется, меньше данных
};

// Множители для турниров на основе исторической прибыльности
const TOURNAMENT_BOOST = {
  'Masters 1000': 1.10,    // Все диапазоны +ROI → +10% уверенности
  'ATP 500': 1.05,         // Средняя прибыльность → +5% уверенности
  'ATP 250': 1.0,          // Базовый уровень
  'Grand Slam': 0.85,      // Худшие для андердогов → -15% уверенности
  'Challenger': 0.9,       // Меньше данных, более волатильно → -10% уверенности
  'ITF': 0.8               // Наименее предсказуемо → -20% уверенности
};

// Специальные ограничения для турниров
const TOURNAMENT_SPECIAL_RULES = {
  'Grand Slam': {
    MAX_ODDS: 2.8,         // Максимальный коэффициент для Grand Slam
    ALLOW_UNDERDOGS: false // Не ставить на андердогов
  },
  'Masters 1000': {
    ALLOW_ALL_RANGES: true,
    CONFIDENCE_BOOST: 1.1
  }
};

// НОВОЕ: Запрет ставок против топ-игроков (анализ 15 ставок показал 6 проигрышей из-за этого)
const TOP_PLAYERS_BLACKLIST = {
  'ATP': [
    // Топ-10 ATP (апрель 2026)
    'Novak Djokovic',
    'Carlos Alcaraz',
    'Jannik Sinner',
    'Daniil Medvedev',
    'Alexander Zverev',      // НОВОЕ: Дал проигрыш в ID 13
    'Andrey Rublev',
    'Casper Ruud',
    'Stefanos Tsitsipas',
    'Hubert Hurkacz',
    'Karen Khachanov',       // НОВОЕ: Дал проигрыш в ID 10
    'Taylor Fritz',
    'Holger Rune',
    'Alex de Minaur',        // НОВОЕ: Дал проигрыш в ID 7
    'Ben Shelton',           // НОВОЕ: Проиграл Фонсеке, но всё равно сильный игрок
    
    // Другие сильные игроки, против которых проигрывали
    'Denis Shapovalov',      // НОВОЕ: Дал проигрыш в ID 6
    'Lorenzo Sonego',        // НОВОЕ: Дал проигрыш в ID 9
    'Francisco Cerundolo'    // НОВОЕ: Хотя Зверев был фаворитом в ID 13
  ],
  'WTA': [
    'Iga Swiatek',
    'Aryna Sabalenka',
    'Coco Gauff',
    'Elena Rybakina',
    'Jessica Pegula',
    'Ons Jabeur',
    'Marketa Vondrousova',
    'Maria Sakkari',
    'Karolina Muchova',      // НОВОЕ: Выиграла, но всё равно топ-игрок
    'Madison Keys'
  ],
  
  // Функция проверки (улучшенная для частичных совпадений)
  isTopPlayer: function(playerName) {
    if (!playerName) return false;
    
    const normalized = playerName.toLowerCase().trim();
    
    // Сначала проверяем точные совпадения по фамилии
    const playerParts = normalized.split(/[\s\.]+/);
    const lastName = playerParts[playerParts.length - 1];
    
    // Проверяем ATP
    for (const topPlayer of this.ATP) {
      const topPlayerLower = topPlayer.toLowerCase();
      const topPlayerParts = topPlayerLower.split(/[\s\.]+/);
      const topLastName = topPlayerParts[topPlayerParts.length - 1];
      
      // Проверяем по фамилии или полному имени
      if (normalized.includes(topPlayerLower) || 
          normalized.includes(topLastName) ||
          topPlayerLower.includes(lastName)) {
        return true;
      }
    }
    
    // Проверяем WTA
    for (const topPlayer of this.WTA) {
      const topPlayerLower = topPlayer.toLowerCase();
      const topPlayerParts = topPlayerLower.split(/[\s\.]+/);
      const topLastName = topPlayerParts[topPlayerParts.length - 1];
      
      if (normalized.includes(topPlayerLower) || 
          normalized.includes(topLastName) ||
          topPlayerLower.includes(lastName)) {
        return true;
      }
    }
    
    return false;
  },
  
  // Получить причину блокировки
  getBlockReason: function(playerName) {
    if (!playerName) return 'Неизвестный игрок';
    
    const normalized = playerName.toLowerCase().trim();
    const playerParts = normalized.split(/[\s\.]+/);
    const lastName = playerParts[playerParts.length - 1];
    
    // Ищем по фамилии в ATP
    for (const topPlayer of this.ATP) {
      const topPlayerLower = topPlayer.toLowerCase();
      const topPlayerParts = topPlayerLower.split(/[\s\.]+/);
      const topLastName = topPlayerParts[topPlayerParts.length - 1];
      
      if (normalized.includes(topPlayerLower) || 
          normalized.includes(topLastName) ||
          topPlayerLower.includes(lastName)) {
        return `Ставка против топ-игрока ATP: ${topPlayer}`;
      }
    }
    
    // Ищем по фамилии в WTA
    for (const topPlayer of this.WTA) {
      const topPlayerLower = topPlayer.toLowerCase();
      const topPlayerParts = topPlayerLower.split(/[\s\.]+/);
      const topLastName = topPlayerParts[topPlayerParts.length - 1];
      
      if (normalized.includes(topPlayerLower) || 
          normalized.includes(topLastName) ||
          topPlayerLower.includes(lastName)) {
        return `Ставка против топ-игрока WTA: ${topPlayer}`;
      }
    }
    
    return `Ставка против сильного игрока: ${playerName}`;
  }
};

// Функции для расчёта множителей на основе конфигурации
function calculateOddsMultiplier(odds) {
  if (!USE_HISTORICAL_OPTIMIZATIONS) return 1.0;
  
  const config = ODDS_CONFIG;
  
  // Оптимальный диапазон 2.5-3.0
  if (odds >= config.SWEET_SPOT.MIN && odds <= config.SWEET_SPOT.MAX) {
    return config.SWEET_SPOT.CONFIDENCE_BOOST;
  }
  
  // Андердоги >3.0
  if (odds > config.UNDERDOG_PENALTY.THRESHOLD) {
    return config.UNDERDOG_PENALTY.CONFIDENCE_PENALTY;
  }
  
  // Диапазон 2.0-2.5 (убыточный по историческим данным)
  if (odds >= 2.0 && odds < 2.5) {
    return 0.9; // -10% уверенности
  }
  
  // Диапазон <2.0 (без прибыли)
  if (odds < 2.0) {
    return 0.95; // -5% уверенности
  }
  
  return 1.0;
}

function calculateSurfaceMultiplier(surface) {
  if (!USE_HISTORICAL_OPTIMIZATIONS || !surface) return 1.0;
  
  // Приводим к стандартному формату
  const normalizedSurface = surface.toLowerCase();
  
  if (normalizedSurface.includes('grass')) return SURFACE_BOOST.Grass;
  if (normalizedSurface.includes('clay')) return SURFACE_BOOST.Clay;
  if (normalizedSurface.includes('hard')) return SURFACE_BOOST.Hard;
  if (normalizedSurface.includes('carpet')) return SURFACE_BOOST.Carpet;
  
  return SURFACE_BOOST.Hard; // По умолчанию Hard
}

function calculateTournamentMultiplier(tournamentName) {
  if (!USE_HISTORICAL_OPTIMIZATIONS || !tournamentName) return 1.0;
  
  const name = tournamentName.toLowerCase();
  
  // Определяем уровень турнира
  if (name.includes('masters') || name.includes('1000')) return TOURNAMENT_BOOST['Masters 1000'];
  if (name.includes('500')) return TOURNAMENT_BOOST['ATP 500'];
  if (name.includes('250')) return TOURNAMENT_BOOST['ATP 250'];
  if (name.includes('grand slam') || name.includes('wimbledon') || 
      name.includes('us open') || name.includes('australian open') || 
      name.includes('roland garros') || name.includes('french open')) {
    return TOURNAMENT_BOOST['Grand Slam'];
  }
  if (name.includes('challenger')) return TOURNAMENT_BOOST.Challenger;
  if (name.includes('itf') || name.includes('future')) return TOURNAMENT_BOOST.ITF;
  
  return TOURNAMENT_BOOST['ATP 250']; // По умолчанию ATP 250
}

function checkTournamentSpecialRules(tournamentName, odds) {
  if (!USE_HISTORICAL_OPTIMIZATIONS || !tournamentName) return true;
  
  const name = tournamentName.toLowerCase();
  
  // Проверяем правила для Grand Slam
  if (name.includes('grand slam') || name.includes('wimbledon') || 
      name.includes('us open') || name.includes('australian open') || 
      name.includes('roland garros') || name.includes('french open')) {
    
    const rule = TOURNAMENT_SPECIAL_RULES['Grand Slam'];
    
    // Проверка максимального коэффициента
    if (odds > rule.MAX_ODDS) {
      return {
        allowed: false,
        reason: `Grand Slam + высокий коэффициент (${odds}) - исторически убыточно`
      };
    }
    
    // Проверка андердогов
    if (!rule.ALLOW_UNDERDOGS && odds > ODDS_CONFIG.UNDERDOG_PENALTY.THRESHOLD) {
      return {
        allowed: false,
        reason: `Grand Slam + андердог (${odds}) - исторически убыточно`
      };
    }
  }
  
  return { allowed: true };
}

// НОВОЕ: Проверка игроков (анализ 15 ставок показал 6 проигрышей из-за ставок против топ-игроков)
function checkPlayerRestrictions(playerName, opponentName, odds) {
  if (!USE_HISTORICAL_OPTIMIZATIONS) return { allowed: true };
  
  // 1. Проверяем, не ставим ли мы против топ-игрока (ГЛАВНОЕ ПРАВИЛО!)
  if (TOP_PLAYERS_BLACKLIST.isTopPlayer(opponentName)) {
    return {
      allowed: false,
      reason: TOP_PLAYERS_BLACKLIST.getBlockReason(opponentName) + ` (коэф ${odds})`
    };
  }
  
  // 2. Проверяем, не ставим ли мы на топ-игрока с низким коэф (< 2.0) — обычно невыгодно
  if (TOP_PLAYERS_BLACKLIST.isTopPlayer(playerName) && odds < 2.0) {
    return {
      allowed: false,
      reason: `Топ-игрок ${playerName} с низким коэффициентом ${odds} (< 2.0)`
    };
  }
  
  // 3. Проверяем максимальный коэффициент (абсолютный лимит)
  if (odds > ODDS_CONFIG.MAX_ODDS) {
    return {
      allowed: false,
      reason: `Коэффициент ${odds} превышает максимальный ${ODDS_CONFIG.MAX_ODDS}`
    };
  }
  
  // 4. Проверяем андердогов (коэф > 2.8)
  if (odds > ODDS_CONFIG.UNDERDOG_PENALTY.THRESHOLD) {
    return {
      allowed: false,
      reason: `Андердог с коэффициентом ${odds} (порог ${ODDS_CONFIG.UNDERDOG_PENALTY.THRESHOLD})`
    };
  }
  
  return { allowed: true };
}

// Главная функция для расчёта итоговой уверенности
function calculateConfidence(baseConfidence, odds, surface, tournamentName, playerName = '', opponentName = '') {
  if (!USE_HISTORICAL_OPTIMIZATIONS) {
    return {
      raw: baseConfidence,
      adjusted: baseConfidence,
      multipliers: {
        odds: 1.0,
        surface: 1.0,
        tournament: 1.0
      }
    };
  }
  
  // НОВОЕ: Проверяем ограничения по игрокам
  const playerCheck = checkPlayerRestrictions(playerName, opponentName, odds);
  if (!playerCheck.allowed) {
    return {
      raw: baseConfidence,
      adjusted: 0, // Нулевая уверенность, если правила нарушены
      multipliers: {
        odds: 0,
        surface: 0,
        tournament: 0
      },
      blockedBy: playerCheck.reason
    };
  }
  
  // Проверяем специальные правила турнира
  const tournamentCheck = checkTournamentSpecialRules(tournamentName, odds);
  if (!tournamentCheck.allowed) {
    return {
      raw: baseConfidence,
      adjusted: 0, // Нулевая уверенность, если правила нарушены
      multipliers: {
        odds: 0,
        surface: 0,
        tournament: 0
      },
      blockedBy: tournamentCheck.reason
    };
  }
  
  // Рассчитываем множители
  const oddsMultiplier = calculateOddsMultiplier(odds);
  const surfaceMultiplier = calculateSurfaceMultiplier(surface);
  const tournamentMultiplier = calculateTournamentMultiplier(tournamentName);
  
  // Итоговая уверенность
  const adjustedConfidence = baseConfidence * oddsMultiplier * surfaceMultiplier * tournamentMultiplier;
  
  return {
    raw: baseConfidence,
    adjusted: adjustedConfidence,
    multipliers: {
      odds: oddsMultiplier,
      surface: surfaceMultiplier,
      tournament: tournamentMultiplier
    },
    oddsRange: getOddsRangeDescription(odds),
    surface: surface || 'Unknown',
    tournamentTier: getTournamentTier(tournamentName),
    playerCheck: playerCheck.allowed ? 'OK' : playerCheck.reason
  };
}

// Вспомогательные функции
function getOddsRangeDescription(odds) {
  if (odds < 2.0) return '<2.0';
  if (odds >= 2.0 && odds < 2.5) return '2.0-2.5';
  if (odds >= 2.5 && odds <= 3.0) return '2.5-3.0';
  if (odds > 3.0 && odds <= 4.0) return '3.0-4.0';
  return '>4.0';
}

function getTournamentTier(tournamentName) {
  if (!tournamentName) return 'Unknown';
  
  const name = tournamentName.toLowerCase();
  
  if (name.includes('masters') || name.includes('1000')) return 'Masters 1000';
  if (name.includes('500')) return 'ATP 500';
  if (name.includes('250')) return 'ATP 250';
  if (name.includes('grand slam') || name.includes('wimbledon') || 
      name.includes('us open') || name.includes('australian open') || 
      name.includes('roland garros') || name.includes('french open')) {
    return 'Grand Slam';
  }
  if (name.includes('challenger')) return 'Challenger';
  if (name.includes('itf') || name.includes('future')) return 'ITF';
  
  return 'Unknown';
}

// Функция для логирования множителей
function logConfidenceDetails(confidenceData, matchDetails) {
  if (!USE_HISTORICAL_OPTIMIZATIONS) return;
  
  const { raw, adjusted, multipliers, oddsRange, surface, tournamentTier } = confidenceData;
  
  console.log(`[INFO] ${matchDetails}`);
  console.log(`  Odds: ${matchDetails.odds} (${oddsRange}) → ${formatMultiplier(multipliers.odds)}`);
  
  if (surface && surface !== 'Unknown') {
    console.log(`  Surface: ${surface} → ${formatMultiplier(multipliers.surface)}`);
  }
  
  if (tournamentTier && tournamentTier !== 'Unknown') {
    console.log(`  Tournament: ${tournamentTier} → ${formatMultiplier(multipliers.tournament)}`);
  }
  
  console.log(`  Final confidence: ${(adjusted * 100).toFixed(1)}% (raw: ${(raw * 100).toFixed(1)}%)\n`);
}

function formatMultiplier(multiplier) {
  if (multiplier > 1.0) {
    return `+${((multiplier - 1.0) * 100).toFixed(0)}% confidence`;
  } else if (multiplier < 1.0) {
    return `-${((1.0 - multiplier) * 100).toFixed(0)}% confidence`;
  }
  return `no change`;
}

// ================== НОВЫЕ ФИЛЬТРЫ НА ОСНОВЕ АНАЛИЗА 2644 МАТЧЕЙ ATP 2025 ==================
// Результаты анализа: текущие правила дают ROI -8.0%, нужны дополнительные фильтры

// Флаг включения/отключения дополнительных фильтров
const ADDITIONAL_FILTERS_ENABLED = process.env.ADDITIONAL_FILTERS_ENABLED === 'true' || false;

// Конфигурация дополнительных фильтров
const ADDITIONAL_FILTERS = {
  // Общий флаг включения/отключения всех фильтров
  GLOBAL_ENABLED: ADDITIONAL_FILTERS_ENABLED,
  
  // Минимальный рейтинг игрока (ATP топ-100)
  MAX_RANK: 100,
  
  // Разрешённые категории турниров
  ALLOWED_TOURNAMENT_TIERS: ['ATP 250', 'ATP 500', 'Masters 1000', 'Grand Slam'],
  
  // Максимальная разница в рейтинге (по модулю)
  MAX_RANK_DIFF: 50,
  
  // Оптимальный диапазон коэффициентов на основе ROI анализа
  OPTIMAL_ODDS_RANGE: {
    MIN: 1.8,  // Убрали 1.5-1.8 (ROI -6%)
    MAX: 2.3,  // Убрали 2.3-3.0 (высокий риск)
    CONFIDENCE_BOOST: 1.15  // +15% уверенности для оптимального диапазона
  },
  
  // Режим фильтрации: 'block' (блокировать) или 'warn' (только предупреждение)
  MODE: {
    rank_filter: 'warn',      // Если рейтинг не найден — предупреждение, а не блокировка
    tournament_filter: 'block',
    rank_diff_filter: 'block',
    optimal_odds_filter: 'block'
  },
  
  // Включить/выключить фильтры (для A/B тестирования)
  ENABLED: {
    rank_filter: true,
    tournament_tier_filter: true,
    rank_diff_filter: true,
    optimal_odds_filter: true
  }
};

// Функция проверки дополнительных фильтров
function applyAdditionalFilters(matchData, odds, pick) {
  const { GLOBAL_ENABLED, ENABLED, MODE, MAX_RANK, ALLOWED_TOURNAMENT_TIERS, MAX_RANK_DIFF, OPTIMAL_ODDS_RANGE } = ADDITIONAL_FILTERS;
  
  // Проверяем глобальный флаг включения
  if (!GLOBAL_ENABLED) {
    return { allowed: true, filter: 'disabled', reason: 'Дополнительные фильтры отключены' };
  }
  
  // Определяем рейтинги игроков (из данных матча или справочника)
  const player1Rank = matchData.player1?.rank || getPlayerRank(matchData.player1?.name || '');
  const player2Rank = matchData.player2?.rank || getPlayerRank(matchData.player2?.name || '');
  
  // Определяем категорию турнира
  const tournamentName = matchData.tournament?.name || matchData.tournament || '';
  const tournamentTier = getTournamentTier(tournamentName);
  
  // Фильтр 1: Рейтинг игроков (режим 'warn' для неизвестных рейтингов)
  if (ENABLED.rank_filter) {
    if (player1Rank > MAX_RANK || player2Rank > MAX_RANK) {
      const blockResult = { 
        allowed: false, 
        reason: `Rank too low (${player1Rank}, ${player2Rank} > ${MAX_RANK})`,
        filter: 'rank_filter'
      };
      
      // Проверяем режим: если 'warn' и рейтинг = 999 (неизвестен), то не блокируем
      if (MODE.rank_filter === 'warn' && (player1Rank === 999 || player2Rank === 999)) {
        console.warn(`[WARN] Рейтинг не найден для игрока(ов): ${matchData.player1?.name || 'Unknown'}, ${matchData.player2?.name || 'Unknown'}`);
        return { allowed: true, filter: 'rank_filter_warn', reason: 'Рейтинг не найден (только предупреждение)' };
      }
      
      return blockResult;
    }
  }
  
  // Фильтр 2: Категория турнира
  if (ENABLED.tournament_tier_filter) {
    if (!ALLOWED_TOURNAMENT_TIERS.includes(tournamentTier)) {
      const blockResult = { 
        allowed: false, 
        reason: `Tournament tier ${tournamentTier} not allowed`,
        filter: 'tournament_tier_filter'
      };
      
      // Для неизвестных категорий турниров тоже только предупреждение
      if (MODE.tournament_filter === 'warn' && tournamentTier === 'Unknown') {
        console.warn(`[WARN] Категория турнира неизвестна: ${tournamentName}`);
        return { allowed: true, filter: 'tournament_warn', reason: 'Категория турнира неизвестна (только предупреждение)' };
      }
      
      return blockResult;
    }
  }
  
  // Фильтр 3: Разница в рейтинге
  if (ENABLED.rank_diff_filter) {
    const rankDiff = Math.abs(player1Rank - player2Rank);
    if (rankDiff > MAX_RANK_DIFF) {
      return { 
        allowed: false, 
        reason: `Rank difference ${rankDiff} > ${MAX_RANK_DIFF}`,
        filter: 'rank_diff_filter'
      };
    }
  }
  
  // Фильтр 4: Оптимальный диапазон коэффициентов
  if (ENABLED.optimal_odds_filter) {
    if (odds < OPTIMAL_ODDS_RANGE.MIN || odds > OPTIMAL_ODDS_RANGE.MAX) {
      return { 
        allowed: false, 
        reason: `Odds ${odds} outside optimal range ${OPTIMAL_ODDS_RANGE.MIN}-${OPTIMAL_ODDS_RANGE.MAX}`,
        filter: 'optimal_odds_filter'
      };
    }
  }
  
  return { allowed: true, filter: 'passed_all', reason: 'Все фильтры пройдены' };
}

// Функция получения рейтинга игрока по имени
function getPlayerRank(playerName) {
  try {
    // Загружаем справочник рейтингов
    const path = require('path');
    const rankingsPath = path.join(__dirname, 'atp-rankings.json');
    const rankings = require(rankingsPath) || {};
    
    if (!playerName) return 999;
    
    // Нормализация имени (убрать пробелы, привести к нижнему регистру)
    const normalized = playerName.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Поиск точного совпадения
    if (rankings[normalized]) {
      return rankings[normalized];
    }
    
    // Поиск по фамилии
    const lastName = normalized.split(' ').pop();
    for (const [name, rank] of Object.entries(rankings)) {
      if (name.includes(lastName) || lastName.includes(name.split(' ').pop())) {
        return rank;
      }
    }
    
    return 999; // Рейтинг по умолчанию для неизвестных игроков
  } catch (error) {
    // Если файл не найден или ошибка загрузки
    console.warn(`⚠️ Ошибка загрузки рейтингов: ${error.message}`);
    return 999;
  }
}

// Функция логирования статистики фильтров
function logFilterStats(filterStats) {
  if (!filterStats || Object.keys(filterStats).length === 0) return;
  
  console.log('\n[FILTER STATS]');
  console.log('-'.repeat(40));
  
  let totalAnalyzed = 0;
  let totalBlocked = 0;
  
  for (const [filter, count] of Object.entries(filterStats)) {
    if (filter === 'total_analyzed') {
      totalAnalyzed = count;
      console.log(`- Total matches analyzed: ${count}`);
    } else if (filter === 'total_passed') {
      console.log(`- PASSED all filters: ${count}`);
    } else if (filter === 'total_blocked') {
      totalBlocked = count;
      console.log(`- BLOCKED by any filter: ${count}`);
    } else {
      console.log(`- Blocked by ${filter}: ${count}`);
    }
  }
  
  if (totalAnalyzed > 0) {
    const blockedPercentage = (totalBlocked / totalAnalyzed * 100).toFixed(1);
    const passedPercentage = (100 - parseFloat(blockedPercentage)).toFixed(1);
    console.log(`\n📊 SUMMARY: ${blockedPercentage}% blocked, ${passedPercentage}% passed`);
  }
}

// Экспорт конфигурации
module.exports = {
  USE_HISTORICAL_OPTIMIZATIONS,
  ODDS_CONFIG,
  SURFACE_BOOST,
  TOURNAMENT_BOOST,
  TOURNAMENT_SPECIAL_RULES,
  TOP_PLAYERS_BLACKLIST,
  ADDITIONAL_FILTERS, // НОВОЕ
  calculateOddsMultiplier,
  calculateSurfaceMultiplier,
  calculateTournamentMultiplier,
  checkTournamentSpecialRules,
  checkPlayerRestrictions, // НОВОЕ
  calculateConfidence,
  getOddsRangeDescription,
  getTournamentTier,
  logConfidenceDetails,
  applyAdditionalFilters, // НОВОЕ
  getPlayerRank, // НОВОЕ
  logFilterStats // НОВОЕ
};