#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Пути
const betsDbPath = path.join(__dirname, '../../../bets-db.json');
const apiKey = process.env.THE_ODDS_API_KEY;
if (!apiKey) {
  console.error('❌ THE_ODDS_API_KEY не установлен в переменных окружения');
  console.error('   Создайте файл .env.local с ключом (см. SETUP_SECURITY.md)');
  process.exit(1);
}
const baseUrl = 'https://api.the-odds-api.com/v4/sports';

async function fetchLiveResults() {
    console.log('📊 Получение результатов матчей в реальном времени...');
    
    try {
        const response = await fetch(`${baseUrl}/tennis/odds/?apiKey=${apiKey}&regions=eu&markets=h2h`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✅ Получено ${data.length} событий`);
        return data;
    } catch (error) {
        console.error(`❌ Ошибка при получении данных: ${error.message}`);
        return null;
    }
}

function normalizePlayerName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-zа-яё\s]/g, '')
        .trim();
}

function findMatchResult(events, betTitle) {
    if (!events || events.length === 0) return null;
    
    const betName = normalizePlayerName(betTitle);
    
    for (const event of events) {
        try {
            const homeTeam = normalizePlayerName(event.home_team || '');
            const awayTeam = normalizePlayerName(event.away_team || '');
            const eventName = normalizePlayerName(event.sport_title || '');
            
            // Проверяем совпадение по именам игроков
            if (betName.includes(homeTeam) || betName.includes(awayTeam) || 
                betName.includes(eventName) || homeTeam.includes(betName) || 
                awayTeam.includes(betName)) {
                
                // Проверяем завершён ли матч
                if (event.completed) {
                    return {
                        match_found: true,
                        completed: true,
                        scores: event.scores || 'Неизвестно',
                        winner: event.home_team,
                        completed_time: event.commence_time
                    };
                } else {
                    return {
                        match_found: true,
                        completed: false,
                        scores: 'Матч в процессе'
                    };
                }
            }
        } catch (e) {
            // Пропускаем некорректные события
            continue;
        }
    }
    
    return null;
}

function determineBetResult(bet, matchData) {
    if (!matchData || !matchData.completed) {
        return 'pending';
    }
    
    const betLower = bet.event.toLowerCase();
    const betPlayers = betLower.split(' vs ').map(p => p.trim());
    
    if (betPlayers.length < 2) return 'pending';
    
    const winner = matchData.winner?.toLowerCase() || '';
    
    // Простая логика: если в названии ставки есть имя победителя
    if (winner && betLower.includes(winner)) {
        return 'won';
    }
    
    return 'lost';
}

async function updateBetResults() {
    console.log('🔄 Обновление результатов ставок...');
    
    // Загружаем базу данных
    if (!fs.existsSync(betsDbPath)) {
        console.error('❌ База данных ставок не найдена');
        return;
    }
    
    const betsDb = JSON.parse(fs.readFileSync(betsDbPath, 'utf8'));
    const activeBets = betsDb.bets.filter(bet => bet.status === 'active' || bet.status === 'pending');
    
    if (activeBets.length === 0) {
        console.log('✅ Активных ставок нет');
        return;
    }
    
    console.log(`🔍 Найдено ${activeBets.length} активных ставок`);
    
    // Получаем данные о матчах
    const events = await fetchLiveResults();
    
    let updatedCount = 0;
    
    for (const bet of activeBets) {
        console.log(`\n📊 Проверяем ставку #${bet.id}: ${bet.event}`);
        
        const matchResult = findMatchResult(events, bet.event);
        
        if (matchResult) {
            if (matchResult.completed) {
                const result = determineBetResult(bet, matchResult);
                
                bet.status = result;
                bet.settled_at = new Date().toISOString();
                bet.match_details = matchResult;
                
                console.log(`   ✅ Матч завершён: ${result === 'won' ? '🏆 ВЫИГРЫШ' : '💸 ПРОИГРЫШ'}`);
                console.log(`   📊 Счёт: ${matchResult.scores}`);
                updatedCount++;
            } else {
                console.log(`   ⏳ Матч ещё не завершён`);
            }
        } else {
            console.log(`   ❓ Информация о матче не найдена`);
            
            // Если ставка старше 12 часов, помечаем как проигранную (упрощённо)
            const betDate = new Date(bet.created_at);
            const hoursDiff = (Date.now() - betDate.getTime()) / (1000 * 60 * 60);
            
            if (hoursDiff > 12 && bet.status === 'active') {
                bet.status = 'lost';
                bet.settled_at = new Date().toISOString();
                bet.match_details = { reason: 'Матч не найден, автоматическое закрытие' };
                updatedCount++;
                console.log(`   ⚠️  Ставка помечена как проигранная (старше 12 часов)`);
            }
        }
    }
    
    // Сохраняем обновления
    if (updatedCount > 0) {
        fs.writeFileSync(betsDbPath, JSON.stringify(betsDb, null, 2));
        console.log(`\n✅ Обновлено ${updatedCount} ставок`);
    } else {
        console.log('\nℹ️  Ни одной ставки не обновлено');
    }
    
    return betsDb;
}

// Запуск обновления
updateBetResults().then(updatedBets => {
    if (updatedBets) {
        console.log('\n🎉 Обновление завершено!');
        console.log('📊 Статистика ставок:');
        
        const stats = {
            total: updatedBets.bets.length,
            active: updatedBets.bets.filter(b => b.status === 'active').length,
            pending: updatedBets.bets.filter(b => b.status === 'pending').length,
            won: updatedBets.bets.filter(b => b.status === 'won').length,
            lost: updatedBets.bets.filter(b => b.status === 'lost').length,
            void: updatedBets.bets.filter(b => b.status === 'void').length
        };
        
        console.log(`   Всего: ${stats.total}`);
        console.log(`   Активные: ${stats.active}`);
        console.log(`   Ожидающие: ${stats.pending}`);
        console.log(`   Выигрыши: ${stats.won}`);
        console.log(`   Проигрыши: ${stats.lost}`);
        console.log(`   Возвраты: ${stats.void}`);
        
        const settled = stats.won + stats.lost + stats.void;
        if (settled > 0) {
            const profit = updatedBets.bets
                .filter(b => ['won', 'lost', 'void'].includes(b.status))
                .reduce((sum, bet) => {
                    if (bet.status === 'won') return sum + (bet.stake * bet.odds - bet.stake);
                    if (bet.status === 'lost') return sum - bet.stake;
                    return sum; // void возвращает ставку
                }, 0);
            
            console.log(`   Прибыль: ${profit.toFixed(2)} руб.`);
        }
    }
}).catch(error => {
    console.error('❌ Критическая ошибка:', error);
});