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

const REQUIRED_FIELDS = ['name', 'version', 'author'];

const PATTERNS = {
	name: {
		pattern: /^[A-Za-z0-9][A-Za-z0-9-_]+$/,
		message: 'must only contain letters, numbers, dashes and underscores'
	},

	version: {
		pattern: /^\d+\.\d+\.\d+$/,
		message: 'must be formatted like 1.0.0'
	}
};

/**
 * Validate one field of the library descriptor
 * @param {string} field - name of the field to validate
 * @param {string} value - value of the field to validate
 * @returns {object} - key valid indicates if validation passed
 *                     key errors is an object with pairs of invalid field names and error messages
 */
export function validateField(field, value) {
	if (REQUIRED_FIELDS.includes(field) && !value) {
		return {
			valid: false,
			errors: {
				[field]: "can't be blank"
			}
		};
	}

	let validator;
	if (validator = PATTERNS[field]) {
		if (!value.match(validator.pattern)) {
			return {
				valid: false,
				errors: {
					[field]: validator.message
				}
			};
		}
	}

	return {
		valid: true
	};
}

/**
 * Validate the entire library descriptor
 * @param {object} descriptor - object with all the library fields
 * @returns {object} - key valid indicates if validation passed
 *                     key errors is an object with pairs of invalid field names and error messages
 */
export function validateDescriptor(descriptor) {
	const results = {
		valid: true
	};

	for (const field of Object.keys(descriptor)) {
		const fieldResults = validateField(field, descriptor[field]);

		if (!fieldResults.valid) {
			results.valid = false;
			results.errors = Object.assign({}, results.errors, fieldResults.errors);
		}
	};

	return results;
}


/**
 * Validate the library format, descriptor and the file structure
 * @param {object} repo - the library repository that provides access to the library files
 * @param {string} libraryName - the library to validate (defaults to library at the root of the repo)
 * @returns {object} - key valid indicates if validation passed
 *                     key errors is an object with pairs of invalid field names and error messages
 */
export function validateLibrary(repo, libraryName = '') {
	return repo.getLibraryLayout(libraryName).then((layout) => {
		if (layout !== 2) {
			return {
				valid: false,
				errors: {
					library: 'must be migrated to v2 format'
				}
			};
		}

		return repo.fetch(libraryName).then((library) => {
			return library.definition();
		}).then((descriptor) => {
			return validateDescriptor(descriptor);
		});
	});

}
