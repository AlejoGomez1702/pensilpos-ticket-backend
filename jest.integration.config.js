module.exports = {
    testEnvironment: 'node',
    clearMocks: true,
    testMatch: ['<rootDir>/tests-integration/**/*.integration.test.js'],
    setupFiles: ['<rootDir>/tests-integration/setup-env.js'],
    testTimeout: 30000,
    maxWorkers: 1,
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/app.js',
    ],
    coverageDirectory: 'coverage-integration',
};
