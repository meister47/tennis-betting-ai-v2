#!/usr/bin/env node

/**
 * The Odds API Cache Manager - Optimized Version
 * Централизованный кэш для оптимизации запросов
 * Дифференцированные TTL и singleton паттерн
 */

// ================== ЗАГРУЗКА .ENV ==================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// ================== ИНИЦИАЛИЗАЦИЯ ЛОГГЕРА ==================
const Logger = require('../src/logger');
const logger = new Logger('cache');

// ================== ИМПОРТ КОНФИГУРАЦИИ ==================
const CACHE_CONFIG = require('../config/cache-config');
const API_CONFIG = require('../config/api-config');

const fs = require('fs');
const https = require('https');
const path = require('path');

// Получаем активный API
let activeApi = null;
try {
  activeApi = API_CONFIG.getActiveApi();
  logger.info('Активный API определен', { 
    api: activeApi.NAME,
    key_present: !!activeApi.KEY,
    base_url: activeApi.BASE_URL
  });
} catch (error) {
  logger.error('Ошибка определения API', { error: error.message });
  process.exit(1);
}

const CACHE_DIR = path.join(__dirname, '../cache');
const CACHE_FILE = path.join(CACHE_DIR, 'odds-cache.json');

// Убедимся, что директория кэша существует
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class OddsCacheManager {
  constructor() {
    // Singleton pattern - если уже есть экземпляр, возвращаем его
    if (OddsCacheManager.instance) {
      return OddsCacheManager.instance;
    }
    
    // Инициализация нового экземпляра
    OddsCacheManager.instance = this;
    
    // Загружаем конфигурацию
    this.config = CACHE_CONFIG;
    
    // Инициализируем кэш
    this.cache = {};
    this.entries = 0;
    this.totalSizeBytes = 0;
    this.cleanupInterval = null;
    
    // Загружаем существующий кэш
    this.load();
    
    // Запускаем периодическую очистку
    this.startCleanupInterval();
    
    logger.info('OddsCacheManager инициализирован', {
      singleton: true,
      configLoaded: true
    });
  }

  // ================== ОСНОВНЫЕ МЕТОДЫ ==================

  /**
   * Определяет TTL для ключа на основе паттернов
   * @param {string} key - Ключ кэша
   * @returns {number} TTL в миллисекундах
   */
  determineTTL(key) {
    const patterns = this.config.KEY_PATTERNS;
    
    for (const [type, regexes] of Object.entries(patterns)) {
      for (const regex of regexes) {
        if (regex.test(key)) {
          return this.config.TTL[type] || this.config.DEFAULT_TTL;
        }
      }
    }
    
    return this.config.DEFAULT_TTL;
  }

  /**
   * Сохраняет значение в кэше с указанным TTL
   * @param {string} key - Ключ
   * @param {any} value - Значение
   * @param {number} ttl - TTL в миллисекундах (если не указан, определяется автоматически)
   * @returns {boolean} Успешно ли сохранено
   */
  set(key, value, ttl = null) {
    try {
      const actualTTL = ttl || this.determineTTL(key);
      const size = JSON.stringify(value).length;
      
      this.cache[key] = {
        value,
        timestamp: Date.now(),
        ttl: actualTTL,
        size
      };
      
      this.entries = Object.keys(this.cache).length;
      this.totalSizeBytes += size;
      
      // Автоматическое сохранение в файл
      this.save();
      
      logger.debug('Запись сохранена в кэш', {
        key,
        ttlHours: (actualTTL / (1000 * 60 * 60)).toFixed(1),
        sizeBytes: size,
        totalEntries: this.entries
      });
      
      return true;
    } catch (error) {
      logger.error('Ошибка сохранения в кэш', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Получает значение из кэша с проверкой TTL
   * @param {string} key - Ключ
   * @returns {any|null} Значение или null если устарело/отсутствует
   */
  get(key) {
    try {
      const entry = this.cache[key];
      
      if (!entry) {
        logger.debug('Запись не найдена в кэше', { key });
        return null;
      }
      
      const age = Date.now() - entry.timestamp;
      const ttl = entry.ttl || this.config.DEFAULT_TTL;
      
      // Проверка срока действия
      if (age > ttl) {
        logger.debug('Запись устарела, удаляем', {
          key,
          ageHours: (age / (1000 * 60 * 60)).toFixed(1),
          ttlHours: (ttl / (1000 * 60 * 60)).toFixed(1)
        });
        
        delete this.cache[key];
        this.entries--;
        this.totalSizeBytes -= entry.size;
        this.save();
        
        return null;
      }
      
      logger.debug('Запись найдена в кэше', {
        key,
        ageHours: (age / (1000 * 60 * 60)).toFixed(1),
        ttlHours: (ttl / (1000 * 60 * 60)).toFixed(1)
      });
      
      return entry.value;
    } catch (error) {
      logger.error('Ошибка получения из кэша', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Принудительное обновление записи
   * @param {string} key - Ключ
   * @returns {boolean} Успешно ли удалено
   */
  refresh(key) {
    try {
      if (this.cache[key]) {
        const oldSize = this.cache[key].size;
        delete this.cache[key];
        this.entries--;
        this.totalSizeBytes -= oldSize;
        this.save();
        
        logger.debug('Запись удалена из кэша', { key });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Ошибка обновления записи', {
        key,
        error: error.message
      });
      return false;
    }
  }

  // ================== УПРАВЛЕНИЕ ФАЙЛАМИ ==================

  /**
   * Загрузка кэша из файла
   */
  load() {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        logger.info('Файл кэша не найден, создаём новый');
        this.cache = {};
        this.entries = 0;
        this.totalSizeBytes = 0;
        return;
      }
      
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Валидация структуры
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Неверный формат файла кэша');
      }
      
      this.cache = parsed.cache || {};
      this.entries = Object.keys(this.cache).length;
      this.totalSizeBytes = parsed.totalSizeBytes || 0;
      
      // Очистка устаревших записей при загрузке
      const cleaned = this.pruneExpiredEntries();
      
      logger.info('Кэш загружен из файла', {
        entries: this.entries,
        sizeMB: (this.totalSizeBytes / 1024 / 1024).toFixed(2),
        cleanedEntries: cleaned
      });
      
    } catch (error) {
      logger.error('Ошибка загрузки кэша, создаём новый', {
        error: error.message,
        file: CACHE_FILE
      });
      
      this.cache = {};
      this.entries = 0;
      this.totalSizeBytes = 0;
    }
  }

  /**
   * Сохранение кэша в файл
   */
  save() {
    try {
      const data = {
        cache: this.cache,
        totalSizeBytes: this.totalSizeBytes,
        timestamp: Date.now(),
        version: '1.1' // Версия формата с TTL
      };
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
      
      logger.debug('Кэш сохранён в файл', {
        entries: this.entries,
        sizeMB: (this.totalSizeBytes / 1024 / 1024).toFixed(2)
      });
      
      return true;
    } catch (error) {
      logger.error('Ошибка сохранения кэша', {
        error: error.message,
        file: CACHE_FILE
      });
      return false;
    }
  }

  // ================== ОЧИСТКА И СТАТИСТИКА ==================

  /**
   * Удаление устаревших записей
   * @returns {number} Количество удалённых записей
   */
  pruneExpiredEntries() {
    const now = Date.now();
    let deleted = 0;
    
    for (const [key, entry] of Object.entries(this.cache)) {
      const age = now - entry.timestamp;
      const ttl = entry.ttl || this.config.DEFAULT_TTL;
      
      if (age > ttl) {
        delete this.cache[key];
        deleted++;
        this.totalSizeBytes -= entry.size;
      }
    }
    
    this.entries = Object.keys(this.cache).length;
    
    if (deleted > 0) {
      logger.info('Устаревшие записи удалены', {
        deleted,
        remaining: this.entries
      });
      this.save();
    }
    
    return deleted;
  }

  /**
   * Запуск периодической очистки
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      const deleted = this.pruneExpiredEntries();
      if (deleted > 0) {
        logger.debug('Периодическая очистка завершена', { deleted });
      }
    }, this.config.CLEANUP.INTERVAL);
    
    logger.debug('Интервал очистки запущен', {
      intervalHours: (this.config.CLEANUP.INTERVAL / (1000 * 60 * 60)).toFixed(1)
    });
  }

  /**
   * Получение статистики кэша
   * @returns {object} Статистика
   */
  stats() {
    const entriesByType = {};
    let oldestEntry = null;
    let newestEntry = null;
    
    for (const [key, entry] of Object.entries(this.cache)) {
      const type = this.determineTTL(key);
      const typeName = Object.entries(this.config.TTL).find(([k, v]) => v === type)?.[0] || 'UNKNOWN';
      
      entriesByType[typeName] = (entriesByType[typeName] || 0) + 1;
      
      if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
        oldestEntry = { key, ...entry };
      }
      if (!newestEntry || entry.timestamp > newestEntry.timestamp) {
        newestEntry = { key, ...entry };
      }
    }
    
    const stats = {
      entries: this.entries,
      sizeBytes: this.totalSizeBytes,
      sizeMB: (this.totalSizeBytes / 1024 / 1024).toFixed(2),
      entriesByType,
      oldestEntry: oldestEntry ? {
        key: oldestEntry.key,
        ageHours: ((Date.now() - oldestEntry.timestamp) / (1000 * 60 * 60)).toFixed(1),
        ttlHours: (oldestEntry.ttl / (1000 * 60 * 60)).toFixed(1)
      } : null,
      newestEntry: newestEntry ? {
        key: newestEntry.key,
        ageHours: ((Date.now() - newestEntry.timestamp) / (1000 * 60 * 60)).toFixed(1),
        ttlHours: (newestEntry.ttl / (1000 * 60 * 60)).toFixed(1)
      } : null,
      memory: process.memoryUsage()
    };
    
    return stats;
  }

  // ================== API МЕТОДЫ (обратная совместимость) ==================

  /**
   * Получение коэффициентов с кэшированием (совместимость)
   */
  async getTennisOdds(forceRefresh = false) {
    const cacheKey = 'odds_today';
    
    // Если есть актуальные данные в кэше и не требуется обновление
    if (!forceRefresh) {
      const cached = this.get(cacheKey);
      if (cached) {
        logger.info('Используем кэшированные коэффициенты', {
          eventCount: cached.length
        });
        return cached;
      }
    }
    
    logger.info('Запрашиваем обновление данных с API', { forceRefresh });
    
    try {
      const events = await this.fetchFromAPI();
      
      if (!events || events.length === 0) {
        logger.warn('API вернул пустой ответ');
        return [];
      }
      
      // Сохраняем с TTL для живых коэффициентов
      this.set(cacheKey, events, this.config.TTL.ODDS_LIVE);
      
      return events;
    } catch (error) {
      logger.error('Ошибка получения коэффициентов', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Запрос к Odds API (использует активный API)
   */
  fetchFromAPI() {
    const api = activeApi;
    logger.info('Запрос к API', { api: api.NAME });
    
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        apiKey: api.KEY,
        regions: api.REGIONS,
        markets: api.MARKETS,
        oddsFormat: api.ODDS_FORMAT,
        dateFormat: api.DATE_FORMAT
      });

      const sportsPart = api.NAME === 'Odds-API.io' ? 'tennis_atp' : 'tennis';
      const options = {
        hostname: new URL(api.BASE_URL).hostname,
        path: `/v4/sports/${sportsPart}/odds?${params.toString()}`,
        headers: { 'User-Agent': 'TennisBettingAI/2.0-with-odds-api-io' }
      };

      const req = https.get(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const events = JSON.parse(data);
            
            if (!events || events.length === 0) {
              logger.warn('API вернул пустой ответ', { api: api.NAME });
              resolve([]);
              return;
            }
            
            logger.info('Данные получены от API', { 
              api: api.NAME,
              eventCount: events.length
            });
            resolve(events);
          } catch (err) {
            logger.error('Ошибка парсинга данных API', { 
              api: api.NAME,
              error: err.message
            });
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        logger.error('Ошибка сетевого запроса', { 
          api: api.NAME,
          error: err.message
        });
        reject(err);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        const timeoutError = new Error(`Таймаут запроса к ${api.NAME}`);
        logger.error('Таймаут запроса', { 
          api: api.NAME,
          error: timeoutError.message
        });
        reject(timeoutError);
      });
    });
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
      
      this.cache = {};
      this.entries = 0;
      this.totalSizeBytes = 0;
      
      logger.ok('Кэш полностью очищен');
      return true;
    } catch (error) {
      logger.error('Ошибка очистки кэша', { error: error.message });
      return false;
    }
  }
}

