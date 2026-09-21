/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/test/setup-environment.ts'],
  // `src/generated/**` e o Prisma Client gerado (schema.prisma § generator
  // client) — codigo que ninguem escreve a mao, sem sentido medir cobertura.
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/generated/**'],
};
