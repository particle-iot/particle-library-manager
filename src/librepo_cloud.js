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

const Particle = require('particle-api-js');

import {AbstractLibraryRepository, MemoryLibraryFile, AbstractLibrary} from './librepo';
import {LibraryFormatError} from './librepo';


/**
 * A library retrieved from the cloud.
 */
export class CloudLibrary extends AbstractLibrary
{
	constructor(name, metadata, repo) {
		super(name, metadata, repo);
	}

	processFiles(files) {
		return this.tabsToFiles(files);
	}

	tabsToFiles(tabs) {
		const files = [];
		for (let tab of tabs) {
			files.push(this.tabToFile(tab));
		}
		return files;
	}

	/**
	 * Creates a new LibraryFile for the given tab object.
	 * @param {object} tab A tab from Build. Expected properties are title, kind, extension,
	 *  content and id.
	 * @returns {LibraryFile} the library file for the tab.
	 */
	tabToFile(tab) {
		return new MemoryLibraryFile(tab.title, tab.kind, tab.extension, tab.content, tab.id);
	}
}

/**
 * A library repository that fetches its content Particle Library endpoint.
 */
export class CloudLibraryRepository extends AbstractLibraryRepository {

	/**
	 * @param {String} endpoint The root of the library API.
	 */
	constructor({config, auth}) {
		super();
		this.particle = new Particle(config);
		this.auth = auth;
		this.particle.debug = console.log;
	}

	_getLibrary(name) {
		return this.particle.getLibrary({auth: this.auth, name: name});
	}

	fetch(name) {
		return this._getLibrary(name).then((lib) => {
			return this._createLibrary(name, lib.body);
		});
	}

	_createLibrary(name, metadata) {
		return new CloudLibrary(name, metadata, this);
	}

	names() {
		return this.index().then((libs) => {
			return this.extractNames(libs);
		});
	}

	extractNames(libs) {
		let result = [];
		for (let lib of libs) {
			result.push(lib.name);
		}
		return result;
	}

	/**
	 * Fetches the library index from the endpoint.
	 * @returns {Array} of library metadata. The format is specific to the version of the library.
	 */
	index() {
		return this.particle.listLibraries({auth: this.auth}).then(result => result.libraries);
	}

	/**
	 * Retrieves an object descriptor corresponding to the 'library.properties' file for the library.
	 * @param {AbstractLibrary} lib    The library
	 * @returns {Promise<Object>} The library definition.
	 */
	definition(lib) {
		return Promise.resolve(lib.metadata);
	}

	extension(name) {
		const idx = name.lastIndexOf('.');
		return idx>=0 ? [name.substring(idx+1), name.substring(0,idx)] : ['', name];
	}

	files(lib) {
		return this.particle.getLibraryFiles({auth: this.auth, name: lib.name}).then(files => {
			return files.body.map((file) => {

				const path = require('path');
				const filename = file.path;
				const basename = path.basename(filename);
				const extension = path.extname(basename);
				// remove the leading dot

				const stem = path.basename(basename, extension);
				let dir = path.dirname(filename);
				let dirs = dir.split('/');
				if (dirs[0]=='firmware')    // migrate to v2 format :-)
					dirs[0] = 'src';

				if (dirs[1]=='examples')        // move firmware/examples to ./examples
					dirs = ['examples'];
				dir = dirs.join('/');
				const noext = path.join(dir, stem);
				// hard-code to source so that the fs filesystem includes the file
				return new MemoryLibraryFile(noext, 'source'/*type*/, extension.substring(1), file.content, undefined);
			}).filter(item => item!==null);
		});
	}

}
