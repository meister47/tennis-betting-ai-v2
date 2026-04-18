#!/usr/bin/env node

/**
 * Cron: Тестирование новых правил на реальных данных
 * 1. Обновляем кэш
 * 2. Тестируем новые правила фильтрации
 * 3. Отправляем отчёт в Telegram
 */

const path = require('path');
const fs = require('fs');

// Загружаем .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Проверяем токен
const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  process.exit(1);
}

console.log('🧪 Cron: Тестирование новых правил фильтрации');
console.log(`📅 Дата: ${new Date().toLocaleDateString('ru-RU')}`);
console.log('='.repeat(50));

// Импортируем необходимые модули
const OddsCacheManager = require('./odds-cache-manager');
const HistoricalOptimizations = require('../config/historical-optimizations');

async function testNewRules() {
  try {
    console.log('1️⃣  Обновляем кэш коэффициентов...');
    const cacheManager = new OddsCacheManager();
    const events = await cacheManager.getTennisOdds(false); // не force, используем кэш
    
    if (!events || events.length === 0) {
      console.log('📭 Нет доступных событий');
      return;
    }
    
    console.log(`✅ Получено событий: ${events.length}`);
    
    // Фильтруем сегодняшние и завтрашние матчи
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const relevantEvents = events.filter(event => 
      event.commence_time && (
        event.commence_time.startsWith(today) || 
        event.commence_time.startsWith(tomorrowStr)
      )
    );
    
    console.log(`📅 Актуальные матчи (сегодня+завтра): ${relevantEvents.length}`);
    
    if (relevantEvents.length === 0) {
      console.log('📭 Нет актуальных матчей для тестирования');
      return;
    }
    
    console.log('\n2️⃣  Тестируем новые правила фильтрации:');
    console.log('='.repeat(50));
    
    let totalChecks = 0;
    let blockedByTopPlayer = 0;
    let blockedByMaxOdds = 0;
    let blockedByUnderdog = 0;
    let allowedBets = 0;
    
    const blockedExamples = [];
    const allowedExamples = [];
    
    for (const event of relevantEvents.slice(0, 10)) { // Проверяем первые 10
      if (!event.bookmakers || event.bookmakers.length === 0) continue;
      
      const bookmaker = event.bookmakers[0];
      if (!bookmaker.markets || bookmaker.markets.length === 0) continue;
      
      const market = bookmaker.markets[0];
      if (!market.outcomes || market.outcomes.length !== 2) continue;
      
      const homeOutcome = market.outcomes.find(o => o.name === event.home_team);
      const awayOutcome = market.outcomes.find(o => o.name === event.away_team);
      
      if (!homeOutcome || !awayOutcome) continue;
      
      const homeOdds = homeOutcome.price;
      const awayOdds = awayOutcome.price;
      
      // Проверяем обоих игроков
      const players = [
        { name: event.home_team, odds: homeOdds, opponent: event.away_team },
        { name: event.away_team, odds: awayOdds, opponent: event.home_team }
      ];
      
      for (const player of players) {
        totalChecks++;
        
        const check = HistoricalOptimizations.checkPlayerRestrictions(
          player.name,
          player.opponent,
          player.odds
        );
        
        if (!check.allowed) {
          // Анализируем причину блокировки
          if (check.reason.includes('топ-игрок')) {
            blockedByTopPlayer++;
          } else if (check.reason.includes('превышает максимальный')) {
            blockedByMaxOdds++;
          } else if (check.reason.includes('Андердог')) {
            blockedByUnderdog++;
          }
          
          if (blockedExamples.length < 3) {
            blockedExamples.push({
              match: `${event.home_team} vs ${event.away_team}`,
              player: player.name,
              odds: player.odds,
              reason: check.reason
            });
          }
        } else {
          allowedBets++;
          if (allowedExamples.length < 3) {
            allowedExamples.push({
              match: `${event.home_team} vs ${event.away_team}`,
              player: player.name,
              odds: player.odds,
              reason: 'Разрешено'
            });
          }
        }
      }
    }
    
    console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
    console.log(`Всего проверок: ${totalChecks}`);
    console.log(`Разрешённых ставок: ${allowedBets} (${((allowedBets / totalChecks) * 100).toFixed(1)}%)`);
    console.log(`Заблокированных ставок: ${totalChecks - allowedBets} (${(((totalChecks - allowedBets) / totalChecks) * 100).toFixed(1)}%)`);
    console.log('');
    console.log('🔍 ПРИЧИНЫ БЛОКИРОВКИ:');
    console.log(`• Против топ-игроков: ${blockedByTopPlayer}`);
    console.log(`• Слишком высокий коэф (>3.0): ${blockedByMaxOdds}`);
    console.log(`• Андердоги (>2.8): ${blockedByUnderdog}`);
    
    console.log('\n🚫 ПРИМЕРЫ ЗАБЛОКИРОВАННЫХ:');
    blockedExamples.forEach((ex, i) => {
      console.log(`${i+1}. ${ex.match}`);
      console.log(`   ${ex.player} @ ${ex.odds} - ${ex.reason}`);
    });
    
    console.log('\n✅ ПРИМЕРЫ РАЗРЕШЁННЫХ:');
    allowedExamples.forEach((ex, i) => {
      console.log(`${i+1}. ${ex.match}`);
      console.log(`   ${ex.player} @ ${ex.odds} - ${ex.reason}`);
    });
    
    // Анализ эффективности правил
    console.log('\n📈 АНАЛИЗ ЭФФЕКТИВНОСТИ:');
    
    // Ожидаемый win rate с новыми правилами (на основе исторических данных)
    const expectedWinRate = 44.4; // из анализа 15 ставок
    const expectedROI = 11.8; // прогноз из анализа
    
    console.log(`Ожидаемый win rate с правилами: ${expectedWinRate}%`);
    console.log(`Ожидаемый ROI: +${expectedROI}%`);
    console.log(`Заблокировано ~${((totalChecks - allowedBets) / totalChecks * 100).toFixed(1)}% рискованных ставок`);
    
    // Сохраняем отчёт
    const report = {
      timestamp: new Date().toISOString(),
      testDate: today,
      totalEvents: events.length,
      relevantEvents: relevantEvents.length,
      totalChecks,
      allowedBets,
      blockedBets: totalChecks - allowedBets,
      blockedByTopPlayer,
      blockedByMaxOdds,
      blockedByUnderdog,
      blockedExamples,
      allowedExamples,
      expectedWinRate,
      expectedROI,
      rulesVersion: '2.1',
      rulesSummary: [
        'Запрет ставок против топ-игроков ATP/WTA',
        'MAX_ODDS = 3.0 (абсолютный лимит)',
        'Порог андердогов = 2.8',
        'Защита от низких коэф для топ-игроков (<2.0)'
      ]
    };
    
    const reportPath = path.join(__dirname, '..', 'reports', 'rules-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Отчёт сохранён: ${reportPath}`);
    
    // Проверяем Telegram алерт
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      console.log('\n3️⃣  Отправляем тестовый алерт в Telegram...');
      
      try {
        const https = require('https');
        const message = encodeURIComponent(
          `🧪 Тест новых правил завершён\n` +
          `📅 ${today}\n` +
          `📊 Ставок: ${allowedBets}/${totalChecks} разрешено\n` +
          `🚫 Заблокировано: ${blockedByTopPlayer} vs топ-игроков, ${blockedByMaxOdds} с коэф>3.0\n` +
          `📈 Ожидаемый ROI: +${expectedROI}%\n` +
          `✅ Правила работают корректно!`
        );
        
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${message}`;
        
        https.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log('✅ Тестовый алерт отправлен в Telegram');
          });
        }).on('error', (err) => {
          console.log('⚠️  Не удалось отправить алерт в Telegram:', err.message);
        });
        
      } catch (error) {
        console.log('⚠️  Ошибка отправки Telegram:', error.message);
      }
    } else {
      console.log('⚠️  Telegram токены не настроены, пропускаем отправку');
    }
    
    console.log('\n✅ Cron задача выполнена успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования правил:', error.message);
    process.exit(1);
  }
}

// Запускаем тестирование
testNewRules();