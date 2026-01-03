/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests/unit'],
    setupFilesAfterEnv: [
        '<rootDir>/tests/unit/setup.js',
        '<rootDir>/tests/unit/mocks/chrome.mock.js'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js'
    ],
    transform: {},
    extensionsToTreatAsEsm: ['.jsx'],
    testMatch: ['**/*.test.js'],
    verbose: true
};
