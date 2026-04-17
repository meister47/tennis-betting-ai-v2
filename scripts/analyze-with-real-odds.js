#!/usr/bin/env node

/**
 * Tennis Betting AI v3 - Интеграция улучшенной модели
 * Основные улучшения после анализа проигрышей 14.04.2026:
 * 1. Порог минимальной вероятности победы
 * 2. Корректировка edge для высоких коэффициентов
 * 3. Максимальный коэффициент 4.0
 * 4. Улучшенные веса факторов
 */

const ImprovedCleanTicketProtocol = require('./analyze-v2.js');
const FonbetOddsFetcher = require('./fonbet-odds-fetcher.js');
const TennisStatsAdapter = require('./tennis-stats-adapter.js');
const SafetyChecks = require('./safety-checks.js');
const HistoricalOptimizations = require('../config/historical-optimizations.js');
const fs = require('fs');
const path = require('path');

// Конфигурация пользователя (Тоша) с улучшениями v3
const USER_CONFIG_V3 = {
  bankroll: 1500,
  minStake: 30,
  maxStake: 90,
  riskProfile: 'moderate',
  bookmaker: 'fonbet',
  preferredMarkets: ['moneyline', 'handicap', 'total'],
  minEdge: 0.05,
  minWinProbability: 0.35,     // НОВОЕ: минимальная вероятность победы
  maxOddsForBet: 4.0,          // НОВОЕ: не ставить на коэффициенты >4.0
  excludePeakForm: true,
  surfaceSpecialization: true,
  motivationFactors: true,
  useProbabilityThreshold: true, // НОВОЕ: использовать порог вероятности
  tournamentLevel: 'ATP',        // НОВОЕ: уровень турнира
  useHistoricalOptimizations: HistoricalOptimizations.USE_HISTORICAL_OPTIMIZATIONS,
  historicalOddsConfig: HistoricalOptimizations.ODDS_CONFIG,
  dryRun: false                 // Режим тестирования без реальных ставок
};

class RealOddsAnalyzerV3 {
  constructor() {
    this.protocol = new ImprovedCleanTicketProtocol(USER_CONFIG_V3);
    this.fetcher = new FonbetOddsFetcher();
    this.statsAdapter = new TennisStatsAdapter({
      useRealStats: true,
      fallbackToDemo: true,
      cacheTtl: 3600000
    });
    this.safetyChecks = new SafetyChecks({
      maxOddsDiscrepancy: 0.5,
      checkSurface: true,
      checkInjuryReturn: true,
      checkMotivation: true,
      minSurfaceMatches: 3,
      injuryReturnDays: 30
    });
    this.results = [];
  }

  /**
   * Получение реальных коэффициентов
   */
  async fetchRealOdds(useCache = true) {
    console.log('🎾 Получение реальных коэффициентов с Fonbet...');
    console.log('');
    
    try {
      const oddsData = await this.fetcher.fetchOdds(useCache);
      
      console.log(`✅ Получено ${oddsData.totalMatches} матчей`);
      console.log(`📅 Время получения: ${new Date(oddsData.fetchedAt).toLocaleString('ru-RU')}`);
      console.log(`🔍 Источник: ${oddsData.source}`);
      
      if (!oddsData.success) {
        console.log(`⚠️  ${oddsData.error}`);
        console.log('📊 Используем демо-данные для анализа');
      }
      
      console.log('');
      return oddsData;
      
    } catch (error) {
      console.error('❌ Ошибка получения коэффициентов:', error.message);
      console.log('📊 Используем демо-данные для анализа');
      return this.fetcher.getDemoData();
    }
  }

  /**
   * Оценка уровня турнира (v3 улучшение)
   */
  assessTournamentLevel(tournamentName) {
    if (!tournamentName) return 'Unknown';
    
    const tournament = tournamentName.toLowerCase();
    
    if (tournament.includes('atp') || tournament.includes('masters') || 
        tournament.includes('grand slam') || tournament.includes('open')) {
      return 'ATP';
    } else if (tournament.includes('challenger')) {
      return 'Challenger';
    } else if (tournament.includes('itf') || tournament.includes('future')) {
      return 'ITF';
    } else {
      return 'Unknown';
    }
  }

