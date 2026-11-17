#!/usr/bin/env node
/**
 * Restaurant Management System - Master E2E Automated Test Execution Entrypoint
 */

const { runAll } = require('./testRunner');

const targetTier = process.argv[2] || null;
const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';

runAll(targetTier, baseUrl)
  .then(summary => {
    if (summary.failedTests > 0) {
      console.error(`\x1b[31mE2E Test Run Completed with ${summary.failedTests} failure(s).\x1b[0m`);
      process.exit(1);
    } else {
      console.log(`\x1b[32mAll ${summary.totalTests} E2E Test Cases Passed Successfully!\x1b[0m`);
      process.exit(0);
    }
  })
  .catch(err => {
    console.error(`\x1b[31mFatal Test Runner Error: ${err.message}\x1b[0m`);
    process.exit(1);
  });
