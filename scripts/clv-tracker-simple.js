#!/usr/bin/env node

/**
 * ПРОСТОЙ CLV-трекер для Tennis Betting AI v2.0
 * Анализ win rate vs implied probability (ожидаемая вероятность = 1/коэф)
 * Версия: 1.0 (простая)
 * Дата: 2026-04-18
 * 
 * Функционал:
 * 1. Анализирует историю ставок из bets-db.json
 * 2. Вычисляет ожидаемую вероятность (1/коэф) vs фактическую win rate
 * 3. Категоризирует ставки: хорошие, нейтральные, плохие
 * 4. Генерирует текстовый отчёт для Telegram
 */

const fs = require('fs').promises;
const path = require('path');
const API_CONFIG = require('../config/api-config');

// Загружаем конфигурацию
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Путь к базе данных ставок
const BETS_DB_PATH = path.join(__dirname, '..', 'data', 'bets-db.json');

// Параметры анализа
const CLV_CONFIG = {
  GOOD_THRESHOLD: 0.10,  // Win rate > expected + 10% = хороший коэф
  BAD_THRESHOLD: -0.05,  // Win rate < expected - 5% = плохой коэф
  MIN_BETS_FOR_ANALYSIS: 5, // Минимум ставок для статистики
  MIN_DAYS_FOR_TREND: 7     // Минимум дней для трендового анализа
};

class SimpleClvTracker {
  constructor() {
    // Простой трекер без HTTP клиента
  }

  /**
   * Загружает базу данных ставок
   */
  async loadBets() {
    try {
      await fs.access(BETS_DB_PATH);
      const data = await fs.readFile(BETS_DB_PATH, 'utf8');
      const db = JSON.parse(data);
      
      console.log(`📊 Загружено ${db.stats.total_bets || 0} ставок из базы данных`);
      return db;
    } catch (error) {
      console.error('❌ Ошибка загрузки базы данных ставок:', error.message);
      return { bets: [], stats: { total_bets: 0 } };
    }
  }

  /**
   * Фильтрует завершённые ставки
   */
  filterSettledBets(bets) {
    return bets.filter(bet => {
      const status = bet.status?.toLowerCase?.();
      const result = bet.result?.toLowerCase?.();
      return (status === 'settled' && (result === 'won' || result === 'lost')) || 
             (status === 'won' || status === 'lost');
    });
  }

  /**
   * Анализирует ставку и вычисляет CLV метрики
   */
  analyzeBet(bet) {
    console.log(`🔍 Анализ ставки ${bet.id}:`, {
      odds_field: bet.odds_placed || bet.odds,
      status: bet.status,
      result: bet.result,
      has_odds: !!(bet.odds_placed || bet.odds)
    });
    
    const oddsValue = bet.odds_placed || bet.odds;
    if (!oddsValue) {
      console.log(`   ❌ Нет коэффициента в ставке ${bet.id}`);
      return null;
    }

    const odds = parseFloat(oddsValue);
    if (isNaN(odds) || odds <= 1) {
      console.log(`   ❌ Неверный коэффициент в ставке ${bet.id}: ${oddsValue}`);
      return null;
    }

    // Ожидаемая вероятность (implied probability) = 1 / коэф
    const expectedProbability = 1 / odds;
    
    // Фактический исход (1 = выигрыш, 0 = проигрыш)
    const status = bet.status?.toLowerCase?.();
    const result = bet.result?.toLowerCase?.();
    const isWin = (status === 'won' || result === 'won') || 
                  (status === 'settled' && result === 'won');
    const actualResult = isWin ? 1 : 0;
    
    // CLV разница: фактический результат - ожидаемая вероятность
    const clvDifference = actualResult - expectedProbability;
    
    // Категория ставки
    let category;
    if (clvDifference > CLV_CONFIG.GOOD_THRESHOLD) {
      category = 'good'; // Хороший коэф
    } else if (clvDifference < CLV_CONFIG.BAD_THRESHOLD) {
      category = 'bad';  // Плохой коэф
    } else {
      category = 'neutral'; // Нейтральный
    }

    return {
      ...bet,
      analysis: {
        odds,
        expectedProbability,
        actualResult,
        clvDifference,
        category,
        date: bet.created_at || bet.date
      }
    };
  }

