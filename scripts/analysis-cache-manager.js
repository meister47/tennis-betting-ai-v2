#!/usr/bin/env node

/**
 * Analysis Cache Manager - Кэширование результатов анализа модели
 * 
 * 🎯 ЦЕЛЬ: Не пересчитывать одни и те же матчи при повторных запусках
 * 
 * 📊 ПРИНЦИП РАБОТЫ:
 * 1. Перед анализом матча проверяем кэш
 * 2. Если матч уже анализировался сегодня и коэффициенты не изменились >2%:
 *    → Используем кэшированный результат
 * 3. Иначе: выполняем полный анализ и сохраняем в кэш
 * 
 * ⚡ ОЖИДАЕМЫЙ ЭФФЕКТ:
 * - Ускорение повторных запусков в 3-5 раз
 * - Снижение нагрузки на CPU
 * - Консистентность результатов при одинаковых входных данных
 */

const fs = require('fs');
const path = require('path');

// Конфигурация
const CACHE_DIR = path.join(__dirname, '../cache');
const CACHE_FILE = path.join(CACHE_DIR, 'analysis-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
const ODDS_CHANGE_THRESHOLD = 0.02; // 2% изменение коэффициента

// Утилиты для работы с датами
const DAY_IN_MS = 24 * 60 * 60 * 1000;

class AnalysisCacheManager {
  constructor() {
    this.cache = this.loadCache();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Загрузка кэша из файла с проверкой целостности
   */
  loadCache() {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        console.log('📦 Анализ-кэш: файл не найден, создаём новый');
        return { version: '1.0', created: new Date().toISOString(), entries: {} };
      }

      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const cache = JSON.parse(data);

      // Проверка целостности структуры
      if (!cache.version || !cache.created || !cache.entries) {
        console.log('⚠️  Анализ-кэш: некорректная структура, создаём новый');
        return { version: '1.0', created: new Date().toISOString(), entries: {} };
      }

      // Очистка устаревших записей (TTL 24 часа)
      this.cleanExpiredEntries(cache);

      console.log(`✅ Анализ-кэш загружен: ${Object.keys(cache.entries).length} записей`);
      return cache;

    } catch (error) {
      console.log(`⚠️  Анализ-кэш: ошибка загрузки (${error.message}), используем пустой кэш`);
      return { version: '1.0', created: new Date().toISOString(), entries: {} };
    }
  }

  /**
   * Очистка устаревших записей (старше 24 часов)
   */
  cleanExpiredEntries(cache) {
    const now = Date.now();
    const originalCount = Object.keys(cache.entries).length;
    let removedCount = 0;

    for (const matchId in cache.entries) {
      const entry = cache.entries[matchId];
      const entryAge = now - new Date(entry.timestamp).getTime();
      
      if (entryAge > CACHE_TTL_MS) {
        delete cache.entries[matchId];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Анализ-кэш: удалено ${removedCount} устаревших записей (осталось ${Object.keys(cache.entries).length})`);
    }
  }

  /**
   * Генерация ID матча для кэша
   */
  generateMatchId(homeTeam, awayTeam, tournament, commenceTime) {
    // Нормализация названий команд
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const home = normalize(homeTeam);
    const away = normalize(awayTeam);
    const tourney = tournament ? normalize(tournament) : 'unknown';
    const date = commenceTime ? new Date(commenceTime).toISOString().split('T')[0] : 'nodate';
    
    return `${home}_vs_${away}_${tourney}_${date}`;
  }

  /**
   * Проверка, изменились ли коэффициенты более чем на 2%
   */
  hasOddsChanged(cachedOdds, currentOdds) {
    if (!cachedOdds || !currentOdds) return true;
    
    // Сравниваем относительное изменение
    const change = Math.abs(currentOdds - cachedOdds) / cachedOdds;
    return change > ODDS_CHANGE_THRESHOLD;
  }

  /**
   * Проверка, является ли запись актуальной для сегодняшнего дня
   */
  isEntryFresh(timestamp) {
    const entryDate = new Date(timestamp);
    const today = new Date();
    
    return entryDate.getDate() === today.getDate() &&
           entryDate.getMonth() === today.getMonth() &&
           entryDate.getFullYear() === today.getFullYear();
  }

  /**
   * Получение кэшированного результата анализа
   * 
   * @param {string} matchId - ID матча
   * @param {number} currentOdds - Текущий коэффициент
   * @returns {object|null} Кэшированный результат или null если не найден
   */
  getCachedAnalysis(matchId, currentOdds) {
    if (!this.cache.entries[matchId]) {
      this.misses++;
      return null;
    }

    const entry = this.cache.entries[matchId];
    
    // Проверка актуальности (сегодняшний день)
    if (!this.isEntryFresh(entry.timestamp)) {
      console.log(`   📅 ${matchId}: запись не актуальна (не сегодня)`);
      this.misses++;
      return null;
    }

    // Проверка изменения коэффициентов
    if (this.hasOddsChanged(entry.odds_snapshot, currentOdds)) {
      console.log(`   📊 ${matchId}: коэффициенты изменились (${entry.odds_snapshot} → ${currentOdds})`);
      this.misses++;
      return null;
    }

    // Всё ок, используем кэш
    this.hits++;
    console.log(`   💾 ${matchId}: используем кэшированный результат (edge=${(entry.edge * 100).toFixed(1)}%)`);
    
    return {
      model_prob: entry.model_prob,
      edge: entry.edge,
      recommendation: entry.recommendation,
      stake: entry.stake,
      cached: true,
      timestamp: entry.timestamp
    };
  }

  /**
   * Сохранение результата анализа в кэш
   * 
   * @param {string} matchId - ID матча
   * @param {object} analysis - Результат анализа
   * @param {number} odds - Текущий коэффициент
   */
  saveAnalysis(matchId, analysis, odds) {
    try {
      this.cache.entries[matchId] = {
        timestamp: new Date().toISOString(),
        odds_snapshot: odds,
        model_prob: analysis.model_prob || analysis.probability,
        edge: analysis.edge,
        recommendation: analysis.recommendation || analysis.decision,
        stake: analysis.stake || 0
      };

      // Автоматически сохраняем в файл
      this.saveToFile();
      
      console.log(`   💾 ${matchId}: сохранено в кэш`);

    } catch (error) {
      console.log(`⚠️  ${matchId}: ошибка сохранения в кэш (${error.message})`);
    }
  }

  /**
   * Сохранение кэша в файл
   */
  saveToFile() {
    try {
      // Создаём директорию, если её нет
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      // Добавляем статистику
      this.cache.stats = {
        totalEntries: Object.keys(this.cache.entries).length,
        hits: this.hits,
        misses: this.misses,
        hitRate: this.hits > 0 ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) : 0,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
      
    } catch (error) {
      console.log(`❌ Ошибка сохранения кэша: ${error.message}`);
    }
  }

  /**
   * Получение статистики кэша
   */
  getStats() {
    return {
      entries: Object.keys(this.cache.entries).length,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits > 0 ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) : 0
    };
  }

  /**
   * Очистка всего кэша
   */
  clearCache() {
    this.cache.entries = {};
    this.hits = 0;
    this.misses = 0;
    this.saveToFile();
    console.log('✅ Анализ-кэш полностью очищен');
  }

  /**
   * Удаление устаревших записей из кэша
   */
  cleanup() {
    const originalCount = Object.keys(this.cache.entries).length;
    this.cleanExpiredEntries(this.cache);
    const newCount = Object.keys(this.cache.entries).length;
    
    if (originalCount !== newCount) {
      this.saveToFile();
      console.log(`🧹 Удалено ${originalCount - newCount} устаревших записей`);
    }
    
    return { removed: originalCount - newCount, remaining: newCount };
  }
}

/**
 * CLI-интерфейс для управления кэшем
 */
if (require.main === module) {
  const cacheManager = new AnalysisCacheManager();
  const command = process.argv[2] || 'status';

  switch (command) {
    case 'status':
      const stats = cacheManager.getStats();
      console.log('📊 СТАТИСТИКА АНАЛИЗ-КЭША:');
      console.log(`📁 Записей в кэше: ${stats.entries}`);
      console.log(`🎯 Хиты: ${stats.hits}, Промахи: ${stats.misses}`);
      console.log(`📈 Hit Rate: ${stats.hitRate}%`);
      
      // Показываем последние 5 записей
      if (stats.entries > 0) {
        console.log('\n📝 ПОСЛЕДНИЕ ЗАПИСИ:');
        const entries = Object.entries(cacheManager.cache.entries)
          .slice(0, 5)
          .map(([id, entry]) => ({
            match: id.split('_vs_').slice(0, 2).join(' vs '),
            odds: entry.odds_snapshot,
            edge: (entry.edge * 100).toFixed(1) + '%',
            timestamp: new Date(entry.timestamp).toLocaleString('ru-RU')
          }));
        
        entries.forEach(entry => {
          console.log(`   ${entry.match} @ ${entry.odds} (edge: ${entry.edge}) — ${entry.timestamp}`);
        });
      }
      break;

    case 'clean':
      cacheManager.clearCache();
      break;

    case 'cleanup':
      const result = cacheManager.cleanup();
      console.log(`✅ Очистка завершена: ${result.removed} удалено, ${result.remaining} осталось`);
      break;

    default:
      console.log('Использование:');
      console.log('  node analysis-cache-manager.js status    # статистика кэша');
      console.log('  node analysis-cache-manager.js clean    # полная очистка кэша');
      console.log('  node analysis-cache-manager.js cleanup  # удаление устаревших записей');
      break;
  }
}

module.exports = AnalysisCacheManager;