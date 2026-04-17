#!/usr/bin/env node
/**
 * Быстрая проверка системы перед аудитом
 * Проверяет критические конфигурации без запуска полного анализа
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 БЫСТРАЯ ПРОВЕРКА СИСТЕМЫ ТЕННИСНЫХ СТАВОК v2.0');
console.log('Дата:', new Date().toISOString());
console.log('='.repeat(60));

// Результаты проверки
const results = {
  config: { passed: 0, failed: 0, warnings: 0 },
  security: { passed: 0, failed: 0, warnings: 0 },
  files: { passed: 0, failed: 0, warnings: 0 },
  cache: { passed: 0, failed: 0, warnings: 0 }
};

// 1. Проверка конфигурационных файлов
console.log('\n1. 📁 ПРОВЕРКА КОНФИГУРАЦИОННЫХ ФАЙЛОВ');
console.log('-'.repeat(40));

const configFiles = [
  'config/historical-optimizations.js',
  'config/dynamic-edge-config.js',
  'config/tournament-risk.json',
  'config/bookmakers.json'
];

configFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем конкретные файлы
    if (file.includes('historical-optimizations')) {
      if (content.includes('MIN_ODDS: 2.5')) {
        console.log(`✅ ${file}: MIN_ODDS = 2.5`);
        results.config.passed++;
      } else {
        console.log(`❌ ${file}: MIN_ODDS НЕ равен 2.5`);
        results.config.failed++;
      }
      
      if (content.includes('Grand Slam') && content.includes('MAX_ODDS: 2.8')) {
        console.log(`✅ ${file}: Grand Slam ограничения найдены`);
        results.config.passed++;
      } else {
        console.log(`⚠️ ${file}: Grand Slam ограничения не ясны`);
        results.config.warnings++;
      }
    }
    
    if (file.includes('dynamic-edge-config')) {
      if (content.includes('BASE_EDGE: 0.03')) {
        console.log(`✅ ${file}: BASE_EDGE = 3%`);
        results.config.passed++;
      } else {
        console.log(`⚠️ ${file}: BASE_EDGE не указан явно`);
        results.config.warnings++;
      }
    }
    
    if (file.includes('bookmakers')) {
      if (content.includes('The Odds API') && !content.includes('Fonbet')) {
        console.log(`✅ ${file}: Используется The Odds API (не Fonbet)`);
        results.config.passed++;
      } else {
        console.log(`⚠️ ${file}: Проверьте конфигурацию букмекеров`);
        results.config.warnings++;
      }
    }
  } else {
    console.log(`❌ ${file}: Файл не найден`);
    results.config.failed++;
  }
});

// 2. Проверка безопасности
console.log('\n2. 🔒 ПРОВЕРКА БЕЗОПАСНОСТИ');
console.log('-'.repeat(40));

// Проверка токенов в коде
const checkForTokens = () => {
  let foundTokens = false;
  
  // Проверяем основные директории
  const dirsToCheck = ['scripts', 'config'];
  
  dirsToCheck.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js') || f.endsWith('.json'));
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Проверяем на наличие токенов
        if (content.includes('ghp_') || 
            content.includes('5bade599') || 
            content.match(/api[_-]?key/i) ||
            content.match(/token["']?\s*:\s*["'][^"']{10,}/i)) {
          console.log(`❌ ${dir}/${file}: Найден возможный токен`);
          foundTokens = true;
        }
      });
    }
  });
  
  if (!foundTokens) {
    console.log('✅ Токены не найдены в коде');
    results.security.passed++;
  } else {
    console.log('❌ Обнаружены потенциальные токены в коде');
    results.security.failed++;
  }
};

checkForTokens();

// Проверка .gitignore
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (gitignore.includes('.env') || gitignore.includes('cache/') || gitignore.includes('*.env')) {
    console.log('✅ .gitignore содержит защиту чувствительных файлов');
    results.security.passed++;
  } else {
    console.log('⚠️ .gitignore может быть недостаточно защищён');
    results.security.warnings++;
  }
}

// 3. Проверка файловой структуры
console.log('\n3. 📂 ПРОВЕРКА ФАЙЛОВОЙ СТРУКТУРЫ');
console.log('-'.repeat(40));

const requiredFiles = [
  'scripts/analyze-with-real-odds.js',
  'scripts/analysis-cache-manager.js',
  'scripts/odds-cache-manager.js',
  'docs/GRAVEYARD.md',
  'docs/betting-commands.md',
  'reports/AUDITOR_INSTRUCTIONS.md',
  'package.json',
  'README.md'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}: Существует`);
    results.files.passed++;
  } else {
    console.log(`❌ ${file}: Отсутствует`);
    results.files.failed++;
  }
});

// 4. Проверка кэша
console.log('\n4. 💾 ПРОВЕРКА СОСТОЯНИЯ КЭША');
console.log('-'.repeat(40));

const cacheDir = path.join(__dirname, '..', 'cache');
if (fs.existsSync(cacheDir)) {
  console.log('✅ Директория cache/ существует');
  results.cache.passed++;
  
  // Проверяем файлы кэша
  const cacheFiles = ['odds-cache.json', 'system-stats.json'];
  
  cacheFiles.forEach(file => {
    const filePath = path.join(cacheDir, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      
      if (ageHours < 24) {
        console.log(`✅ ${file}: Свежий (${ageHours.toFixed(1)} часов)`);
        results.cache.passed++;
      } else {
        console.log(`⚠️ ${file}: Устаревший (${ageHours.toFixed(1)} часов)`);
        results.cache.warnings++;
      }
    } else {
      console.log(`⚠️ ${file}: Отсутствует`);
      results.cache.warnings++;
    }
  });
  
  // Проверяем директорию analysis-cache
  const analysisCacheDir = path.join(cacheDir, 'analysis-cache');
  if (fs.existsSync(analysisCacheDir)) {
    const files = fs.readdirSync(analysisCacheDir);
    if (files.length > 0) {
      console.log(`✅ analysis-cache/: ${files.length} файлов`);
      results.cache.passed++;
    } else {
      console.log('⚠️ analysis-cache/: Пустая директория');
      results.cache.warnings++;
    }
  } else {
    console.log('⚠️ analysis-cache/: Директория не существует');
    results.cache.warnings++;
  }
} else {
  console.log('⚠️ Директория cache/ не существует');
  results.cache.warnings++;
}

// Итоги
console.log('\n' + '='.repeat(60));
console.log('📊 ИТОГИ ПРОВЕРКИ');
console.log('='.repeat(60));

const totalPassed = Object.values(results).reduce((sum, cat) => sum + cat.passed, 0);
const totalFailed = Object.values(results).reduce((sum, cat) => sum + cat.failed, 0);
const totalWarnings = Object.values(results).reduce((sum, cat) => sum + cat.warnings, 0);

console.log(`✅ Пройдено: ${totalPassed}`);
console.log(`❌ Ошибки: ${totalFailed}`);
console.log(`⚠️ Предупреждения: ${totalWarnings}`);

// Детали по категориям
console.log('\n📈 ДЕТАЛИ ПО КАТЕГОРИЯМ:');
Object.entries(results).forEach(([category, stats]) => {
  console.log(`  ${category.toUpperCase()}: ✅${stats.passed} ❌${stats.failed} ⚠️${stats.warnings}`);
});

// Рекомендации
console.log('\n🎯 РЕКОМЕНДАЦИИ:');

if (totalFailed > 0) {
  console.log('❌ Критические ошибки обнаружены. Система НЕ готова к аудиту.');
  console.log('   Исправьте ошибки перед запуском полного аудита.');
} else if (totalWarnings > 5) {
  console.log('⚠️ Много предупреждений. Рекомендуется проверить перед аудитом:');
  console.log('   1. Обновить кэш: node scripts/update-cache-now.js');
  console.log('   2. Проверить конфигурации');
  console.log('   3. Обновить документацию при необходимости');
} else {
  console.log('✅ Система готова к полному аудиту.');
  console.log('   Запустите: node scripts/run-audit-v2.0.js');
}

// Проверка основных конфигураций
console.log('\n🔧 КЛЮЧЕВЫЕ КОНФИГУРАЦИИ:');
try {
  const historicalConfig = require('../config/historical-optimizations.js');
  console.log(`   MIN_ODDS: ${historicalConfig.ODDS_CONFIG?.MIN_ODDS || 'не найден'}`);
  console.log(`   Grand Slam ограничения: ${historicalConfig.TOURNAMENT_SPECIAL_RULES?.['Grand Slam']?.MAX_ODDS || 'не найден'}`);
} catch (e) {
  console.log(`   ⚠️ Не удалось загрузить конфигурации: ${e.message}`);
}

try {
  const edgeConfig = require('../config/dynamic-edge-config.js');
  console.log(`   BASE_EDGE: ${edgeConfig.EDGE_CONFIG?.BASE_EDGE || 'не найден'}`);
} catch (e) {
  console.log(`   ⚠️ Не удалось загрузить edge конфигурации: ${e.message}`);
}

console.log('\n📝 СЛЕДУЮЩИЕ ШАГИ:');
console.log('1. Исправьте критические ошибки (если есть)');
console.log('2. Обновите кэш: node scripts/update-cache-now.js');
console.log('3. Запустите полный аудит: node scripts/run-audit-v2.0.js --full');

console.log('\n' + '='.repeat(60));
console.log('🔚 ПРОВЕРКА ЗАВЕРШЕНА');

// Выходной код
process.exit(totalFailed > 0 ? 1 : 0);