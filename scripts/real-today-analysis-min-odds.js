#!/usr/bin/env node

/**
 * Реальный анализ матчей на сегодня через The Odds API
 * ОБНОВЛЁННАЯ ВЕРСИЯ: минимальный коэффициент = 2.5 + ДИНАМИЧЕСКИЙ EDGE
 * Использует OddsCacheManager для экономии запросов
 */

// ================== НОВОЕ: ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА ==================
const Logger = require('../src/logger');
const logger = new Logger('analyzer');

// ================== НАСТРОЙКА РЕЖИМА ЛОГГИРОВАНИЯ ==================
const USE_JSON_LOGGER = true; // Флаг для быстрого отключения/включения

const OddsCacheManager = require('./odds-cache-manager');
const AnalysisCacheManager = require('./analysis-cache-manager.js');
const HistoricalOptimizations = require('../config/historical-optimizations.js');
const DynamicEdgeConfig = require('../config/dynamic-edge-config.js');
const SurfaceDetector = require('./surface-detector.js');
const BetsManager = require('./bets-manager.js');
const TODAY = new Date().toISOString().split('T')[0];

// Инициализируем менеджер ставок
const betsManager = new BetsManager();

// Загружаем конфигурацию CLV из .env.local
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const CLV_MODE_ENABLED = process.env.CLV_MODE_ENABLED === 'true' || false;

/**
 * Создает ставку на основе рекомендации
 * @param {Object} recommendation - Данные рекомендации
 * @param {Object} event - Данные события из Odds-API
 * @param {string} matchId - ID матча
 */
async function createBetFromRecommendation(recommendation, event, matchId) {
  try {
    // Формируем данные для ставки
    const betData = {
      event: `${event.home_team} vs ${event.away_team} (${recommendation.tournament})`,
      market: `Победа ${recommendation.choice}`,
      odds: recommendation.odds,
      stake: recommendation.stake,
      notes: `Рекомендация tennis-betting-ai v2.0 с CLV поддержкой. Edge: ${(recommendation.edge * 100).toFixed(1)}%, Уверенность: ${recommendation.confidence}`,
      surface: recommendation.surface,
      match_id: matchId,
      match_start_time: event.commence_time,
      player_name: recommendation.choice,
      tournament: recommendation.tournament
    };
    
    // Создаем ставку через менеджер
    const bet = await betsManager.createBet(betData);
    
    logger.ok('Ставка создана', { 
      betId: bet.id,
      pick: recommendation.choice,
      odds: recommendation.odds,
      edge: recommendation.edge,
      stake: recommendation.stake,
      status: bet.status,
      clvMode: CLV_MODE_ENABLED
    });
    
    /* БЫЛО:
    console.log(`🎯 СТАВКА СОЗДАНА: ${bet.id}`);
    console.log(`   Статус: ${bet.status} (CLV mode: ${CLV_MODE_ENABLED})`);
    console.log(`   Коэффициент: ${bet.odds_placed}`);
    console.log(`   Начало матча: ${new Date(bet.match_start_time).toLocaleString('ru-RU')}`);
    console.log('');
    */
    
    return bet;
  } catch (error) {
    logger.error('Ошибка создания ставки', { error: error.message });
    /* БЫЛО:
    console.error(`❌ Ошибка создания ставки: ${error.message}`);
    */
    return null;
  }
}

// КОНФИГУРАЦИЯ ТОШИ (обновлено с историческими оптимизациями и динамическим edge)
const USER_CONFIG = {
  bankroll: 1500,
  minStake: 30,
  maxStake: 90,
  minEdge: 0.05,  // Старый фиксированный edge (для отката)
  minWinProbability: 0.35,
  minOdds: HistoricalOptimizations.ODDS_CONFIG.MIN_ODDS,      // 2.5 вместо 1.5
  maxOdds: 4.0,
  maxTournamentRisk: 'medium', // low, medium, high
  useHistoricalOptimizations: HistoricalOptimizations.USE_HISTORICAL_OPTIMIZATIONS, // true
  useDynamicEdge: DynamicEdgeConfig.USE_DYNAMIC_EDGE // true/false
};

