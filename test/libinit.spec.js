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

const chai = require('chai');
chai.use(require('chai-as-promised'));
//const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const helpers = require('yeoman-test');
const assert = require('yeoman-assert');
const fse = require('fs-extra');

import { LibraryInitGenerator } from '../src/libinit';
import { appRoot } from '../src/index';

// http://yeoman.io/generator/module-test_helpers.html

describe('library initialize', () => {

	const testData = { name: 'nominative', version: '1.2.3', author: 'Borges' };

	function assertGeneratedContent(expected, actual) {
		if (actual===undefined) {
			actual = expected;
		}
		const expectedContent = fs.readFileSync(path.join(__dirname,'./generator/', expected), 'utf8');
		assert.fileContent(actual, expectedContent);
	}

	function validateOutput() {
		assertGeneratedContent('library.properties');
		assertGeneratedContent('src/nominative.cpp');
		assertGeneratedContent('src/nominative.h');
		assertGeneratedContent('examples/doit/doit_example.cpp');
	}

	function generator(dir, cb) {
		let result = helpers.run(LibraryInitGenerator);
		if (dir) {
			result = result.inTmpDir((dir) => {
				// `dir` is the path to the new temporary directory
				fse.copySync(path.join(appRoot, 'src/init'), dir);
			});
		}
		if (cb) {
			result = cb(result);
		}
		return result.toPromise();
	}

	describe('generator', () => {
		it('interpolates library.properties', () => {
			return generator('init', (result) => {
				return result.withOptions(testData);       // Mock options passed in
			}).then(validateOutput);
		});

		it('should prompt for all properties if not provided', () => {
			return generator('init', (result) => {
				return result.withPrompts(testData);       // Mock options passed in
			}).then(validateOutput);
		});
	});
});
