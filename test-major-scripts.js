#!/usr/bin/env node

/**
 * Тестирование основных скриптов с новым логированием
 */

const Logger = require('./src/logger');
const logger = new Logger('integration-test');

async function testScriptImports() {
  logger.info('Тестирование импорта основных скриптов');
  
  try {
    // 1. Тест OddsCacheManager
    logger.info('Тест импорта OddsCacheManager');
    const OddsCacheManager = require('./scripts/odds-cache-manager.js');
    const cacheManager = new OddsCacheManager();
    logger.ok('OddsCacheManager загружен', { 
      cacheType: typeof cacheManager,
      hasMethod: typeof cacheManager.getTennisOdds === 'function'
    });
    
    // 2. Тест BetsManager
    logger.info('Тест импорта BetsManager');
    const BetsManager = require('./scripts/bets-manager.js');
    const betsManager = new BetsManager();
    logger.ok('BetsManager загружен', {
      hasMethod: typeof betsManager.getBets === 'function'
    });
    
    // 3. Тест анализатора
    logger.info('Тест импорта анализатора');
    const { analyzeMatches } = require('./scripts/real-today-analysis-min-odds.js');
    logger.ok('Анализатор загружен', {
      hasMethod: typeof analyzeMatches === 'function'
    });
    
    // 4. Тест CLV трекера
    logger.info('Тест импорта CLV трекера');
    const ClosingOddsCapture = require('./scripts/capture-closing-odds.js');
    const clvTracker = new ClosingOddsCapture();
    logger.ok('CLV трекер загружен', {
      hasMethod: typeof clvTracker.execute === 'function'
    });
    
    // 5. Тест планировщика
    logger.info('Тест импорта планировщика');
    const OddsUpdateScheduler = require('./scripts/odds-update-scheduler.js');
    const scheduler = new OddsUpdateScheduler();
    logger.ok('Планировщик загружен', {
      hasMethod: typeof scheduler.runScheduler === 'function'
    });
    
    return true;
  } catch (error) {
    logger.error('Ошибка импорта скриптов', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

async function testLoggerInDifferentComponents() {
  logger.info('Тест логгера в разных компонентах');
  
  try {
    // Создаем логгеры для разных компонентов
    const analyzers = [
      new Logger('analyzer'),
      new Logger('clv-tracker'),
      new Logger('cache'),
      new Logger('scheduler'),
      new Logger('bets-manager')
    ];
    
    // Тестовые сообщения
    analyzers.forEach((log, index) => {
      log.info(`Тестовое сообщение от компонента ${index}`, {
        testId: index,
        timestamp: new Date().toISOString()
      });
    });
    
    // Тест разных уровней
    const testLogger = new Logger('test-levels');
    testLogger.debug('Отладка');
    testLogger.info('Информация');
    testLogger.ok('Успех');
    testLogger.warn('Предупреждение');
    testLogger.skip('Пропуск');
    testLogger.error('Ошибка');
    
    logger.ok('Тест уровней логирования завершён');
    return true;
  } catch (error) {
    logger.error('Ошибка тестирования логгеров', { error: error.message });
    return false;
  }
}

async function checkLogFileStructure() {
  logger.info('Проверка структуры файла логов');
  
  const fs = require('fs');
  const path = require('path');
  
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(__dirname, 'logs', `${today}.jsonl`);
  
  if (!fs.existsSync(logFile)) {
    logger.error('Файл логов не найден', { logFile });
    return false;
  }
  
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  
  // Анализ структуры
  const components = new Set();
  const levels = new Set();
  let errors = 0;
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      components.add(entry.component);
      levels.add(entry.level);
      
      // Проверка обязательных полей
      if (!entry.timestamp || !entry.component || !entry.level || !entry.message) {
        logger.warn('Неполная запись в логах', { entry });
        errors++;
      }
    } catch (e) {
      logger.error('Ошибка парсинга JSON', { line: line.substring(0, 100), error: e.message });
      errors++;
    }
  }
  
  logger.info('Анализ логов завершён', {
    totalEntries: lines.length,
    uniqueComponents: components.size,
    uniqueLevels: levels.size,
    errors,
    components: Array.from(components),
    levels: Array.from(levels)
  });
  
  return errors === 0;
}

async function main() {
  logger.info('=== ТЕСТИРОВАНИЕ ИНТЕГРАЦИИ JSON-ЛОГГИРОВАНИЯ ===');
  
  const results = {
    imports: false,
    logging: false,
    structure: false
  };
  
  try {
    // Тест 1: Импорт скриптов
    logger.info('Тест 1/3: Импорт основных скриптов');
    results.imports = await testScriptImports();
    
    // Тест 2: Логирование в разных компонентах
    logger.info('Тест 2/3: Логирование в разных компонентах');
    results.logging = await testLoggerInDifferentComponents();
    
    // Тест 3: Структура файлов логов
    logger.info('Тест 3/3: Проверка структуры логов');
    results.structure = await checkLogFileStructure();
    
    // Итоги
    logger.info('=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===', { results });
    
    const allPassed = Object.values(results).every(r => r === true);
    
    if (allPassed) {
      logger.ok('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО');
      console.log('\n🎉 Интеграция JSON-логирования успешно завершена!');
      console.log('📁 Файлы:');
      console.log('  • src/logger.js - модуль логирования');
      console.log('  • scripts/*.js - обновлённые скрипты');
      console.log('  • logs/YYYY-MM-DD.jsonl - файлы логов');
      console.log('\n📊 Проверка логов:');
      console.log('  cat logs/' + today + '.jsonl | jq \'.\'');
      console.log('  cat logs/' + today + '.jsonl | jq \'select(.component == "analyzer")\'');
      console.log('\n📚 Подробнее: README-LOGGING.md');
    } else {
      logger.error('❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ', { failedTests: Object.keys(results).filter(k => !results[k]) });
      console.log('\n⚠️  Некоторые тесты провалены. Проверьте логи выше.');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Критическая ошибка тестирования', {
      error: error.message,
      stack: error.stack
    });
    console.error('\n💥 Критическая ошибка:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}