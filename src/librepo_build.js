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

import 'babel-polyfill';

import {LibraryRepository, Library, LibraryNotFoundError, MemoryLibraryFile} from './librepo';
import {Agent} from './agent';


export class BuildLibrary extends Library
{
	constructor(name, metadata, repo) {
		super(name);
		this.metadata = metadata;
		this.repo = repo;
		this.cache = { definition: undefined, files: undefined };
		if (this.metadata.id.length < 1) {
			throw LibraryNotFoundError(this.repo, this, 'no id');
		}
	}

	definition() {
		return new Promise((fulfill,rejected) => {
			if (!this.cache.definition) {
				return this.repo.definition(this.metadata.id)
					.then(desc => fulfill(desc))
					.catch(error => rejected(error));
			}
			fulfill(this.cache.definition);
		});
	}

	files() {
		return new Promise((fulfill,rejected) => {
			if (!this.cache.files) {
				return this.repo.tabs(this.metadata.id)
					.then(tabs => fulfill(this.tabsToFiles(tabs)))
					.catch(error => rejected(error));
			}
			fulfill(this.cache.files);
		});
	}

	tabsToFiles(tabs) {
		const files = [];
		for (let tab of tabs) {
			files.push(this.tabToFile(tab));
		}
		return files;
	}
	
	tabToFile(tab) {
		return new MemoryLibraryFile(tab.title, tab.kind, tab.extension, tab.content, tab.id);
	}
}

/**
 * A library repository that fetches it's content via the Build library endpoint.
 */
export class BuildLibraryRepository extends LibraryRepository {

	/**
	 * @param {String} endpoint The root of the library API.
	 */
	constructor({endpoint}) {
		super();
		this.endpoint = endpoint;
		this.agent = new Agent();
		this.root = 'libs';
		this.dot_json = '.json';

	}

	fetch(name) {
		return this.get(this.root+this.dot_json, {name}).then(lib => this._buildLibrary(name, lib));
	}

	_buildLibrary(name, lib) {
		if (lib.length!==1) {
			throw new LibraryNotFoundError(this, name);
		}
		return new BuildLibrary(name, lib[0], this);
	}

	names() {
		return this.index().then((libs)=>{
			return this.extractNames(libs);
		});
	}

	extractNames(libs) {
		let result = [];
		for (let lib of libs) {
			result.push(lib.title);
		}
		return result;
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

	tabs(id) {
		return this.get(`${this.root}/${id}/tabs.json`);
	}

	/**
	 * Retrieves an object descriptor corresponding to the 'spark.json' file for the library.
	 * @param {String} id    The library id
	 * @returns {Promise<Object>} The library definition.
	 */
	definition(id) {
		return this.get(`${this.root}/${id}/definition.json`);
	}
}
