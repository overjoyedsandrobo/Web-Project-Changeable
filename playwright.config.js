// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5000",
    headless: true
  },
  webServer: {
    command: "python Changeable/app.py",
    url: "http://127.0.0.1:5000",
    reuseExistingServer: !process.env.CI,
    env: {
      CHANGEABLE_TESTING: "1",
      CHANGEABLE_DB_URI: "sqlite:///changeable_test.db"
    }
  }
});