// Классификация турниров по уровню риска
const TOURNAMENT_RISK = {
  'ATP Barcelona Open': 'low',
  'ATP Munich': 'medium', 
  'WTA Stuttgart Open': 'low',
  'ATP Monte Carlo Masters': 'low',
  'ATP Houston': 'medium',
  'WTA Charleston': 'low'
};

// Инициализируем кэш-менеджер
const cacheManager = new OddsCacheManager();

// 1. Получение коэффициентов через кэш
async function fetchRealOdds(forceRefresh = false) {
  logger.info('Получаем коэффициенты через кэш-менеджер');
  /* БЫЛО:
  console.log('🔍 Получаем коэффициенты через кэш-менеджер...');
  */
  
  try {
    const events = await cacheManager.getTennisOdds(forceRefresh);
    
    // Получаем статистику кэша
    const stats = cacheManager.getStats();
    logger.info('Кэш статистика', stats);
    /* БЫЛО:
    console.log(`✅ Кэш: возраст ${stats.cacheAgeHours} часов, запросов: ${stats.requestsCount}`);
    */
    
    return events;
  } catch (error) {
    logger.error('Ошибка получения коэффициентов', { error: error.message });
    /* БЫЛО:
    console.error('❌ Ошибка получения коэффициентов:', error.message);
    */
    
    // В случае ошибки пробуем получить из старого скрипта
    logger.warn('Пробуем получить данные напрямую (fallback)');
    /* БЫЛО:
    console.log('⚠️  Пробуем получить данные напрямую (fallback)...');
    */
    return await fetchDirectOdds();
  }
}

// 2. Прямой запрос к API (fallback)
function fetchDirectOdds() {
  logger.warn('Fallback: прямой запрос к API');
  /* БЫЛО:
  console.log('⚠️  Fallback: прямой запрос к API...');
  */
  
  // Импортируем старую функцию (если нужно)
  const https = require('https');
  const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  logger.error('THE_ODDS_API_KEY не установлен в переменных окружения', { 
    error: 'Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)' 
  });
  /* БЫЛО:
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  */
  process.exit(1);
}
  
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      apiKey: API_KEY,
      regions: 'eu',
      markets: 'h2h',
      oddsFormat: 'decimal',
      dateFormat: 'iso'
    });

    const options = {
      hostname: 'api.the-odds-api.com',
      path: `/v4/sports/tennis/odds?${params.toString()}`,
      headers: { 'User-Agent': 'TennisBettingAI/1.5-cached' }
    };

    const req = https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          logger.info('Получены события (fallback)', { eventCount: events.length });
          /* БЫЛО:
          console.log(`✅ Получено ${events.length} событий (fallback)`);
          */
          
          // FIX: Добавлена проверка пустого ответа API
          if (!events || events.length === 0) {
            logger.info('Нет матчей для анализа сегодня (fallback)');
            /* БЫЛО:
            console.log('📭 Нет матчей для анализа сегодня (fallback)')
            */
            resolve([]);
            return;
          }
          
          resolve(events);
        } catch (err) {
          logger.error('Ошибка парсинга данных', { error: err.message });
          /* БЫЛО:
          console.error('❌ Ошибка парсинга данных:', err.message);
          */
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('Ошибка запроса', { error: err.message });
      /* БЫЛО:
      console.error('❌ Ошибка запроса:', err.message);
      */
      reject(err);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      const timeoutError = new Error('Таймаут запроса к The Odds API');
      logger.error('Таймаут запроса', { error: timeoutError.message });
      /* БЫЛО:
      reject(new Error('Таймаут запроса к The Odds API'));
      */
      reject(timeoutError);
    });
  });
}

// 3. Фильтрация сегодняшних матчей
function filterTodayMatches(events) {
  return events.filter(event => {
    if (!event.commence_time) return false;
    return event.commence_time.startsWith(TODAY);
  });
}

