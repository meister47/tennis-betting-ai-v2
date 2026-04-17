/**
 * Детектор покрытия корта для теннисных матчей
 * Определяет покрытие (Grass, Clay, Hard, Unknown) по турниру и API данным
 */

// Справочник турнир → покрытие
const TOURNAMENT_SURFACE = {
  // Grand Slams
  'Australian Open': 'Hard',
  'French Open': 'Clay',
  'Roland Garros': 'Clay',
  'Wimbledon': 'Grass',
  'US Open': 'Hard',
  
  // ATP Masters 1000
  'Indian Wells Masters': 'Hard',
  'Miami Open': 'Hard',
  'Monte Carlo Masters': 'Clay',
  'Madrid Open': 'Clay',
  'Rome Masters': 'Clay',
  'Canadian Open': 'Hard',
  'Cincinnati Masters': 'Hard',
  'Shanghai Masters': 'Hard',
  'Paris Masters': 'Hard',
  
  // ATP 500/250
  'ATP Barcelona': 'Clay',
  'ATP Munich': 'Clay',
  'ATP Houston': 'Clay',
  'ATP Stuttgart': 'Grass',
  'ATP Halle': 'Grass',
  'ATP Queen\'s Club': 'Grass',
  'ATP Newport': 'Grass',
  'ATP Washington': 'Hard',
  'ATP Tokyo': 'Hard',
  'ATP Vienna': 'Hard',
  'ATP Basel': 'Hard',
  
  // WTA
  'WTA Stuttgart': 'Clay',
  'WTA Charleston': 'Clay',
  'WTA Madrid': 'Clay',
  'WTA Rome': 'Clay',
  'WTA Eastbourne': 'Grass',
  'WTA Birmingham': 'Grass',
  'WTA San Jose': 'Hard',
  'WTA Cincinnati': 'Hard',
  'WTA Wuhan': 'Hard',
  'WTA Beijing': 'Hard',
  
  // Общие ключевые слова
  'Open': 'Hard', // большинство "Open" турниров на харде
  'Masters': 'Clay', // большинство Masters на грунте (кроме Indian Wells, Miami)
  'Championship': 'Hard',
  'International': 'Hard',
  'ATP Cup': 'Hard',
  'Davis Cup': 'Hard',
  'Laver Cup': 'Hard'
};

// Маппинг sport_key → покрытие
const SPORT_KEY_SURFACE = {
  // ATP
  'tennis_atp_australian_open': 'Hard',
  'tennis_atp_french_open': 'Clay',
  'tennis_atp_wimbledon': 'Grass',
  'tennis_atp_us_open': 'Hard',
  
  // ATP Masters
  'tennis_atp_indian_wells': 'Hard',
  'tennis_atp_miami_open': 'Hard',
  'tennis_atp_monte_carlo': 'Clay',
  'tennis_atp_madrid_open': 'Clay',
  'tennis_atp_rome': 'Clay',
  'tennis_atp_canada': 'Hard',
  'tennis_atp_cincinnati': 'Hard',
  'tennis_atp_shanghai': 'Hard',
  'tennis_atp_paris': 'Hard',
  
  // ATP 500/250
  'tennis_atp_barcelona': 'Clay',
  'tennis_atp_munich': 'Clay',
  'tennis_atp_houston': 'Clay',
  'tennis_atp_stuttgart': 'Grass',
  'tennis_atp_halle': 'Grass',
  'tennis_atp_queens': 'Grass',
  'tennis_atp_newport': 'Grass',
  'tennis_atp_washington': 'Hard',
  'tennis_atp_tokyo': 'Hard',
  'tennis_atp_vienna': 'Hard',
  'tennis_atp_basel': 'Hard',
  
  // WTA
  'tennis_wta_australian_open': 'Hard',
  'tennis_wta_french_open': 'Clay',
  'tennis_wta_wimbledon': 'Grass',
  'tennis_wta_us_open': 'Hard',
  'tennis_wta_stuttgart': 'Clay',
  'tennis_wta_charleston': 'Clay',
  'tennis_wta_madrid': 'Clay',
  'tennis_wta_rome': 'Clay',
  'tennis_wta_eastbourne': 'Grass',
  'tennis_wta_birmingham': 'Grass',
  'tennis_wta_san_jose': 'Hard',
  'tennis_wta_cincinnati': 'Hard',
  'tennis_wta_wuhan': 'Hard',
  'tennis_wta_beijing': 'Hard',
  
  // Общие
  'tennis_atp': 'Hard', // по умолчанию для ATP
  'tennis_wta': 'Hard', // по умолчанию для WTA
  'tennis': 'Hard' // общий fallback
};

