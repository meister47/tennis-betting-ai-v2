#!/usr/bin/env node
// Простая обёртка для запуска clv-tracker-simple.js
const SimpleClvTracker = require('./clv-tracker-simple.js');
const tracker = new SimpleClvTracker();
tracker.run();