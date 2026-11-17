/**
 * Custom Assertion Helpers for E2E Test Suite
 */

const assert = require('node:assert');

const Assertions = {
  /**
   * Asserts HTTP status code matches expected
   */
  assertStatus(res, expectedStatus, context = '') {
    const msg = `Expected status ${expectedStatus} but got ${res.status}. Context: ${context}. Body: ${JSON.stringify(res.body || res.data)}`;
    assert.strictEqual(res.status, expectedStatus, msg);
  },

  /**
   * Asserts error response structure
   */
  assertError(res, expectedStatus, expectedErrorSubstring = '') {
    assert.strictEqual(res.status, expectedStatus, `Expected error status ${expectedStatus} but got ${res.status}`);
    const bodyStr = JSON.stringify(res.body || res.data || '');
    if (expectedErrorSubstring) {
      assert.ok(
        bodyStr.toLowerCase().includes(expectedErrorSubstring.toLowerCase()),
        `Expected error body to include "${expectedErrorSubstring}", got: ${bodyStr}`
      );
    }
  },

  /**
   * Asserts decimal numeric equality within epsilon
   */
  assertDecimal(actual, expected, epsilon = 0.001, message = '') {
    const diff = Math.abs(Number(actual) - Number(expected));
    assert.ok(
      diff <= epsilon,
      `Expected ${expected} (within ${epsilon}) but got ${actual}. ${message}`
    );
  },

  /**
   * Asserts object has required properties
   */
  assertHasProperties(obj, properties, context = '') {
    assert.ok(obj && typeof obj === 'object', `Expected object, got ${typeof obj}. Context: ${context}`);
    for (const prop of properties) {
      assert.ok(
        prop in obj && obj[prop] !== undefined,
        `Expected property "${prop}" in object. Context: ${context}. Keys: ${Object.keys(obj).join(', ')}`
      );
    }
  },

  /**
   * Asserts array is non-empty
   */
  assertNonEmptyArray(arr, context = '') {
    assert.ok(Array.isArray(arr), `Expected array, got ${typeof arr}. Context: ${context}`);
    assert.ok(arr.length > 0, `Expected non-empty array. Context: ${context}`);
  }
};

module.exports = Assertions;