  /**
   * Корректировка edge для коэффициентов (v3 улучшение)
   */
  adjustEdgeForOdds(edge, odds) {
    let adjustedEdge = edge;
    
    // Для высоких коэффициентов уменьшаем edge (больше риска)
    if (odds > 4.0) {
      adjustedEdge *= 0.5; // Уменьшаем edge на 50%
    } else if (odds > 3.0) {
      adjustedEdge *= 0.8; // Уменьшаем edge на 20%
    } else if (odds < 1.8) {
      adjustedEdge *= 1.2; // Увеличиваем edge на 20% для низких коэффициентов
    }
    
    return Math.max(0, Math.round(adjustedEdge * 10) / 10); // Округляем
  }

  /**
   * Проверка минимальной вероятности победы (v3 улучшение)
   */
  checkMinimumProbability(probability, odds) {
    let minProbability = USER_CONFIG_V3.minWinProbability;
    
    // Для высоких коэффициентов увеличиваем порог
    if (odds > 4.0) {
      minProbability = 0.40; // 40% для коэффициентов >4.0
    } else if (odds > 3.0) {
      minProbability = 0.38; // 38% для коэффициентов 3.0-4.0
    } else if (odds < 1.8) {
      minProbability = 0.45; // 45% для коэффициентов <1.8
    }
    
    return probability >= minProbability;
  }

  /**
   * Улучшенная рекомендация v3 с учётом всех новых факторов и исторических оптимизаций
   */
  makeEnhancedRecommendationV3(edge, odds, probability, tournamentLevel, originalRecommendation, matchDetails = {}) {
    // Детали матча для исторических оптимизаций
    const { surface, tournament } = matchDetails;
    
    // Применяем исторические оптимизации (если включены)
    let historicalConfidence = null;
    if (USER_CONFIG_V3.useHistoricalOptimizations) {
      const baseConfidence = probability; // Используем вероятность как базовую уверенность
      historicalConfidence = HistoricalOptimizations.calculateConfidence(
        baseConfidence,
        odds,
        surface,
        tournament
      );
      
      // Логируем детали множителей
      HistoricalOptimizations.logConfidenceDetails(historicalConfidence, {
        match: matchDetails.match || 'Unknown Match',
        odds: odds,
        surface: surface,
        tournament: tournament
      });
      
      // Если ставка заблокирована правилами турнира
      if (historicalConfidence.blockedBy) {
        return {
          decision: 'AVOID',
          confidence: 'very-low',
          selection: null,
          reason: historicalConfidence.blockedBy,
          edge: 0,
          originalEdge: edge,
          originalRecommendation: originalRecommendation,
          historicalData: {
            oddsRange: historicalConfidence.oddsRange,
            surface: historicalConfidence.surface,
            tournamentTier: historicalConfidence.tournamentTier,
            blocked: true
          }
        };
      }
      
      // Обновляем edge с учётом исторических оптимизаций
      if (historicalConfidence.adjusted > 0) {
        // Преобразуем уверенность обратно в edge (просто для совместимости)
        const historicalEdge = edge * historicalConfidence.multipliers.odds;
        edge = Math.max(0, historicalEdge);
      }
    }
    // Проверка 1: Максимальный коэффициент
    if (odds > USER_CONFIG_V3.maxOddsForBet) {
      return {
        decision: 'AVOID',
        confidence: 'low',
        selection: null,
        reason: `Коэффициент ${odds} превышает максимальный порог ${USER_CONFIG_V3.maxOddsForBet}`,
        edge: 0,
        originalEdge: edge,
        originalRecommendation: originalRecommendation
      };
    }
    
    // Корректируем edge с учётом коэффициента
    const adjustedEdge = this.adjustEdgeForOdds(edge, odds);
    
    // Проверка 2: Минимальная вероятность победы
    if (USER_CONFIG_V3.useProbabilityThreshold && !this.checkMinimumProbability(probability, odds)) {
      const minProb = odds > 4.0 ? 0.40 : odds > 3.0 ? 0.38 : odds < 1.8 ? 0.45 : 0.35;
      return {
        decision: 'AVOID',
        confidence: 'low',
        selection: null,
        reason: `Вероятность победы ${(probability * 100).toFixed(1)}% < минимального порога ${(minProb * 100).toFixed(0)}% для коэффициента ${odds}`,
        edge: adjustedEdge,
        originalEdge: edge,
        originalRecommendation: originalRecommendation
      };
    }
    
    // Проверка 3: Минимальный edge после корректировки
    if (adjustedEdge < USER_CONFIG_V3.minEdge * 100) {
      return {
        decision: 'NO_BET',
        confidence: 'low',
        selection: null,
        reason: `Недостаточное преимущество после корректировок (${adjustedEdge.toFixed(1)}% < ${USER_CONFIG_V3.minEdge * 100}%)`,
        edge: adjustedEdge,
        originalEdge: edge,
        originalRecommendation: originalRecommendation
      };
    }
    
    // Проверка 4: Уровень турнира
    let tournamentFactor = 1.0;
    if (tournamentLevel === 'Challenger') {
      tournamentFactor = 0.9; // Уменьшаем edge на 10% для Challenger
    } else if (tournamentLevel === 'ITF' || tournamentLevel === 'Unknown') {
      tournamentFactor = 0.8; // Уменьшаем edge на 20% для ITF/Unknown
    }
    
    const finalEdge = adjustedEdge * tournamentFactor;
    
    if (finalEdge >= USER_CONFIG_V3.minEdge * 100) {
      const confidence = finalEdge >= 15 ? 'high' : finalEdge >= 8 ? 'medium' : 'low';
    
    // Формируем результат с историческими данными
    const result = {
      decision: 'BET',
      confidence: confidence,
      selection: originalRecommendation.selection,
      reason: `Преимущество ${finalEdge.toFixed(1)}% обнаружено (с учётом корректировок v3)`,
      edge: finalEdge,
      originalEdge: edge,
      adjustments: {
        oddsAdjustment: adjustedEdge !== edge,
        tournamentAdjustment: tournamentFactor !== 1.0,
        probabilityCheck: 'passed'
      }
    };
    
    // Добавляем исторические данные если они есть
    if (historicalConfidence) {
      result.historicalData = {
        oddsRange: historicalConfidence.oddsRange,
        surface: historicalConfidence.surface,
        tournamentTier: historicalConfidence.tournamentTier,
        rawConfidence: Math.round(historicalConfidence.raw * 1000) / 10,
        adjustedConfidence: Math.round(historicalConfidence.adjusted * 1000) / 10,
        multipliers: historicalConfidence.multipliers
      };
      
      // Обновляем reason с деталями оптимизаций
      result.reason = `Преимущество ${finalEdge.toFixed(1)}% + исторические оптимизации: ` +
        `${historicalConfidence.oddsRange} (${formatHistoricalMultiplier(historicalConfidence.multipliers.odds)}), ` +
        `${historicalConfidence.surface} (${formatHistoricalMultiplier(historicalConfidence.multipliers.surface)}), ` +
        `${historicalConfidence.tournamentTier} (${formatHistoricalMultiplier(historicalConfidence.multipliers.tournament)})`;
    }
    
    return result;
    
    function formatHistoricalMultiplier(multiplier) {
      if (multiplier > 1.0) return `+${((multiplier - 1) * 100).toFixed(0)}%`;
      if (multiplier < 1.0) return `-${((1 - multiplier) * 100).toFixed(0)}%`;
      return '0%';
    }
    } else {
      return {
        decision: 'NO_BET',
        confidence: 'low',
        selection: null,
        reason: `После корректировок недостаточное преимущество (${finalEdge.toFixed(1)}%)`,
        edge: finalEdge,
        originalEdge: edge,
        originalRecommendation: originalRecommendation
      };
    }
  }

