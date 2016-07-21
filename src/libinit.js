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

import { Base } from 'yeoman-generator';
const path = require('path');

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
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
		super(...args);
	}

	/**
	 * Registers the option names.
	 * @private
	 * @returns {undefined} nothing
	 */
	_initializeOptions() {
		this.option('name');
		this.option('version');
		this.option('dir');
	}

	_setOutputDir() {
		if (this.options.dir !== undefined) {
			this.destinationRoot(this.options.dir);
		}
	}

	_allPrompts() {
		let prompt = [];

		if (this.options.name === undefined) {
			prompt.push({
				type: 'input',
				name: 'name',
				message: 'Enter a name for your library:',
			});
		}

		if (this.options.version === undefined) {
			prompt.push({
				type: 'input',
				name: 'version',
				message: 'Enter a version for your library:',
			});
		}

		if (this.options.author === undefined) {
			prompt.push({
				type: 'input',
				name: 'author',
				message: 'Who is the author of your library:',
			});
		}

		return prompt;
	}

	_handlePrompts(data) {
		Object.assign(this.options, data);
		if (this.options.name) {
			this.options.Name = capitalizeFirstLetter(this.options.name);
		}
	}

	_prompt() {
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
					this.templatePath('examples/doit/doit_example.cpp'),
					this.destinationPath('examples/doit/doit_example.cpp'),
					this.options
				);
			}
		};
	}
};



/**
 * Yeoman generator that provides library initialize
 * functionality to create a new library in the file system.
 *
 */
export class LibraryInitGenerator extends LibraryInitGeneratorMixin(Base) { // eslint-disable-line new-cap

	constructor(...args) {
		super(...args);
		this.sourceRoot(path.join(__dirname, 'init', 'templates'));
		this._initializeOptions();
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

// keep all branches  of the ES6 transpilled code executed
export default () => {};
