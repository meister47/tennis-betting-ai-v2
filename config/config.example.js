/**
 * Configuration file for Tennis Betting AI
 * Copy this file to config.js and fill in your API key
 */

module.exports = {
  // Get your API key from https://the-odds-api.com
  API_KEY: 'YOUR_API_KEY_HERE',
  
  // Bankroll and staking
  BANKROLL: 1500,
  MIN_STAKE: 30,
  MAX_STAKE: 90,
  
  // Odds filtering
  MIN_ODDS: 2.5,      // Minimum odds (filters low-value bets)
  MAX_ODDS: 4.0,      // Maximum odds (filters extreme longshots)
  
  // Probability thresholds
  MIN_EDGE: 0.05,     // Minimum edge (5%)
  MIN_WIN_PROBABILITY: 0.35,  // Minimum win probability (35%)
  
  // Risk management
  MAX_TOURNAMENT_RISK: 'medium', // low, medium, high
  
  // Historical optimizations
  USE_HISTORICAL_OPTIMIZATIONS: true,
  
  // Cache settings
  CACHE_TTL_HOURS: 24, // Cache time-to-live in hours
  
  // API settings
  API_REGIONS: 'eu',   // API regions
  API_MARKETS: 'h2h',  // Betting markets
  ODDS_FORMAT: 'decimal' // Odds format
};

// Usage example:
// const config = require('./config/config');
// console.log(`API Key: ${config.API_KEY}`);