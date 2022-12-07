module.exports = {
  projects: [
    "<rootDir>/*/functions/jest.config.js",
    "<rootDir>/firestore-bigquery-export/scripts/*/jest.config.js",
  ],
  testPathIgnorePatterns: [
    ".*/bin/",
    ".*/lib/",
    ".*/firestore-counter/",
    "/node_modules/",
    // Ignoring otherwise tests duplicate due to Jest `projects`
    ".*/__tests__/.*.ts",
    "<rootDir>/firestore-send-email/functions/__tests__/*.test.ts",
    "<rootDir>/delete-user-data/functions/__tests__/*.test.ts",
  ].concat(process.env.CI_TEST === "true" ? ["e2e"] : []),
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/node_modules/**",
    "!**/test-data/**",
  ],
  maxConcurrency: 10,
};
