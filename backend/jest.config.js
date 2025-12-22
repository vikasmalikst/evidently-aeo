/**
 * Jest Configuration for Backend
 * 
 * Configures Jest to properly handle TypeScript files using ts-jest.
 */

module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Use Node as the test environment (not browser/jsdom)
  testEnvironment: 'node',
  
  // Root directory for tests
  roots: ['<rootDir>/src'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  
  // Coverage configuration (optional)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  
  // Setup files (if needed)
  // setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  
  // Global timeout (30 seconds for integration tests with database)
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
};

