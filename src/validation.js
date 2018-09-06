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

import klaw from 'klaw';
import path from 'path';

const REQUIRED_FIELDS = ['name', 'version', 'author', 'sentence'];

const PATTERNS = {
	name: {
		pattern: /^[A-Za-z0-9][A-Za-z0-9-_\+]*$/,
		message: 'must only contain letters, numbers, dashes, underscores and plus signs.'
	},

	version: {
		pattern: /^\d+\.\d+\.\d+$/,
		message: 'must be formatted like 1.0.0'
	}
};


Object.entries = x =>
	Object.keys(x).reduce((y, z) =>
	y.push([z, x[z]]) && y, []);

/**
 * Validate one field of the library metadata
 * @param {string} field - name of the field to validate
 * @param {string} value - value of the field to validate
 * @returns {object} - key valid indicates if validation passed
 *                     key errors is an object with pairs of invalid field names and error messages
 */
export function validateField(field, value) {
	if (REQUIRED_FIELDS.includes(field) && !value) {
		return {
			field, value,
			valid: false,
			errors: {
				[field]: "can't be blank"
			}
		};
	}

	let validator;
	if ((validator = PATTERNS[field])) {
		if (!value.match(validator.pattern)) {
			return {
				field, value,
				valid: false,
				errors: {
					[field]: validator.message
				}
			};
		}
	}

	return {
		field, value,
		valid: true,
	};
}

/**
 * Validate the entire library metadata
 * @param {object} metadata - object with all the library fields
 * @returns {object} - key valid indicates if validation passed
 *                     key errors is an object with pairs of invalid field names and error messages
 */
export function validateMetadata(metadata) {
	const results = {
		valid: true
	};

	for (const [field, value] of Object.entries(metadata)) {
		const fieldResults = validateField(field, value);

		if (!fieldResults.valid) {
			results.valid = false;
			results.errors = Object.assign({}, results.errors, fieldResults.errors);
		}
	}

	return results;
}

class ValidationFailed {
	constructor(validationResults) {
		this.validationResults = validationResults;
		this.name = 'ValidationFailedError';
	}
}

/**
 * Validate the library format, metadata and the file structure
 * @param {object} repo - the library repository that provides access to the library files
 * @param {string} libraryName - the library to validate (defaults to library at the root of the repo)
 * @returns {object} - key valid indicates if validation passed
 *                     key errors is an object with pairs of invalid field names and error messages
 */
export function validateLibrary(repo, libraryName = '') {
	// A promise chain that can return early by rejecting with ValidationFailed
	return _validateLibraryLayout(repo, libraryName)
		.then(() => _validateLibraryMetadata(repo, libraryName))
		.then(() => _validateLibraryFiles(repo, libraryName))
		.then(() => {
			return {
				valid: true
			};
		})
		.catch((error) => {
			if (error.name === 'ValidationFailedError') {
				return error.validationResults;
			}
			throw error;
		});
}

function _validateLibraryLayout(repo, libraryName) {
	return repo.getLibraryLayout(libraryName).then((layout) => {
		if (layout !== 2) {
			throw new ValidationFailed({
				valid: false,
				errors: {
					library: 'must be migrated from v1 format'
				}
			});
		}
	}, (error) => {
		if (error.name === 'LibraryNotFoundError') {
			throw new ValidationFailed({
				valid: false,
				errors: {
					library: 'is missing library.properties'
				}
			});
		}
		throw error;
	});
}

function _validateLibraryMetadata(repo, libraryName) {
	return repo.fetch(libraryName)
		.then((library) => library.definition())
		.then((metadata) => validateMetadata(metadata))
		.then((results) => {
			if (!results.valid) {
				throw new ValidationFailed(results);
			}
		});
}

/**
 * Enumerate all files relative to the root of the library
 * @param {string} directory - root of the library
 * @returns {Promise} - resolves to array of relative paths
 * @private
 */
function _libraryFiles(directory) {
	return new Promise((fulfill) => {
		const files = [];
		klaw(directory)
			.on('data', (item) => {
				const relativePath = path.relative(directory, item.path);
				files.push(relativePath);
			})
			.on('end', () => {
				fulfill(files);
			});
	});
}

function _mainSourceName(repo, libraryName) {
	return repo.fetch(libraryName)
		.then((library) => library.definition())
		.then((metadata) => metadata.name);
}

/**
 * Validate that README, LICENSE and src/lib.cpp and src/lib.h are present
 * @param {object} repo - filesystem library repo
 * @param {string} libraryName - name of library in the filesystem repo
 * @returns {Promise} - object with valid and errors keys
 * @private
 */
function _validateLibraryFiles(repo, libraryName) {
	const results = {
		valid: true
	};

	const directory = repo.libraryDirectory(libraryName);

	const requiredFiles = {
		'README.md': /^README/i,
		'LICENSE': /^LICENSE/i,
	};

	return _mainSourceName(repo, libraryName)
		.then((mainSourceName) => {
			// Match Windows and UNIX paths
			// todo - factor out the regex (it's copied from PATTERNS.name.pattern without the start/end match)
			//requiredFiles['main source'] = new RegExp('src[/\\\\][A-Za-z0-9][A-Za-z0-9-_\+]*.cpp', 'i');
			requiredFiles['main header'] = new RegExp('src[/\\\\][A-Za-z0-9][A-Za-z0-9-_\+]*.h', 'i');
		})
		.then(() => _libraryFiles(directory))
		.then((files) => {
			for (const [requiredFile, filenamePattern] of Object.entries(requiredFiles)) {
				if (!files.find((f) => f.match(filenamePattern))) {
					results.valid = false;
					results.errors = Object.assign({}, results.errors, {
						[requiredFile]: 'is missing'
					});
				}
			}

			if (!results.valid) {
				throw new ValidationFailed(results);
			}
		});
}


export function formatValidationError(key, message) {
	return `${key} ${message}`;
}

export function formatValidationErrors(results) {
	const errors = [];
	for (let key in results.errors) {
		const value = results.errors[key];
		errors.push(formatValidationError(key, value));
	}
	return errors;
}

export function validationMessage(results, separator='\n') {
	return formatValidationErrors(results).join(separator);
}
