#!/usr/bin/env node

/**
 * Скрипт для сбора closing коэффициентов для системы CLV
 * Запускается по cron каждые 5-10 минут
 * 
 * Функционал:
 * 1. Читает bets-db.json
 * 2. Находит ставки со статусом 'waiting_for_closing_line'
 * 3. Матчи в диапазоне: NOW() <= start_time <= NOW() + 20 минут
 * 4. Запрашивает Odds-API для актуальных коэффициентов
 * 5. Обновляет odds_closing и принимает решение
 */

// ================== НОВОЕ: ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА ==================
const Logger = require('../src/logger');
const logger = new Logger('clv-tracker');

// ================== НАСТРОЙКА РЕЖИМА ЛОГГИРОВАНИЯ ==================
const USE_JSON_LOGGER = true; // Флаг для быстрого отключения/включения

const BetsManager = require('./bets-manager.js');
const axios = require('axios');
const path = require('path');

// Загружаем конфигурацию
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Загружаем конфигурацию API
const ODDS_API_IO_KEY = process.env.ODDS_API_IO_KEY;
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY;
const USE_ODDS_API_IO = process.env.USE_ODDS_API_IO === 'true' || false;
const CLV_MODE_ENABLED = process.env.CLV_MODE_ENABLED === 'true' || false;
const CLV_DRY_RUN = process.env.CLV_DRY_RUN === 'true' || false;
const CLV_TIME_WINDOW_MINUTES = parseInt(process.env.CLV_TIME_WINDOW_MINUTES) || 20;

// Настройки API (используем Odds-API.io по умолчанию)
const ODDS_API_CONFIG = {
  // Odds-API.io (новый основной)
  io: {
    BASE_URL: 'https://api.the-odds-api.io/v4',
    SPORT: 'tennis_atp',
    REGIONS: 'eu',
    MARKETS: 'h2h',
    KEY: ODDS_API_IO_KEY
  },
  // The-Odds-API.com (старый, для совместимости)
  com: {
    BASE_URL: 'https://api.the-odds-api.com/v4',
    SPORT: 'tennis_atp',
    REGIONS: 'eu',
    MARKETS: 'h2h',
    KEY: THE_ODDS_API_KEY
  }
};

// Выбираем активный API на основе конфигурации
const ACTIVE_API = USE_ODDS_API_IO ? 'io' : 'com';

