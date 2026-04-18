/**
 * Конфигурация API для Tennis Betting AI v2.0
 * Поддержка Odds-API.io и The-Odds-API.com с автоматическим переключением
 * Версия: 1.0
 * Дата: 2026-04-18
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

module.exports = {
  // Конфигурация API
  APIs: {
    // Odds-API.io (новый основной)
    io: {
      NAME: 'Odds-API.io',
      BASE_URL: 'https://api.the-odds-api.io/v4',
      KEY: process.env.ODDS_API_IO_KEY || '',
      IS_ACTIVE: process.env.USE_ODDS_API_IO === 'true' || true, // По умолчанию включен
      
      // Параметры запросов
      SPORT: 'tennis_atp',
      REGIONS: 'eu',
      MARKETS: 'h2h',
      ODDS_FORMAT: 'decimal',
      DATE_FORMAT: 'iso',
      
      // Особенности
      SUPPORTS_HISTORICAL: true,
      SUPPORTS_CLV: true,
      FREE_TIER_LIMITS: {
        daily_requests: 1000,
        monthly_requests: 30000,
        request_interval_ms: 1000 // Минимум 1 секунда между запросами
      },
      
      // Метрики производительности
      LATENCY_MULTIPLIER: 1.0,
      SUCCESS_RATE: 0.95
    },
    
    // The-Odds-API.com (старый, для совместимости)
    com: {
      NAME: 'The-Odds-API.com',
      BASE_URL: 'https://api.the-odds-api.com/v4',
      KEY: process.env.THE_ODDS_API_KEY || '',
      IS_ACTIVE: process.env.USE_ODDS_API_IO === 'false' || false, // По умолчанию выключен
      
      // Параметры запросов
      SPORT: 'tennis',
      REGIONS: 'eu',
      MARKETS: 'h2h',
      ODDS_FORMAT: 'decimal',
      DATE_FORMAT: 'iso',
      
      // Особенности
      SUPPORTS_HISTORICAL: false,
      SUPPORTS_CLV: false,
      FREE_TIER_LIMITS: {
        daily_requests: 500,
        monthly_requests: 15000,
        request_interval_ms: 2000
      },
      
      // Метрики производительности
      LATENCY_MULTIPLIER: 1.5,
      SUCCESS_RATE: 0.90
    }
  },
  
  // Автоматическое определение активного API
  getActiveApi() {
    if (this.APIs.io.IS_ACTIVE && this.APIs.io.KEY) {
      return this.APIs.io;
    }
    if (this.APIs.com.IS_ACTIVE && this.APIs.com.KEY) {
      return this.APIs.com;
    }
    
    // Если ни один ключ не установлен, пытаемся использовать то, что есть
    if (this.APIs.io.KEY) {
      console.warn('⚠️  USE_ODDS_API_IO=false, но ключ Odds-API.io найден. Используем Odds-API.io');
      return this.APIs.io;
    }
    if (this.APIs.com.KEY) {
      console.warn('⚠️  USE_ODDS_API_IO=true, но ключ The-Odds-API.com найден. Используем The-Odds-API.com');
      return this.APIs.com;
    }
    
    throw new Error('❌ Нет активного API с ключом. Установите ODDS_API_IO_KEY или THE_ODDS_API_KEY в .env.local');
  },
  
  // Получить конфигурацию по имени API
  getApi(name) {
    if (this.APIs[name]) {
      return this.APIs[name];
    }
    throw new Error(`API "${name}" не найден. Доступные API: ${Object.keys(this.APIs).join(', ')}`);
  },
  
  // Проверить доступность API по ключу
  healthCheck() {
    const results = {};
    
    for (const [name, config] of Object.entries(this.APIs)) {
      results[name] = {
        name: config.NAME,
        key_present: !!config.KEY,
        is_active: config.IS_ACTIVE,
        is_configured: !!(config.KEY && config.IS_ACTIVE)
      };
    }
    
    return results;
  },
  
  // Создать URL для запроса к API
  buildApiUrl(apiName, endpoint = 'sports', sport = null, eventId = null) {
    const api = this.getApi(apiName);
    let url = `${api.BASE_URL}/${endpoint}`;
    
    if (sport) {
      url += `/${sport}`;
      
      if (eventId) {
        url += `/events/${eventId}/odds`;
      } else {
        url += '/odds';
      }
    }
    
    return url;
  },
  
  // Создать параметры запроса
  buildApiParams(apiName) {
    const api = this.getApi(apiName);
    
    return {
      apiKey: api.KEY,
      regions: api.REGIONS,
      markets: api.MARKETS,
      oddsFormat: api.ODDS_FORMAT,
      dateFormat: api.DATE_FORMAT
    };
  }
};