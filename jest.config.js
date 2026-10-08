module.exports = {
    testEnvironment: 'node',
    clearMocks: true,
    restoreMocks: true,
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    // Las rutas solo se ejercitan de verdad en la suite de integración (supertest sobre la app real).
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/app.js',
        '!src/routes/**',
    ],
    coverageDirectory: 'coverage',
};