  /**
   * Основной метод анализа с улучшениями v3
   */
  async analyzeWithV3Improvements(useCache = true) {
    console.log('🎾 TENNIS BETTING AI v3 - УЛУЧШЕННАЯ МОДЕЛЬ');
    console.log('='.repeat(60));
    console.log('📅 Дата: ' + new Date().toLocaleString('ru-RU'));
    console.log('🔧 Версия: v3 (после анализа проигрышей 14.04.2026)');
    console.log('='.repeat(60));
    console.log('');
    
    // Получаем коэффициенты
    const oddsData = await this.fetchRealOdds(useCache);
    
    // Фильтруем теннисные матчи
    const tennisMatches = oddsData.matches.filter(match => 
      match.sport && match.sport.toLowerCase().includes('tennis')
    );
    
    console.log(`🎾 Найдено теннисных матчей: ${tennisMatches.length}`);
    console.log('');
    
    if (tennisMatches.length === 0) {
      console.log('⚠️  Теннисных матчей не найдено. Используем демо-данные...');
      const demoMatches = oddsData.matches.filter(match => match.sport === 'Tennis' || !match.sport);
      return await this.analyzeMatches(demoMatches);
    }
    
    return await this.analyzeMatches(tennisMatches);
  }

  /**
   * Анализ матчей с улучшениями v3
   */
  async analyzeMatches(matches) {
    console.log('🔍 АНАЛИЗ МАТЧЕЙ С УЛУЧШЕНИЯМИ v3:');
    console.log('');
    
    const results = [];
    
    for (const match of matches.slice(0, 10)) { // Анализируем первые 10 матчей
      try {
        console.log(`📊 Матч: ${match.player1 || 'Игрок 1'} vs ${match.player2 || 'Игрок 2'}`);
        
        // Получаем статистику через адаптер
        const stats = await this.statsAdapter.getPlayerStats({
          player1: match.player1 || 'Player1',
          player2: match.player2 || 'Player2',
          tournament: match.tournament || 'ATP Tour',
          surface: match.surface || 'Hard'
        });
        
        // Оценка рисков
        const riskAssessment = this.safetyChecks.assessMatch(match, stats);
        
        // Анализ оригинальной моделью
        const originalAnalysis = await this.protocol.analyzeMatch({
          player1: match.player1 || 'Player1',
          player2: match.player2 || 'Player2',
          tournament: match.tournament || 'ATP Tour',
          surface: match.surface || 'Hard',
          round: match.round || 'First Round',
          odds: {
            player1: match.odds && match.odds.player1 ? match.odds.player1 : 1.9,
            player2: match.odds && match.odds.player2 ? match.odds.player2 : 1.9
          }
        });
        
        // Применяем улучшения v3
        const tournamentLevel = this.assessTournamentLevel(match.tournament);
        const odds = originalAnalysis.selection === 'player1' ? 
          (match.odds && match.odds.player1 ? match.odds.player1 : 1.9) :
          (match.odds && match.odds.player2 ? match.odds.player2 : 1.9);
        
        const probability = 1 / odds;
        const v3Recommendation = this.makeEnhancedRecommendationV3(
          originalAnalysis.edge[originalAnalysis.selection === 'player1' ? 'player1' : 'player2'],
          odds,
          probability,
          tournamentLevel,
          originalAnalysis.recommendation,
          {
            match: `${match.player1 || 'Игрок 1'} vs ${match.player2 || 'Игрок 2'}`,
            surface: match.surface || 'Hard',
            tournament: match.tournament || 'ATP Tour'
          }
        );
        
        // Обновляем анализ с v3 рекомендацией и историческими данными
        const enhancedAnalysis = {
          ...originalAnalysis,
          recommendation: v3Recommendation,
          tournamentLevel: tournamentLevel,
          probability: Math.round(probability * 1000) / 10,
          adjustments: v3Recommendation.adjustments || {},
          historicalData: v3Recommendation.historicalData || null
        };
        
        results.push(enhancedAnalysis);
        
        // Выводим результат с деталями исторических оптимизаций
        console.log(`   📈 Оригинальный edge: ${originalAnalysis.edge[originalAnalysis.selection === 'player1' ? 'player1' : 'player2'].toFixed(1)}%`);
        console.log(`   🎯 Вероятность победы: ${enhancedAnalysis.probability}%`);
        console.log(`   🏆 Уровень турнира: ${tournamentLevel}`);
        console.log(`   🤖 Рекомендация v3: ${v3Recommendation.decision}`);
        console.log(`   💡 Причина: ${v3Recommendation.reason}`);
        
        // Дополнительная информация по историческим оптимизациям
        if (enhancedAnalysis.historicalData) {
          const hd = enhancedAnalysis.historicalData;
          console.log(`   📊 Исторические данные:`);
          console.log(`      Диапазон коэффициентов: ${hd.oddsRange}`);
          console.log(`      Поверхность: ${hd.surface}`);
          console.log(`      Уровень турнира: ${hd.tournamentTier}`);
          console.log(`      Уверенность: ${hd.rawConfidence}% → ${hd.adjustedConfidence}%`);
        }
        console.log('');
        
      } catch (error) {
        console.error(`❌ Ошибка анализа матча: ${error.message}`);
        console.log('');
      }
    }
    
    // Фильтруем только рекомендованные ставки
    const recommendedBets = results.filter(r => r.recommendation.decision === 'BET');
    
    console.log('='.repeat(60));
    console.log('📊 ИТОГИ АНАЛИЗА v3:');
    console.log('');
    console.log(`📈 Всего проанализировано матчей: ${results.length}`);
    console.log(`🎯 Рекомендовано ставок: ${recommendedBets.length}`);
    console.log(`⚠️  Отклонено ставок: ${results.length - recommendedBets.length}`);
    
    if (recommendedBets.length > 0) {
      console.log('');
      console.log('🔥 РЕКОМЕНДОВАННЫЕ СТАВКИ:');
      recommendedBets.forEach((bet, index) => {
        console.log(`${index + 1}. ${bet.match}`);
        console.log(`   Выбор: ${bet.recommendation.selection === 'player1' ? bet.player1 : bet.player2}`);
        console.log(`   Коэффициент: ${bet.recommendation.selection === 'player1' ? (bet.odds.player1 || 'N/A') : (bet.odds.player2 || 'N/A')}`);
        console.log(`   Edge v3: ${bet.recommendation.edge.toFixed(1)}%`);
        console.log(`   Уверенность: ${bet.recommendation.confidence}`);
        console.log(`   Ставка: ${bet.stake} руб.`);
        console.log('');
      });
    }
    
    // Сохраняем результаты
    this.saveResults(results);
    
    return {
      totalAnalyzed: results.length,
      recommendedBets: recommendedBets.length,
      results: results,
      recommendedBetsDetails: recommendedBets
    };
  }