// 4. Определение турнира
function getTournament(event) {
  // Пытаемся извлечь турнир из описания
  const description = event.description || '';
  
  // Проверяем известные турниры
  for (const [tournament, risk] of Object.entries(TOURNAMENT_RISK)) {
    if (description.includes(tournament)) {
      return { name: tournament, risk };
    }
  }
  
  // По умолчанию medium риск
  return { name: 'Неизвестный турнир', risk: 'medium' };
}

// 5. Расчёт edge
function calculateEdge(odds, estimatedProbability) {
  const fairOdds = 1 / estimatedProbability;
  const edge = fairOdds / odds - 1;
  return Math.max(0, edge);
}

// 6. Расчёт суммы ставки по Kelly Criterion
function calculateStake(bankroll, edge, odds, minStake, maxStake) {
  const kellyFraction = edge / (odds - 1);
  const safeFraction = kellyFraction * 0.5; // Половина Kelly для безопасности
  const stake = bankroll * safeFraction;
  
  // Ограничение по min/max
  if (stake < minStake) return minStake;
  if (stake > maxStake) return maxStake;
  return Math.round(stake);
}

// 7. Получение вероятности победы (упрощённо)
function getEstimatedProbability(playerName, opponentName, tournamentRisk) {
  // Базовая логика: случайное распределение между 40-60%
  const baseProb = 0.5;
  
  // Корректировки по риску турнира
  if (tournamentRisk === 'low') return baseProb + 0.05; // 55%
  if (tournamentRisk === 'high') return baseProb - 0.15; // 35%
  return baseProb; // 50% для medium
}

// 8. Оценка уверенности по edge с историческими оптимизациями
function getConfidence(edge, odds, tournamentName) {
  const baseConfidence = edge;
  
  // Применяем исторические оптимизации
  const confidenceResult = HistoricalOptimizations.calculateConfidence(
    baseConfidence,
    odds,
    null, // surface - неизвестно
    tournamentName
  );
  
  const adjustedConfidence = confidenceResult.adjusted;
  
  // Преобразуем в текстовую оценку
  if (adjustedConfidence === 0) {
    return '🚫 БЛОКИРОВАНА';
  } else if (adjustedConfidence >= 0.20) {
    return '✅ Высокая';
  } else if (adjustedConfidence >= 0.10) {
    return '⚠️ Умеренная';
  } else {
    return '📉 Низкая';
  }
}