class ClosingOddsCapture {
  constructor() {
    this.betsManager = new BetsManager();
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Tennis-Betting-AI-CLV/1.0'
      }
    });
  }

  /**
   * Получает актуальные коэффициенты для матча из Odds-API
   * @param {string} matchId - ID матча в Odds-API
   * @returns {Object|null} - Данные матча или null при ошибке
   */
  async fetchCurrentOdds(matchId) {
    try {
      const apiConfig = ODDS_API_CONFIG[ACTIVE_API];
      const apiKey = apiConfig.KEY;
      
      if (!apiKey) {
        logger.error(`Ключ API не установлен для ${ACTIVE_API === 'io' ? 'Odds-API.io' : 'The-Odds-API.com'}`);
        // Пробуем переключиться на альтернативный API
        const altApi = ACTIVE_API === 'io' ? 'com' : 'io';
        const altConfig = ODDS_API_CONFIG[altApi];
        const altApiKey = altConfig.KEY;
        
        if (!altApiKey) {
          logger.error('Оба ключа API отсутствуют!');
          return null;
        }
        
        logger.info(`Переключаемся на альтернативный API: ${altApi === 'io' ? 'Odds-API.io' : 'The-Odds-API.com'}`);
        return await this.fetchCurrentOddsWithApi(matchId, altApi, altConfig);
      }
      
      return await this.fetchCurrentOddsWithApi(matchId, ACTIVE_API, apiConfig);
    } catch (error) {
      logger.error('Критическая ошибка в fetchCurrentOdds', { matchId, error: error.message });
      return null;
    }
  }
  
  /**
   * Вспомогательный метод для запроса к конкретному API
   */
  async fetchCurrentOddsWithApi(matchId, apiName, apiConfig) {
    try {
      const url = `${apiConfig.BASE_URL}/sports/${apiConfig.SPORT}/events/${matchId}/odds`;
      const params = {
        apiKey: apiConfig.KEY,
        regions: apiConfig.REGIONS,
        markets: apiConfig.MARKETS
      };

      logger.info('Запрос коэффициентов для матча', { 
        matchId, 
        api: apiName === 'io' ? 'Odds-API.io' : 'The-Odds-API.com',
        url: `${apiConfig.BASE_URL}/sports/${apiConfig.SPORT}/events/{id}/odds`
      });

      const response = await this.httpClient.get(url, { params });
      
      if (!response.data) {
        logger.warn('Нет данных в ответе API', { matchId, api: apiName });
        return null;
      }

      logger.info('Коэффициенты получены', { 
        matchId, 
        api: apiName === 'io' ? 'Odds-API.io' : 'The-Odds-API.com',
        homeTeam: response.data.home_team,
        awayTeam: response.data.away_team,
        eventType: response.data.sport_key
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        // API вернул ошибку
        logger.error('Ошибка API', { 
          matchId, 
          api: apiName === 'io' ? 'Odds-API.io' : 'The-Odds-API.com',
          status: error.response.status,
          statusText: error.response.statusText
        });
      } else if (error.request) {
        // Не было ответа от сервера
        logger.error('Нет ответа от сервера', { 
          matchId, 
          api: apiName === 'io' ? 'Odds-API.io' : 'The-Odds-API.com',
          error: error.message 
        });
      } else {
        // Ошибка конфигурации
        logger.error('Ошибка запроса', { 
          matchId, 
          api: apiName === 'io' ? 'Odds-API.io' : 'The-Odds-API.com',
          error: error.message 
        });
      }
      return null;
    }
  }

  /**
   * Находит ставки ожидающие closing line
   * @returns {Array} - Массив ставок
   */
  async findBetsNeedingClosingLine() {
    try {
      const bets = this.betsManager.getBets();
      
      const now = new Date();
      const futureCutoff = new Date(now.getTime() + CLV_TIME_WINDOW_MINUTES * 60000);
      
      const targetBets = bets.filter(bet => {
        // Только ставки в состоянии waiting_for_closing_line
        if (bet.status !== 'waiting_for_closing_line') {
          return false;
        }

        // Проверяем что match_start_time есть
        if (!bet.match_start_time) {
          return false;
        }

        const matchTime = new Date(bet.match_start_time);
        
        // Матч должен начаться в ближайшем окне
        return matchTime >= now && matchTime <= futureCutoff;
      });

      logger.info('Найдены ставки для обработки', { 
        totalBets: bets.length, 
        targetBets: targetBets.length,
        clvWindowMinutes: CLV_TIME_WINDOW_MINUTES 
      });
      /* БЫЛО:
      console.log(`📊 Найдено ставок: ${targetBets.length} из ${bets.length} (окно: ${CLV_TIME_WINDOW_MINUTES} минут)`);
      */

      return targetBets;
    } catch (error) {
      logger.error('Ошибка поиска ставок', { error: error.message });
      /* БЫЛО:
      console.error(`❌ Ошибка поиска ставок: ${error.message}`);
      */
      return [];
    }
  }

  /**
   * Получает коэффициент для конкретного игрока
   * @param {Object} matchData - Данные матча от Odds-API
   * @param {string} playerName - Имя игрока
   * @returns {number|null} - Коэффициент или null
   */
  getPlayerOdds(matchData, playerName) {
    if (!matchData.bookmakers || matchData.bookmakers.length === 0) {
      return null;
    }

    // Берем первого букмекера
    const bookmaker = matchData.bookmakers[0];
    if (!bookmaker.markets || bookmaker.markets.length === 0) {
      return null;
    }

    const market = bookmaker.markets[0];
    if (!market.outcomes || market.outcomes.length === 0) {
      return null;
    }

    const outcome = market.outcomes.find(o => 
      o.name.toLowerCase() === playerName.toLowerCase()
    );

    return outcome ? outcome.price : null;
  }

  /**
   * Принимает решение на основе изменения коэффициентов
   * @param {number} openingOdds - Коэффициент открытия
   * @param {number} closingOdds - Коэффициент закрытия
   * @param {Object} bet - Данные ставки
   * @returns {string} - Решение: 'confirm', 'cancel', 'hedge' }
   */
  makeDecision(bet, currentOdds) {
    const placedOdds = bet.odds_placed;
    const closingOdds = currentOdds;
    
    logger.debug('Принятие решения по ставке', { 
      betId: bet.id,
      placedOdds,
      closingOdds,
      difference: closingOdds - placedOdds 
    });
    /* БЫЛО:
    console.log(`   Разница: ${closingOdds} vs ${placedOdds} = ${(closingOdds - placedOdds).toFixed(2)}`);
    */

    // Логика принятия решения
    const ODDS_CHANGE_THRESHOLD = 0.2; // 20% изменение

    if (!closingOdds || closingOdds <= 0) {
      logger.warn('Неверный closing odds', { betId: bet.id, closingOdds });
      /* БЫЛО:
      console.log(`⚠️  Неверный closing odds: ${closingOdds}`);
      */
      return 'confirm'; // Подтверждаем по умолчанию
    }

    const change = (closingOdds - placedOdds) / placedOdds;

    if (change > ODDS_CHANGE_THRESHOLD) {
      // Коэффициент вырос значительно - подтверждаем (выгодно)
      logger.info('Коэффициент вырос - подтверждаем ставку', { 
        betId: bet.id, 
        change: (change * 100).toFixed(1) + '%',
        threshold: (ODDS_CHANGE_THRESHOLD * 100) + '%' 
      });
      /* БЫЛО:
      console.log(`✅ Коэффициент вырос на ${(change * 100).toFixed(1)}% - ПОДТВЕРЖДАЕМ`);
      */
      return 'confirm';
    } else if (change < -ODDS_CHANGE_THRESHOLD) {
      // Коэффициент упал значительно - отменяем (невыгодно)
      logger.info('Коэффициент упал - отменяем ставку', { 
        betId: bet.id, 
        change: (change * 100).toFixed(1) + '%',
        threshold: (-ODDS_CHANGE_THRESHOLD * 100) + '%' 
      });
      /* БЫЛО:
      console.log(`❌ Коэффициент упал на ${(change * 100).toFixed(1)}% - ОТМЕНЯЕМ`);
      */
      return 'cancel';
    } else {
      // Небольшое изменение - хеджируем
      logger.info('Небольшое изменение - хеджируем', { 
        betId: bet.id, 
        change: (change * 100).toFixed(1) + '%' 
      });
      /* БЫЛО:
      console.log(`⚠️  Небольшое изменение ${(change * 100).toFixed(1)}% - ХЕДЖИРУЕМ`);
      */
      return 'hedge';
    }
  }

  /**
   * Обрабатывает одну ставку
   * @param {Object} bet - Данные ставки
   * @returns {boolean} - Успех
   */
  async processBet(bet) {
    logger.info('Обработка ставки', { 
      betId: bet.id,
      matchId: bet.match_id,
      player: bet.player_name,
      placedOdds: bet.odds_placed,
      status: bet.status 
    });
    /* БЫЛО:
    console.log(`\n🎯 Ставка #${bet.id}: ${bet.player_name} @ ${bet.odds_placed}`);
    console.log(`   Матч: ${bet.event} (${bet.match_id})`);
    */

    try {
      // Получаем актуальные коэффициенты
      const matchData = await this.fetchCurrentOdds(bet.match_id);
      if (!matchData) {
        logger.warn('Не удалось получить коэффициенты', { betId: bet.id, matchId: bet.match_id });
        /* БЫЛО:
        console.log(`⚠️  Не удалось получить коэффициенты для матча ${bet.match_id}`);
        */
        return false;
      }

      // Получаем коэффициент для конкретного игрока
      const currentOdds = this.getPlayerOdds(matchData, bet.player_name);
      if (!currentOdds) {
        logger.warn('Не найден коэффициент игрока', { 
          betId: bet.id, 
          player: bet.player_name,
          availablePlayers: matchData.home_team + ' vs ' + matchData.away_team 
        });
        /* БЫЛО:
        console.log(`⚠️  Не найден коэффициент для игрока ${bet.player_name}`);
        console.log(`   Доступные: ${matchData.home_team} vs ${matchData.away_team}`);
        */
        return false;
      }

      logger.info('Текущий коэффициент получен', { 
        betId: bet.id, 
        currentOdds,
        placedOdds: bet.odds_placed 
      });
      /* БЫЛО:
      console.log(`✅ Текущий коэффициент: ${currentOdds}`);
      */

      // Принимаем решение
      const decision = this.makeDecision(bet, currentOdds);
      
      // Обновляем ставку
      const updateData = {
        odds_closing: currentOdds,
        decision,
        last_checked: new Date().toISOString()
      };

      if (!CLV_DRY_RUN) {
        const success = await this.betsManager.updateBet(bet.id, updateData);
        
        if (success) {
          logger.ok('Ставка обновлена', { 
            betId: bet.id, 
            decision,
            currentOdds,
            placedOdds: bet.odds_placed,
            dryRun: false 
          });
          /* БЫЛО:
          console.log(`✅ Ставка обновлена: ${decision.toUpperCase()}`);
          */
          return true;
        } else {
          logger.error('Ошибка обновления ставки', { betId: bet.id });
          /* БЫЛО:
          console.error(`❌ Ошибка обновления ставки ${bet.id}`);
          */
          return false;
        }
      } else {
        logger.info('DRY RUN: Ставка не обновлена', { 
          betId: bet.id, 
          decision,
          currentOdds,
          placedOdds: bet.odds_placed 
        });
        /* БЫЛО:
        console.log(`📝 DRY RUN: Ставка НЕ обновлена (решение: ${decision})`);
        */
        return true;
      }

    } catch (error) {
      logger.error('Ошибка обработки ставки', { 
        betId: bet.id, 
        error: error.message 
      });
      /* БЫЛО:
      console.error(`❌ Ошибка обработки ставки ${bet.id}: ${error.message}`);
      */
      return false;
    }
  }

  /**
   * Основной метод выполнения
   */
  async execute() {
    if (!CLV_MODE_ENABLED) {
      logger.info('CLV режим отключен, пропускаем выполнение');
      /* БЫЛО:
      console.log('📭 CLV режим отключен, пропускаем выполнение');
      */
      return { processed: 0, skipped: true };
    }

    logger.info('Запуск CLV обработки', { 
      clvMode: CLV_MODE_ENABLED,
      dryRun: CLV_DRY_RUN,
      windowMinutes: CLV_TIME_WINDOW_MINUTES 
    });
    /* БЫЛО:
    console.log('🔁 ЗАПУСК CLV ОБРАБОТКИ 🔁');
    console.log(`⚙️  Режим: ${CLV_MODE_ENABLED ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📝 Dry Run: ${CLV_DRY_RUN ? 'ДА' : 'НЕТ'}`);
    console.log(`⏱️  Окно времени: ${CLV_TIME_WINDOW_MINUTES} минут`);
    console.log('='.repeat(50));
    */

    try {
      // Находим ставки для обработки
      const bets = await this.findBetsNeedingClosingLine();
      
      if (bets.length === 0) {
        logger.info('Нет ставок для обработки');
        /* БЫЛО:
        console.log('📭 Нет ставок для обработки');
        */
        return { processed: 0, skipped: false };
      }

      logger.info('Обработка ставок', { count: bets.length });
      /* БЫЛО:
      console.log(`📊 Обработка ${bets.length} ставок...`);
      */

      let successCount = 0;
      
      // Обрабатываем каждую ставку
      for (const bet of bets) {
        const success = await this.processBet(bet);
        if (success) successCount++;
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Итоговая статистика
      logger.info('CLV обработка завершена', { 
        total: bets.length, 
        successful: successCount,
        failed: bets.length - successCount,
        successRate: Math.round((successCount / bets.length) * 100) + '%'
      });
      /* БЫЛО:
      console.log('\n' + '='.repeat(50));
      console.log('🎉 CLV ОБРАБОТКА ЗАВЕРШЕНА');
      console.log(`📊 Итоги: ${successCount}/${bets.length} успешно обработано`);
      console.log('='.repeat(50));
      */

      return {
        processed: bets.length,
        successful: successCount,
        failed: bets.length - successCount,
        successRate: Math.round((successCount / bets.length) * 100)
      };

    } catch (error) {
      logger.error('Критическая ошибка CLV обработки', { 
        error: error.message,
        stack: error.stack 
      });
      /* БЫЛО:
      console.error('❌ Критическая ошибка CLV обработки:', error.message);
      console.error(error.stack);
      */
      return { processed: 0, error: error.message };
    }
  }
}

// Главная функция
async function main() {
  const clvCapture = new ClosingOddsCapture();
  return await clvCapture.execute();
}

// Запуск
if (require.main === module) {
  main().then(result => {
    process.exit(0);
  }).catch(error => {
    logger.error('Необработанная ошибка в main', { error: error.message });
    /* БЫЛО:
    console.error('❌ Необработанная ошибка:', error.message);
    */
    process.exit(1);
  });
}

module.exports = ClosingOddsCapture;