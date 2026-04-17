#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки SurfaceDetector
 */

const SurfaceDetector = require('./surface-detector.js');

console.log('🧪 Тестирование SurfaceDetector...\n');

// Тестовые данные
const testEvents = [
  { sport_key: 'tennis_atp_munich', sport_title: 'ATP Munich', home_team: 'Player A', away_team: 'Player B' },
  { sport_key: 'tennis_atp_wimbledon', sport_title: 'Wimbledon', home_team: 'Player C', away_team: 'Player D' },
  { sport_key: 'tennis_atp_french_open', sport_title: 'French Open', home_team: 'Player E', away_team: 'Player F' },
  { sport_key: 'tennis_atp_australian_open', sport_title: 'Australian Open', home_team: 'Player G', away_team: 'Player H' },
  { sport_key: 'tennis_atp_unknown', sport_title: 'Unknown Tournament', home_team: 'Player I', away_team: 'Player J' },
  { sport_key: 'tennis_atp_stuttgart', sport_title: 'ATP Stuttgart', home_team: 'Nadal', away_team: 'Federer' },
  { sport_key: 'tennis_atp_halle', sport_title: 'ATP Halle', home_team: 'Djokovic', away_team: 'Murray' },
  { sport_key: 'tennis_atp_barcelona', sport_title: 'ATP Barcelona', home_team: 'Thiem', away_team: 'Zverev' }
];

console.log('📋 Результаты определения покрытия:');
console.log('─'.repeat(60));

testEvents.forEach((event, index) => {
  const surface = SurfaceDetector.detectSurface(event);
  console.log(`${index + 1}. ${event.sport_title}: ${surface}`);
});

// Тест статистики
console.log('\n📊 Статистика по тестовым данным:');
const stats = SurfaceDetector.getSurfaceStats(testEvents);
console.log(`Всего событий: ${stats.total}`);
console.log(`Успешное определение: ${stats.detectionRate}%`);
console.log('Распределение:');
for (const [surface, data] of Object.entries(stats.bySurface)) {
  if (data.count > 0) {
    console.log(`  ${surface}: ${data.count} (${data.percentage}%)`);
  }
}

// Тест на реальных данных из bets-db.json
console.log('\n🔍 Тест на реальных данных из bets-db.json...');
const fs = require('fs');
const path = require('path');

const BETS_DB_PATH = '/root/.openclaw/workspace/bets-db.json';

if (fs.existsSync(BETS_DB_PATH)) {
  try {
    const rawData = fs.readFileSync(BETS_DB_PATH, 'utf8');
    const betsDb = JSON.parse(rawData);
    
    console.log(`Загружено ${betsDb.bets.length} ставок`);
    
    // Проверяем первые 5 ставок
    console.log('\nПервые 5 ставок:');
    betsDb.bets.slice(0, 5).forEach((bet, index) => {
      // Создаём mock event для SurfaceDetector
      const mockEvent = {
        sport_title: bet.event || '',
        sport_key: bet.event.toLowerCase().includes('atp') ? 'tennis_atp' : 
                  bet.event.toLowerCase().includes('wta') ? 'tennis_wta' : 'tennis',
        home_team: '',
        away_team: ''
      };
      
      // Извлекаем имена из события если есть "vs"
      const eventParts = bet.event.split('vs');
      if (eventParts.length === 2) {
        mockEvent.home_team = eventParts[0].trim();
        mockEvent.away_team = eventParts[1].trim().split(':')[0].trim();
      }
      
      const surface = SurfaceDetector.detectSurface(mockEvent);
      console.log(`${index + 1}. "${bet.event.substring(0, 40)}..." -> ${surface}`);
    });
    
    // Проверяем наличие поля surface
    const betsWithSurface = betsDb.bets.filter(bet => bet.surface).length;
    console.log(`\n📈 Текущее состояние поля surface:`);
    console.log(`   С surface: ${betsWithSurface} ставок`);
    console.log(`   Без surface: ${betsDb.bets.length - betsWithSurface} ставок`);
    
  } catch (err) {
    console.error(`Ошибка чтения bets-db.json: ${err.message}`);
  }
} else {
  console.log(`Файл ${BETS_DB_PATH} не найден`);
}

console.log('\n✅ Тест завершён!');