import { expect } from './test-setup';
import * as index from '../src/index';
const fs = require('fs');
const path = require('path');

describe('public package interface', () => {
	it('exports a bunch of stuff', () => {
		const expectedExports = [
			// librepo.js
			'LibraryRepositoryError',
			'LibraryNotFoundError',
			'LibraryFormatError',
			'LibraryRepository',
			'Library',
			'LibraryFile',
			'MemoryLibraryFile',
			'AbstractLibrary',
			'AbstractLibraryRepository',

			// librepo_build.js
			'BuildLibrary',
			'BuildLibraryRepository',

			// librepo_fs.js
			'libraryProperties',
			'FileSystemLibrary',
			'NamingStrategy',
			'FileSystemLibraryFile',
			'sparkDotJson',
			'FileSystemNamingStrategy',
			'FileSystemLibraryRepository',
			'mapActionDir',
			'getdirs',
			'pathsCommonPrefix',
			'isLibraryExample',

			// libinit.js
			'LibraryInitGenerator',

			// librepo_cloud.js
			'CloudLibrary',
			'CloudLibraryRepository',

			// validation.js
			'validateField',
			'validateMetadata',
			'validateLibrary',
			'formatValidationError',
			'formatValidationErrors',
			'validationMessage',

			// extra
			'appRoot',
			'resourcesDir'
		];
		expect(Object.keys(index)).to.eql(expectedExports);
	});
});

describe('resourcesDir', () => {
	it('can fetch resources dir', () => {
		const dir = index.resourcesDir();
		return expect(fs.existsSync(dir)).to.be.true;
	});

	it('can fetch libraries via approot', () => {
		const dir = index.resourcesDir();
		const libs = path.join(dir, 'libraries');
		return expect(fs.existsSync(libs)).to.be.true;
	});
});

