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

import Particle from 'particle-api-js';

import { AbstractLibraryRepository, AbstractLibrary } from './librepo';

const tar = require('tar-stream');
const gunzip = require('gunzip-maybe');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const promisify = require('es6-promisify');

/**
 * A library retrieved from the cloud.
 */
export class CloudLibrary extends AbstractLibrary{
	constructor(name, metadata, repo) {
		super(name, metadata, repo);
	}

	// processFiles(files) {
	// 	return this.tabsToFiles(files);
	// }
	//
	// tabsToFiles(tabs) {
	// 	const files = [];
	// 	for (let tab of tabs) {
	// 		files.push(this.tabToFile(tab));
	// 	}
	// 	return files;
	// }
	//
	// /**
	//  * Creates a new LibraryFile for the given tab object.
	//  * @param {object} tab A tab from Build. Expected properties are title, kind, extension,
	//  *  content and id.
	//  * @returns {LibraryFile} the library file for the tab.
	//  */
	// tabToFile(tab) {
	// 	return new MemoryLibraryFile(tab.title, tab.kind, tab.extension, tab.content, tab.id);
	// }


	copyTo(dir) {
		const self = this;
		return promisify(mkdirp)(dir)
			.then(() => this.metadata.download())
			.then((buffer) => {
				const Readable = require('stream').Readable;
				const read = new Readable;
				read._read = () => {
					read.push(buffer);
					read.push(null);
				};
				return new Promise((fulfill, reject) => {
					const extract = tar.extract();

					// for some reason this function doesn't get tracked for coverage
					/* istanbul ignore next */
					function handleEntry(header, stream, callback) {
						function createDir(dir, callback) {
							mkdirp(dir, (err) => {
								if (err) {
									reject(err);
								} else {
									callback();
								}
							});
						}

						// header is the tar header
						// stream is the content body (might be an empty stream)
						// call next when you are done with this entry
						const fqname = path.join(dir, header.name);

						if (header.type==='directory') {
							createDir(fqname, callback);
						} else if (header.type==='file') {
							createDir(path.dirname(fqname), () => {
								const write = fs.createWriteStream(fqname);
								write.on('open', () => {
									write.on('error', reject);
									stream.pipe(write);
									stream.on('end', () => {
										callback();     // ready for next entry
									});
								});
							});
						} else {
							stream.resume();
							callback();
						}
					}

					extract.on('entry', handleEntry);
					extract.on('finish', fulfill);
					read.pipe(gunzip()).pipe(extract);
				}).then(() => self);
			});
	}
}


/**
 * A library repository that fetches its content Particle Library endpoint.
 */
export class CloudLibraryRepository extends AbstractLibraryRepository {

	/**
	 * @param {String} endpoint The root of the library API.
	 */
	constructor({ auth=undefined, client = new Particle().client({ auth }) }) {
		super();
		this.api = client.api;
		this.client = client;
		this.auth = auth;
		this.api.debug = console.log; // eslint-disable-line no-console
	}

	_getLibrary(name, version) {
		const query = version ? { version } : undefined;
		return this.client.library(name, query);
	}

	fetch(name, version) {
		return this._getLibrary(name, version).then((lib) => {
			return this._createLibrary(name, lib);
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

	/**
	 * Fetches the library index from the endpoint.
	 * @returns {Array} of library metadata. The format is specific to the version of the library.
	 */
	index() {
		return this.client.libraries();
	}

	/**
	 * Retrieves an object descriptor corresponding to the 'library.properties' file for the library.
	 * @param {AbstractLibrary} lib    The library
	 * @returns {Promise<Object>} The library definition.
	 */
	definition(lib) {
		return Promise.resolve(lib.metadata);
	}

	/*
	extension(name) {
		const idx = name.lastIndexOf('.');
		return idx>=0 ? [name.substring(idx+1), name.substring(0,idx)] : ['', name];
	}

	files(lib) {
		return this.api.getLibraryFiles({auth: this.auth, name: lib.name}).then(files => {
			return files.body.map((file) => {

				const path = require('path');
				const filename = file.path;
				const basename = path.basename(filename);
				const extension = path.extname(basename);
				// remove the leading dot

				const stem = path.basename(basename, extension);
				let dir = path.dirname(filename);
				let dirs = dir.split('/');
				if (dirs[0]==='firmware') {   // migrate to v2 format :-)
					dirs[0] = 'src';
				}

				if (dirs[1]==='examples') {      // move firmware/examples to ./examples
					dirs = ['examples'];
				}
				dir = dirs.join('/');
				const noext = path.join(dir, stem);
				// hard-code to source so that the fs filesystem includes the file
				return new MemoryLibraryFile(noext, 'source', extension.substring(1), file.content, undefined);
			}).filter(item => item!==null);
		});
	}
	*/
}
