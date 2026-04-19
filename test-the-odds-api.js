#!/usr/bin/env node

/**
 * Тестирование The-Odds-API.com как основного источника данных
 * Проверяем подключение, формат ответа и доступность данных
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const https = require('https');
const { URL } = require('url');

// Ключ The-Odds-API.com
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || '5bade59990c62f13daecce0427ec665e';

// Конфигурация The-Odds-API.com
const CONFIG = {
  BASE_URL: 'https://api.the-odds-api.com/v4',
  REGIONS: 'eu',
  MARKETS: 'h2h',
  ODDS_FORMAT: 'decimal',
  DATE_FORMAT: 'iso'
};

// Доступные теннисные ключи (документация: https://the-odds-api.com/sports)
const TENNIS_SPORT_KEYS = [
  'tennis',                      // Общий ключ тенниса (все матчи)
  'tennis_atp',                  // ATP общий
  'tennis_wta',                  // WTA общий
  'tennis_atp_auckland',         // ATP Auckland (пример)
  'tennis_atp_brisbane_international',
  'tennis_wta_chengdu_open',
  'tennis_atp_doha',
  'tennis_wta_monterrey_open',
  'tennis_atp_auckland'
];

/**
 * Проверить доступность конкретного ключа спорта
 */
async function testSportKey(sportKey) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      apiKey: THE_ODDS_API_KEY,
      regions: CONFIG.REGIONS,
      markets: CONFIG.MARKETS,
      oddsFormat: CONFIG.ODDS_FORMAT
    });
    
    const url = `${CONFIG.BASE_URL}/sports/${sportKey}/odds?${params.toString()}`;
    const urlObj = new URL(url);
    
    console.log(`🔗 Тестируем ключ: ${sportKey}`);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'TennisBettingAI/2.0-the-odds-api-test',
        'Accept': 'application/json'
      },
      timeout: 10000
    };
    
    const req = https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          // Обработка разных ответов
          if (res.statusCode === 401) {
            console.log(`   ❌ Доступ запрещён (неверный ключ)`);
            resolve({ sportKey, status: 'unauthorized', data: result });
            return;
          }
          
          if (res.statusCode === 404) {
            console.log(`   ❌ Ключ не найден/недоступен`);
            resolve({ sportKey, status: 'not_found', data: null });
            return;
          }
          
          if (res.statusCode === 200) {
            if (result && Array.isArray(result)) {
              console.log(`   ✅ Найдено матчей: ${result.length}`);
              resolve({ sportKey, status: 'success', matches: result.length, data: result.slice(0, 2) });
            } else if (result && result.message) {
              console.log(`   ⚠️  Сообщение: ${result.message}`);
              resolve({ sportKey, status: 'api_message', message: result.message });
            } else {
              console.log(`   ⚠️  Неожиданный формат данных`);
              resolve({ sportKey, status: 'unexpected_format', data: result });
            }
          } else {
            console.log(`   ❓ Неизвестный статус: ${res.statusCode}`);
            resolve({ sportKey, status: 'unknown', statusCode: res.statusCode, data: result });
          }
        } catch (err) {
          console.log(`   ❌ Ошибка парсинга: ${err.message}`);
          console.log(`   📥 Ответ: ${data.substring(0, 200)}...`);
          resolve({ sportKey, status: 'parse_error', error: err.message });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Сетевая ошибка: ${err.message}`);
      resolve({ sportKey, status: 'network_error', error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`   ⏱️  Таймаут запроса`);
      resolve({ sportKey, status: 'timeout' });
    });
  });
}

/**
 * Искать рабочий теннисный ключ
 */
async function findWorkingTennisKey() {
  console.log('🔍 Ищем рабочий ключ тенниса для The-Odds-API.com...');
  console.log('='.repeat(60));
  
  for (const sportKey of TENNIS_SPORT_KEYS) {
    const result = await testSportKey(sportKey);
    
    // Если нашли успешный ключ с матчами > 0
    if (result.status === 'success' && result.matches > 0) {
      console.log(`\n🎯 НАЙДЕН РАБОЧИЙ КЛЮЧ: ${sportKey}`);
      console.log(`📅 Матчей доступно: ${result.matches}`);
      return { workingKey: sportKey, result };
    }
    
    // Пауза 1.5 секунды между запросами (правила API)
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n❌ Не найдено рабочего ключа тенниса');
  return null;
}

/**
 * Прогрессивный поиск ключа (расширенный)
 */
async function progressiveSportKeyFinding() {
  console.log('🎯 ПРОГРЕССИВНЫЙ ПОИСК КЛЮЧЕЙ TENNIS BETTING AI v2.0');
  console.log('='.repeat(80));
  
  console.log(`🔑 Ключ The-Odds-API.com: ${THE_ODDS_API_KEY ? '***'+THE_ODDS_API_KEY.slice(-8) : 'не найден'}`);
  console.log(`⏰ Время: ${new Date().toLocaleString('ru-RU')}`);
  console.log('-' .repeat(80));
  
  const workingKey = await findWorkingTennisKey();
  
  if (!workingKey) {
    console.log('\n⚠️  Пробуем альтернативные стратегии поиска...');
    
    // Попробуем базовый ключ 'tennis' без ограничений по времени
    console.log('\n🔄 Тестируем базовый ключ "tennis" с расширенными параметрами...');
    
    const baseTest = await testWithExtendedParams('tennis');
    if (baseTest.status === 'success' && baseTest.matches > 0) {
      console.log(`✅ Ключ "tennis" работает с расширенными параметрами`);
      return { workingKey: 'tennis', extendedParams: true, result: baseTest };
    }
    
    // Попробуем получить список всех спортивных key
    console.log('\n📋 Запрашиваем список всех доступных спортивных ключей...');
    
    try {
      const sportsList = await getAvailableSports();
      console.log(`📊 Доступных sports: ${sportsList.length}`);
      
      const tennisKeys = sportsList.filter(s => 
        s.key.includes('tennis') || s.title.toLowerCase().includes('tennis')
      );
      
      console.log(`🎾 Найдено теннисных ключей: ${tennisKeys.length}`);
      
      if (tennisKeys.length > 0) {
        console.log('\n🎯 Попробуем каждый найденный ключ:');
        for (const sport of tennisKeys.slice(0, 5)) { // Тестируем только первые 5
          console.log(`  • ${sport.key} - ${sport.title}`);
          const result = await testSportKey(sport.key);
          if (result.status === 'success' && result.matches > 0) {
            console.log(`\n✅ РАБОЧИЙ КЛЮЧ НАЙДЕН: ${sport.key}`);
            return { workingKey: sport.key, source: 'sports_list', result };
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } catch (error) {
      console.log(`❌ Ошибка получения списка sports: ${error.message}`);
    }
    
    console.log('\n🔴 КРИТИЧЕСКАЯ ОШИБКА: Не удалось найти рабочий ключ тенниса!');
    return null;
  }
  
  return workingKey;
}

/**
 * Тест с расширенными параметрами
 */
async function testWithExtendedParams(sportKey) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      apiKey: THE_ODDS_API_KEY,
      regions: 'eu,us,uk,au', // Все доступные регионы
      markets: 'h2h,spreads,totals', // Все рынки
      oddsFormat: CONFIG.ODDS_FORMAT,
      dateFormat: CONFIG.DATE_FORMAT,
      commenceTimeFrom: new Date().toISOString(),
      commenceTimeTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // +14 дней
    });
    
    const url = `${CONFIG.BASE_URL}/sports/${sportKey}/odds?${params.toString()}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'TennisBettingAI/2.0-extended-test' },
      timeout: 15000
    };
    
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (res.statusCode === 200 && Array.isArray(result)) {
            resolve({ status: 'success', matches: result.length, data: result.slice(0, 3) });
          } else if (result.message) {
            resolve({ status: 'api_message', message: result.message, statusCode: res.statusCode });
          } else {
            resolve({ status: 'unexpected_format', statusCode: res.statusCode, data: result });
          }
        } catch (err) {
          resolve({ status: 'parse_error', error: err.message });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'timeout' });
    });
  });
}