  /**
   * Анализирует все ставки
   */
  async analyzeAllBets() {
    const db = await this.loadBets();
    const settledBets = this.filterSettledBets(db.bets || []);
    
    if (settledBets.length < CLV_CONFIG.MIN_BETS_FOR_ANALYSIS) {
      console.log(`⚠️  Недостаточно завершённых ставок для анализа. Нужно ${CLV_CONFIG.MIN_BETS_FOR_ANALYSIS}, есть ${settledBets.length}`);
      return { analyzedBets: [], summary: null };
    }

    console.log(`📈 Анализируем ${settledBets.length} завершённых ставок...`);

    const analyzedBets = settledBets
      .map(bet => this.analyzeBet(bet))
      .filter(bet => bet !== null);

    const summary = this.calculateSummary(analyzedBets);
    
    return { analyzedBets, summary };
  }

  /**
   * Вычисляет общую статистику
   */
  calculateSummary(analyzedBets) {
    const categories = { good: 0, neutral: 0, bad: 0 };
    let totalClvDiff = 0;
    let totalExpectedProbability = 0;
    let totalActualResult = 0;
    
    analyzedBets.forEach(bet => {
      const { category, expectedProbability, actualResult, clvDifference } = bet.analysis;
      categories[category]++;
      totalClvDiff += clvDifference;
      totalExpectedProbability += expectedProbability;
      totalActualResult += actualResult;
    });

    const totalBets = analyzedBets.length;
    const winRate = totalActualResult / totalBets;
    const expectedWinRate = totalExpectedProbability / totalBets;
    const avgClvDiff = totalClvDiff / totalBets;

    // Группируем по диапазону коэффициентов
    const oddsRanges = {
      '1.0-2.0': { good: 0, neutral: 0, bad: 0, count: 0 },
      '2.0-3.0': { good: 0, neutral: 0, bad: 0, count: 0 },
      '3.0-4.0': { good: 0, neutral: 0, bad: 0, count: 0 },
      '4.0+': { good: 0, neutral: 0, bad: 0, count: 0 }
    };

    analyzedBets.forEach(bet => {
      const odds = bet.analysis.odds;
      const category = bet.analysis.category;
      
      let range;
      if (odds <= 2.0) range = '1.0-2.0';
      else if (odds <= 3.0) range = '2.0-3.0';
      else if (odds <= 4.0) range = '3.0-4.0';
      else range = '4.0+';
      
      oddsRanges[range][category]++;
      oddsRanges[range].count++;
    });

    return {
      totalBets,
      winRate,
      expectedWinRate,
      avgClvDiff,
      categories,
      oddsRanges,
      clvScore: avgClvDiff * 100, // В процентах
      performance: avgClvDiff > 0 ? 'positive' : avgClvDiff < -0.05 ? 'negative' : 'neutral'
    };
  }

