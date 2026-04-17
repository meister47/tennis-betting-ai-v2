#!/usr/bin/env node

/**
 * The Odds API Update Scheduler
 * Планировщик для автоматического обновления кэша в определённое время
 * Экономит токены, делая запросы только когда нужно
 */

// ================== НОВОЕ: ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА ==================
const Logger = require('../src/logger');
const logger = new Logger('scheduler');

// ================== НАСТРОЙКА РЕЖИМА ЛОГГИРОВАНИЯ ==================
const USE_JSON_LOGGER = true; // Флаг для быстрого отключения/включения

const OddsCacheManager = require('./odds-cache-manager');
const fs = require('fs');
const path = require('path');

// Время обновления (локальное время Амстердама)
const UPDATE_SCHEDULE = [
  '08:00',  // Утро (перед началом дневных матчей)
  '13:00',  // Обед (обновление перед вечерними матчами)
  '18:00'   // Вечер (обновление на завтра)
];

// Файл для хранения расписания
const SCHEDULE_FILE = path.join(__dirname, '../cache/update-schedule.json');

class OddsUpdateScheduler {
  constructor() {
    this.cacheManager = new OddsCacheManager();
    this.loadSchedule();
  }

  // Загрузка расписания из файла
  loadSchedule() {
    try {
      if (fs.existsSync(SCHEDULE_FILE)) {
        const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
        this.schedule = JSON.parse(data);
        logger.info('Загружено расписание из файла', { 
          file: SCHEDULE_FILE,
          entries: this.schedule.length 
        });
        /* БЫЛО:
        console.log('✅ Загружено расписание из файла');
        */
      } else {
        this.schedule = this.createDefaultSchedule();
        this.saveSchedule();
      }
    } catch (error) {
      logger.error('Ошибка загрузки расписания', { 
        error: error.message,
        file: SCHEDULE_FILE 
      });
      /* БЫЛО:
      console.log('❌ Ошибка загрузки расписания:', error.message);
      */
      this.schedule = this.createDefaultSchedule();
    }
  }

  // Создание расписания по умолчанию
  createDefaultSchedule() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const defaultSchedule = UPDATE_SCHEDULE.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date(today);
      date.setHours(hours, minutes, 0, 0);
      