/**
 * Получить список всех доступных спортивных ключей
 */
async function getAvailableSports() {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.BASE_URL}/sports?apiKey=${THE_ODDS_API_KEY}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'TennisBettingAI/2.0-sports-list' },
      timeout: 10000
    };
    
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const sports = JSON.parse(data);
            resolve(sports || []);
          } else {
            const error = JSON.parse(data);
            reject(new Error(error.message || `Status: ${res.statusCode}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут при получении списка sports' ));
    });
  });
}

/**
 * Основной тест
 */
async function main() {
  try {
    console.log('🚀 ТЕСТИРУЕМ THE-ODDS-API.COM КАК ОСНОВНОЙ ИСТОЧНИК ДАННЫХ');
    console.log('=' .repeat(80));
    
    // Проверяем наличие ключа
    if (!THE_ODDS_API_KEY) {
      console.log('❌ Ключ The-Odds-API.com не найден в .env.local');
      console.log('Добавьте: THE_ODDS_API_KEY=ваш_ключ');
      process.exit(1);
    }
    
    console.log(`✅ Ключ найден: ***${THE_ODDS_API_KEY.slice(-8)}`);
    
    // Прогрессивный поиск ключа
    const foundKey = await progressiveSportKeyFinding();
    
    if (!foundKey) {
      console.log('\n🔴 ЗАВЕРШЕНО С ОШИБКОЙ: Не удалось подключиться к The-Odds-API.com');
      console.log('\n💡 ПРОВЕРЬТЕ:');
      console.log('1. Ключ THE_ODDS_API_KEY актуален');
      console.log('2. Работает спортивный ключ "tennis" или "tennis_atp_*"');
      console.log('3. Доступны матчи в указанном регионе ("eu")');
      console.log('4. Лимиты запросов не исчерпаны');
      process.exit(1);
    }
    
    console.log(`\n🎉 УСПЕХ!`);
    console.log(`🏆 Рабочий ключ: ${foundKey.workingKey}`);
    
    if (foundKey.extendedParams) {
      console.log(`ℹ️  Используются расширенные параметры запроса`);
    }
    
    if (foundKey.source) {
      console.log(`🔍 Найден через: ${foundKey.source}`);
    }
    
    console.log(`\n✅ TENNIS BETTING AI v2.0 настроен на The-Odds-API.com как основной источник!`);
    console.log(`📌 Ключ для config/api-config.js: ${foundKey.workingKey}`);
    
  } catch (error) {
    console.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
    console.error(`📌 Подробности: ${error.stack}`);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error('Необработанная ошибка:', error.message);
    process.exit(1);
  });
}

module.exports = { findWorkingTennisKey, testSportKey };