#!/usr/bin/env node

/**
 * 📊 analyze-surface-tournament.js
 * Senior Data Analyst & JavaScript Developer
 * 
 * Анализ эффективности ставок в разрезе покрытий и турниров
 * 
 * 🎯 КОНТЕКСТ:
 * - В bets-db.json теперь есть поле surface (Grass, Clay, Hard)
 * - Нужно понять, на каких покрытиях и турнирах модель работает лучше всего
 * - Исторический анализ показал: Трава +9.3% ROI, Masters 1000 — лучшие турниры, Grand Slam — худшие для высоких кэфов
 */

const fs = require('fs');
const path = require('path');

// ==================== КОНСТАНТЫ ====================
const MIN_SAMPLE_SIZE = 5; // Минимальный размер выборки для статистической значимости
const ODDS_RANGES = [
    { name: '2.0-2.5', min: 2.0, max: 2.5 },
    { name: '2.5-3.0', min: 2.5, max: 3.0 },
    { name: '3.0-3.5', min: 3.0, max: 3.5 },
    { name: '3.5+', min: 3.5, max: Infinity }
];

const TOURNAMENT_CATEGORIES = {
    'Grand Slam': ['Wimbledon', 'US Open', 'Australian Open', 'French Open', 'Roland Garros'],
    'Masters 1000': ['Monte-Carlo', 'Indian Wells', 'Miami', 'Madrid', 'Rome', 'Canada', 'Cincinnati', 'Shanghai', 'Paris'],
    'ATP 500': ['Dubai', 'Acapulco', 'Barcelona', 'Hamburg', 'Washington', 'Beijing', 'Tokyo', 'Vienna', 'Basel'],
    'ATP 250': ['Doha', 'Adelaide', 'Auckland', 'Marseille', 'Rotterdam', 'Santiago', 'Estoril', 'Munich', 'Geneva', 'Stuttgart'],
    'Challenger/ITF': ['Challenger', 'ITF', 'Futures']
};

const SURFACE_EMOJIS = {
    'Grass': '🟢',
    'Clay': '🟤', 
    'Hard': '🔵',
    'Unknown': '⚫'
};

const SURFACE_DISPLAY_NAMES = {
    'Grass': 'ТРАВА',
    'Clay': 'ГРУНТ',
    'Hard': 'ХАРД',
    'Unknown': 'НЕИЗВЕСТНО'
};

