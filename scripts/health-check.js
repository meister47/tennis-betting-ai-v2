#!/usr/bin/env node

/**
 * Система мониторинга здоровья Tennis Betting AI
 * Запускается по cron раз в час
 */

const fs = require('fs');
const path = require('path');
const TelegramAlerter = require('./telegram-alert');

// Конфигурация
const HEALTH_FILE = path.join(__dirname, '../data/health-state.json');
const CACHE_DIR = path.join(__dirname, '../cache');
const DATA_DIR = path.join(__dirname, '../data');
const CONFIG = {
  // Интервалы проверки (в часах)
  thresholds: {
    analyzer: { warn: 3, error: 6 },
    clvTracker: { warn: 2, error: 4 },
    oddsCache: { warn: 12, error: 24 },
    system: { warn: 1, error: 3 } // Проверка самой системы мониторинга
  },
  // Активное время работы (часы UTC+3)
  activeHours: {
    start: 8,  // 08:00 MSK
    end: 23    // 23:00 MSK
  }
};

/**
 * Основной класс системы мониторинга здоровья
 */
class HealthMonitor {
  constructor() {
    this.alerter = new TelegramAlerter();
    this.healthState = this.loadHealthState();
    this.previousState = { ...this.healthState };
    this.results = {
      timestamp: new Date().toISOString(),
      components: [],
      overall: { status: 'ok', level: 'info', message: 'Система работает нормально' }
    };
  }

  /**
   * Загрузка состояния здоровья из файла
   */
  loadHealthState() {
    try {
      if (fs.existsSync(HEALTH_FILE)) {
        const content = fs.readFileSync(HEALTH_FILE, 'utf8');
        return JSON.parse(content);
      }
      return {};
    } catch (error) {
      console.error('[HEALTH] Failed to load health state:', error.message);
      return {};
    }
  }

