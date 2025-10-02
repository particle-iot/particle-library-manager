import { particle } from 'eslint-config-particle';

export default particle({
	rootDir: import.meta.dirname,
	sourceType: 'module',
	testGlobals: 'mocha'
});
