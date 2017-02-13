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

import { AbstractLibraryRepository, LibraryNotFoundError, MemoryLibraryFile, AbstractLibrary } from './librepo';
import Agent from 'particle-api-js/lib/Agent';
import { LibraryFormatError } from './librepo';

/**
 * A library retrieved from the Build repo.
 * The metadata should include the ID
 */
export class BuildLibrary extends AbstractLibrary{
	constructor(name, metadata, id, repo) {
		super(name, metadata, repo);
		if (id === undefined || id.length < 1) {
			throw new LibraryFormatError(this.repo, name, 'no id');
		}
		this.id = id;
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
 * A library repository that fetches its content via the Build library endpoint.
 */
export class BuildLibraryRepository extends AbstractLibraryRepository {

	/**
	 * @param {String} endpoint The root of the library API.
	 */
	constructor({ endpoint }) {
		super();
		this.endpoint = endpoint;
		this.agent = new Agent();
		this.root = 'libs';
		this.dot_json = '.json';
	}

	fetch(name) {
		return this.get(this.root+this.dot_json, { name }).then(libs => this._buildLibrary(name, libs));
	}

	_buildLibrary(name, libs) {
		if (libs.length!==1) {
			throw new LibraryNotFoundError(this, name);
		}
		const metadata = libs[0];
		return this._createLibrary(name, metadata);
	}

	_createLibrary(name, metadata) {
		return new BuildLibrary(name, metadata, metadata.id, this);
	}

	names() {
		return this.index().then((libs)=>{
			return this.extractNames(libs);
		});
	}

	extractName(lib) {
		return lib.title;
	}

	/**
	 * Fetches the library index from the endpoint.
	 * @returns {Array} of library metadata. The format is specific to the version of the library.
	 */
	index() {
		return this.get(this.root+this.dot_json);
	}

	get(resource, args) {
		return this.agent.get(this.qualify(resource), undefined, args).then(result => result.body);
	}

	qualify(uri) {
		return this.endpoint + uri;
	}

	files(lib) {
		const id = this.libraryId(lib);
		return this.get(`${this.root}/${id}/tabs.json`);
	}

	/**
	 * Retrieves an object descriptor corresponding to the 'spark.json' file for the library.
	 * @param {AbstractLibrary} lib    The library
	 * @returns {Promise<Object>} The library definition.
	 */
	definition(lib) {
		const id = this.libraryId(lib);
		return this.get(`${this.root}/${id}/definition.json`);
	}

	libraryId(lib) {
		return lib.id;
	}
}