// ==================== УТИЛИТЫ ====================
function categorizeTournament(eventName) {
    if (!eventName) return 'Unknown';
    
    const nameLower = eventName.toLowerCase();
    
    for (const [category, keywords] of Object.entries(TOURNAMENT_CATEGORIES)) {
        for (const keyword of keywords) {
            if (nameLower.includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }
    
    // Проверяем по ключевым словам
    if (nameLower.includes('grand slam') || nameLower.includes('wimbledon') || 
        nameLower.includes('us open') || nameLower.includes('australian open') || 
        nameLower.includes('french open') || nameLower.includes('roland garros')) {
        return 'Grand Slam';
    }
    
    if (nameLower.includes('masters') || nameLower.includes('1000')) {
        return 'Masters 1000';
    }
    
    if (nameLower.includes('500')) {
        return 'ATP 500';
    }
    
    if (nameLower.includes('250')) {
        return 'ATP 250';
    }
    
    if (nameLower.includes('challenger') || nameLower.includes('itf') || nameLower.includes('futures')) {
        return 'Challenger/ITF';
    }
    
    return 'Other';
}

function getOddsRange(odds) {
    for (const range of ODDS_RANGES) {
        if (odds >= range.min && odds < range.max) {
            return range.name;
        }
    }
    return 'Other';
}

function calculateROI(staked, returned) {
    if (staked === 0) return 0;
    return ((returned - staked) / staked) * 100;
}

function calculateWinRate(won, lost) {
    const total = won + lost;
    if (total === 0) return 0;
    return (won / total) * 100;
}

function formatPercentage(value) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatEmoji(roi) {
    if (roi > 5) return '🔥';
    if (roi > 2) return '✅';
    if (roi > 0) return '🟢';
    if (roi > -2) return '🟡';
    if (roi > -5) return '🟠';
    return '🔴';
}

// ==================== ОСНОВНАЯ ЛОГИКА ====================
class SurfaceTournamentAnalyzer {
    constructor() {
        this.betsDbPath = path.join(__dirname, '../../../bets-db.json');
        this.outputPath = path.join(__dirname, '../../../data/surface-tournament-analysis.json');
        this.data = null;
        this.analysis = {
            surfaces: {},
            tournaments: {},
            crossAnalysis: {},
            recommendations: []
        };
    }
    
    loadData() {
        if (!fs.existsSync(this.betsDbPath)) {
            throw new Error(`❌ База данных не найдена: ${this.betsDbPath}`);
        }
        
        const rawData = fs.readFileSync(this.betsDbPath, 'utf8');
        this.data = JSON.parse(rawData);
        
        console.log(`✅ Данные загружены: ${this.data.bets.length} ставок`);
        return this.data.bets.filter(bet => bet.status === 'settled');
    }
    
    analyzeSurfaces(settledBets) {
        console.log('📊 Анализ по покрытиям...');
        
        const surfaces = {};
        
        for (const bet of settledBets) {
            const surface = bet.surface || 'Unknown';
            
            if (!surfaces[surface]) {
                surfaces[surface] = {
                    bets: [],
                    total_staked: 0,
                    total_return: 0,
                    total_profit: 0,
                    won: 0,
                    lost: 0,
                    odds_sum: 0,
                    count: 0
                };
            }
            
            const surfaceData = surfaces[surface];
            surfaceData.bets.push(bet);
            surfaceData.total_staked += bet.stake;
            surfaceData.total_return += bet.return || 0;
            surfaceData.total_profit += bet.profit || 0;
            
            if (bet.result === 'won') surfaceData.won++;
            if (bet.result === 'lost') surfaceData.lost++;
            
            surfaceData.odds_sum += bet.odds || 0;
            surfaceData.count++;
        }
        
        // Рассчитываем метрики
        for (const [surface, data] of Object.entries(surfaces)) {
            this.analysis.surfaces[surface] = {
                count: data.count,
                win_rate: calculateWinRate(data.won, data.lost),
                roi: calculateROI(data.total_staked, data.total_return),
                avg_odds: data.count > 0 ? data.odds_sum / data.count : 0,
                total_staked: data.total_staked,
                total_return: data.total_return,
                total_profit: data.total_profit,
                won: data.won,
                lost: data.lost,
                sufficient_data: data.count >= MIN_SAMPLE_SIZE
            };
        }
        
        return this.analysis.surfaces;
    }
    
    analyzeTournaments(settledBets) {
        console.log('🏆 Анализ по турнирам...');
        
        const tournaments = {};
        
        for (const bet of settledBets) {
            const category = categorizeTournament(bet.event);
            
            if (!tournaments[category]) {
                tournaments[category] = {
                    bets: [],
                    total_staked: 0,
                    total_return: 0,
                    total_profit: 0,
                    won: 0,
                    lost: 0,
                    count: 0
                };
            }
            
            const tournamentData = tournaments[category];
            tournamentData.bets.push(bet);
            tournamentData.total_staked += bet.stake;
            tournamentData.total_return += bet.return || 0;
            tournamentData.total_profit += bet.profit || 0;
            
            if (bet.result === 'won') tournamentData.won++;
            if (bet.result === 'lost') tournamentData.lost++;
            
            tournamentData.count++;
        }
        
        // Рассчитываем метрики
        for (const [category, data] of Object.entries(tournaments)) {
            this.analysis.tournaments[category] = {
                count: data.count,
                roi: calculateROI(data.total_staked, data.total_return),
                total_staked: data.total_staked,
                total_return: data.total_return,
                total_profit: data.total_profit,
                won: data.won,
                lost: data.lost,
                win_rate: calculateWinRate(data.won, data.lost),
                sufficient_data: data.count >= MIN_SAMPLE_SIZE
            };
        }
        
        return this.analysis.tournaments;
    }
    
    analyzeCrossSurfaceOdds(settledBets) {
        console.log('🎯 Кросс-анализ: покрытие + диапазон коэффициентов...');
        
        const crossData = {};
        
        for (const bet of settledBets) {
            const surface = bet.surface || 'Unknown';
            const oddsRange = getOddsRange(bet.odds);
            const key = `${surface}_${oddsRange}`;
            
            if (!crossData[key]) {
                crossData[key] = {
                    surface,
                    oddsRange,
                    bets: [],
                    total_staked: 0,
                    total_return: 0,
                    total_profit: 0,
                    won: 0,
                    lost: 0,
                    count: 0
                };
            }
            
            const crossItem = crossData[key];
            crossItem.bets.push(bet);
            crossItem.total_staked += bet.stake;
            crossItem.total_return += bet.return || 0;
            crossItem.total_profit += bet.profit || 0;
            
            if (bet.result === 'won') crossItem.won++;
            if (bet.result === 'lost') crossItem.lost++;
            
            crossItem.count++;
        }
        
        // Рассчитываем метрики и фильтруем значимые комбинации
        for (const [key, data] of Object.entries(crossData)) {
            if (data.count >= 3) { // Меньший порог для кросс-анализа
                this.analysis.crossAnalysis[key] = {
                    surface: data.surface,
                    oddsRange: data.oddsRange,
                    count: data.count,
                    roi: calculateROI(data.total_staked, data.total_return),
                    win_rate: calculateWinRate(data.won, data.lost),
                    total_staked: data.total_staked,
                    total_return: data.total_return,
                    total_profit: data.total_profit,
                    won: data.won,
                    lost: data.lost
                };
            }
        }
        
        return this.analysis.crossAnalysis;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Анализ покрытий
        for (const [surface, data] of Object.entries(this.analysis.surfaces)) {
            if (data.sufficient_data) {
                if (data.roi > 5) {
                    recommendations.push({
                        type: 'SUCCESS',
                        message: `${SURFACE_EMOJIS[surface]} ${SURFACE_DISPLAY_NAMES[surface]} — увеличить уверенность (ROI: ${formatPercentage(data.roi)})`,
                        action: 'increase_confidence',
                        surface,
                        roi: data.roi
                    });
                } else if (data.roi < -2) {
                    recommendations.push({
                        type: 'WARNING',
                        message: `${SURFACE_EMOJIS[surface]} ${SURFACE_DISPLAY_NAMES[surface]} — пересмотреть порог edge (ROI: ${formatPercentage(data.roi)})`,
                        action: 'review_edge',
                        surface,
                        roi: data.roi
                    });
                }
            } else if (data.count > 0) {
                recommendations.push({
                    type: 'INFO',
                    message: `${SURFACE_EMOJIS[surface]} ${SURFACE_DISPLAY_NAMES[surface]} — недостаточно данных (${data.count} ставок)`,
                    action: 'collect_more_data',
                    surface,
                    count: data.count
                });
            }
        }
        
        // Анализ турниров
        for (const [tournament, data] of Object.entries(this.analysis.tournaments)) {
            if (data.sufficient_data) {
                if (data.roi < -5) {
                    recommendations.push({
                        type: 'DANGER',
                        message: `❌ ${tournament} — исключить (ROI: ${formatPercentage(data.roi)})`,
                        action: 'exclude_tournament',
                        tournament,
                        roi: data.roi
                    });
                } else if (data.roi > 3) {
                    recommendations.push({
                        type: 'SUCCESS',
                        message: `✅ ${tournament} — фокусироваться (ROI: ${formatPercentage(data.roi)})`,
                        action: 'focus_tournament',
                        tournament,
                        roi: data.roi
                    });
                }
            }
        }
        
        // Кросс-анализ
        for (const [key, data] of Object.entries(this.analysis.crossAnalysis)) {
            if (data.count >= 3) {
                if (data.roi > 8) {
                    recommendations.push({
                        type: 'HOT',
                        message: `🔥 ${data.surface} + ${data.oddsRange} — горячая зона (ROI: ${formatPercentage(data.roi)}, ${data.count} ставок)`,
                        action: 'exploit_combination',
                        surface: data.surface,
                        oddsRange: data.oddsRange,
                        roi: data.roi,
                        count: data.count
                    });
                } else if (data.roi < -10) {
                    recommendations.push({
                        type: 'AVOID',
                        message: `🚫 ${data.surface} + ${data.oddsRange} — избегать (ROI: ${formatPercentage(data.roi)}, ${data.count} ставок)`,
                        action: 'avoid_combination',
                        surface: data.surface,
                        oddsRange: data.oddsRange,
                        roi: data.roi,
                        count: data.count
                    });
                }
            }
        }
        
        this.analysis.recommendations = recommendations;
        return recommendations;
    }
    
    printReport() {
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('📊 АНАЛИЗ ПО ПОКРЫТИЯМ');
        console.log('════════════════════════════════════════════════════════════\n');
        
        // Сортируем покрытия по ROI
        const sortedSurfaces = Object.entries(this.analysis.surfaces)
            .sort(([, a], [, b]) => b.roi - a.roi);
        
        for (const [surface, data] of sortedSurfaces) {
            const emoji = SURFACE_EMOJIS[surface] || '⚫';
            const displayName = SURFACE_DISPLAY_NAMES[surface] || surface.toUpperCase();
            
            let line = `${emoji} ${displayName}`;
            
            if (!data.sufficient_data) {
                line += ` [INSUFFICIENT DATA: ${data.count} ставок]`;
            } else {
                line += `\n   Ставок: ${data.count} | Win Rate: ${data.win_rate.toFixed(1)}% | `;
                line += `ROI: ${formatPercentage(data.roi)} | Средний кэф: ${data.avg_odds.toFixed(2)}`;
                line += ` ${formatEmoji(data.roi)}`;
                
                // Находим лучший диапазон для этого покрытия
                const surfaceCross = Object.values(this.analysis.crossAnalysis)
                    .filter(item => item.surface === surface && item.count >= 3)
                    .sort((a, b) => b.roi - a.roi);
                
                if (surfaceCross.length > 0 && surfaceCross[0].roi > 5) {
                    line += `\n   🔥 Лучший диапазон: ${surfaceCross[0].oddsRange} → ROI ${formatPercentage(surfaceCross[0].roi)} (${surfaceCross[0].count} ставок)`;
                }
            }
            
            console.log(line + '\n');
        }
        
        console.log('════════════════════════════════════════════════════════════');
        console.log('🏆 АНАЛИЗ ПО ТУРНИРАМ');
        console.log('════════════════════════════════════════════════════════════\n');
        
        // Сортируем турниры по ROI
        const sortedTournaments = Object.entries(this.analysis.tournaments)
            .sort(([, a], [, b]) => b.roi - a.roi);
        
        for (const [tournament, data] of sortedTournaments) {
            if (data.count === 0) continue;
            
            let line = `${tournament}:`;
            
            if (!data.sufficient_data) {
                line += ` Ставок: ${data.count} [INSUFFICIENT DATA]`;
            } else {
                const emoji = formatEmoji(data.roi);
                line += ` Ставок: ${data.count} | ROI: ${formatPercentage(data.roi)} ${emoji}`;
                line += ` | Win Rate: ${data.win_rate.toFixed(1)}%`;
            }
            
            console.log(line);
        }
        
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('🎯 КРОСС-АНАЛИЗ: ПОКРЫТИЕ + ДИАПАЗОН КОЭФФИЦИЕНТОВ');
        console.log('════════════════════════════════════════════════════════════\n');
        
        // Сортируем кросс-анализ по ROI
        const sortedCross = Object.values(this.analysis.crossAnalysis)
            .sort((a, b) => b.roi - a.roi);
        
        for (const item of sortedCross) {
            if (item.count >= 3) {
                const emoji = formatEmoji(item.roi);
                console.log(`${emoji} ${item.surface} + ${item.oddsRange}:`);
                console.log(`   Ставок: ${item.count} | ROI: ${formatPercentage(item.roi)} | Win Rate: ${item.win_rate.toFixed(1)}%`);
            }
        }
        
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('💡 РЕКОМЕНДАЦИИ:');
        console.log('════════════════════════════════════════════════════════════\n');
        
        // Группируем рекомендации по типу
        const groupedRecs = {
            HOT: [],
            SUCCESS: [],
            WARNING: [],
            DANGER: [],
            AVOID: [],
            INFO: []
        };
        
        for (const rec of this.analysis.recommendations) {
            groupedRecs[rec.type].push(rec);
        }
        
        // Выводим рекомендации в порядке приоритета
        for (const type of ['HOT', 'SUCCESS', 'WARNING', 'DANGER', 'AVOID', 'INFO']) {
            if (groupedRecs[type].length > 0) {
                for (const rec of groupedRecs[type]) {
                    console.log(rec.message);
                }
            }
        }
        
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('📈 СВОДНАЯ СТАТИСТИКА');
        console.log('════════════════════════════════════════════════════════════');
        
        const totalBets = Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.count, 0);
        const totalStaked = Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.total_staked, 0);
        const totalReturn = Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.total_return, 0);
        const totalProfit = Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.total_profit, 0);
        const totalWon = Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.won, 0);
        const totalLost = Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.lost, 0);
        
        const overallROI = calculateROI(totalStaked, totalReturn);
        const overallWinRate = calculateWinRate(totalWon, totalLost);
        
        console.log(`📊 Всего ставок: ${totalBets}`);
        console.log(`💰 Общая ставка: ${totalStaked} руб.`);
        console.log(`💸 Общий возврат: ${totalReturn} руб.`);
        console.log(`📈 Общая прибыль: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} руб.`);
        console.log(`🎯 Общий ROI: ${formatPercentage(overallROI)}`);
        console.log(`🏆 Общий Win Rate: ${overallWinRate.toFixed(1)}%`);
    }
    
    saveAnalysis() {
        // Создаём директорию data если её нет
        const dataDir = path.join(__dirname, '../../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Добавляем метаданные
        const fullAnalysis = {
            metadata: {
                generated_at: new Date().toISOString(),
                total_bets: Object.values(this.analysis.surfaces).reduce((sum, s) => sum + s.count, 0),
                min_sample_size: MIN_SAMPLE_SIZE,
                version: '1.0'
            },
            ...this.analysis
        };
        
        fs.writeFileSync(this.outputPath, JSON.stringify(fullAnalysis, null, 2));
        console.log(`\n✅ Анализ сохранён: ${this.outputPath}`);
    }
    
    run() {
        try {
            console.log('🎯 Запуск анализа эффективности ставок...');
            console.log('='.repeat(60));
            
            // 1. Загружаем данные
            const settledBets = this.loadData();
            console.log(`📁 Завершённых ставок: ${settledBets.length}`);
            
            // 2. Анализируем покрытия
            this.analyzeSurfaces(settledBets);
            
            // 3. Анализируем турниры
            this.analyzeTournaments(settledBets);
            
            // 4. Кросс-анализ
            this.analyzeCrossSurfaceOdds(settledBets);
            
            // 5. Генерируем рекомендации
            this.generateRecommendations();
            
            // 6. Выводим отчёт
            this.printReport();
            
            // 7. Сохраняем анализ
            this.saveAnalysis();
            
            console.log('\n🎉 Анализ завершён успешно!');
            
        } catch (error) {
            console.error(`❌ Ошибка при анализе: ${error.message}`);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// ==================== ЗАПУСК ====================
if (require.main === module) {
    const analyzer = new SurfaceTournamentAnalyzer();
    analyzer.run();
}

module.exports = SurfaceTournamentAnalyzer;