// Ключевые слова в названии турнира для определения покрытия
const SURFACE_KEYWORDS = {
  'grass': 'Grass',
  'clay': 'Clay',
  'hard': 'Hard',
  'indoor': 'Hard',
  'outdoor': 'Hard',
  'carpet': 'Carpet',
  'acrylic': 'Hard',
  'decoturf': 'Hard',
  'plexicushion': 'Hard',
  'greenset': 'Hard',
  'rebound': 'Hard'
};

class SurfaceDetector {
  /**
   * Определить покрытие корта для матча
   * @param {Object} event - Объект события из The Odds API
   * @param {string} event.sport_key - Ключ спорта (например, 'tennis_atp_munich')
   * @param {string} event.sport_title - Название спорта (например, 'ATP Munich')
   * @param {string} event.home_team - Имя домашнего игрока
   * @param {string} event.away_team - Имя гостевого игрока
   * @returns {string} - Покрытие: 'Grass', 'Clay', 'Hard', 'Carpet', 'Unknown'
   */
  static detectSurface(event) {
    if (!event) {
      console.warn('⚠️  SurfaceDetector: event не определён');
      return 'Unknown';
    }

    // 1. Попробовать определить по sport_key
    if (event.sport_key && SPORT_KEY_SURFACE[event.sport_key]) {
      const surface = SPORT_KEY_SURFACE[event.sport_key];
      console.log(`✅ Surface по sport_key '${event.sport_key}': ${surface}`);
      return surface;
    }

    // 2. Попробовать определить по sport_title
    if (event.sport_title) {
      const surfaceFromTitle = this._detectFromTitle(event.sport_title);
      if (surfaceFromTitle !== 'Unknown') {
        console.log(`✅ Surface по sport_title '${event.sport_title}': ${surfaceFromTitle}`);
        return surfaceFromTitle;
      }
    }

    // 3. Попробовать определить по названиям команд (редко, но бывает)
    const surfaceFromTeams = this._detectFromTeamNames(event.home_team, event.away_team);
    if (surfaceFromTeams !== 'Unknown') {
      console.log(`✅ Surface по именам команд: ${surfaceFromTeams}`);
      return surfaceFromTeams;
    }

    // 4. Если ничего не помогло
    console.log(`❓ Surface не определён для события: ${event.sport_title || event.sport_key}`);
    return 'Unknown';
  }

  /**
   * Определить покрытие по названию турнира
   * @param {string} title - Название турнира
   * @returns {string} - Покрытие
   */
  static _detectFromTitle(title) {
    if (!title) return 'Unknown';
    
    const titleLower = title.toLowerCase();
    
    // Проверить точные совпадения
    for (const [tournament, surface] of Object.entries(TOURNAMENT_SURFACE)) {
      if (titleLower.includes(tournament.toLowerCase())) {
        return surface;
      }
    }
    
    // Проверить ключевые слова
    for (const [keyword, surface] of Object.entries(SURFACE_KEYWORDS)) {
      if (titleLower.includes(keyword)) {
        return surface;
      }
    }
    
    // Эвристики по названию
    if (titleLower.includes('grass') || titleLower.includes('wimbledon') || 
        titleLower.includes('halle') || titleLower.includes('queens') ||
        titleLower.includes('newport') || titleLower.includes('stuttgart')) {
      return 'Grass';
    }
    
    if (titleLower.includes('clay') || titleLower.includes('french') || 
        titleLower.includes('roland') || titleLower.includes('monte carlo') ||
        titleLower.includes('barcelona') || titleLower.includes('rome') ||
        titleLower.includes('madrid') || titleLower.includes('houston')) {
      return 'Clay';
    }
    
    if (titleLower.includes('hard') || titleLower.includes('indoor') ||
        titleLower.includes('outdoor') || titleLower.includes('australian') ||
        titleLower.includes('us open') || titleLower.includes('indian wells') ||
        titleLower.includes('miami') || titleLower.includes('canada') ||
        titleLower.includes('cincinnati') || titleLower.includes('shanghai') ||
        titleLower.includes('paris') || titleLower.includes('tokyo') ||
        titleLower.includes('vienna') || titleLower.includes('basel')) {
      return 'Hard';
    }
    
    return 'Unknown';
  }