  /**
   * Сохранение состояния здоровья
   */
  saveHealthState() {
    try {
      // Создаем директорию если не существует
      const dir = path.dirname(HEALTH_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(HEALTH_FILE, JSON.stringify(this.healthState, null, 2));
    } catch (error) {
      console.error('[HEALTH] Failed to save health state:', error.message);
    }
  }

  /**
   * Проверка компонента analyzer
   */
  checkAnalyzer() {
    const component = 'analyzer';
    const state = this.healthState[component];
    const now = new Date();
    const result = {
      name: 'analyzer',
      component,
      status: 'ok',
      level: 'info',
      message: 'Анализатор работает нормально'
    };

    if (!state || !state.lastRun) {
      result.status = 'error';
      result.level = 'critical';
      result.message = 'Анализатор никогда не запускался';
      result.lastRun = null;
      result.uptime = 0;
    } else {
      const lastRun = new Date(state.lastRun);
      const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
      result.lastRun = state.lastRun;
      result.hoursSinceLastRun = hoursSinceLastRun;
      result.uptime = state.status === 'ok' ? 1 : 0;

      // Проверяем пороги
      if (hoursSinceLastRun > CONFIG.thresholds.analyzer.error) {
        result.status = 'error';
        result.level = 'error';
        result.message = `Анализатор не запускался более ${CONFIG.thresholds.analyzer.error} часов`;
      } else if (hoursSinceLastRun > CONFIG.thresholds.analyzer.warn) {
        result.status = 'warn';
        result.level = 'warn';
        result.message = `Анализатор не запускался более ${CONFIG.thresholds.analyzer.warn} часов`;
      }
    }

    // Обновляем состояние в памяти
    this.healthState[component] = {
      ...state,
      lastCheck: now.toISOString(),
      status: result.status
    };

    this.results.components.push(result);
    return result;
  }

  /**
   * Проверка компонента clv-tracker
   */
  checkClvTracker() {
    const component = 'clv-tracker';
    const state = this.healthState[component];
    const now = new Date();
    const result = {
      name: 'clv-tracker',
      component,
      status: 'ok',
      level: 'info',
      message: 'CLV-трекер работает нормально'
    };

    if (!state || !state.lastRun) {
      result.status = 'error';
      result.level = 'critical';
      result.message = 'CLV-трекер никогда не запускался';
      result.lastRun = null;
      result.uptime = 0;
    } else {
      const lastRun = new Date(state.lastRun);
      const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
      result.lastRun = state.lastRun;
      result.hoursSinceLastRun = hoursSinceLastRun;
      result.uptime = state.status === 'ok' ? 1 : 0;

      // Проверяем активное время (UTC+3)
      const mskHour = (now.getUTCHours() + 3) % 24;
      const isActiveTime = mskHour >= CONFIG.activeHours.start && mskHour <= CONFIG.activeHours.end;

      // Более строгие проверки в активное время
      if (hoursSinceLastRun > CONFIG.thresholds.clvTracker.error) {
        result.status = 'error';
        result.level = 'error';
        result.message = `CLV-трекер не запускался более ${CONFIG.thresholds.clvTracker.error} часов`;
      } else if (isActiveTime && hoursSinceLastRun > CONFIG.thresholds.clvTracker.warn) {
        result.status = 'warn';
        result.level = 'warn';
        result.message = `CLV-трекер не запускался более ${CONFIG.thresholds.clvTracker.warn} часов в активное время`;
      } else if (!isActiveTime && hoursSinceLastRun > CONFIG.thresholds.clvTracker.warn * 2) {
        result.status = 'warn';
        result.level = 'warn';
        result.message = `CLV-трекер не запускался более ${CONFIG.thresholds.clvTracker.warn * 2} часов`;
      }

      result.isActiveTime = isActiveTime;
    }

    // Обновляем состояние в памяти
    this.healthState[component] = {
      ...state,
      lastCheck: now.toISOString(),
      status: result.status
    };

    this.results.components.push(result);
    return result;
  }

  /**
   * Проверка кэша коэффициентов
   */
  checkOddsCache() {
    const component = 'odds-cache';
    const cacheFile = path.join(CACHE_DIR, 'odds-cache.json');
    const now = new Date();
    const result = {
      name: 'odds-cache',
      component,
      status: 'ok',
      level: 'info',
      message: 'Кэш коэффициентов актуален'
    };

    if (!fs.existsSync(cacheFile)) {
      result.status = 'error';
      result.level = 'error';
      result.message = 'Файл кэша не существует';
      result.lastRun = null;
      result.uptime = 0;
    } else {
      try {
        const stats = fs.statSync(cacheFile);
        const hoursSinceModified = (now - stats.mtime) / (1000 * 60 * 60);
        result.lastRun = stats.mtime.toISOString();
        result.hoursSinceLastRun = hoursSinceModified;
        result.uptime = 1;

        // Проверяем размер файла
        const fileSizeMB = stats.size / (1024 * 1024);
        result.fileSizeMB = fileSizeMB;

        if (hoursSinceModified > CONFIG.thresholds.oddsCache.error) {
          result.status = 'error';
          result.level = 'error';
          result.message = `Кэш коэффициентов устарел (более ${CONFIG.thresholds.oddsCache.error} часов)`;
        } else if (hoursSinceModified > CONFIG.thresholds.oddsCache.warn) {
          result.status = 'warn';
          result.level = 'warn';
          result.message = `Кэш коэффициентов устарел (более ${CONFIG.thresholds.oddsCache.warn} часов)`;
        }

        if (fileSizeMB < 0.001) {
          result.status = 'warn';
          result.level = 'warn';
          result.message += ' | Кэш слишком мал (возможно пустой)';
        }
      } catch (error) {
        result.status = 'error';
        result.level = 'error';
        result.message = `Ошибка чтения кэша: ${error.message}`;
      }
    }

    this.results.components.push(result);
    return result;
  }

  /**
   * Проверка системы мониторинга
   */
  checkSystemHealth() {
    const component = 'health-monitor';
    const now = new Date();
    
    // Проверяем когда последний раз запускалась сама система мониторинга
    const systemState = this.healthState[component] || {};
    const lastSystemRun = systemState.lastRun ? new Date(systemState.lastRun) : null;
    
    const result = {
      name: 'health-monitor',
      component,
      status: 'ok',
      level: 'info',
      message: 'Система мониторинга работает'
    };

    if (lastSystemRun) {
      const hoursSinceSystemRun = (now - lastSystemRun) / (1000 * 60 * 60);
      result.lastRun = systemState.lastRun;
      result.hoursSinceLastRun = hoursSinceSystemRun;
      result.uptime = 1;

      if (hoursSinceSystemRun > CONFIG.thresholds.system.error) {
        result.status = 'error';
        result.level = 'critical';
        result.message = `Система мониторинга не запускалась более ${CONFIG.thresholds.system.error} часов`;
      } else if (hoursSinceSystemRun > CONFIG.thresholds.system.warn) {
        result.status = 'warn';
        result.level = 'warn';
        result.message = `Система мониторинга не запускалась более ${CONFIG.thresholds.system.warn} часов`;
      }
    }

    // Обновляем состояние системы мониторинга
    this.healthState[component] = {
      lastRun: now.toISOString(),
      lastCheck: now.toISOString(),
      status: result.status,
      pid: process.pid
    };

    this.results.components.push(result);
    return result;
  }

  /**
   * Определение общего статуса системы
   */
  calculateOverallStatus() {
    const components = this.results.components;
    
    // Подсчитываем статусы
    const errorCount = components.filter(c => c.status === 'error').length;
    const warnCount = components.filter(c => c.status === 'warn').length;
    const okCount = components.filter(c => c.status === 'ok').length;
    const total = components.length;

    let overallStatus = 'ok';
    let overallLevel = 'info';
    let message = `Все компоненты работают нормально (${okCount}/${total})`;

    if (errorCount > 0) {
      overallStatus = 'error';
      overallLevel = 'error';
      message = `Критические проблемы: ${errorCount} компонентов с ошибками`;
    } else if (warnCount > 0) {
      overallStatus = 'warn';
      overallLevel = 'warn';
      message = `Предупреждения: ${warnCount} компонентов требуют внимания`;
    }

    this.results.overall = {
      status: overallStatus,
      level: overallLevel,
      message,
      stats: { total, ok: okCount, warn: warnCount, error: errorCount }
    };

    return this.results.overall;
  }

  /**
   * Проверка изменений состояния компонентов
   */
  checkStateChanges() {
    const changes = [];

    for (const component in this.healthState) {
      const currentState = this.healthState[component];
      const previousState = this.previousState[component];

      if (!previousState) {
        // Первая запись компонента
        changes.push({
          component,
          type: 'new',
          from: null,
          to: currentState.status,
          timestamp: currentState.lastCheck || currentState.lastRun
        });
      } else if (previousState.status !== currentState.status) {
        // Изменение статуса
        changes.push({
          component,
          type: 'status_change',
          from: previousState.status,
          to: currentState.status,
          timestamp: currentState.lastCheck || currentState.lastRun
        });
      }
    }

    return changes;
  }

  /**
   * Отправка алертов об изменениях
   */
  async sendAlertsForChanges(changes) {
    for (const change of changes) {
      const component = change.component;
      const componentResult = this.results.components.find(c => c.component === component);
      
      if (!componentResult) continue;

      // Отправляем алерт только для значимых изменений
      if (change.type === 'new' || (change.from && change.to && change.from !== change.to)) {
        const level = componentResult.level;
        const message = componentResult.message;
        
        await this.alerter.sendComponentAlert(
          component,
          componentResult.status,
          `${change.type === 'new' ? 'Новый компонент' : `Статус изменился с ${change.from} на ${change.to}`}: ${message}`,
          {
            lastRun: componentResult.lastRun,
            hoursSinceLastRun: componentResult.hoursSinceLastRun,
            uptime: componentResult.uptime
          }
        );
      }
    }
  }

  /**
   * Запуск всех проверок
   */
  async runChecks() {
    console.log('[HEALTH] Starting health checks...');

    try {
      // Выполняем все проверки
      this.checkAnalyzer();
      this.checkClvTracker();
      this.checkOddsCache();
      this.checkSystemHealth();

      // Рассчитываем общий статус
      this.calculateOverallStatus();

      // Проверяем изменения состояния
      const changes = this.checkStateChanges();

      // Сохраняем состояние
      this.saveHealthState();

      // Сохраняем результаты проверки
      this.saveCheckResults();

      // Отправляем алерты если есть изменения
      if (changes.length > 0) {
        await this.sendAlertsForChanges(changes);
      }

      // Отправляем сводку если есть проблемы или раз в 24 часа
      const shouldSendSummary = 
        this.results.overall.status !== 'ok' || 
        (new Date().getHours() === 12); // В 12:00 по UTC

      if (shouldSendSummary) {
        await this.alerter.sendHealthSummary(this.results);
      }

      console.log('[HEALTH] Health checks completed:', this.results.overall);

      return this.results;

    } catch (error) {
      console.error('[HEALTH] Error during health checks:', error);
      
      // Отправляем алерт об ошибке в системе мониторинга
      await this.alerter.send(
        `Система мониторинга здоровья завершилась с ошибкой: ${error.message}`,
        'critical',
        { component: 'health-monitor', status: 'error' }
      );

      throw error;
    }
  }

  /**
   * Сохранение результатов проверки
   */
  saveCheckResults() {
    try {
      const resultsFile = path.join(DATA_DIR, 'health-results.json');
      const dir = path.dirname(resultsFile);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Загружаем историю
      let history = [];
      if (fs.existsSync(resultsFile)) {
        history = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      }

      // Добавляем текущий результат
      history.unshift(this.results);

      // Ограничиваем историю 100 записями
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      fs.writeFileSync(resultsFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('[HEALTH] Failed to save check results:', error.message);
    }
  }
}

/**
 * Основная функция запуска
 */
async function main() {
  try {
    const monitor = new HealthMonitor();
    const results = await monitor.runChecks();

    // Возвращаем код выхода в зависимости от статуса
    if (results.overall.status === 'error') {
      process.exit(1);
    } else if (results.overall.status === 'warn') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('[HEALTH] Fatal error:', error);
    process.exit(3);
  }
}

// Запуск если скрипт вызван напрямую
if (require.main === module) {
  main();
}

module.exports = HealthMonitor;