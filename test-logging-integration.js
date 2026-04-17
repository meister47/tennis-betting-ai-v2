#!/usr/bin/env node

/**
 * Тестирование интеграции JSON-логирования
 */

const Logger = require('./src/logger');
const logger = new Logger('test-runner');

async function testLogger() {
  logger.info('Запуск теста JSON-логирования', { 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });

  // Тест различных уровней логирования
  logger.debug('Отладочное сообщение', { debug: true, counter: 1 });
  logger.info('Информационное сообщение', { data: { key: 'value' }, array: [1, 2, 3] });
  logger.ok('Успешное сообщение', { success: true, operation: 'test' });
  logger.warn('Предупреждение', { issue: 'minor', severity: 'low' });
  logger.skip('Пропуск операции', { reason: 'test', skipCount: 5 });
  logger.error('Тестовая ошибка', { error: new Error('Test error').message, stack: 'test stack' });

  // Тест больших данных
  logger.info('Большой набор данных', {
    match: {
      id: 'match_123',
      players: ['Djokovic', 'Nadal'],
      odds: [1.8, 2.1],
      startTime: new Date().toISOString()
    },
    analysis: {
      edge: 0.15,
      confidence: 0.8,
      recommendation: 'bet'
    }
  });

  logger.ok('Тест завершён', { 
    testDuration: 'completed',
    logFile: 'logs/' + new Date().toISOString().split('T')[0] + '.jsonl'
  });

  return true;
}

// Проверка создания логов
function checkLogFiles() {
  const fs = require('fs');
  const path = require('path');
  
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    logger.error('Директория логов не создана', { logDir });
    return false;
  }
  
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `${today}.jsonl`);
  
  if (!fs.existsSync(logFile)) {
    logger.warn('Файл логов за сегодня не найден', { logFile });
    return false;
  }
  
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  
  logger.info('Проверка файла логов', { 
    logFile,
    lineCount: lines.length,
    fileSize: fs.statSync(logFile).size 
  });
  
  // Проверка JSON валидности
  let validLines = 0;
  for (const line of lines) {
    try {
      JSON.parse(line);
      validLines++;
    } catch (e) {
      logger.error('Невалидный JSON в логах', { line: line.substring(0, 100), error: e.message });
    }
  }
  
  if (validLines === lines.length) {
    logger.ok('Все записи логов валидны', { validLines, totalLines: lines.length });
    return true;
  } else {
    logger.error('Найдены невалидные записи в логах', { 
      validLines, 
      totalLines: lines.length,
      invalidLines: lines.length - validLines 
    });
    return false;
  }
}

// Основная функция
async function main() {
  logger.info('=== НАЧАЛО ТЕСТА JSON-ЛОГГИРОВАНИЯ ===');
  
  try {
    // Тест логгера
    await testLogger();
    
    // Проверка файлов
    const filesOk = checkLogFiles();
    
    // Показать последние записи
    const fs = require('fs');
    const path = require('path');
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(__dirname, 'logs', `${today}.jsonl`);
    
    if (fs.existsSync(logFile)) {
      logger.info('Последние 3 записи в логах:');
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      const lastLines = lines.slice(-3);
      
      for (const line of lastLines) {
        try {
          const entry = JSON.parse(line);
          console.log(`  ${entry.timestamp} [${entry.component}] ${entry.level}: ${entry.message}`);
        } catch (e) {
          console.log(`  ❌ Невалидный JSON: ${line.substring(0, 50)}...`);
        }
      }
    }
    
    if (filesOk) {
      logger.ok('=== ТЕСТ ПРОЙДЕН УСПЕШНО ===', { 
        timestamp: new Date().toISOString(),
        status: 'PASSED' 
      });
      console.log('\n🎉 Все тесты пройдены успешно!');
      console.log(`📊 Логи сохранены в: logs/${today}.jsonl`);
      console.log('📚 Инструкция по чтению логов: cat logs/' + today + '.jsonl | jq \'.\'');
    } else {
      logger.error('=== ТЕСТ ПРОВАЛЕН ===', { status: 'FAILED' });
      console.log('\n❌ Тест провален, проверьте ошибки выше.');
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

// Запуск
if (require.main === module) {
  main();
}

module.exports = { testLogger, checkLogFiles };