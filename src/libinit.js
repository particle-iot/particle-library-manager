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

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Yeoman generator that provides library initialize
 * functionality to create a new library in the file system.
 */
export class LibraryInitGenerator extends Base {

	constructor(...args) {
		super(...args);
		this.option('name');
	}

	get prompting() {
		return {
			promptVersion() {
				let prompt = [];

				if (this.options.name===undefined) {
					prompt.push({
						type: 'input',
						name: 'name',
						message: 'Enter a name for your library:',
					});
				}

				if (this.options.version===undefined) {
					prompt.push({
						type: 'input',
						name: 'version',
						message: 'Enter a version for your library:',
					});
				}

				if (this.options.author===undefined) {
					prompt.push({
						type: 'input',
						name: 'author',
						message: 'Who is the author of your library:',
					});
				}

				const self = this;
				return this.prompt(prompt).then((data) => {
					Object.assign(self.options, data);
					this.options.Name = capitalizeFirstLetter(this.options.name);
				});
			}
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

	method1() {
		console.log(`The name is ${this.options.name}`);
	}
}
