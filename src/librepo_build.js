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

import {LibraryRepository, Library, LibraryNotFoundError} from './librepo';
import {Agent} from './agent';


export class BuildLibrary extends Library
{
	constructor(name, metadata, repo) {
		super(name);
		this.metadata = metadata;
		this.repo = repo;
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
	}

	fetch(name) {
		return this.get('libs.json', {name}).then(lib => this._buildLibrary(name, lib));
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
		return this.get('libs.json');
	}

	get(resource, args) {
		return this.agent.get(this.qualify(resource), undefined, args).then(result => result.body);
	}

	qualify(uri) {
		return this.endpoint + uri;
	}

}