  /**
   * Генерирует текстовый отчёт для Telegram
   */
  generateTelegramReport(summary, analyzedBets = []) {
    if (!summary) {
      return '📭 Недостаточно данных для CLV анализа. Нужно минимум 5 завершённых ставок.';
    }

    const { 
      totalBets, 
      winRate, 
      expectedWinRate, 
      avgClvDiff, 
      categories,
      oddsRanges,
      clvScore,
      performance
    } = summary;

    const emoji = {
      good: '✅',
      neutral: '⚪', 
      bad: '❌',
      positive: '📈',
      negative: '📉',
      neutralPerf: '➖'
    };

    const performanceText = {
      positive: '📈 ПОЛОЖИТЕЛЬНО',
      negative: '📉 ОТРИЦАТЕЛЬНО',
      neutral: '➖ НЕЙТРАЛЬНО'
    }[performance];

    let report = `🎯 CLV АНАЛИЗ ТЕННИСНЫХ СТАВОК\n\n`;
    report += `📊 **Статистика (${totalBets} ставок):**\n`;
    report += `   Win rate: ${(winRate * 100).toFixed(1)}%\n`;
    report += `   Ожидалось: ${(expectedWinRate * 100).toFixed(1)}%\n`;
    report += `   CLV счёт: ${clvScore > 0 ? '+' : ''}${clvScore.toFixed(1)}%\n`;
    report += `   Результат: ${performanceText}\n\n`;

    report += `📈 **Качество коэффициентов:**\n`;
    report += `   ${emoji.good} Хорошие: ${categories.good} (${Math.round(categories.good/totalBets*100)}%)\n`;
    report += `   ${emoji.neutral} Нейтральные: ${categories.neutral} (${Math.round(categories.neutral/totalBets*100)}%)\n`;
    report += `   ${emoji.bad} Плохие: ${categories.bad} (${Math.round(categories.bad/totalBets*100)}%)\n\n`;

    report += `🎯 **Анализ по диапазонам коэффициентов:**\n`;
    Object.entries(oddsRanges).forEach(([range, data]) => {
      if (data.count > 0) {
        const goodPercent = data.good ? Math.round(data.good/data.count*100) : 0;
        const badPercent = data.bad ? Math.round(data.bad/data.count*100) : 0;
        report += `   ${range}: ${data.count} ставок (✅${goodPercent}% | ❌${badPercent}%)\n`;
      }
    });

    // Самые лучшие и худшие ставки
    const sortedBets = [...analyzedBets]
      .sort((a, b) => b.analysis.clvDifference - a.analysis.clvDifference);
    
    if (sortedBets.length >= 3) {
      const best = sortedBets[0];
      const worst = sortedBets[sortedBets.length - 1];
      
      report += `\n🏆 **Лучшая ставка:**\n`;
      report += `   ${best.event} @${best.analysis.odds.toFixed(2)}\n`;
      report += `   Win rate: +${(best.analysis.clvDifference * 100).toFixed(1)}%\n\n`;
      
      report += `⚠️ **Худшая ставка:**\n`;
      report += `   ${worst.event} @${worst.analysis.odds.toFixed(2)}\n`;
      report += `   Win rate: ${(worst.analysis.clvDifference * 100).toFixed(1)}%\n`;
    }

    // Рекомендации
    report += `\n💡 **Рекомендации:**\n`;
    
    if (performance === 'positive') {
      report += `   🎯 Система работает! Продолжай использовать текущие настройки.\n`;
    } else if (performance === 'negative') {
      report += `   ⚠️  Win rate ниже ожидаемого. Проверь фильтры и настройки.\n`;
    } else {
      report += `   🔄 Нейтральная производительность. Рассмотри A/B тестирование.\n`;
    }

    // Найди оптимальный диапазон коэффициентов
    let bestRange = null;
    let bestGoodPercent = -1;
    
    Object.entries(oddsRanges).forEach(([range, data]) => {
      if (data.count >= 5 && data.good > 0) {
        const goodPercent = Math.round(data.good/data.count*100);
        if (goodPercent > bestGoodPercent) {
          bestGoodPercent = goodPercent;
          bestRange = range;
        }
      }
    });

    if (bestRange) {
      report += `   📊 Оптимальный диапазон: ${bestRange} (${bestGoodPercent}% хороших ставок)\n`;
    }

    // Добавляем ссылку на активный API
    try {
      const activeApi = API_CONFIG.getActiveApi();
      report += `\n🔗 **Источник данных:** ${activeApi.NAME}\n`;
      report += `   Настройка: USE_ODDS_API_IO=${process.env.USE_ODDS_API_IO || 'true'}\n`;
    } catch (error) {
      // Игнорируем ошибки API конфигурации в отчёте
    }

    report += `\n🔄 Следующий анализ: автоматически по cron или через /clv`;
    
    return report;
  }

  /**
   * Основная функция запуска
   */
  async run() {
    console.log('🚀 Запуск простого CLV трекера...');
    
    try {
      const { analyzedBets, summary } = await this.analyzeAllBets();
      
      if (!summary) {
        console.log('❌ Недостаточно данных для анализа');
        return null;
      }

      console.log('✅ Анализ завершён');
      console.log(`   Всего ставок: ${summary.totalBets}`);
      console.log(`   Win rate: ${(summary.winRate * 100).toFixed(1)}%`);
      console.log(`   Ожидалось: ${(summary.expectedWinRate * 100).toFixed(1)}%`);
      console.log(`   CLV счёт: ${summary.clvScore > 0 ? '+' : ''}${summary.clvScore.toFixed(1)}%`);
      console.log(`   Категории: ✅${summary.categories.good} ⚪${summary.categories.neutral} ❌${summary.categories.bad}`);

      // Генерируем отчёт
      const report = this.generateTelegramReport(summary, analyzedBets);
      console.log('\n📋 Отчёт для Telegram:\n');
      console.log(report);
      
      return { summary, report };
    } catch (error) {
      console.error('❌ Ошибка в CLV трекере:', error.message);
      return null;
    }
  }
}

// Запуск скрипта
if (require.main === module) {
  const tracker = new SimpleClvTracker();
  tracker.run();
}

module.exports = SimpleClvTracker;