#!/usr/bin/env node

/**
 * Скрипт для анализа эффективности системы CLV (Closing Line Value)
 * 
 * Функционал:
 * 1. Читает bets-db.json
 * 2. Фильтрует завершенные ставки с заполненными odds_placed и odds_closing
 * 3. Рассчитывает CLV для каждой ставки
 * 4. Группирует по CLV (positive/negative/neutral)
 * 5. Считает статистику для каждой группы
 */

const BetsManager = require('./bets-manager.js');
const path = require('path');

// Загружаем конфигурацию
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

class ClosingLineValueAnalyzer {
  constructor() {
    this.betsManager = new BetsManager();
  }

  /**
   * Рассчитывает CLV для ставки
   * CLV = (1/odds_closing) - (1/odds_placed)
   * Положительный CLV = ставка переиграла рынок
   */
  calculateCLV(bet) {
    if (!bet.odds_placed || !bet.odds_closing) {
      return null;
    }
    
    const impliedProbabilityPlaced = 1 / bet.odds_placed;
    const impliedProbabilityClosing = 1 / bet.odds_closing;
    
    return impliedProbabilityClosing - impliedProbabilityPlaced;
  }

  /**
   * Определяет группу CLV
   */
  getCLVGroup(clv) {
    if (clv > 0.001) { // Небольшой порог для положительного
      return 'positive';
    } else if (clv < -0.001) { // Небольшой порог для отрицательного
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  /**
   * Анализирует ставки с CLV
   */
  async analyze() {
    console.log('📊 АНАЛИЗ CLV (Closing Line Value)');
    console.log(`   Время: ${new Date().toLocaleString('ru-RU')}\n`);
    
    try {
      // Загружаем базу данных
      await this.betsManager.initializeDatabase();
      
      // Получаем ставки с CLV
      const betsWithCLV = await this.betsManager.getBetsWithCLV();
      
      console.log(`📈 Ставок с рассчитанным CLV: ${betsWithCLV.length}\n`);
      
      if (betsWithCLV.length === 0) {
        console.log('⚠️  Нет данных для анализа CLV. Нужно дождаться завершения ставок.');
        return;
      }
      
      // Группируем ставки
      const groups = {
        positive: [],
        negative: [],
        neutral: []
      };
      
      // Анализируем каждую ставку
      console.log('📋 ДЕТАЛЬНЫЙ АНАЛИЗ СТАВОК:\n');
      console.log('ID | Событие | Игрок | Коэф. | Закр. | CLV | Результат');
      console.log('---|---------|-------|-------|-------|-----|----------');
      
      betsWithCLV.forEach(bet => {
        const clv = bet.clv;
        const group = this.getCLVGroup(clv);
        
        groups[group].push(bet);
        
        // Выводим детали по ставке
        const eventShort = bet.event.length > 30 ? bet.event.substring(0, 30) + '...' : bet.event;
        const playerShort = bet.player_name ? (bet.player_name.length > 15 ? bet.player_name.substring(0, 15) + '...' : bet.player_name) : 'N/A';
        const resultSymbol = bet.result === 'won' ? '✅' : bet.result === 'lost' ? '❌' : '⏳';
        const clvSymbol = clv > 0 ? '📈' : clv < 0 ? '📉' : '↔️';
        
        console.log(`${bet.id.substring(0, 8)} | ${eventShort} | ${playerShort} | ${bet.odds_placed.toFixed(2)} | ${bet.odds_closing.toFixed(2)} | ${clv.toFixed(4)} ${clvSymbol} | ${resultSymbol} ${bet.result}`);
      });
      
      console.log('\n📊 СТАТИСТИКА ПО ГРУППАМ CLV:\n');
      
      // Анализируем каждую группу
      for (const [groupName, groupBets] of Object.entries(groups)) {
        if (groupBets.length === 0) {
          console.log(`${this.getGroupEmoji(groupName)} ${this.getGroupName(groupName)}: 0 ставок`);
          continue;
        }
        
        // Фильтруем завершенные ставки для этой группы
        const settledBets = groupBets.filter(bet => bet.status === 'settled');
        
        if (settledBets.length === 0) {
          console.log(`${this.getGroupEmoji(groupName)} ${this.getGroupName(groupName)}: ${groupBets.length} ставок (ни одна не завершена)`);
          continue;
        }
        
        // Считаем статистику
        const wonBets = settledBets.filter(bet => bet.result === 'won');
        const lostBets = settledBets.filter(bet => bet.result === 'lost');
        
        const totalStaked = settledBets.reduce((sum, bet) => sum + (bet.stake || 0), 0);
        const totalReturn = settledBets.reduce((sum, bet) => sum + (bet.return || 0), 0);
        const totalProfit = totalReturn - totalStaked;
        
        const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length * 100).toFixed(1) : '0.0';
        const roi = totalStaked > 0 ? (totalProfit / totalStaked * 100).toFixed(1) : '0.0';
        
        // Средний CLV для группы
        const avgCLV = groupBets.reduce((sum, bet) => sum + (bet.clv || 0), 0) / groupBets.length;
        
        // Средний коэффициент
        const avgOddsPlaced = groupBets.reduce((sum, bet) => sum + (bet.odds_placed || 0), 0) / groupBets.length;
        const avgOddsClosing = groupBets.reduce((sum, bet) => sum + (bet.odds_closing || 0), 0) / groupBets.length;
        
        console.log(`${this.getGroupEmoji(groupName)} ${this.getGroupName(groupName)}:`);
        console.log(`   Ставок: ${groupBets.length} (завершено: ${settledBets.length})`);
        console.log(`   Win Rate: ${winRate}% (${wonBets.length}/${settledBets.length})`);
        console.log(`   ROI: ${roi}% (прибыль: ${totalProfit.toFixed(0)} руб.)`);
        console.log(`   Средний CLV: ${avgCLV.toFixed(4)}`);
        console.log(`   Средний коэф.: ${avgOddsPlaced.toFixed(2)} → ${avgOddsClosing.toFixed(2)}`);
        console.log('');
      }
      
      // Общая статистика по всем ставкам с CLV
      const allSettledBets = betsWithCLV.filter(bet => bet.status === 'settled');
      
      if (allSettledBets.length > 0) {
        console.log('🎯 ОБЩАЯ СТАТИСТИКА ВСЕХ СТАВОК С CLV:\n');
        
        const allWonBets = allSettledBets.filter(bet => bet.result === 'won');
        const allLostBets = allSettledBets.filter(bet => bet.result === 'lost');
        
        const allTotalStaked = allSettledBets.reduce((sum, bet) => sum + (bet.stake || 0), 0);
        const allTotalReturn = allSettledBets.reduce((sum, bet) => sum + (bet.return || 0), 0);
        const allTotalProfit = allTotalReturn - allTotalStaked;
        
        const allWinRate = (allWonBets.length / allSettledBets.length * 100).toFixed(1);
        const allROI = allTotalStaked > 0 ? (allTotalProfit / allTotalStaked * 100).toFixed(1) : '0.0';
        
        const allAvgCLV = betsWithCLV.reduce((sum, bet) => sum + (bet.clv || 0), 0) / betsWithCLV.length;
        
        console.log(`   Всего ставок: ${betsWithCLV.length}`);
        console.log(`   Завершено: ${allSettledBets.length}`);
        console.log(`   Общий Win Rate: ${allWinRate}% (${allWonBets.length}/${allSettledBets.length})`);
        console.log(`   Общий ROI: ${allROI}% (прибыль: ${allTotalProfit.toFixed(0)} руб.)`);
        console.log(`   Средний CLV: ${allAvgCLV.toFixed(4)}`);
        
        // Корреляция CLV и результата
        const positiveCLVWins = groups.positive.filter(bet => bet.result === 'won').length;
        const negativeCLVWins = groups.negative.filter(bet => bet.result === 'won').length;
        
        const positiveCLVWinRate = groups.positive.length > 0 ? (positiveCLVWins / groups.positive.filter(b => b.status === 'settled').length * 100).toFixed(1) : 'N/A';
        const negativeCLVWinRate = groups.negative.length > 0 ? (negativeCLVWins / groups.negative.filter(b => b.status === 'settled').length * 100).toFixed(1) : 'N/A';
        
        console.log(`\n🔗 КОРРЕЛЯЦИЯ CLV И РЕЗУЛЬТАТА:`);
        console.log(`   Положительный CLV → Win Rate: ${positiveCLVWinRate}%`);
        console.log(`   Отрицательный CLV → Win Rate: ${negativeCLVWinRate}%`);
        
        if (positiveCLVWinRate !== 'N/A' && negativeCLVWinRate !== 'N/A') {
          const difference = parseFloat(positiveCLVWinRate) - parseFloat(negativeCLVWinRate);
          console.log(`   Разница: ${difference.toFixed(1)}% в пользу положительного CLV`);
        }
      }
      
      // Рекомендации на основе анализа
      console.log('\n💡 РЕКОМЕНДАЦИИ НА ОСНОВЕ АНАЛИЗА CLV:');
      
      if (groups.positive.length > 0 && groups.positive.filter(b => b.status === 'settled').length > 5) {
        const positiveWinRate = parseFloat((groups.positive.filter(b => b.result === 'won').length / groups.positive.filter(b => b.status === 'settled').length * 100).toFixed(1));
        
        if (positiveWinRate > 55) {
          console.log(`   ✅ Ставки с положительным CLV показывают Win Rate ${positiveWinRate}%`);
          console.log(`   → Продолжайте фильтровать по CLV, это работает!`);
        }
      }
      
      if (groups.negative.length > 0 && groups.negative.filter(b => b.status === 'settled').length > 5) {
        const negativeWinRate = parseFloat((groups.negative.filter(b => b.result === 'won').length / groups.negative.filter(b => b.status === 'settled').length * 100).toFixed(1));
        
        if (negativeWinRate < 45) {
          console.log(`   ⚠️  Ставки с отрицательным CLV показывают Win Rate ${negativeWinRate}%`);
          console.log(`   → CLV фильтр эффективно отсеивает плохие ставки`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Ошибка анализа CLV: ${error.message}`);
      console.error(error.stack);
    }
  }

  /**
   * Возвращает эмодзи для группы
   */
  getGroupEmoji(groupName) {
    switch (groupName) {
      case 'positive': return '📈';
      case 'negative': return '📉';
      case 'neutral': return '↔️';
      default: return '📊';
    }
  }

  /**
   * Возвращает название группы на русском
   */
  getGroupName(groupName) {
    switch (groupName) {
      case 'positive': return 'Положительный CLV';
      case 'negative': return 'Отрицательный CLV';
      case 'neutral': return 'Нейтральный CLV';
      default: return groupName;
    }
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  const analyzer = new ClosingLineValueAnalyzer();
  analyzer.analyze().catch(error => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
  });
}

// Экспорт для тестирования
module.exports = ClosingLineValueAnalyzer;