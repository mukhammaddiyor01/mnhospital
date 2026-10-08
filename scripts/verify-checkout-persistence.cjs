const { spawnSync } = require('node:child_process');
if (process.argv[2]) require('dotenv').config({ path: process.argv[2], override: true });
if (!process.env.MONGO_DEV) throw new Error('Load the development environment with node --env-file before running this script');
const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', '--silent', '--runTestsByPath', 'apps/mnhospital-api/test/checkout.persistence.spec.ts'], {
	stdio: 'inherit', env: { ...process.env, MN_CHECKOUT_TEST_URI: process.env.MONGO_DEV, NODE_ENV: 'test' },
});
process.exitCode = result.status ?? 1;
