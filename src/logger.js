const fs = require('fs');
const path = require('path');

class Logger {
  constructor(component) {
    this.component = component;
    this.logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    this.USE_JSON_LOGGER = true;
  }

  _write(level, message, data = {}) {
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        component: this.component,
        level,
        message,
        ...data
      };

      // Человекочитаемый вывод в консоль
      const emoji = { 
        INFO: 'ℹ️', 
        WARN: '⚠️', 
        ERROR: '❌', 
        OK: '✅', 
        SKIP: '⏭️',
        DEBUG: '🔍'
      };
      const emojiSymbol = emoji[level] || '•';
      
      // Форматируем данные для консоли
      let consoleMsg = `${emojiSymbol} [${this.component}] ${message}`;
      if (Object.keys(data).length > 0) {
        // Для консоли показываем только ключевые данные
        const shortData = {};
        Object.keys(data).forEach(key => {
          if (typeof data[key] === 'object' && data[key] !== null) {
            shortData[key] = '[Object]';
          } else if (Array.isArray(data[key])) {
            shortData[key] = `[Array(${data[key].length})]`;
          } else {
            shortData[key] = data[key];
          }
        });
        if (Object.keys(shortData).length > 0) {
          consoleMsg += ` | ${JSON.stringify(shortData)}`;
        }
      }
      
      console.log(consoleMsg);

      // JSON в файл (один файл на день) если включено
      if (this.USE_JSON_LOGGER) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `${date}.jsonl`);
        
        // Добавляем кэширование частых записей
        const logLine = JSON.stringify(entry) + '\n';
        fs.appendFile(logFile, logLine, (err) => {
          if (err) {
            // При ошибке записи в файл — выводим в консоль, но не останавливаем работу
            console.error(`❌ [${this.component}] Failed to write log to file: ${err.message}`);
          }
        });
      }
    } catch (error) {
      // Аварийное логирование при ошибках в самом логгере
      console.error(`❌ [logger] Logger error: ${error.message}`);
    }
  }

  info(msg, data) { this._write('INFO', msg, data); }
  warn(msg, data) { this._write('WARN', msg, data); }
  error(msg, data) { this._write('ERROR', msg, data); }
  ok(msg, data) { this._write('OK', msg, data); }
  skip(msg, data) { this._write('SKIP', msg, data); }
  debug(msg, data) { this._write('DEBUG', msg, data); }
}

module.exports = Logger;