      return {
        time,
        timestamp: date.getTime(),
        executed: false,
        forced: false
      };
    });

    logger.info('Создано расписание по умолчанию', { 
      today,
      scheduleTimes: UPDATE_SCHEDULE,
      entries: defaultSchedule.length 
    });
    /* БЫЛО:
    console.log(`📅 Создано расписание на ${today}: ${UPDATE_SCHEDULE.join(', ')}`);
    */

    return defaultSchedule;
  }

  // Сохранение расписания
  saveSchedule() {
    try {
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(this.schedule, null, 2));
      logger.debug('Расписание сохранено', { 
        file: SCHEDULE_FILE,
        entries: this.schedule.length 
      });
      /* БЫЛО:
      console.log('💾 Расписание сохранено');
      */
    } catch (error) {
      logger.error('Ошибка сохранения расписания', { 
        error: error.message,
        file: SCHEDULE_FILE 
      });
      /* БЫЛО:
      console.error('❌ Ошибка сохранения расписания:', error.message);
      */
    }
  }

  // Проверка, нужно ли обновлять кэш
  shouldUpdate() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM формате
    
    // Проверяем каждый элемент расписания
    for (const entry of this.schedule) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const scheduleTime = hours * 100 + minutes;
      
      // Если время наступило и ещё не выполнено
      if (currentTime >= scheduleTime && !entry.executed) {
        logger.info('Время для обновления', { 
          scheduleTime: entry.time,
          currentTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
          entry
        });
        /* БЫЛО:
        console.log(`🕒 Время обновления: ${entry.time} (сейчас: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')})`);
        */
        return { shouldUpdate: true, entry };
      }
    }
    
    // Проверяем принудительные обновления
    const forcedEntry = this.schedule.find(e => e.forced && !e.executed);
    if (forcedEntry) {
      logger.info('Принудительное обновление', { entry: forcedEntry });
      /* БЫЛО:
      console.log(`🔧 Принудительное обновление запланировано`);
      */
      return { shouldUpdate: true, entry: forcedEntry };
    }
    
    // Проверяем устаревший кэш
    const stats = this.cacheManager.getStats();
    if (stats.isExpired) {
      logger.warn('Кэш устарел, требуется обновление', { 
        cacheAgeHours: stats.cacheAgeHours,
        ttlHours: 24 
      });
      /* БЫЛО:
      console.log(`⚠️  Кэш устарел (${stats.cacheAgeHours} часов), требуется обновление`);
      */
      return { shouldUpdate: true, entry: { time: 'expired', forced: true } };
    }
    
    logger.debug('Обновление не требуется', { 
      currentTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
      scheduleTimes: UPDATE_SCHEDULE 
    });
    /* БЫЛО:
    console.log(`📭 Обновление не требуется (следующее: ${this.getNextUpdateTime()})`);
    */
    return { shouldUpdate: false, entry: null };
  }

  // Получение времени следующего обновления
  getNextUpdateTime() {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    for (const time of UPDATE_SCHEDULE) {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduleTime = hours * 100 + minutes;
      
      if (scheduleTime > currentTime) {
        return time;
      }
    }
    
    // Если все обновления на сегодня выполнены, возвращаем первое завтра
    return UPDATE_SCHEDULE[0];
  }

  // Выполнение обновления
  async executeUpdate() {
    logger.info('Запуск обновления кэша');
    /* БЫЛО:
    console.log('🔄 ЗАПУСК ОБНОВЛЕНИЯ КЭША 🔄');
    */
    
    try {
      // Получаем данные с обновлением кэша
      const events = await this.cacheManager.getTennisOdds(true);
      
      if (!events || events.length === 0) {
        logger.warn('Обновление завершено без данных', { 
          eventCount: 0,
          status: 'empty' 
        });
        /* БЫЛО:
        console.log('⚠️  Обновление завершено без данных');
        */
        return { success: false, events: 0, error: 'No data' };
      }
      
      logger.ok('Обновление успешно', { 
        eventCount: events.length,
        timestamp: new Date().toISOString() 
      });
      /* БЫЛО:
      console.log(`✅ Обновление успешно: ${events.length} событий`);
      */
      
      return { success: true, events: events.length };
    } catch (error) {
      logger.error('Ошибка обновления кэша', { error: error.message });
      /* БЫЛО:
      console.error('❌ Ошибка обновления кэша:', error.message);
      */
      return { success: false, events: 0, error: error.message };
    }
  }

  // Отметка обновления как выполненного
  markAsExecuted(entry) {
    if (!entry) return;
    
    const now = new Date();
    
    // Находим и обновляем запись
    const entryIndex = this.schedule.findIndex(e => 
      e.time === entry.time || (e.forced && entry.forced)
    );
    
    if (entryIndex !== -1) {
      this.schedule[entryIndex].executed = true;
      this.schedule[entryIndex].executedAt = now.toISOString();
      
      if (entry.forced) {
        this.schedule[entryIndex].forced = false;
      }
      
      this.saveSchedule();
      
      logger.info('Обновление отмечено как выполненное', { 
        entryTime: entry.time || 'forced',
        executedAt: now.toISOString() 
      });
      /* БЫЛО:
      console.log(`✅ Обновление отмечено как выполненное`);
      */
    }
  }

  // Принудительное обновление
  forceUpdate() {
    const now = new Date();
    const forcedEntry = {
      time: `forced_${now.getTime()}`,
      timestamp: now.getTime(),
      executed: false,
      forced: true
    };
    
    this.schedule.push(forcedEntry);
    this.saveSchedule();
    
    logger.info('Запланировано принудительное обновление', { 
      forcedEntry,
      totalEntries: this.schedule.length 
    });
    /* БЫЛО:
    console.log('🔧 Принудительное обновление запланировано');
    */
    
    return forcedEntry;
  }

  // Сброс расписания на сегодня
  resetForToday() {
    const today = new Date().toISOString().split('T')[0];
    
    // Удаляем записи с сегодняшней датой
    this.schedule = this.schedule.filter(entry => {
      const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
      return entryDate !== today;
    });
    
    // Добавляем новое расписание на сегодня
    const todaySchedule = this.createDefaultSchedule();
    this.schedule = [...this.schedule, ...todaySchedule];
    this.saveSchedule();
    
    logger.info('Расписание сброшено на сегодня', { 
      today,
      entries: this.schedule.length 
    });
    /* БЫЛО:
    console.log(`🔄 Расписание сброшено на ${today}`);
    */
  }

  // Основной цикл планировщика
  async runScheduler() {
    logger.info('Запуск планировщика обновлений', { 
      scheduleTimes: UPDATE_SCHEDULE,
      currentTime: new Date().toISOString() 
    });
    /* БЫЛО:
    console.log('⏰ ЗАПУСК ПЛАНИРОВЩИКА ОБНОВЛЕНИЙ ⏰');
    console.log(`📅 Расписание: ${UPDATE_SCHEDULE.join(', ')}`);
    console.log('='.repeat(50));
    */
    
    const checkResult = this.shouldUpdate();
    
    if (checkResult.shouldUpdate) {
      const updateResult = await this.executeUpdate();
      
      if (updateResult.success) {
        this.markAsExecuted(checkResult.entry);
      }
      
      logger.info('Планировщик завершил работу', { 
        shouldUpdate: checkResult.shouldUpdate,
        updateSuccess: updateResult.success,
        eventsUpdated: updateResult.events || 0 
      });
      /* БЫЛО:
      console.log(`📊 Итог: ${updateResult.success ? 'УСПЕХ' : 'ОШИБКА'} (${updateResult.events || 0} событий)`);
      */
      
      return updateResult;
    } else {
      logger.info('Планировщик: обновление не требуется', { 
        nextUpdate: this.getNextUpdateTime() 
      });
      /* БЫЛО:
      console.log(`📭 Обновление не требуется (следующее: ${this.getNextUpdateTime()})`);
      */
      return { success: true, events: 0, status: 'not_required' };
    }
  }
}

