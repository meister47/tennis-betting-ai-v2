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
  MAX_ODDS: 10.0,          // Пока не режем
  SWEET_SPOT: {
    MIN: 2.5,
    MAX: 3.0,
    CONFIDENCE_BOOST: 1.2  // +20% уверенности для оптимального диапазона
  },
  UNDERDOG_PENALTY: {
    THRESHOLD: 3.0,
    CONFIDENCE_PENALTY: 0.7 // -30% уверенности для андердогов
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

// Главная функция для расчёта итоговой уверенности
function calculateConfidence(baseConfidence, odds, surface, tournamentName) {
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
    tournamentTier: getTournamentTier(tournamentName)
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

// Экспорт конфигурации
module.exports = {
  USE_HISTORICAL_OPTIMIZATIONS,
  ODDS_CONFIG,
  SURFACE_BOOST,
  TOURNAMENT_BOOST,
  TOURNAMENT_SPECIAL_RULES,
  calculateOddsMultiplier,
  calculateSurfaceMultiplier,
  calculateTournamentMultiplier,
  checkTournamentSpecialRules,
  calculateConfidence,
  getOddsRangeDescription,
  getTournamentTier,
  logConfidenceDetails
};