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
import { validateField, validateMetadata, validateLibrary } from '../src/validation';
import { FileSystemLibraryRepository, FileSystemNamingStrategy } from '../src/librepo_fs';
import path from 'path';
import { formatValidationErrors } from '../src/validation';

describe('validation', () => {

	describe('validateField', () => {
		it('returns an object', () => {
			expect(validateField('field', 'value')).to.be.ok;
		});

		function expectField(field, value, result) {
			expect(result.field).to.equal(field);
			expect(result.value).to.equal(value);
		}

		function expectValid(field, value) {
			const result = validateField(field, value);
			expectField(field, value, result);
			expect(result.valid).to.be.true;
		}

		function expectError(field, value, expectedMessage) {
			const result = validateField(field, value);
			expectField(field, value, result);
			expect(result.valid).to.be.false;
			expect(result.errors[field]).to.equal(expectedMessage);
		}

		it('returns valid for an unknown field', () => {
			expectValid('field', 'value');
		});

		describe('name', () => {
			const errorMessage = 'must only contain letters, numbers, dashes, underscores and plus signs.';

			it('returns valid for a valid name', () => {
				expectValid('name', 'my-lib_123');
			});

			it('returns valid for a name containing plus signs', () => {
				expectValid('name', 'my-lib_123++');
			});

			it('returns valid for a name containing plus signs at the start', () => {
				expectError('name', '+my-lib_123++', errorMessage);
			});

			it('returns error for missing name', () => {
				expectError('name', undefined, "can't be blank");
			});

			it('returns error for blank name', () => {
				expectError('name', '', "can't be blank");
			});

			it('returns error for a name starting with a dash', () => {
				expectError('name', '-help', errorMessage);
			});

			it('returns error for a name with forbidden characters', () => {
				expectError('name', 'foo@bar', errorMessage);
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

		describe('sentence', () => {
			it('returns valid for a valid sentence', () => {
				expectValid('sentence', 'A library');
			});

			it('returns error for missing sentence', () => {
				expectError('sentence', undefined, "can't be blank");
			});

			it('returns error for blank sentence', () => {
				expectError('sentence', '', "can't be blank");
			});
		});
	});

	describe('validateMetadata', () => {
		it('returns an object', () => {
			expect(validateMetadata({})).to.be.ok;
		});

		const validMetadata = {
			name: 'mylib',
			author: 'Author <author@example.com>',
			version: '1.0.0',
			sentence: 'A library'
		};

		function expectValid(metadata) {
			const result = validateMetadata(metadata);
			expect(result.valid).to.be.true;
		}

		function expectError(metadata, ...fields) {
			const result = validateMetadata(metadata);
			expect(result.valid).to.be.false;
			expect(result.errors).to.have.all.keys(fields);
		}

		it('returns valid for valid metadata', () => {
			expectValid(validMetadata);
		});

		it('returns an error when a field is invalid', () => {
			const metadata = Object.assign({}, validMetadata, {
				name: ''
			});

			expectError(metadata, 'name');
		});

		it('returns multiple errors when multiple fields is invalid', () => {
			const metadata = Object.assign({}, validMetadata, {
				name: '',
				version: ''
			});

			expectError(metadata, 'name', 'version');
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
				expect(result.errors).to.have.keys('README.md', 'LICENSE', 'main header');
			};
			return setup().then(execute).then(verify);
		});

		it('returns valid for valid library that has been renamed', () => {
			const setup = () => getLibrary('library-v2-renamed');

			const execute = (repo) => validateLibrary(repo);

			const verify = (result) => expect(result.valid).to.be.true;

			return setup().then(execute).then(verify);
		});

	});

	describe('error handling', () => {
		const err = { msg: 'test error' };
		const repo = { getLibraryLayout: () => Promise.reject(err) };

		it('validateLibrary throws an error that is not ValidationFailedError', () => {
			expect(validateLibrary(repo, 'testlib')).to.eventually.be.rejectedWith(err);
		});

		it('validateLibrary returns error results for ValidationFailedError', () => {
			const err = { msg: 'test error', name: 'LibraryNotFoundError' };
			const repo = { getLibraryLayout: () => Promise.reject(err) };
			const results = { errors: { library: 'is missing library.properties' }, valid: false };
			return expect(validateLibrary(repo, 'testlib')).to.eventually.deep.equal(results);
		});
	});

	describe('error messaging', () => {
		it('formats empty errors', () => {
			const invalid = { valid: false, errors: {} };
			expect(formatValidationErrors(invalid).join()).to.be.equal('');
		});


		it('formats a single validation error', () => {
			const invalid = { valid: false, errors: { a: 'needed b' } };
			expect(formatValidationErrors(invalid).join()).to.be.equal('a needed b');
		});
	});
});