  /**
   * Сохранение результатов анализа
   */
  saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-v3-${timestamp}.json`;
    const filepath = path.join(__dirname, '../results', filename);
    
    const output = {
      timestamp: new Date().toISOString(),
      version: 'v3',
      config: USER_CONFIG_V3,
      totalMatches: results.length,
      recommendedBets: results.filter(r => r.recommendation.decision === 'BET').length,
      results: results.map(r => ({
        match: r.match,
        tournament: r.tournament,
        surface: r.surface,
        tournamentLevel: r.tournamentLevel,
        probability: r.probability,
        odds: r.odds,
        edge: r.edge,
        recommendation: r.recommendation,
        stake: r.stake,
        reasoning: r.reasoning
      }))
    };
    
    // Создаем директорию results, если её нет
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`💾 Результаты сохранены: ${filepath}`);
  }

  /**
   * Анализ сегодняшних проигрышей для обучения модели
   */
  analyzeTodayLosses() {
    console.log('🔍 АНАЛИЗ ПРОИГРЫШЕЙ 14.04.2026:');
    console.log('='.repeat(60));
    
    const todayLosses = [
      {
        event: 'Грикспор Т vs Шаповалов Д',
        odds: 1.95,
        edge: 2.7,
        score: '1:2',
        tournament: 'ATP Tour'
      },
      {
        event: 'Де Минару А vs Офнер С',
        odds: 4.40,
        edge: 31.7,
        score: '2:0',
        tournament: 'ATP Tour'
      },
      {
        event: 'Табило А vs Фонсека Ж',
        odds: 2.90,
        edge: 12.0,
        score: '0:2',
        tournament: 'ATP Tour'
      }
    ];
    
    todayLosses.forEach((loss, index) => {
      console.log(`\n${index + 1}. ${loss.event}`);
      console.log(`   Коэффициент: ${loss.odds}, Edge: ${loss.edge}%`);
      
      const tournamentLevel = this.assessTournamentLevel(loss.tournament);
      const probability = 1 / loss.odds;
      const v3Recommendation = this.makeEnhancedRecommendationV3(
        loss.edge, 
        loss.odds, 
        probability, 
        tournamentLevel,
        { decision: 'BET', selection: 'player1' }
      );
      
      console.log(`   Подразумеваемая вероятность: ${(probability * 100).toFixed(1)}%`);
      console.log(`   Уровень турнира: ${tournamentLevel}`);
      console.log(`   Новая рекомендация v3: ${v3Recommendation.decision}`);
      console.log(`   Причина: ${v3Recommendation.reason}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 ВЫВОДЫ: Новая модель v3 отвергает рискованные ставки');
  }
}

// Запуск анализа
if (require.main === module) {
  const analyzer = new RealOddsAnalyzerV3();
  
  // Сначала покажем анализ сегодняшних проигрышей
  analyzer.analyzeTodayLosses();
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ЗАПУСК АНАЛИЗА С УЛУЧШЕНИЯМИ v3');
  console.log('='.repeat(60));
  
  // Запускаем анализ с кэшированием (useCache = true)
  analyzer.analyzeWithV3Improvements(true)
    .then(results => {
      console.log('\n✅ Анализ завершён!');
    })
    .catch(error => {
      console.error('❌ Ошибка при анализе:', error);
    });
}

module.exports = RealOddsAnalyzerV3;