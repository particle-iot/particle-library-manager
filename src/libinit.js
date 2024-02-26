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
import { processTemplate } from './util/template_processor';
const path = require('path');
const inquirer = require('inquirer');

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
	const msg = [];
	for (const idx in validation) {
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
export class LibraryInitGeneratorMixin {

	constructor(...args) {
		this.arguments = [];
		this.argument = (name, options) => (this.arguments.push({ name, options }));
		this.options = {};
		this.destinationRoot = undefined;
		this.sourceRoot = path.join(__dirname, 'init', 'templates');
	}

	destinationPath(file) {
		return path.join(process.cwd(), file);
	}

	templatePath(file) {
		return path.join(this.sourceRoot, file);
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

	prompt(questions) {
		return inquirer.prompt(questions);
	}

	_allPrompts() {
		const prompt = [];

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
		const result = [];
		for (const idx in options) {
			const check = this._validateOption(options[idx]);
			if (check && !check.valid) {
				result.push(check);
			}
		}
		return result;
	}

	_validateOption(attribute) {
		const value = this.options[attribute];
		if (value !== undefined && value !== null) {
			return this._validateField(attribute, value.toString());
		}
		return null;
	}

	_validateField(field, value) {
		return validateField(field, value);
	}

	_prompt() {
		const prompt = this._allPrompts();
		return this.prompt(prompt).then((data) => this._handlePrompts(data));
	}

	get prompting() {
		return {
			prompt : this._prompt.bind(this)
		};
	}

	async write() {
		await processTemplate({
			templatePath: this.templatePath('library.properties'),
			destinationPath: this.destinationPath('library.properties'),
			options: this.options
		});

		await processTemplate({
			templatePath: this.templatePath('README.md'),
			destinationPath: this.destinationPath('README.md'),
			options: this.options
		});

		await processTemplate({
			templatePath: this.templatePath('LICENSE'),
			destinationPath: this.destinationPath('LICENSE'),
			options: this.options
		});

		const filename = `src/${this.options.name}.cpp`;
		await processTemplate({
			templatePath: this.templatePath('src/library.cpp'),
			destinationPath: this.destinationPath(filename),
			options: this.options
		});

		await processTemplate({
			templatePath: this.templatePath('src/library.h'),
			destinationPath: this.destinationPath(`src/${this.options.name}.h`),
			options: this.options
		});

		await processTemplate({
			templatePath: this.templatePath('examples/usage/usage.ino'),
			destinationPath: this.destinationPath('examples/usage/usage.ino'),
			options: this.options
		});
	}
}

// keep all branches  of the ES6 transpilled code executed
/* istanbul ignore next: not executed on node 7 */
export default () => {};
