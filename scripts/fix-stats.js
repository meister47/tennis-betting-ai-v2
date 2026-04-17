#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Пути
const betsDbPath = path.join(__dirname, '../../../bets-db.json');

function recalculateStats() {
    console.log('🧮 Пересчёт статистики ставок...');
    
    if (!fs.existsSync(betsDbPath)) {
        console.error('❌ База данных ставок не найдена');
        return;
    }
    
    const betsDb = JSON.parse(fs.readFileSync(betsDbPath, 'utf8'));
    
    // Пересчитываем статистику правильно
    const settledBets = betsDb.bets.filter(b => b.status === 'settled' || b.result === 'won' || b.result === 'lost' || b.result === 'void');
    const activeBets = betsDb.bets.filter(b => b.status === 'active');
    const pendingBets = betsDb.bets.filter(b => b.status === 'pending');
    
    const totalStaked = settledBets.reduce((sum, b) => sum + (b.stake || 0), 0);
    const totalReturn = settledBets.reduce((sum, b) => sum + (b.return || 0), 0);
    const totalProfit = settledBets.reduce((sum, b) => sum + (b.profit || 0), 0);
    
    const wonBets = settledBets.filter(b => b.result === 'won');
    const lostBets = settledBets.filter(b => b.result === 'lost');
    const voidBets = settledBets.filter(b => b.result === 'void');
    
    // Рассчитываем win_rate только на основе завершённых ставок (won + lost)
    const completedBets = wonBets.length + lostBets.length;
    const winRate = completedBets > 0 ? (wonBets.length / completedBets * 100) : 0;
    
    // Средние коэффициенты
    const avgOdds = settledBets.length > 0 
        ? settledBets.reduce((sum, b) => sum + (b.odds || 0), 0) / settledBets.length 
        : 0;
    
    // Прибыль на ставку
    const profitPerBet = settledBets.length > 0 ? totalProfit / settledBets.length : 0;
    
    // ROI
    const roi = totalStaked > 0 ? (totalProfit / totalStaked * 100) : 0;
    
    betsDb.stats = {
        total_bets: betsDb.bets.length,
        won: wonBets.length,
        lost: lostBets.length,
        void: voidBets.length,
        pending: pendingBets.length,
        active: activeBets.length,
        settled: settledBets.length,
        total_staked: totalStaked,
        total_return: totalReturn,
        total_profit: totalProfit,
        roi: roi,
        win_rate: winRate,
        avg_odds: avgOdds,
        profit_per_bet: profitPerBet
    };
    
    // Сохраняем с бэкапом
    const backupPath = betsDbPath + '.before-fix-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(betsDbPath, backupPath);
    
    fs.writeFileSync(betsDbPath, JSON.stringify(betsDb, null, 2));
    
    console.log(`\n✅ Статистика пересчитана`);
    console.log(`📁 Создан бэкап: ${backupPath}`);
    
    return betsDb;
}

// Запуск
const fixedBets = recalculateStats();

if (fixedBets) {
    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log('='.repeat(50));
    
    const stats = fixedBets.stats;
    console.log(`   Всего ставок: ${stats.total_bets}`);
    console.log(`   Выигрыши: ${stats.won} (ставки 2, 3)`);
    console.log(`   Проигрыши: ${stats.lost} (ставки 1, 4, 5, 6-10)`);
    console.log(`   Возвраты: ${stats.void}`);
    console.log(`   Активные: ${stats.active}`);
    console.log(`   Ожидающие: ${stats.pending}`);
    console.log('');
    console.log(`   💰 Общая ставка: ${stats.total_staked} руб.`);
    console.log(`   💸 Общий возврат: ${stats.total_return} руб.`);
    console.log(`   📈 Общая прибыль: ${stats.total_profit} руб.`);
    console.log(`   📊 ROI: ${stats.roi.toFixed(2)}%`);
    console.log(`   🎯 Win Rate: ${stats.win_rate.toFixed(2)}%`);
    console.log(`   ⚖️  Средний коэффициент: ${stats.avg_odds.toFixed(2)}`);
    console.log(`   📦 Прибыль на ставку: ${stats.profit_per_bet.toFixed(2)} руб.`);
    
    // Детали по ставкам
    console.log('\n📋 ДЕТАЛИ ЗАВЕРШЁННЫХ СТАВОК:');
    console.log('='.repeat(50));
    
    const settledBets = fixedBets.bets.filter(b => b.status === 'settled');
    for (const bet of settledBets) {
        const resultEmoji = bet.result === 'won' ? '✅' : '❌';
        const profitSign = bet.profit >= 0 ? '+' : '';
        console.log(`   ${resultEmoji} #${bet.id}: ${bet.event} | Коэф: ${bet.odds} | Ставка: ${bet.stake} руб. | Прибыль: ${profitSign}${bet.profit} руб.`);
    }
}