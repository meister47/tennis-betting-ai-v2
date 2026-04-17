#!/usr/bin/env node

/**
 * Скрипт для создания ставок на основе анализа
 * Обертка вокруг real-today-analysis-min-odds.js с поддержкой CLV
 * 
 * Использование:
 * node create-bets-from-analysis.js
 */

const { analyzeMatches } = require('./real-today-analysis-min-odds.js');
const BetsManager = require('./bets-manager.js');
const path = require('path');

// Загружаем конфигурацию
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CLV_MODE_ENABLED = process.env.CLV_MODE_ENABLED === 'true' || false;

class BetCreator {
  constructor() {
    this.betsManager = new BetsManager();
  }

  /**
   * Создает ставку на основе рекомендации
   * @param {Object} recommendation - Данные рекомендации из анализа
   * @param {Object} eventData - Исходные данные события
   * @returns {Promise<Object|null>} - Созданная ставка или null
   */
  async createBetFromRecommendation(recommendation, eventData) {
    try {
      // Генерируем match_id (используем комбинацию игроков + время)
      const matchId = `tennis_${recommendation.match.replace(/ vs /g, '_').replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
      
      const betData = {
        event: `${recommendation.match} (${recommendation.tournament})`,
        market: `Победа ${recommendation.choice}`,
        odds: recommendation.odds,
        stake: recommendation.stake,
        notes: `Рекомендация tennis-betting-ai v2.0. Edge: ${(recommendation.edge * 100).toFixed(1)}%, Уверенность: ${recommendation.confidence}, Динамический edge: ${recommendation.dynamicEdgeEnabled ? 'ВКЛ' : 'ВЫКЛ'}`,
        surface: recommendation.surface,
        match_id: matchId,
        match_start_time: recommendation.time || new Date().toISOString(),
        player_name: recommendation.choice,
        tournament: recommendation.tournament
      };

      console.log(`🎯 СОЗДАЕМ СТАВКУ НА ОСНОВЕ АНАЛИЗА:`);
      console.log(`   Матч: ${betData.event}`);
      console.log(`   Игрок: ${betData.player_name} @ ${betData.odds}`);
      console.log(`   Ставка: ${betData.stake} руб.`);
      console.log(`   Edge: ${(recommendation.edge * 100).toFixed(1)}% (требуется: ${(recommendation.requiredEdge * 100).toFixed(1)}%)`);
      console.log(`   Уверенность: ${recommendation.confidence}`);
      
      if (CLV_MODE_ENABLED) {
        console.log(`   📊 РЕЖИМ CLV: ВКЛЮЧЕН (статус: waiting_for_closing_line)`);
      } else {
        console.log(`   ⚡ РЕЖИМ CLV: ВЫКЛЮЧЕН (статус: pending)`);
      }

      const bet = await this.betsManager.createBet(betData);
      return bet;
    } catch (error) {
      console.error(`❌ Ошибка создания ставки: ${error.message}`);
      return null;
    }
  }

  /**
   * Основная функция
   */
  async run() {
    console.log('🚀 ЗАПУСК СОЗДАНИЯ СТАВОК С ПОДДЕРЖКОЙ CLV');
    console.log(`   Время: ${new Date().toLocaleString('ru-RU')}`);
    console.log(`   Режим CLV: ${CLV_MODE_ENABLED ? '✅ ВКЛЮЧЕН' : '❌ ВЫКЛЮЧЕН'}\n`);
    
    try {
      // Инициализируем базу данных ставок
      await this.betsManager.initializeDatabase();
      
      // Выполняем анализ матчей
      console.log('🔍 Выполняем анализ матчей через real-today-analysis-min-odds.js...\n');
      const recommendations = await analyzeMatches();
      
      if (!recommendations || recommendations.length === 0) {
        console.log('ℹ️  Анализ не нашел рекомендаций для ставок.');
        return;
      }
      
      console.log(`📊 Найдено рекомендаций: ${recommendations.length}\n`);
      
      // Создаем ставки для каждой рекомендации
      let createdCount = 0;
      let errorCount = 0;
      
      for (const recommendation of recommendations) {
        console.log(`\n--- РЕКОМЕНДАЦИЯ ${createdCount + 1} из ${recommendations.length} ---`);
        
        const bet = await this.createBetFromRecommendation(recommendation, {});
        
        if (bet) {
          createdCount++;
        } else {
          errorCount++;
        }
        
        // Небольшая пауза между созданием ставок
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`\n🎉 РЕЗУЛЬТАТ СОЗДАНИЯ СТАВОК:`);
      console.log(`   Успешно создано: ${createdCount}`);
      console.log(`   С ошибками: ${errorCount}`);
      console.log(`   Всего рекомендаций: ${recommendations.length}`);
      
      // Показываем информацию о CLV
      const clvInfo = this.betsManager.getCLVInfo();
      console.log(`\n📊 ИНФОРМАЦИЯ О СИСТЕМЕ CLV:`);
      console.log(`   Режим: ${clvInfo.enabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
      console.log(`   Безопасный режим: ${clvInfo.dry_run ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
      
      if (CLV_MODE_ENABLED) {
        console.log(`\n📋 ДАЛЬНЕЙШИЕ ДЕЙСТВИЯ:`);
        console.log(`   1. Скрипт capture-closing-odds.js будет собирать closing коэффициенты`);
        console.log(`   2. Ставки получат статус pending/skipped_line_movement на основе CLV`);
        console.log(`   3. Используйте analyze-closing-line-value.js для анализа эффективности`);
      }
      
    } catch (error) {
      console.error(`❌ Ошибка в скрипте создания ставок: ${error.message}`);
      console.error(error.stack);
    }
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  const creator = new BetCreator();
  creator.run().catch(error => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
  });
}

// Экспорт для тестирования
module.exports = BetCreator;