// 9. Основная функция анализа
async function analyzeMatches() {
  logger.info('Запуск анализа матчей на сегодня');
  /* БЫЛО:
  console.log('🎾 ЗАПУСК АНАЛИЗА МАТЧЕЙ НА СЕГОДНЯ 🎾');
  console.log(`📅 Дата: ${TODAY}`);
  console.log('='.repeat(50));
  */
  
  try {
    // Получаем коэффициенты
    const allEvents = await fetchRealOdds();
    
    if (!allEvents || allEvents.length === 0) {
      logger.info('Нет доступных событий для анализа');
      /* БЫЛО:
      console.log('📭 Нет доступных событий для анализа');
      */
      return { recommendations: [], stats: { totalEvents: 0, filtered: 0, bets: 0 } };
    }
    
    logger.info('Всего событий получено', { totalEvents: allEvents.length });
    /* БЫЛО:
    console.log(`📊 Всего событий: ${allEvents.length}`);
    */
    
    // Фильтруем сегодняшние матчи
    const todayEvents = filterTodayMatches(allEvents);
    logger.info('Сегодняшние матчи', { todayEvents: todayEvents.length });
    /* БЫЛО:
    console.log(`📆 Сегодняшние матчи: ${todayEvents.length}`);
    */
    
    if (todayEvents.length === 0) {
      logger.info('Нет матчей на сегодня');
      /* БЫЛО:
      console.log('📭 Нет матчей на сегодня');
      */
      return { recommendations: [], stats: { totalEvents: allEvents.length, filtered: 0, bets: 0 } };
    }
    
    // Инициализируем детектор поверхности
    const surfaceDetector = new SurfaceDetector();
    
    // Анализируем каждый матч
    const recommendations = [];
    
    for (const event of todayEvents) {
      try {
        const tournamentInfo = getTournament(event);
        const tournamentName = tournamentInfo.name;
        const tournamentRisk = tournamentInfo.risk;
        
        // Проверяем риск турнира
        if (tournamentRisk === 'high' && USER_CONFIG.maxTournamentRisk === 'low') {
          logger.skip('Слишком высокий риск турнира', { 
            matchId: event.id, 
            tournament: tournamentName,
            tournamentRisk,
            maxAllowed: USER_CONFIG.maxTournamentRisk 
          });
          /* БЫЛО:
          console.log(`[SKIP] ${event.id} - турнир ${tournamentName} слишком рисковый (${tournamentRisk})`);
          */
          continue;
        }
        
        // Получаем букмекерские коэффициенты
        if (!event.bookmakers || event.bookmakers.length === 0) {
          logger.skip('Нет коэффициентов', { matchId: event.id });
          /* БЫЛО:
          console.log(`[SKIP] ${event.id} - нет коэффициентов`);
          */
          continue;
        }
        
        // Берем первого букмекера (обычно с лучшими коэффициентами)
        const bookmaker = event.bookmakers[0];
        if (!bookmaker.markets || bookmaker.markets.length === 0) {
          logger.skip('Нет рынков у букмекера', { matchId: event.id, bookmaker: bookmaker.title });
          /* БЫЛО:
          console.log(`[SKIP] ${event.id} - нет рынков у букмекера ${bookmaker.title}`);
          */
          continue;
        }
        
        const market = bookmaker.markets[0];
        if (!market.outcomes || market.outcomes.length !== 2) {
          logger.skip('Некорректные исходы', { matchId: event.id, outcomesCount: market.outcomes?.length || 0 });
          /* БЫЛО:
          console.log(`[SKIP] ${event.id} - некорректные исходы (${market.outcomes?.length || 0})`);
          */
          continue;
        }
        
        const homeOutcome = market.outcomes.find(o => o.name === event.home_team);
        const awayOutcome = market.outcomes.find(o => o.name === event.away_team);
        
        if (!homeOutcome || !awayOutcome) {
          logger.skip('Не найдены исходы команд', { 
            matchId: event.id, 
            homeFound: !!homeOutcome, 
            awayFound: !!awayOutcome 
          });
          /* БЫЛО:
          console.log(`[SKIP] ${event.id} - не найдены исходы команд`);
          */
          continue;
        }
        
        const homeOdds = homeOutcome.price;
        const awayOdds = awayOutcome.price;
        
        // Определяем тип поверхности
        const surface = await surfaceDetector.detectSurface(event);
        
        // Анализируем каждого игрока
        const players = [
          { name: event.home_team, odds: homeOdds, isHome: true },
          { name: event.away_team, odds: awayOdds, isHome: false }
        ];
        
        for (const player of players) {
          // Проверяем минимальный коэффициент
          if (player.odds < USER_CONFIG.minOdds) {
            logger.skip('Коэффициент слишком низкий', { 
              matchId: event.id, 
              player: player.name, 
              odds: player.odds, 
              minOdds: USER_CONFIG.minOdds 
            });
            /* БЫЛО:
            console.log(`[SKIP] ${event.id} ${player.name} @ ${player.odds} - слишком низкий коэффициент`);
            */
            continue;
          }
          
          // Проверяем максимальный коэффициент
          if (player.odds > USER_CONFIG.maxOdds) {
            logger.skip('Коэффициент слишком высокий', { 
              matchId: event.id, 
              player: player.name, 
              odds: player.odds, 
              maxOdds: USER_CONFIG.maxOdds 
            });
            /* БЫЛО:
            console.log(`[SKIP] ${event.id} ${player.name} @ ${player.odds} - слишком высокий коэффициент`);
            */
            continue;
          }
          
          // Оцениваем вероятность победы
          const opponentName = player.isHome ? event.away_team : event.home_team;
          const estimatedProbability = getEstimatedProbability(player.name, opponentName, tournamentRisk);
          
          // Проверяем минимальную вероятность
          if (estimatedProbability < USER_CONFIG.minWinProbability) {
            logger.skip('Слишком низкая вероятность победы', { 
              matchId: event.id, 
              player: player.name, 
              probability: estimatedProbability.toFixed(2),
              minProbability: USER_CONFIG.minWinProbability 
            });
            /* БЫЛО:
            console.log(`[SKIP] ${event.id} ${player.name} - вероятность ${estimatedProbability.toFixed(2)} слишком низкая`);
            */
            continue;
          }
          
          // Рассчитываем edge
          let edge = calculateEdge(player.odds, estimatedProbability);
          
          // Применяем динамический edge если включено
          if (USER_CONFIG.useDynamicEdge) {
            const dynamicEdgeResult = DynamicEdgeConfig.calculateDynamicEdge(
              edge,
              player.odds,
              surface,
              tournamentName
            );
            edge = dynamicEdgeResult.adjusted;
          }
          
          // Проверяем минимальный edge
          if (edge < USER_CONFIG.minEdge) {
            logger.skip('Edge слишком низкий', { 
              matchId: event.id, 
              player: player.name, 
              edge: edge.toFixed(3),
              minEdge: USER_CONFIG.minEdge 
            });
            /* БЫЛО:
            console.log(`[SKIP] ${event.id} ${player.name} - edge ${edge.toFixed(3)} слишком низкий`);
            */
            continue;
          }
          
          // Рассчитываем сумму ставки
          const stake = calculateStake(
            USER_CONFIG.bankroll,
            edge,
            player.odds,
            USER_CONFIG.minStake,
            USER_CONFIG.maxStake
          );
          
          // Получаем уверенность
          const confidence = getConfidence(edge, player.odds, tournamentName);
          
          // Формируем рекомендацию
          const recommendation = {
            matchId: event.id,
            event: `${event.home_team} vs ${event.away_team}`,
            choice: player.name,
            odds: player.odds,
            edge: Number(edge.toFixed(3)),
            stake,
            confidence,
            tournament: tournamentName,
            tournamentRisk,
            surface,
            commenceTime: event.commence_time,
            estimatedProbability: Number(estimatedProbability.toFixed(3)),
            isHome: player.isHome
          };
          
          recommendations.push(recommendation);
          
          logger.ok('Рекомендация создана', { 
            matchId: event.id, 
            player: player.name, 
            odds: player.odds, 
            edge: edge.toFixed(3),
            stake,
            confidence,
            tournament: tournamentName 
          });
          /* БЫЛО:
          console.log(`✅ ${event.id} ${player.name} @ ${player.odds} - edge: ${edge.toFixed(3)}, ставка: ${stake} руб.`);
          */
        }
        
      } catch (error) {
        logger.error('Ошибка анализа матча', { 
          matchId: event?.id || 'unknown', 
          error: error.message 
        });
        /* БЫЛО:
        console.error(`❌ Ошибка анализа матча ${event?.id || 'unknown'}: ${error.message}`);
        */
      }
    }
    
    // Статистика
    logger.info('Анализ завершён', { 
      totalEvents: allEvents.length,
      todayEvents: todayEvents.length,
      recommendations: recommendations.length 
    });
    /* БЫЛО:
    console.log('='.repeat(50));
    console.log(`📊 СТАТИСТИКА:`);
    console.log(`   Всего событий: ${allEvents.length}`);
    console.log(`   Сегодняшних: ${todayEvents.length}`);
    console.log(`   Рекомендаций: ${recommendations.length}`);
    */
    
    return {
      recommendations,
      stats: {
        totalEvents: allEvents.length,
        filtered: todayEvents.length,
        bets: recommendations.length
      }
    };
    
  } catch (error) {
    logger.error('Критическая ошибка анализа', { error: error.message, stack: error.stack });
    /* БЫЛО:
    console.error('❌ Критическая ошибка анализа:', error.message);
    console.error(error.stack);
    */
    throw error;
  }
}