  /**
   * Определить покрытие по именам команд (редкий случай)
   * @param {string} homeTeam - Домашний игрок
   * @param {string} awayTeam - Гостевой игрок
   * @returns {string} - Покрытие
   */
  static _detectFromTeamNames(homeTeam, awayTeam) {
    if (!homeTeam && !awayTeam) return 'Unknown';
    
    const allNames = (homeTeam + ' ' + awayTeam).toLowerCase();
    
    // Некоторые игроки известны своими предпочтениями на определённых покрытиях
    // Это очень грубая эвристика, используется как последнее средство
    
    // Игроки, известные на грунте
    const clayPlayers = ['nadal', 'thiem', 'ruud', 'schwartzman', 'garin'];
    if (clayPlayers.some(player => allNames.includes(player))) {
      return 'Clay';
    }
    
    // Игроки, известные на траве
    const grassPlayers = ['federer', 'murray', 'kyrgios', 'berrettini', 'cressy'];
    if (grassPlayers.some(player => allNames.includes(player))) {
      return 'Grass';
    }
    
    // Игроки, известные на харде
    const hardPlayers = ['djokovic', 'medvedev', 'zverev', 'tsitsipas', 'rublev'];
    if (hardPlayers.some(player => allNames.includes(player))) {
      return 'Hard';
    }
    
    return 'Unknown';
  }

  /**
   * Получить статистику покрытий для списка событий
   * @param {Array} events - Массив событий
   * @returns {Object} - Статистика по покрытиям
   */
  static getSurfaceStats(events) {
    const stats = {
      total: events.length,
      bySurface: {
        Grass: { count: 0, percentage: 0 },
        Clay: { count: 0, percentage: 0 },
        Hard: { count: 0, percentage: 0 },
        Carpet: { count: 0, percentage: 0 },
        Unknown: { count: 0, percentage: 0 }
      },
      detectionRate: 0
    };
    
    events.forEach(event => {
      const surface = this.detectSurface(event);
      stats.bySurface[surface].count++;
    });
    
    // Рассчитать проценты
    for (const surface in stats.bySurface) {
      stats.bySurface[surface].percentage = 
        stats.total > 0 ? Math.round((stats.bySurface[surface].count / stats.total) * 100) : 0;
    }
    
    // Процент успешного определения
    const knownCount = stats.total - stats.bySurface.Unknown.count;
    stats.detectionRate = stats.total > 0 ? Math.round((knownCount / stats.total) * 100) : 0;
    
    return stats;
  }

  /**
   * Проверить детектор на тестовых данных
   * @param {Array} testEvents - Тестовые события
   */
  static testDetection(testEvents) {
    console.log('🧪 Тестирование SurfaceDetector...');
    
    testEvents.forEach((event, index) => {
      const surface = this.detectSurface(event);
      console.log(`  ${index + 1}. ${event.sport_title || event.sport_key}: ${surface}`);
    });
    
    const stats = this.getSurfaceStats(testEvents);
    console.log('\n📊 Статистика определения:');
    console.log(`  Всего событий: ${stats.total}`);
    console.log(`  Успешное определение: ${stats.detectionRate}%`);
    console.log('  По покрытиям:');
    for (const [surface, data] of Object.entries(stats.bySurface)) {
      if (data.count > 0) {
        console.log(`    ${surface}: ${data.count} (${data.percentage}%)`);
      }
    }
  }
}

module.exports = SurfaceDetector;

// Тестовые данные для проверки
if (require.main === module) {
  const testEvents = [
    { sport_key: 'tennis_atp_munich', sport_title: 'ATP Munich', home_team: 'Player A', away_team: 'Player B' },
    { sport_key: 'tennis_atp_wimbledon', sport_title: 'Wimbledon', home_team: 'Player C', away_team: 'Player D' },
    { sport_key: 'tennis_atp_french_open', sport_title: 'French Open', home_team: 'Player E', away_team: 'Player F' },
    { sport_key: 'tennis_atp_australian_open', sport_title: 'Australian Open', home_team: 'Player G', away_team: 'Player H' },
    { sport_key: 'tennis_atp_unknown', sport_title: 'Unknown Tournament', home_team: 'Player I', away_team: 'Player J' }
  ];
  
  SurfaceDetector.testDetection(testEvents);
}