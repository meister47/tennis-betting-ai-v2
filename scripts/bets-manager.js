#!/usr/bin/env node

/**
 * Менеджер для работы с базой данных ставок bets-db.json
 * Поддерживает CLV (Closing Line Value) систему
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Конфигурация из .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CLV_MODE_ENABLED = process.env.CLV_MODE_ENABLED === 'true' || false;
const CLV_DRY_RUN = process.env.CLV_DRY_RUN === 'true' || false;
const CLV_TIME_WINDOW_MINUTES = parseInt(process.env.CLV_TIME_WINDOW_MINUTES) || 20;
const CLV_CHECK_INTERVAL_MINUTES = parseInt(process.env.CLV_CHECK_INTERVAL_MINUTES) || 10;

const BETS_DB_PATH = path.join(__dirname, '..', 'data', 'bets-db.json');

class BetsManager {
  constructor() {
    this.betsDbPath = BETS_DB_PATH;
  }

  /**
   * Инициализирует базу данных ставок
   */
  async initializeDatabase() {
    try {
      await fs.access(this.betsDbPath);
      console.log('✅ База данных ставок уже существует');
    } catch (error) {
      // Создаем новую базу данных
      const initialData = {
        version: '1.1',  // Новая версия с поддержкой CLV
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stats: {
          total_bets: 0,
          won: 0,
          lost: 0,
          void: 0,
          pending: 0,
          active: 0,
          settled: 0,
          waiting_for_closing_line: 0,
          skipped_line_movement: 0,
          total_staked: 0,
          total_return: 0,
          total_profit: 0,
          roi: "0.0",
          win_rate: "0.0",
          avg_odds: "0.0",
          profit_per_bet: "0.0"
        },
        bets: []
      };

      await this.saveDatabase(initialData);
      console.log('✅ Создана новая база данных ставок');
    }
  }

  /**
   * Загружает базу данных
   */
  async loadDatabase() {
    try {
      const data = await fs.readFile(this.betsDbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Ошибка загрузки базы данных ставок:', error.message);
      // Создаем новую базу при ошибке
      await this.initializeDatabase();
      return await this.loadDatabase();
    }
  }

  /**
   * Сохраняет базу данных
   */
  async saveDatabase(data) {
    try {
      // Создаем папку data если не существует
      const dataDir = path.dirname(this.betsDbPath);
      await fs.mkdir(dataDir, { recursive: true });

      data.updated_at = new Date().toISOString();
      await fs.writeFile(this.betsDbPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('❌ Ошибка сохранения базы данных:', error.message);
      return false;
    }
  }

  /**
   * Создает новую ставку с поддержкой CLV
   * @param {Object} betData - Данные ставки
   * @returns {Object} - Созданная ставка с ID
   */
  async createBet(betData) {
    const db = await this.loadDatabase();
    
    // Генерируем уникальный ID ставки
    const betId = `bet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Определяем начальный статус в зависимости от режима CLV
    const initialStatus = CLV_MODE_ENABLED ? 'waiting_for_closing_line' : 'pending';
    
    const newBet = {
      id: betId,
      date: new Date().toISOString().split('T')[0],
      event: betData.event || 'Неизвестное событие',
      market: betData.market || 'Победа',
      odds: betData.odds || 0,
      stake: betData.stake || 0,
      result: 'pending',
      return: 0,
      profit: 0,
      status: initialStatus,
      notes: betData.notes || '',
      settled_at: null,
      surface: betData.surface || 'Unknown',
      
      // Поля для CLV системы
      odds_placed: betData.odds || 0,
      odds_closing: null,
      closing_captured_at: null,
      match_id: betData.match_id || null,
      match_start_time: betData.match_start_time || null,
      player_name: betData.player_name || null,
      tournament: betData.tournament || null,
      clv: null, // Closing Line Value
      clv_group: null // positive/negative/neutral
    };

    // Добавляем ставку в базу
    db.bets.push(newBet);
    
    // Обновляем статистику
    this.updateStats(db);
    
    await this.saveDatabase(db);
    
    console.log(`✅ Ставка создана: ${betId}`);
    console.log(`   Событие: ${newBet.event}`);
    console.log(`   Рынок: ${newBet.market} @ ${newBet.odds}`);
    console.log(`   Статус: ${newBet.status} (CLV mode: ${CLV_MODE_ENABLED})`);
    
    return newBet;
  }

  /**
   * Обновляет коэффициенты закрытия для ставки
   * @param {string} betId - ID ставки
   * @param {number} closingOdds - Коэффициент закрытия
   * @returns {boolean} - Успешно ли обновлено
   */
  async updateClosingOdds(betId, closingOdds) {
    if (CLV_DRY_RUN) {
      console.log(`[DRY RUN] Безопасный режим: ставка ${betId} получила бы odds_closing = ${closingOdds}`);
      return false;
    }

    const db = await this.loadDatabase();
    const betIndex = db.bets.findIndex(bet => bet.id === betId);
    
    if (betIndex === -1) {
      console.error(`❌ Ставка ${betId} не найдена`);
      return false;
    }

    const bet = db.bets[betIndex];
    
    // Проверяем, что ставка ожидает закрытия
    if (bet.status !== 'waiting_for_closing_line') {
      console.error(`❌ Ставка ${betId} имеет статус ${bet.status}, а не waiting_for_closing_line`);
      return false;
    }

    // Обновляем коэффициенты закрытия
    bet.odds_closing = closingOdds;
    bet.closing_captured_at = new Date().toISOString();

    // Рассчитываем CLV
    if (bet.odds_placed && bet.odds_closing) {
      bet.clv = (1 / bet.odds_closing) - (1 / bet.odds_placed);
      
      // Определяем группу CLV
      if (bet.clv > 0) {
        bet.clv_group = 'positive';
      } else if (bet.clv < 0) {
        bet.clv_group = 'negative';
      } else {
        bet.clv_group = 'neutral';
      }

      // Логируем CLV
      console.log(`📊 CLV расчет для ставки ${betId}:`);
      console.log(`   Коэффициент при ставке: ${bet.odds_placed}`);
      console.log(`   Коэффициент закрытия: ${bet.odds_closing}`);
      console.log(`   CLV: ${bet.clv.toFixed(4)} (${bet.clv_group})`);
    }

    // Решаем что делать со ставкой на основе CLV
    let newStatus = 'pending';
    let decisionReason = '';
    
    if (bet.odds_closing <= bet.odds_placed) {
      // Линия упала или осталась прежней - хороший знак
      newStatus = 'pending';
      decisionReason = 'Линия упала или стабильна';
    } else {
      // Линия выросла - плохой знак, пропускаем ставку
      newStatus = 'skipped_line_movement';
      decisionReason = 'Линия выросла, плохой CLV';
    }

    bet.status = newStatus;
    bet.notes = bet.notes ? `${bet.notes} | ${decisionReason}` : decisionReason;

    // Сохраняем обновления
    db.bets[betIndex] = bet;
    this.updateStats(db);
    await this.saveDatabase(db);

    console.log(`✅ Ставка ${betId} обновлена:`);
    console.log(`   Новый статус: ${newStatus}`);
    console.log(`   Причина: ${decisionReason}`);

    return true;
  }

  /**
   * Получает ставки, ожидающие закрытия линии
   * @returns {Array} - Массив ставок
   */
  async getBetsWaitingForClosingLine() {
    const db = await this.loadDatabase();
    const now = new Date();
    
    return db.bets.filter(bet => {
      // Проверяем статус
      if (bet.status !== 'waiting_for_closing_line') return false;
      
      // Проверяем, есть ли время начала матча
      if (!bet.match_start_time) return false;
      
      const matchStartTime = new Date(bet.match_start_time);
      
      // Проверяем, что матч скоро начнется (в пределах окна)
      const timeDiffMinutes = (matchStartTime - now) / (1000 * 60);
      
      return timeDiffMinutes >= 0 && timeDiffMinutes <= CLV_TIME_WINDOW_MINUTES;
    });
  }

  /**
   * Получает ставки с заполненным CLV для анализа
   * @returns {Array} - Массив ставок с CLV
   */
  async getBetsWithCLV() {
    const db = await this.loadDatabase();
    
    return db.bets.filter(bet => {
      return bet.status === 'settled' && 
             bet.odds_placed && 
             bet.odds_closing && 
             bet.clv !== null;
    });
  }

  /**
   * Обновляет статистику базы данных
   */
  updateStats(db) {
    const bets = db.bets;
    
    // Сбрасываем статистику
    const stats = {
      total_bets: bets.length,
      won: 0,
      lost: 0,
      void: 0,
      pending: 0,
      active: 0,
      settled: 0,
      waiting_for_closing_line: 0,
      skipped_line_movement: 0,
      total_staked: 0,
      total_return: 0,
      total_profit: 0
    };

    // Считаем статистику
    bets.forEach(bet => {
      // Подсчет по статусам
      if (bet.status === 'waiting_for_closing_line') stats.waiting_for_closing_line++;
      if (bet.status === 'skipped_line_movement') stats.skipped_line_movement++;
      if (bet.status === 'pending') stats.pending++;
      if (bet.status === 'active') stats.active++;
      if (bet.status === 'settled') stats.settled++;
      
      // Подсчет по результатам
      if (bet.result === 'won') stats.won++;
      if (bet.result === 'lost') stats.lost++;
      if (bet.result === 'void') stats.void++;
      
      // Финансовая статистика
      stats.total_staked += bet.stake || 0;
      stats.total_return += bet.return || 0;
    });

    // Рассчитываем производные показатели
    stats.total_profit = stats.total_return - stats.total_staked;
    stats.roi = stats.total_staked > 0 ? (stats.total_profit / stats.total_staked * 100).toFixed(1) : "0.0";
    stats.win_rate = stats.settled > 0 ? (stats.won / stats.settled * 100).toFixed(1) : "0.0";
    
    // Средний коэффициент
    const settledBets = bets.filter(bet => bet.status === 'settled');
    stats.avg_odds = settledBets.length > 0 
      ? (settledBets.reduce((sum, bet) => sum + (bet.odds || 0), 0) / settledBets.length).toFixed(2)
      : "0.0";
    
    // Прибыль на ставку
    stats.profit_per_bet = stats.settled > 0 ? (stats.total_profit / stats.settled).toFixed(2) : "0.0";

    db.stats = stats;
  }

  /**
   * Обновляет статус ставки
   * @param {string} betId - ID ставки
   * @param {string} newStatus - Новый статус
   * @param {string} notes - Примечания
   * @returns {boolean} - Успешно ли обновлено
   */
  async updateBetStatus(betId, newStatus, notes = '') {
    const db = await this.loadDatabase();
    const betIndex = db.bets.findIndex(bet => bet.id === betId);
    
    if (betIndex === -1) {
      console.error(`❌ Ставка ${betId} не найдена`);
      return false;
    }
    
    const bet = db.bets[betIndex];
    bet.status = newStatus;
    
    if (notes) {
      bet.notes = bet.notes ? `${bet.notes} | ${notes}` : notes;
    }
    
    db.bets[betIndex] = bet;
    this.updateStats(db);
    await this.saveDatabase(db);
    
    console.log(`✅ Статус ставки ${betId} обновлен: ${newStatus}`);
    return true;
  }

  /**
   * Возвращает информацию о системе CLV
   */
  getCLVInfo() {
    return {
      enabled: CLV_MODE_ENABLED,
      dry_run: CLV_DRY_RUN,
      time_window_minutes: CLV_TIME_WINDOW_MINUTES,
      check_interval_minutes: CLV_CHECK_INTERVAL_MINUTES
    };
  }
}

// Экспорт класса
module.exports = BetsManager;

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    const betsManager = new BetsManager();
    
    // Инициализируем базу данных
    await betsManager.initializeDatabase();
    
    const clvInfo = betsManager.getCLVInfo();
    console.log('🎯 Система CLV (Closing Line Value)');
    console.log(`   Режим CLV: ${clvInfo.enabled ? '✅ ВКЛЮЧЕН' : '❌ ВЫКЛЮЧЕН'}`);
    console.log(`   Безопасный режим: ${clvInfo.dry_run ? '✅ ВКЛЮЧЕН' : '❌ ВЫКЛЮЧЕН'}`);
    console.log(`   Окно сбора: ${clvInfo.time_window_minutes} минут до матча`);
    console.log(`   Интервал проверки: ${clvInfo.check_interval_minutes} минут`);
    
    const waitingBets = await betsManager.getBetsWaitingForClosingLine();
    console.log(`\n📊 Статистика:`);
    console.log(`   Ставок ожидает закрытия: ${waitingBets.length}`);
    
    const betsWithCLV = await betsManager.getBetsWithCLV();
    console.log(`   Ставок с рассчитанным CLV: ${betsWithCLV.length}`);
  })();
}