// 10. Создание ставок на основе рекомендаций
async function createBetsFromRecommendations(analysisResult) {
  logger.info('Создание ставок на основе рекомендаций', { 
    recommendationCount: analysisResult.recommendations.length 
  });
  /* БЫЛО:
  console.log('\n🎯 СОЗДАНИЕ СТАВОК:');
  */
  
  const bets = [];
  
  for (const recommendation of analysisResult.recommendations) {
    try {
      // Находим соответствующее событие
      const events = await fetchRealOdds();
      const event = events.find(e => e.id === recommendation.matchId);
      
      if (!event) {
        logger.warn('Событие не найдено для создания ставки', { matchId: recommendation.matchId });
        /* БЫЛО:
        console.log(`⚠️  Событие ${recommendation.matchId} не найдено`);
        */
        continue;
      }
      
      const bet = await createBetFromRecommendation(recommendation, event, recommendation.matchId);
      if (bet) {
        bets.push(bet);
      }
    } catch (error) {
      logger.error('Ошибка создания ставки для рекомендации', { 
        matchId: recommendation.matchId, 
        error: error.message 
      });
      /* БЫЛО:
      console.error(`❌ Ошибка создания ставки для ${recommendation.matchId}: ${error.message}`);
      */
    }
  }
  
  logger.info('Создание ставок завершено', { createdBets: bets.length });
  /* БЫЛО:
  console.log(`\n✅ Создано ставок: ${bets.length}`);
  */
  
  return bets;
}

