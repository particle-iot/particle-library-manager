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

import { validateField } from './validation';
const path = require('path');

function lowercaseFirstLetter(string) {
	return string.charAt(0).toLowerCase() + string.slice(1);
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Formats a message from the validation error.
 * @param {object} v    The result from a validateField call.
 * @returns {string}    The error message string
 */
function validationMessage(v) {
	return `${v.field}: ${v.errors[v.field]}`;
}

function validationError(validation) {
	let msg = [];
	for (let idx in validation) {
		const v = validation[idx];
		const m = validationMessage(v);
		msg.push(m);
	}
	const error = new Error(msg);
	error.validate = validation;
	return error;
}

/**
 * Code the functionality separate from the generator so we can mock the various
 * generator operations - having to subclass Base binds the functionality too closely
 * to the generator.
 *
 * @param {class} B The base class to use for the mixin
 * @returns {LibraryInitGeneratorMixin} The mixin class with B as the base.
 */
export const LibraryInitGeneratorMixin = (B) => class extends B {

	constructor(...args) {
		super(...args); 		/* istanbul ignore next: coverage bug? */
	}

	/**
	 * Registers the option names.
	 * @private
	 * @returns {undefined} nothing
	 */
	_initializeOptions() {
		this.argument('name', { type: String, required: false });
		this.argument('version', { type: String, required: false });
		this.argument('year', { type: Number, required: false });
		this.argument('dir', { type: String, required: false });
	}

	_setYear(currentDate = new Date()) {
		if (this.options.year === undefined) {
			this.options.year = currentDate.getFullYear();
		}
	}

	_setOutputDir() {
		if (this.options.dir !== undefined) {
			this.destinationRoot(this.options.dir);
		}
	}

	_promptValidate(field, value) {
		const result = this._validateField(field, value);
		if (!result || result.valid) {
			return true;
		}
		return validationMessage(result);
	}

	_allPrompts() {
		let prompt = [];

		if (this.options.name === undefined) {
			prompt.push({
				type: 'input',
				name: 'name',
				message: 'Enter a name for your library:',
				validate: (value) => this._promptValidate('name', value)
			});
		}

		if (this.options.version === undefined) {
			prompt.push({
				type: 'input',
				name: 'version',
				message: 'Enter a version for your library:',
				validate: (value) => this._promptValidate('version', value)
			});
		}

		if (this.options.author === undefined) {
			prompt.push({
				type: 'input',
				name: 'author',
				message: 'Who is the author of your library:',
				validate: (value) => this._promptValidate('author', value)
			});
		}

		return prompt;
	}

	/**
	 * Handle the result of prompts.
	 * @param {object} data The result of the prompts.
	 * @private
	 * @returns {undefined} nothing
	 */
	_handlePrompts(data) {
		Object.assign(this.options, data);
		if (this.options.name) {
			this.options.name_code = lowercaseFirstLetter(this.options.name.replace(/[^a-zA-Z0-9_]/g, ''));
			this.options.Name_code = capitalizeFirstLetter(this.options.name_code);
		}
		this._checkFields();
	}

	_checkFields() {
		const result = this._validate();
		if (result.length) {
			throw validationError(result);
		}
	}

	_validate() {
		const options = ['name', 'version', 'author'];
		let result = [];
		for (let idx in options) {
			const check = this._validateOption(options[idx]);
			if (check && !check.valid) {
				result.push(check);
			}
		}
		return result;
	}

	_validateOption(attribute) {
		const value = this.options[attribute];
		if (value!==undefined && value!==null) {
			return this._validateField(attribute, value.toString());
		}
		return null;
	}

	_validateField(field, value) {
		return validateField(field, value);
	}

	_prompt() {
		this._setYear();
		this._setOutputDir();
		const prompt = this._allPrompts();
		return this.prompt(prompt).then((data) => this._handlePrompts(data));
	}

	get prompting() {
		return {
			prompt : this._prompt
		};
	}

	get writing() {
		return {
			libraryProperties() {
				this.fs.copyTpl(
					this.templatePath('library.properties'),
					this.destinationPath('library.properties'),
					this.options
				);

				this.fs.copyTpl(
					this.templatePath('README.md'),
					this.destinationPath('README.md'),
					this.options
				);

				this.fs.copyTpl(
					this.templatePath('LICENSE'),
					this.destinationPath('LICENSE'),
					this.options
				);

				const filename = `src/${this.options.name}.cpp`;
				this.fs.copyTpl(
					this.templatePath('src/library.cpp'),
					this.destinationPath(filename),
					this.options
				);

				this.fs.copyTpl(
					this.templatePath('src/library.h'),
					this.destinationPath(`src/${this.options.name}.h`),
					this.options
				);

				this.fs.copyTpl(
					this.templatePath('examples/usage/usage.ino'),
					this.destinationPath('examples/usage/usage.ino'),
					this.options
				);
			}
		};
	}
};

export function buildLibraryInitGeneratorClass() {
	const gen = require('yeoman-generator');

	function sourceRoot() {
		return path.join(__dirname, 'init', 'templates');
	}

	/**
	 * Yeoman generator that provides library initialize
	 * functionality to create a new library in the file system.
	 *
	 */
	class LibraryInitGenerator extends LibraryInitGeneratorMixin(gen) { // eslint-disable-line new-cap

		constructor(...args) {
			super(...args);  			/* istanbul ignore next: coverage bug? */
			this.sourceRoot(sourceRoot());
			this._initializeOptions();
			this._checkFields();
		}

		// It looks like yeoman is expecting the getters specifically on this
		// rather than on super.
		get prompting() {
			return super.prompting;
		}

		get writing() {
			return super.writing;
		}
	}

	// provide the directory unambiguously for external tests since npm link and other
	// packaging tricks can mean external code can end up using the wrong directory
	LibraryInitGenerator.sources = sourceRoot();

	return LibraryInitGenerator;
}


// keep all branches  of the ES6 transpilled code executed
/* istanbul ignore next: not executed on node 7 */
export default () => {};
