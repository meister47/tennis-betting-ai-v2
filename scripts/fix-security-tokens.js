#!/usr/bin/env node
/**
 * Скрипт для исправления хардкоженных токенов в коде
 * Заменяет API ключи на переменные окружения
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 ИСПРАВЛЕНИЕ БЕЗОПАСНОСТИ ТОКЕНОВ');
console.log('='.repeat(60));
console.log('Дата:', new Date().toISOString());
console.log('Цель: Заменить хардкоженные ключи на переменные окружения');
console.log('='.repeat(60));

// Список файлов для исправления с их старыми и новыми строками
const filesToFix = [
  {
    path: 'scripts/real-today-analysis-min-odds.js',
    oldLines: [
      /const API_KEY = '5bade59990c62f13daecce0427ec665e';/
    ],
    newLine: `const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  process.exit(1);
}`
  },
  {
    path: 'scripts/update-bets-results.js',
    oldLines: [
      /const apiKey = '5bade59990c62f13daecce0427ec665e'; \/\/ The Odds API/
    ],
    newLine: `const apiKey = process.env.THE_ODDS_API_KEY;
if (!apiKey) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  process.exit(1);
}`
  },
  {
    path: 'scripts/odds-cache-manager.js',
    oldLines: [
      /const API_KEY = '5bade59990c62f13daecce0427ec665e';/
    ],
    newLine: `const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  process.exit(1);
}`
  },
  {
    path: 'scripts/update-cache-now.js',
    oldLines: [
      /const API_KEY = '5bade59990c62f13daecce0427ec665e';/
    ],
    newLine: `const API_KEY = process.env.THE_ODDS_API_KEY;
if (!API_KEY) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  process.exit(1);
}`
  }
];

// Также проверяем другие возможные места
const otherFilesToCheck = [
  'scripts/analyze-with-real-odds.js',
  'scripts/morning-cache-update.js',
  'scripts/evening-cache-update.js',
  'scripts/odds-update-scheduler.js',
  'config/bookmakers.json'
];

// Статистика
let fixedCount = 0;
let checkedCount = 0;
let errors = [];

console.log('\n📁 ИСПРАВЛЕНИЕ ОСНОВНЫХ ФАЙЛОВ:');
console.log('-'.repeat(40));

// Исправляем основные файлы
filesToFix.forEach(fileInfo => {
  const filePath = path.join(__dirname, '..', fileInfo.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Файл не найден: ${fileInfo.path}`);
    errors.push(`Файл не найден: ${fileInfo.path}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fileFixed = false;
  
  // Ищем и заменяем все старые строки
  fileInfo.oldLines.forEach(oldPattern => {
    if (oldPattern.test(content)) {
      content = content.replace(oldPattern, fileInfo.newLine);
      fileFixed = true;
    }
  });
  
  if (fileFixed) {
    // Записываем обратно
    fs.writeFileSync(filePath, content);
    console.log(`✅ Исправлен: ${fileInfo.path}`);
    fixedCount++;
    
    // Создаем backup
    const backupPath = filePath + '.backup-before-security-fix';
    fs.writeFileSync(backupPath, originalContent);
    console.log(`   📦 Создан backup: ${fileInfo.path}.backup-before-security-fix`);
  } else {
    console.log(`⚠️  Токен не найден в: ${fileInfo.path} (уже исправлен?)`);
  }
  
  checkedCount++;
});

console.log('\n🔍 ПРОВЕРКА ДРУГИХ ФАЙЛОВ:');
console.log('-'.repeat(40));

// Проверяем другие файлы на наличие токенов
otherFilesToCheck.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Файл не найден: ${filePath}`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Проверяем на наличие токенов
  if (content.includes('5bade59990c62f13daecce0427ec665e') || 
      content.includes('ghp_') ||
      content.match(/api[_-]?key["']?\s*:\s*["'][^"']{10,}/i)) {
    console.log(`❌ Найден токен в: ${filePath}`);
    errors.push(`Токен в файле: ${filePath}`);
  } else {
    console.log(`✅ Чистый: ${filePath}`);
  }
  
  checkedCount++;
});

console.log('\n📊 СТАТИСТИКА:');
console.log('-'.repeat(40));
console.log(`Проверено файлов: ${checkedCount}`);
console.log(`Исправлено файлов: ${fixedCount}`);
console.log(`Ошибок: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n❌ ОШИБКИ:');
  errors.forEach(error => console.log(`  - ${error}`));
}

console.log('\n🛡️  СОЗДАНИЕ ФАЙЛОВ БЕЗОПАСНОСТИ:');
console.log('-'.repeat(40));

// Создаем .env.local если не существует
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envLocalPath)) {
  const envContent = `# The Odds API ключ (получите на https://the-odds-api.com/)
THE_ODDS_API_KEY=ваш_ключ_здесь

# Важно: НЕ коммитьте этот файл в Git!
# Добавьте .env.local в .gitignore

# Проверьте настройки в SETUP_SECURITY.md`;
  
  fs.writeFileSync(envLocalPath, envContent);
  console.log(`✅ Создан: .env.local (шаблон)`);
  console.log('   ⚠️  ЗАПОЛНИТЕ КЛЮЧ В .env.local!');
} else {
  console.log(`⚠️  .env.local уже существует`);
}

// Обновляем .gitignore
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  let gitignore = fs.readFileSync(gitignorePath, 'utf8');
  
  if (!gitignore.includes('.env.local')) {
    gitignore += '\n# Файлы окружения\n.env.local\n.env.*.local\n*.env\n';
    fs.writeFileSync(gitignorePath, gitignore);
    console.log('✅ Обновлен: .gitignore (добавлена защита .env.local)');
  } else {
    console.log('✅ .gitignore уже защищает .env.local');
  }
}

console.log('\n🎯 РЕКОМЕНДАЦИИ:');
console.log('-'.repeat(40));

if (errors.length === 0 && fixedCount > 0) {
  console.log('✅ Все хардкоженные токены исправлены!');
  console.log('');
  console.log('📋 СЛЕДУЮЩИЕ ШАГИ:');
  console.log('1. Откройте .env.local и добавьте ваш ключ The Odds API');
  console.log('2. Проверьте работу системы:');
  console.log('   node scripts/analyze-with-real-odds.js --test');
  console.log('3. Запустите проверку безопасности:');
  console.log('   node scripts/quick-audit-check.js');
  console.log('4. Отзовите старый ключ на The Odds API сайте');
  console.log('5. Создайте новый ключ для безопасности');
} else if (errors.length > 0) {
  console.log('❌ Есть неисправленные файлы с токенами');
  console.log('   Нужно вручную исправить файлы из списка ошибок');
} else {
  console.log('⚠️  Не было найдено хардкоженных токенов');
  console.log('   Возможно, они уже были исправлены ранее');
}

console.log('\n🔒 ВАЖНО:');
console.log('-'.repeat(40));
console.log('1. Хардкоженные ключи в коде — КРИТИЧЕСКАЯ уязвимость');
console.log('2. Отзовите старый ключ 5bade59990c62f13daecce0427ec665e');
console.log('3. Создайте новый ключ на https://the-odds-api.com/');
console.log('4. Добавьте новый ключ в .env.local');
console.log('5. НИКОГДА не коммитьте .env.local в Git');

console.log('\n' + '='.repeat(60));
console.log('🔚 СКРИПТ ЗАВЕРШЕН');

// Выходной код
process.exit(errors.length > 0 ? 1 : 0);