// 11. Главная функция
async function main() {
  logger.info('Запуск системы Tennis Betting AI v2.0', {
    date: TODAY,
    config: {
      minOdds: USER_CONFIG.minOdds,
      useHistoricalOptimizations: USER_CONFIG.useHistoricalOptimizations,
      useDynamicEdge: USER_CONFIG.useDynamicEdge,
      clvMode: CLV_MODE_ENABLED
    }
  });
  /* БЫЛО:
  console.log('🎾 TENNIS BETTING AI v2.0 🎾');
  console.log(`📅 ${TODAY}`);
  console.log(`⚙️  MIN ODDS: ${USER_CONFIG.minOdds}`);
  console.log(`📊 Исторические оптимизации: ${USER_CONFIG.useHistoricalOptimizations ? '✅ ВКЛЮЧЕНЫ' : '❌ ВЫКЛЮЧЕНЫ'}`);
  console.log(`📈 Динамический edge: ${USER_CONFIG.useDynamicEdge ? '✅ ВКЛЮЧЁН' : '❌ ВЫКЛЮЧЕН'}`);
  console.log(`🔁 CLV режим: ${CLV_MODE_ENABLED ? '✅ ВКЛЮЧЕН' : '❌ ВЫКЛЮЧЕН'}`);
  console.log('='.repeat(50));
  */
  
  try {
    // 1. Анализ матчей
    const analysisResult = await analyzeMatches();
    
    // 2. Создание ставок
    if (analysisResult.recommendations.length > 0) {
      await createBetsFromRecommendations(analysisResult);
    } else {
      logger.info('Нет рекомендаций для создания ставок');
      /* БЫЛО:
      console.log('📭 Нет рекомендаций для создания ставок');
      */
    }
    
    // 3. Итоговая статистика
    logger.info('Работа завершена', { 
      stats: analysisResult.stats,
      status: 'SUCCESS' 
    });
    /* БЫЛО:
    console.log('\n' + '='.repeat(50));
    console.log('🎉 РАБОТА ЗАВЕРШЕНА');
    console.log(`📊 Итоги: ${analysisResult.stats.bets} ставок из ${analysisResult.stats.totalEvents} событий`);
    console.log('='.repeat(50));
    */
    
  } catch (error) {
    logger.error('Критическая ошибка выполнения', { error: error.message, stack: error.stack });
    /* БЫЛО:
    console.error('❌ Критическая ошибка выполнения:', error.message);
    console.error(error.stack);
    */
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = {
  analyzeMatches,
  createBetsFromRecommendations,
  main
};