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

import {expect} from './test-setup';
import {validateField, validateDescriptor, validateLibrary} from '../src/validation';
import {FileSystemLibraryRepository, FileSystemNamingStrategy} from '../src/librepo_fs';
import path from 'path';

describe('validation', () => {

	describe('validateField', () => {
		it('returns an object', () => {
			expect(validateField('field', 'value')).to.be.ok;
		});

		function expectValid(field, value) {
			const result = validateField(field, value);
			expect(result.valid).to.be.true;
		}

		function expectError(field, value, expectedMessage) {
			const result = validateField(field, value);
			expect(result.valid).to.be.false;
			expect(result.errors[field]).to.equal(expectedMessage);
		}

		it('returns valid for an unknown field', () => {
			expectValid('field', 'value');
		});

		describe('name', () => {
			it('returns valid for a valid name', () => {
				expectValid('name', 'my-lib_123');
			});

			it('returns error for missing name', () => {
				expectError('name', undefined, "can't be blank");
			});

			it('returns error for blank name', () => {
				expectError('name', '', "can't be blank");
			});

			it('returns error for a name starting with a dash', () => {
				expectError('name', '-help', 'must only contain letters, numbers, dashes and underscores');
			});

			it('returns error for a name with forbidden characters', () => {
				expectError('name', 'foo@bar', 'must only contain letters, numbers, dashes and underscores');
			});
		});

		describe('version', () => {
			it('returns valid for a valid version', () => {
				expectValid('version', '1.10.5');
			});

			it('returns error for missing version', () => {
				expectError('version', undefined, "can't be blank");
			});

			it('returns error for blank version', () => {
				expectError('version', '', "can't be blank");
			});

			it('returns error for a name with too few numbers', () => {
				expectError('version', '1.0', 'must be formatted like 1.0.0');
			});

			it('returns error for a name with too many numbers', () => {
				expectError('version', '1.0.5.1', 'must be formatted like 1.0.0');
			});

			it('returns error for a name with invalid characters', () => {
				expectError('version', 'test1', 'must be formatted like 1.0.0');
			});
		});

		describe('author', () => {
			it('returns valid for a valid author', () => {
				expectValid('author', 'Author <author@example.com>');
			});

			it('returns error for missing author', () => {
				expectError('author', undefined, "can't be blank");
			});

			it('returns error for blank name', () => {
				expectError('author', '', "can't be blank");
			});
		});
	});

	describe('validateDescriptor', () => {
		it('returns an object', () => {
			expect(validateDescriptor({})).to.be.ok;
		});

		const validDescriptor = {
			name: 'mylib',
			author: 'Author <author@example.com>',
			version: '1.0.0',
			sentence: 'A library'
		};

		function expectValid(descriptor) {
			const result = validateDescriptor(descriptor);
			expect(result.valid).to.be.true;
		}

		function expectError(descriptor, ...fields) {
			const result = validateDescriptor(descriptor);
			expect(result.valid).to.be.false;
			expect(result.errors).to.have.all.keys(fields);
		}

		it('returns valid for valid descriptor', () => {
			expectValid(validDescriptor);
		});

		it('returns an error when a field is invalid', () => {
			const descriptor = Object.assign({}, validDescriptor, {
				name: ''
			});

			expectError(descriptor, 'name');
		});

		it('returns multiple errors when multiple fields is invalid', () => {
			const descriptor = Object.assign({}, validDescriptor, {
				name: '',
				version: ''
			});

			expectError(descriptor, 'name', 'version');
		});
	});

	describe('validateLibRepo', () => {
		const testdata = path.join(__dirname, '..', 'resources', 'libraries');
		function getLibrary(name) {
			return Promise.resolve(
				new FileSystemLibraryRepository(`${testdata}/${name}`, FileSystemNamingStrategy.DIRECT)
			);
		}

		it('returns valid for valid library', () => {
			const setup = () => getLibrary('library-v2');

			const execute = (repo) => validateLibrary(repo);

			const verify = (result) => expect(result.valid).to.be.true;

			return setup().then(execute).then(verify);
		});

		it('returns errors for a library with invalid name', () => {
			const setup = () => getLibrary('library-v2-invalid');

			const execute = (repo) => validateLibrary(repo);

			const verify = (result) => {
				expect(result.valid).to.be.false;
				expect(result.errors).to.have.key('name');
			};
			return setup().then(execute).then(verify);
		});

		it('returns errors for a library in v1 format', () => {
			const setup = () => getLibrary('library-v1');

			const execute = (repo) => validateLibrary(repo);

			const verify = (result) => {
				expect(result.valid).to.be.false;
				expect(result.errors).to.have.key('library');
			};
			return setup().then(execute).then(verify);
		});

		it('returns errors for a directory that is not a library', () => {
			const setup = () => getLibrary('not-a-library');

			const execute = (repo) => validateLibrary(repo);

			const verify = (result) => {
				expect(result.valid).to.be.false;
				expect(result.errors).to.have.key('library');
			};
			return setup().then(execute).then(verify);
		});

		it('returns errors for a library with missing files', () => {
			const setup = () => getLibrary('library-v2-missing-files');

			const execute = (repo) => validateLibrary(repo);

			const verify = (result) => {
				expect(result.valid).to.be.false;
				expect(result.errors).to.have.keys('README.md', 'LICENSE');
				//expect(result.errors).to.have.key('main source');
				//expect(result.errors).to.have.key('main header');
			};
			return setup().then(execute).then(verify);
		});
	});
});
