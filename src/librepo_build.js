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

import {LibraryRepository} from './librepo';
import {Agent} from './agent';


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

	}

	names() {

	}

	/**
	 * Fetches the library index from the endpoint.
	 * @returns {Array} of library metadata. The format is specific to the version of the library.
	 */
	index() {
		return this.agent.get(this.qualify('libs.json')).then((result)=> {
			return result.body;
		});
	}

	qualify(uri) {
		return this.endpoint + uri;
	}

}

