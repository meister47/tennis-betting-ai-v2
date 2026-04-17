# Tennis Betting AI - Script Guide

## 🎯 Main Analysis Scripts

### `real-today-analysis-min-odds.js`
**Primary script for daily analysis**

```bash
node scripts/real-today-analysis-min-odds.js
```

**Features:**
- Fetches real odds from The Odds API
- Applies MIN_ODDS = 2.5 filter
- Uses historical optimizations
- Calculates edge and stake sizes
- Outputs actionable betting recommendations

**Output Example:**
```
🎾 REAL TENNIS BETTING ANALYSIS (min odds = 2.5 + Historical Optimizations)
📅 Date: 2026-04-16
👤 User: Toша | Bankroll: 1500 руб.
💰 Staking: 30-90 руб.
🎯 Min edge: 5%
📊 Min win probability: 35%
🔄 Odds range: 2.5 - 4
```

### `analyze-with-real-odds.js`
**Integrated historical optimizations**

```bash
node scripts/analyze-with-real-odds.js
```

**Features:**
- Full integration of historical data
- Detailed logging of multiplier application
- DRY_RUN mode for testing
- Feature flag for toggling optimizations

## 🔧 Utility Scripts

### `odds-cache-manager.js`
**API cache manager for rate limiting**

```bash
# Show cache stats
node scripts/odds-cache-manager.js

# Force refresh cache
node scripts/odds-cache-manager.js --refresh
```

**Features:**
- 24-hour cache TTL
- API request optimization
- Fallback to direct API calls
- Cache statistics

### `morning-cache-update.js`
**Morning cache refresh (for cron jobs)**

```bash
node scripts/morning-cache-update.js
```

**Best for cron:**
```cron
0 8 * * * cd /path/to/tennis-betting-ai && node scripts/morning-cache-update.js
```

## 🧪 Testing Scripts

### `test-historical-multipliers.js`
**Test historical optimization multipliers**

```bash
node scripts/test-historical-multipliers.js
```

**Tests:**
- Odds range multipliers
- Tournament multipliers  
- Surface multipliers
- Blocking rules (Grand Slam + underdogs)

### `validate-odds-config.js`
**Validate configuration changes**

```bash
node scripts/validate-odds-config.js
```

**Compares:**
- Old logic (MIN_ODDS = 1.5)
- New logic (MIN_ODDS = 2.5 + optimizations)
- Shows confidence changes

### `test-new-system.js`
**Complete system test**

```bash
node scripts/test-new-system.js
```

**Tests:**
- 5 test cases with different scenarios
- Shows blocking/approval logic
- Expected vs actual results

## ⚙️ Configuration Files

### `config/historical-optimizations.js`
**Historical data models and multipliers**

Based on analysis of 6,206 ATP matches:
- MIN_ODDS: 2.5 (from 1.5)
- Sweet spot: 2.5-3.0 (+20% confidence)
- Grand Slam + underdogs > 3.0: Blocked
- Masters 1000: +10% confidence
- Grass surface: +15% confidence

### `config/tournament-risk.json`
**Tournament classification and multipliers**

```json
{
  "TOURNAMENT_RISK": {
    "ATP Barcelona Open": "low",
    "ATP Munich": "medium"
  },
  "TOURNAMENT_MULTIPLIERS": {
    "Masters 1000": 1.1,
    "Grand Slam": 0.85
  }
}
```

### `config/bookmakers.json`
**Bookmaker data and odds sources**

## 📊 Workflow Examples

### Daily Analysis
```bash
# 1. Update cache (morning)
node scripts/morning-cache-update.js

# 2. Run analysis
node scripts/real-today-analysis-min-odds.js

# 3. Check recommendations
# Output includes exact commands for adding bets
```

### Testing Changes
```bash
# 1. Test historical multipliers
node scripts/test-historical-multipliers.js

# 2. Validate configuration
node scripts/validate-odds-config.js

# 3. Full system test
node scripts/test-new-system.js

# 4. Run analysis in DRY_RUN mode
DRY_RUN=true node scripts/analyze-with-real-odds.js
```

### Debugging
```bash
# Check cache status
node scripts/odds-cache-manager.js

# Test API connectivity
node scripts/odds-cache-manager.js --refresh

# Validate historical data loading
node -e "const h = require('./config/historical-optimizations.js'); console.log('MIN_ODDS:', h.ODDS_CONFIG.MIN_ODDS);"
```

## 🔄 Integration Examples

### With Betting Database
```javascript
const analysis = require('./scripts/real-today-analysis-min-odds.js');

async function analyzeAndSave() {
  const recommendations = await analysis.analyzeMatches();
  
  // Save to database
  recommendations.forEach(rec => {
    db.saveBet({
      match: rec.match,
      choice: rec.choice,
      odds: rec.odds,
      stake: rec.stake,
      confidence: rec.confidence
    });
  });
}
```

### Custom Configuration
```javascript
const HistoricalOptimizations = require('./config/historical-optimizations.js');

// Override configuration
const customConfig = {
  ...HistoricalOptimizations.ODDS_CONFIG,
  MIN_ODDS: 2.8, // More conservative
  SWEET_SPOT: { MIN: 2.8, MAX: 3.2 }
};

const confidence = HistoricalOptimizations.calculateConfidence(
  edge,
  odds,
  surface,
  tournament,
  customConfig
);
```

## ⚠️ Troubleshooting

### No Matches Found
```
✅ Найдено 0 value-ставок из 8 матчей
```

**Possible reasons:**
1. All odds < 2.5 (filtered out)
2. No matches with edge > 5%
3. Cache outdated (run morning-cache-update.js)
4. API key invalid

### Cache Issues
```bash
# Clear cache manually
rm -rf cache/

# Force refresh
node scripts/odds-cache-manager.js --refresh
```

### Historical Optimizations Not Working
```bash
# Test multipliers
node scripts/test-historical-multipliers.js

# Check configuration
node -e "console.log(require('./config/historical-optimizations.js').USE_HISTORICAL_OPTIMIZATIONS);"
```