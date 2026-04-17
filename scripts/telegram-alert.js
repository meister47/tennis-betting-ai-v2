#!/usr/bin/env node

/**
 * Модуль отправки алертов в Telegram для Tennis Betting AI
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Конфигурация по умолчанию
 */
const DEFAULT_CONFIG = {
  // Уровни алертов
  levels: {
    info: { emoji: 'ℹ️', color: '🔵' },
    warn: { emoji: '⚠️', color: '🟡' },
    error: { emoji: '❌', color: '🔴' },
    critical: { emoji: '🚨', color: '🟣' },
    ok: { emoji: '✅', color: '🟢' }
  },
  
  // Компоненты системы
  components: {
    'analyzer': 'Анализатор теннисных матчей',
    'clv-tracker': 'CLV-трекер ставок',
    'odds-cache': 'Кэш коэффициентов',
    'health-monitor': 'Система мониторинга'
  },
  
  // Лимиты отправки (в секундах)
  rateLimits: {
    component: 3600, // 1 час между алертами для одного компонента
    summary: 21600   // 6 часов между сводками
  }
};

/**
 * Класс для отправки алертов в Telegram
 */
class TelegramAlerter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Получение токенов из окружения
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    
    // Проверка конфигурации
    this.enabled = !!(this.botToken && this.chatId);
    this.dryRun = process.env.DRY_RUN === 'true';
    
    // Файлы для хранения истории алертов
    this.stateDir = path.join(__dirname, '../data/telegram-state');
    this.componentAlertsFile = path.join(this.stateDir, 'component-alerts.json');
    this.summaryAlertsFile = path.join(this.stateDir, 'summary-alerts.json');
    
    // Инициализация директорий
    this.initState();
    
    console.log(`[TELEGRAM] Telegram alerter ${this.enabled ? 'enabled' : 'disabled'}`);
    console.log(`[TELEGRAM] Dry run: ${this.dryRun}`);
  }

  /**
   * Инициализация состояния алертов
   */
  initState() {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
      
      // Файл для истории алертов по компонентам
      if (!fs.existsSync(this.componentAlertsFile)) {
        fs.writeFileSync(this.componentAlertsFile, JSON.stringify({}, null, 2));
      }
      
      // Файл для истории сводок
      if (!fs.existsSync(this.summaryAlertsFile)) {
        fs.writeFileSync(this.summaryAlertsFile, JSON.stringify({}, null, 2));
      }
    } catch (error) {
      console.error('[TELEGRAM] Failed to initialize state:', error.message);
    }
  }

  /**
   * Проверка rate limit для компонента
   */
  checkRateLimit(component, alertType = 'component') {
    try {
      const file = alertType === 'component' ? this.componentAlertsFile : this.summaryAlertsFile;
      const history = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      const now = Date.now();
      const limit = alertType === 'component' 
        ? this.config.rateLimits.component 
        : this.config.rateLimits.summary;
      
      const lastAlert = history[component];
      
      // Если алерта еще не было или прошло больше лимита
      if (!lastAlert || (now - lastAlert.timestamp) > (limit * 1000)) {
        // Обновляем историю
        history[component] = { timestamp: now };
        fs.writeFileSync(file, JSON.stringify(history, null, 2));
        return true;
      }
      
      console.log(`[TELEGRAM] Rate limit hit for ${component}, last alert was ${Math.round((now - lastAlert.timestamp) / 1000)}s ago`);
      return false;
    } catch (error) {
      console.error('[TELEGRAM] Rate limit check failed:', error.message);
      return true; // В случае ошибки разрешаем отправку
    }
  }

  /**
   * Форматирование сообщения
   */
  formatMessage(message, level = 'info', metadata = {}) {
    const levelConfig = this.config.levels[level] || this.config.levels.info;
    const componentName = metadata.component 
      ? (this.config.components[metadata.component] || metadata.component)
      : 'System';
    
    // Текущее время
    const now = new Date();
    const timeStr = now.toLocaleString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Статус компонента
    const statusStr = metadata.status 
      ? `*Status:* ${metadata.status.toUpperCase()}\n`
      : '';

    // Дополнительные метаданные
    let metadataStr = '';
    if (metadata.lastRun) {
      metadataStr += `*Last run:* ${metadata.lastRun}\n`;
    }
    if (metadata.hoursSinceLastRun !== undefined) {
      metadataStr += `*Hours since last run:* ${metadata.hoursSinceLastRun.toFixed(2)}\n`;
    }
    if (metadata.uptime !== undefined) {
      metadataStr += `*Uptime:* ${metadata.uptime}\n`;
    }

    // Форматирование сообщения
    const formatted = `${levelConfig.emoji} *${levelConfig.color} ${componentName}*\n` +
                     `${levelConfig.emoji} *Time:* ${timeStr} (MSK)\n` +
                     (statusStr ? `${statusStr}\n` : '') +
                     `${metadataStr ? `${metadataStr}\n` : ''}` +
                     `*Message:* ${message}`;

    return formatted;
  }

  /**
   * Отправка сообщения в Telegram
   */
  async sendMessage(text, retries = 3) {
    // Проверка режима dry run
    if (this.dryRun) {
      console.log('[TELEGRAM] (DRY RUN) Would send:', text);
      return { success: true, dryRun: true };
    }

    // Проверка включенности
    if (!this.enabled) {
      console.log('[TELEGRAM] Would send (disabled):', text);
      return { success: false, error: 'Telegram alerter disabled' };
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          {
            chat_id: this.chatId,
            text: text,
            parse_mode: 'Markdown',
            disable_notification: false,
            disable_web_page_preview: true
          },
          {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.ok) {
          console.log('[TELEGRAM] Message sent successfully');
          return { success: true, messageId: response.data.result.message_id };
        } else {
          console.error('[TELEGRAM] API returned error:', response.data);
          
          if (attempt < retries) {
            console.log(`[TELEGRAM] Retrying (${attempt}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          return { success: false, error: response.data.description };
        }
      } catch (error) {
        console.error(`[TELEGRAM] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < retries) {
          console.log(`[TELEGRAM] Retrying (${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return { 
          success: false, 
          error: error.message,
          code: error.code
        };
      }
    }
    
    return { success: false, error: 'All retries failed' };
  }

  /**
   * Отправка алерта
   */
  async send(message, level = 'info', metadata = {}) {
    // Форматируем сообщение
    const formattedMessage = this.formatMessage(message, level, metadata);
    
    // Проверяем rate limit если есть компонент
    if (metadata.component && !this.checkRateLimit(metadata.component)) {
      console.log(`[TELEGRAM] Rate limit hit for ${metadata.component}, skipping alert`);
      return { success: false, error: 'Rate limit hit' };
    }
    
    // Отправляем сообщение
    return await this.sendMessage(formattedMessage);
  }

  /**
   * Отправка алерта по компоненту
   */
  async sendComponentAlert(component, status, message, metadata = {}) {
    const level = this.statusToLevel(status);
    const enhancedMetadata = {
      component,
      status,
      ...metadata
    };
    
    return await this.send(message, level, enhancedMetadata);
  }

  /**
   * Отправка сводки здоровья системы
   */
  async sendHealthSummary(healthResults) {
    // Проверяем rate limit для сводки
    const summaryKey = 'system-summary';
    if (!this.checkRateLimit(summaryKey, 'summary')) {
      console.log('[TELEGRAM] Rate limit hit for system summary');
      return { success: false, error: 'Rate limit hit' };
    }

    const { overall, components } = healthResults;
    const level = overall.level;
    const levelConfig = this.config.levels[level] || this.config.levels.info;

    // Формируем сводку
    let summary = `${levelConfig.emoji} *${levelConfig.color} Сводка здоровья Tennis Betting AI*\n\n`;
    
    // Общая информация
    const now = new Date();
    const timeStr = now.toLocaleString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    summary += `*Time:* ${timeStr} (MSK)\n`;
    summary += `*Overall status:* ${overall.status.toUpperCase()}\n`;
    summary += `*Message:* ${overall.message}\n\n`;

    // Статистика по компонентам
    const stats = overall.stats || { total: components.length, ok: 0, warn: 0, error: 0 };
    summary += `*📊 Statistics:*\n`;
    summary += `✅ OK: ${stats.ok || 0}\n`;
    summary += `⚠️ WARN: ${stats.warn || 0}\n`;
    summary += `❌ ERROR: ${stats.error || 0}\n`;
    summary += `📦 Total: ${stats.total || 0}\n\n`;

    // Детали по компонентам
    if (components.length > 0) {
      summary += `*🔍 Component details:*\n`;
      
      for (const component of components) {
        const compName = this.config.components[component.component] || component.name || component.component;
        const emoji = this.config.levels[component.level]?.emoji || '🔘';
        const statusText = component.status.toUpperCase();
        
        // Сокращенная информация
        let details = '';
        if (component.hoursSinceLastRun !== undefined) {
          details = ` • ${component.hoursSinceLastRun.toFixed(1)}h`;
        }
        if (component.message) {
          details = `${details ? details + ' • ' : ' • '}${component.message.substring(0, 50)}${component.message.length > 50 ? '...' : ''}`;
        }
        
        summary += `${emoji} *${compName}*: ${statusText}${details}\n`;
      }
    }

    // Рекомендации
    if (overall.status !== 'ok') {
      summary += `\n*🎯 Recommendations:*\n`;
      
      const errorComponents = components.filter(c => c.status === 'error');
      const warnComponents = components.filter(c => c.status === 'warn');
      
      if (errorComponents.length > 0) {
        summary += `• Проверьте компоненты с ошибками в первую очередь\n`;
      }
      if (warnComponents.length > 0) {
        summary += `• Мониторьте компоненты с предупреждениями\n`;
      }
      
      summary += `• Подробные логи: \`tail -f logs/health.log\`\n`;
      summary += `• Проверьте cron jobs: \`crontab -l | grep tennis\`\n`;
    }

    // Отправляем сводку
    return await this.sendMessage(summary);
  }

  /**
   * Конвертация статуса в уровень
   */
  statusToLevel(status) {
    switch (status.toLowerCase()) {
      case 'ok':
        return 'ok';
      case 'running':
        return 'info';
      case 'warn':
      case 'warning':
        return 'warn';
      case 'error':
        return 'error';
      case 'critical':
        return 'critical';
      default:
        return 'info';
    }
  }

  /**
   * Тестовый алерт для проверки конфигурации
   */
  async sendTestAlert() {
    console.log('[TELEGRAM] Sending test alert...');
    
    if (!this.enabled) {
      console.log('[TELEGRAM] Telegram alerter is disabled. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
      return { success: false, error: 'Not enabled' };
    }
    
    const testMessage = `🎯 *Тестовый алерт Tennis Betting AI*\n\n` +
                       `Время: ${new Date().toLocaleString('ru-RU')}\n` +
                       `Система мониторинга работает корректно ✅\n` +
                       `Телеграм-интеграция настроена правильно`;
    
    return await this.sendMessage(testMessage);
  }
}

/**
 * Экспорт класса
 */
module.exports = TelegramAlerter;

/**
 * CLI интерфейс для тестирования
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';
  
  const alerter = new TelegramAlerter();
  
  async function runCommand() {
    switch (command) {
      case 'test':
        const result = await alerter.sendTestAlert();
        if (result.success) {
          console.log('✅ Test alert sent successfully');
          process.exit(0);
        } else {
          console.error('❌ Failed to send test alert:', result.error);
          process.exit(1);
        }
        break;
        
      case 'status':
        console.log('Telegram Alerter Status:');
        console.log(`- Enabled: ${alerter.enabled}`);
        console.log(`- Bot Token: ${alerter.botToken ? 'SET' : 'NOT SET'}`);
        console.log(`- Chat ID: ${alerter.chatId ? 'SET' : 'NOT SET'}`);
        console.log(`- Dry Run: ${alerter.dryRun}`);
        process.exit(0);
        break;
        
      case 'info':
        const infoMessage = `📊 *Информация о системе*\n\n` +
                           `*Host:* ${process.env.HOSTNAME || 'unknown'}\n` +
                           `*User:* ${process.env.USER || 'unknown'}\n` +
                           `*Node:* ${process.version}\n` +
                           `*Path:* ${__dirname}`;
        await alerter.sendMessage(infoMessage);
        console.log('Info message sent');
        process.exit(0);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Available commands:');
        console.log('  test    - Send test alert');
        console.log('  status  - Show configuration status');
        console.log('  info    - Send system info');
        process.exit(1);
    }
  }
  
  runCommand().catch(error => {
    console.error('Command failed:', error);
    process.exit(1);
  });
}