// ================== CLI ИНТЕРФЕЙС ==================

/**
 * Главная функция для тестирования и CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';
  
  const cacheManager = new OddsCacheManager();
  
  switch (command) {
    case 'stats':
      const stats = cacheManager.stats();
      console.log('📊 Статистика кэша:');
      console.log(JSON.stringify(stats, null, 2));
      break;
      
    case 'clear':
      const cleared = cacheManager.clearCache();
      console.log(cleared ? '✅ Кэш очищен' : '❌ Ошибка очистки');
      break;
      
    case 'refresh':
      if (args[1]) {
        const refreshed = cacheManager.refresh(args[1]);
        console.log(refreshed ? `✅ Запись "${args[1]}" обновлена` : `❌ Запись "${args[1]}" не найдена`);
      } else {
        console.log('❌ Укажите ключ: node odds-cache-manager.js refresh <key>');
      }
      break;
      
    case 'test':
    default:
      logger.info('Тестирование OddsCacheManager');
      
      try {
        // Тест базовых операций
        console.log('🧪 Тест 1: Сохранение и получение записи...');
        cacheManager.set('test_key', { data: 'test_value' });
        const retrieved = cacheManager.get('test_key');
        console.log(retrieved ? '✅ Тест пройден' : '❌ Тест не пройден');
        
        // Тест статистики
        console.log('🧪 Тест 2: Статистика...');
        const stats = cacheManager.stats();
        console.log(`📊 Записей: ${stats.entries}, Размер: ${stats.sizeMB} MB`);
        
        // Тест API (опционально)
        if (process.env.TEST_API === 'true') {
          console.log('🧪 Тест 3: API запрос...');
          const events = await cacheManager.getTennisOdds();
          console.log(`📊 Получено событий: ${events?.length || 0}`);
        }
        
        console.log('✅ Все тесты завершены');
      } catch (error) {
        console.error('❌ Ошибка тестирования:', error.message);
        process.exit(1);
      }
      break;
  }
}

// Если файл запущен напрямую
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Необработанная ошибка:', error.message);
    process.exit(1);
  });
}

module.exports = OddsCacheManager;