// Функция для тестирования
async function testScheduler() {
  logger.info('Тестирование планировщика');
  /* БЫЛО:
  console.log('🧪 Тестирование планировщика...');
  */
  
  const scheduler = new OddsUpdateScheduler();
  
  try {
    // Сбрасываем расписание для чистого теста
    scheduler.resetForToday();
    
    // Проверяем состояние
    const checkResult = scheduler.shouldUpdate();
    logger.info('Проверка расписания', { 
      shouldUpdate: checkResult.shouldUpdate,
      entry: checkResult.entry 
    });
    /* БЫЛО:
    console.log(`📅 Проверка: ${checkResult.shouldUpdate ? 'Нужно обновлять' : 'Не нужно'}`);
    */
    
    // Принудительно запускаем обновление для теста
    scheduler.forceUpdate();
    
    // Запускаем планировщик
    const result = await scheduler.runScheduler();
    
    logger.ok('Тест планировщика завершён', { result });
    /* БЫЛО:
    console.log(`✅ Тест планировщика завершён`);
    */
    
    return result;
  } catch (error) {
    logger.error('Тест планировщика завершился ошибкой', { error: error.message });
    /* БЫЛО:
    console.error('❌ Тест планировщика завершился ошибкой:', error.message);
    */
    throw error;
  }
}

// Если файл запущен напрямую
if (require.main === module) {
  testScheduler().catch(error => {
    logger.error('Необработанная ошибка в тесте планировщика', { error: error.message });
    /* БЫЛО:
    console.error('❌ Необработанная ошибка:', error.message);
    */
    process.exit(1);
  });
}

module.exports = OddsUpdateScheduler;