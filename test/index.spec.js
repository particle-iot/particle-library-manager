/*
 ******************************************************************************
 Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU Lesser General Public
 License as published by the Free Software Foundation, either
 version 3 of the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public
 License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */

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
			'LibraryInitGeneratorMixin',
			'buildLibraryInitGeneratorClass',

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

