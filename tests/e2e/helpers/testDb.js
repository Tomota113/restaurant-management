/**
 * Test Database Helper Utilities for SQLite verification
 */

const path = require('path');
const fs = require('fs');

const TestDb = {
  getDbPath() {
    const candidates = [
      process.env.DATABASE_URL,
      path.resolve(__dirname, '../../../server/restaurant.db'),
      path.resolve(__dirname, '../../../server/data/restaurant.db'),
      path.resolve(__dirname, '../../../restaurant.db')
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        return c;
      }
    }
    return candidates[1];
  },

  dbExists() {
    const p = this.getDbPath();
    return fs.existsSync(p);
  }
};

module.exports = TestDb;
