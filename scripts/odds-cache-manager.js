#!/usr/bin/env node

/**
 * The Odds API Cache Manager
 * Централизованный кэш для оптимизации запросов
 * Сохраняет данные на 24 часа
 */

// ================== НОВОЕ: ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА ==================
const Logger = require('../src/logger');
const logger = new Logger('cache');

// ================== НАСТРОЙКА РЕЖИМА ЛОГГИРОВАНИЯ ==================
const USE_JSON_LOGGER = true; // Флаг для быстрого отключения/включения

const fs = require('fs');
const https = require('https');
const path = require('path');

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
const CACHE_DIR = path.join(__dirname, '../cache');
const CACHE_FILE = path.join(CACHE_DIR, 'odds-cache.json');
const CACHE_TTL_HOURS = 24; // 24 часа кэширования

// Убедимся, что директория кэша существует
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class OddsCacheManager {
  constructor() {
    // FIX: Защита от undefined кэша
    if (!this.cache) this.cache = {};
    this.cache = this.loadCache();
  }

  // Загрузка кэша из файла
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const cache = JSON.parse(data);
        
        // Проверяем актуальность кэша
        const cacheAgeHours = (Date.now() - cache.timestamp) / (1000 * 60 * 60);
        if (cacheAgeHours > CACHE_TTL_HOURS) {
          logger.warn('Кэш устарел (старше 24 часов), будет обновлён', {
            cacheAgeHours: cacheAgeHours.toFixed(1),
            ttlHours: CACHE_TTL_HOURS
          });
          /* БЫЛО:
          console.log('⚠️  Кэш устарел (старше 24 часов), будет обновлён');
          */
          return { timestamp: 0, data: null, requests: cache.requests || 0 };
        }
        
        const cacheTime = new Date(cache.timestamp).toLocaleString();
        logger.info('Используется кэш', { timestamp: cacheTime });
        /* БЫЛО:
        console.log(`✅ Используется кэш от ${new Date(cache.timestamp).toLocaleString()}`);
        */
        return cache;
      } else {
        logger.info('Кэш файл не найден, создаётся новый');
        /* БЫЛО:
        console.log('📝 Кэш файл не найден, создаётся новый');
        */
        return { timestamp: 0, data: null, requests: 0 };
      }
    } catch (error) {
      logger.error('Ошибка загрузки кэша', { 
        error: error.message,
        file: CACHE_FILE 
      });
      /* БЫЛО:
      console.error('❌ Ошибка загрузки кэша:', error.message);
      */
      return { timestamp: 0, data: null, requests: 0 };
    }
  }

  // Сохранение кэша в файл
  saveCache(data) {
    try {
      const cache = {
        timestamp: Date.now(),
        data: data,
        requests: (this.cache.requests || 0) + 1
      };
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      this.cache = cache;
      
      logger.ok('Кэш сохранён', { 
        timestamp: new Date().toISOString(),
        eventCount: data?.length || 0,
        requestCount: cache.requests 
      });
      /* БЫЛО:
      console.log(`✅ Кэш сохранён: ${data?.length || 0} событий`);
      */
      return true;
    } catch (error) {
      logger.error('Ошибка сохранения кэша', { 
        error: error.message,
        file: CACHE_FILE 
      });
      /* БЫЛО:
      console.error('❌ Ошибка сохранения кэша:', error.message);
      */
      return false;
    }
  }

  // Запрос к The Odds API
  fetchFromAPI() {
    logger.info('Запрос к The Odds API');
    /* БЫЛО:
    console.log('🌐 Запрос к The Odds API...');
    */
    
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
            
            // FIX: Проверка пустого ответа API
            if (!events || events.length === 0) {
              logger.warn('API вернул пустой ответ', { status: 'empty' });
              /* БЫЛО:
              console.log('📭 Нет данных в ответе API');
              */
              resolve([]);
              return;
            }
            
            logger.info('Данные получены от API', { eventCount: events.length });
            /* БЫЛО:
            console.log(`✅ Получено ${events.length} событий`);
            */
            resolve(events);
          } catch (err) {
            logger.error('Ошибка парсинга данных API', { error: err.message });
            /* БЫЛО:
            console.error('❌ Ошибка парсинга данных:', err.message);
            */
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        logger.error('Ошибка сетевого запроса', { error: err.message });
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

  // Получение коэффициентов с кэшированием
  async getTennisOdds(forceRefresh = false) {
    try {
      // Если есть актуальные данные в кэше и не требуется обновление
      if (this.cache.data && !forceRefresh) {
        const cacheAgeHours = (Date.now() - this.cache.timestamp) / (1000 * 60 * 60);
        if (cacheAgeHours < CACHE_TTL_HOURS) {
          logger.debug('Используем кэшированные данные', { 
            cacheAgeHours: cacheAgeHours.toFixed(1),
            ttlHours: CACHE_TTL_HOURS,
            eventCount: this.cache.data?.length || 0 
          });
          /* БЫЛО:
          console.log(`♻️  Используем кэшированные данные (возраст: ${cacheAgeHours.toFixed(1)} часов)`);
          */
          return this.cache.data;
        }
      }

      logger.info('Запрашиваем обновление данных с API', { forceRefresh });
      /* БЫЛО:
      console.log(forceRefresh ? '🔄 Принудительное обновление...' : '🔄 Обновляем данные...');
      */

      // Получаем данные от API
      const events = await this.fetchFromAPI();
      
      if (!events || events.length === 0) {
        logger.warn('API вернул пустой ответ, используем старый кэш если есть', { 
          cacheAvailable: !!this.cache.data 
        });
        /* БЫЛО:
        console.log('⚠️  API вернул пустой ответ, используем старый кэш если есть');
        */
        return this.cache.data || [];
      }

      // Сохраняем в кэш
      this.saveCache(events);
      
      return events;

    } catch (error) {
      logger.error('Ошибка получения коэффициентов', { 
        error: error.message,
        cacheAvailable: !!this.cache.data 
      });
      /* БЫЛО:
      console.error('❌ Ошибка получения коэффициентов:', error.message);
      */
      
      // В случае ошибки возвращаем старые данные из кэша (если есть)
      if (this.cache.data) {
        logger.warn('Используем старый кэш из-за ошибки', { 
          eventCount: this.cache.data.length,
          cacheAgeHours: this.cache.timestamp ? 
            ((Date.now() - this.cache.timestamp) / (1000 * 60 * 60)).toFixed(1) : 'unknown' 
        });
        /* БЫЛО:
        console.log('⚠️  Используем старый кэш из-за ошибки');
        */
        return this.cache.data;
      }
      
      logger.error('Нет кэша для отката', { status: 'no_fallback' });
      /* БЫЛО:
      console.error('❌ Нет кэша для отката');
      */
      throw error;
    }
  }

  // Получение статистики кэша
  getStats() {
    const cacheAgeMs = Date.now() - this.cache.timestamp;
    const cacheAgeHours = cacheAgeMs / (1000 * 60 * 60);
    
    const stats = {
      cacheAgeHours: cacheAgeHours.toFixed(1),
      requestsCount: this.cache.requests || 0,
      dataCount: this.cache.data?.length || 0,
      isExpired: cacheAgeHours > CACHE_TTL_HOURS,
      nextRefreshInHours: Math.max(0, CACHE_TTL_HOURS - cacheAgeHours).toFixed(1)
    };
    
    logger.debug('Статистика кэша', stats);
    /* БЫЛО:
    console.log(`📊 Статистика кэша: возраст ${stats.cacheAgeHours} часов, запросов: ${stats.requestsCount}`);
    */
    
    return stats;
  }

  // Очистка кэша
  clearCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
        this.cache = { timestamp: 0, data: null, requests: 0 };
        logger.ok('Кэш очищен');
        /* БЫЛО:
        console.log('🗑️  Кэш очищен');
        */
        return true;
      }
      logger.info('Кэш уже пустой');
      /* БЫЛО:
      console.log('📭 Кэш уже пустой');
      */
      return true;
    } catch (error) {
      logger.error('Ошибка очистки кэша', { error: error.message });
      /* БЫЛО:
      console.error('❌ Ошибка очистки кэша:', error.message);
      */
      return false;
    }
  }
}

// Главная функция для тестирования
async function testCacheManager() {
  logger.info('Тестирование OddsCacheManager');
  /* БЫЛО:
  console.log('🧪 Тестирование OddsCacheManager...');
  */
  
  const cacheManager = new OddsCacheManager();
  
  try {
    // Получаем коэффициенты
    const events = await cacheManager.getTennisOdds();
    
    // Получаем статистику
    const stats = cacheManager.getStats();
    
    logger.ok('Тест завершён успешно', { 
      eventCount: events?.length || 0,
      stats 
    });
    /* БЫЛО:
    console.log(`✅ Тест завершён: ${events?.length || 0} событий`);
    */
    
    return events;
  } catch (error) {
    logger.error('Тест завершился ошибкой', { error: error.message });
    /* БЫЛО:
    console.error('❌ Тест завершился ошибкой:', error.message);
    */
    throw error;
  }
}

// Если файл запущен напрямую
if (require.main === module) {
  testCacheManager().catch(error => {
    logger.error('Необработанная ошибка в тесте', { error: error.message });
    /* БЫЛО:
    console.error('❌ Необработанная ошибка:', error.message);
    */
    process.exit(1);
  });
}

module.exports = OddsCacheManager;