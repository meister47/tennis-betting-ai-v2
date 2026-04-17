#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Пути
const betsDbPath = path.join(__dirname, '../../../bets-db.json');

function updateOldBets() {
    console.log('🔄 Обновление старых ставок (старше 12 часов)...');
    
    // Загружаем базу данных
    if (!fs.existsSync(betsDbPath)) {
        console.error('❌ База данных ставок не найдена');
        return;
    }
    
    const betsDb = JSON.parse(fs.readFileSync(betsDbPath, 'utf8'));
    let updatedCount = 0;
    
    for (const bet of betsDb.bets) {
        if (bet.status === 'active' || bet.status === 'pending') {
            const betDate = new Date(bet.date);
            const hoursDiff = (Date.now() - betDate.getTime()) / (1000 * 60 * 60);
            
            console.log(`\n📊 Ставка #${bet.id}: ${bet.event}`);
            console.log(`   Дата ставки: ${bet.date} (${hoursDiff.toFixed(1)} часов назад)`);
            
            // Если ставка старше 12 часов и всё ещё активна
            if (hoursDiff > 12) {
                bet.status = 'lost';
                bet.result = 'lost';
                bet.settled_at = new Date().toISOString();
                bet.notes = bet.notes ? bet.notes + ' | Автоматически помечено как проигрыш (матч не найден, >12 часов)' 
                                      : 'Автоматически помечено как проигрыш (матч не найден, >12 часов)';
                
                console.log(`   ⚠️  Помечена как lost (старше 12 часов)`);
                updatedCount++;
            } else {
                console.log(`   ✅ Ещё активна (<12 часов)`);
            }
        }
    }
    
    // Обновляем статистику
    if (updatedCount > 0) {
        // Пересчитываем статистику
        const settledBets = betsDb.bets.filter(b => ['won', 'lost', 'void'].includes(b.status));
        const activeBets = betsDb.bets.filter(b => b.status === 'active');
        const pendingBets = betsDb.bets.filter(b => b.status === 'pending');
        
        const totalStaked = settledBets.reduce((sum, b) => sum + b.stake, 0);
        const totalReturn = settledBets.reduce((sum, b) => sum + (b.return || 0), 0);
        const totalProfit = settledBets.reduce((sum, b) => sum + (b.profit || 0), 0);
        
        const wonBets = settledBets.filter(b => b.status === 'won');
        const lostBets = settledBets.filter(b => b.status === 'lost');
        const voidBets = settledBets.filter(b => b.status === 'void');
        
        betsDb.stats = {
            total_bets: betsDb.bets.length,
            won: wonBets.length,
            lost: lostBets.length,
            pending: pendingBets.length,
            total_staked: totalStaked,
            total_return: totalReturn,
            total_profit: totalProfit,
            roi: totalStaked > 0 ? (totalProfit / totalStaked * 100) : 0,
            win_rate: wonBets.length + lostBets.length > 0 
                ? (wonBets.length / (wonBets.length + lostBets.length) * 100) 
                : 0,
            avg_odds: settledBets.length > 0 
                ? settledBets.reduce((sum, b) => sum + (b.odds || 0), 0) / settledBets.length 
                : 0,
            profit_per_bet: settledBets.length > 0 ? totalProfit / settledBets.length : 0
        };
        
        // Сохраняем с бэкапом
        const backupPath = betsDbPath + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(betsDbPath, backupPath);
        
        fs.writeFileSync(betsDbPath, JSON.stringify(betsDb, null, 2));
        console.log(`\n✅ Обновлено ${updatedCount} ставок`);
        console.log(`📁 Создан бэкап: ${backupPath}`);
    } else {
        console.log('\nℹ️  Старых ставок не найдено');
    }
    
    return betsDb;
}

// Запуск
const updatedBets = updateOldBets();

if (updatedBets) {
    console.log('\n🎉 Обновление завершено!');
    console.log('📊 Обновлённая статистика:');
    
    const stats = updatedBets.stats;
    console.log(`   Всего ставок: ${stats.total_bets}`);
    console.log(`   Выигрыши: ${stats.won}`);
    console.log(`   Проигрыши: ${stats.lost}`);
    console.log(`   Ожидающие: ${stats.pending}`);
    console.log(`   Общая ставка: ${stats.total_staked} руб.`);
    console.log(`   Возврат: ${stats.total_return} руб.`);
    console.log(`   Прибыль: ${stats.total_profit} руб.`);
    console.log(`   ROI: ${stats.roi.toFixed(2)}%`);
    console.log(`   Win Rate: ${stats.win_rate.toFixed(2)}%`);
}