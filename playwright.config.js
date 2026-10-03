const { defineConfig } = require('@playwright/test')

// Each test starts its own Electron app, so run them one at a time.
module.exports = defineConfig({
  testDir: 'test',
  testMatch: '*.spec.js',
  workers: 1,
  timeout: 30000,
  reporter: process.env.CI ? 'list' : 'line',
})
