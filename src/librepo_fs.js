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
import {LibraryNotFoundError} from './librepo';
import VError from 'verror';
const fs = require('fs');
const promisify = require('es6-promisify');

import {AbstractLibraryRepository, AbstractLibrary, LibraryFile, LibraryFormatError} from './librepo';

/**
 *
 * @param {string} rootDir               The directory to scan, map and action.
 * @param {function} mapper       Called with (stat,name) object for each item in the directory.
 * @param {function} action         Called with an array of actionables from the mapper function.
 * @returns {Promise} promise that returns an array of items returned from involking the mapper and action for each
 *  item in the directory.
 */
export function mapActionDir(rootDir, mapper, action) {
	const stat = promisify(fs.stat);
	const readdir = promisify(fs.readdir);
	return readdir(rootDir)
	.then(files => {
		const filePromises = files.map(file => {
			const filePath = rootDir + file;
			return stat(filePath)
				.then(stat => mapper(stat, file));
		});
		return Promise
			.all(filePromises)
			.then(actionables => action(files, actionables));
	});
}

function isDirectory(stat) {
	return stat.isDirectory();
}

/**
 * Filters a given array and removes all with a non-truthy vale in the corresponding predicate index.
 * @param {Array} items             The items to filter.
 * @param {Array} predicates        The predicates for each item to filter.
 * @returns {Array<T>} The itmes array with all those that didn't satisfy the predicate removed.
 */
function removeFailedPredicate(items, predicates) {
	return items.filter((_,i) => predicates[i]===true);
}

/**
 * Promises to retrieve the directories contained within a directory.
 * @param {string} rootDir      The directory to scan.
 * @returns {Promise<Array<string>>} The names of directories containing in rootDir.
 */
export function getdirs(rootDir) {
	return mapActionDir(rootDir, isDirectory, removeFailedPredicate);
}

export const libraryProperties = 'particle.json';

export class FileSystemLibrary extends AbstractLibrary {
	constructor(name, metadata, repo) {
		super(name, metadata, repo);
	}
}


export class FileSystemLibraryFile extends LibraryFile {
	constructor(fileName, name, kind, extension) {
		super(name, kind, extension);
		this.fileName = fileName;
	}

	content(stream) {
		const source = fs.createReadStream(this.fileName);
		source.pipe(stream);
	}
}


export class FileSystemLibraryRepository extends AbstractLibraryRepository {

	/**
	 *
	 * @param {string} path The location of the file system repository. The contained
	 * libraries are stored as subdirectories under the repo root.
	 */
	constructor(path) {
		super();
		if (!path.endsWith('/')) {
			path += '/';
		}
		this.path = path;
		this.sourceExtensions = { 'c':true, 'cpp': true, 'h':true };
	}

	/**
	 * A nod to the fact we need to sanitize library names for the fs...
	 * @param {string} name      The name to sanitize
	 * @returns {string} a sanitized name.
	 */
	nameToFs(name) {
		return name;
	}

	libraryFileName(libraryName, fileName, fileExt) {
		return this.directory(libraryName) + fileName + '.' + fileExt;
	}

	/**
	 * Copy a given file to this library.
	 * @param {string} libraryName the target library name
	 * @param {LibraryFile} libraryFile   The library file to copy to the target library.
	 * @return {Promise} to copy the library file.
	 */
	copyLibraryFile(libraryName, libraryFile) {
		return Promise.resolve().then(() => {
			const fileName = this.libraryFileName(libraryName, libraryFile.name, libraryFile.extension);
			const outputStream = fs.createWriteStream(fileName);
			libraryFile.content(outputStream);
		});
	}

	includeLibraryFile(libraryFile) {
		return libraryFile.kind === 'source';
	}

	/**
	 * Adds a library to this repo. The descriptor and source files are written out. Example files are presently
	 * not included.
	 * @param {Library} library The library to add.
	 * @return {Promise} promise to create the library
	 */
	add(library) {
		const name = library.name;
		const mkdir = promisify(fs.mkdir);
		return Promise.resolve()
			.then(() => mkdir(this.directory(name)))
			.then(() => library.definition())
			.then(definition => {
				return this.writeDescriptor(this.descriptorFile(name), definition);
			})
			.then(() => library.files())
			.then((files) => {
				const copyFiles = [];
				for (let file of files) {
					if (this.includeLibraryFile(file)) {
						copyFiles.push(Promise.resolve().then(()=>this.copyLibraryFile(name, file)));
					}
				}
				return Promise.all(copyFiles);
			});
	}

	/**
	 * Removes the id field from the metadata.
	 * @param {object} metadata  The object to clone and remove the ID from.
	 * @returns {object} The metadata with the id removed.
	 */
	removeId(metadata) {
		const m = Object.assign({}, metadata);
		delete m.id;
		return m;
	}

	writeDescriptor(toFile, metadata) {
		const writeFile = promisify(fs.writeFile);
		const m = this.removeId(metadata);
		const content = JSON.stringify(m);
		return writeFile(toFile, content);
	}

	/**
	 * Locates the folder corresponding to the library.
	 * @param {string} name The name of the library to fetch.
	 * @return {FileSystemLibrary} the library found
	 */
	fetch(name) {
		const filePath = this.descriptorFile(name);
		return this.readFileJSON(name, filePath)
			.then(descriptor => this._createLibrary(name, descriptor))
			.catch(error => {
				throw new LibraryNotFoundError(this, name, error);
			});
	}

	directory(name) {
		return this.path + name + '/';
	}

	/**
	 * Determine the file that contains the library descriptor.
	 * @param {string} name The library name
	 * @returns {string}    The file path of the library descriptor for the named library.
	 */
	descriptorFile(name) {
		return this.directory(name) + libraryProperties;
	}

	/**
	 * Reads a file and decodes the JSON
	 * @param {string} name The library name. Used in error reporting.
	 * @param {string} filename The file to decode.
	 * @returns {Promise.<Object>} The promise to retrieve the library with the given name.
	 */
	readFileJSON(name, filename) {
		const readFile = promisify(fs.readFile);
		return readFile(filename, 'utf8')
			.then(json => JSON.parse(json))
			.catch(error => {
				throw new LibraryFormatError(this, name, new VError(error, 'error parsing "%s"', filename));
			});
	}

	_createLibrary(name, metadata) {
		return new FileSystemLibrary(name, metadata, this);
	}

	/**
	 * Finds the directories under the given path for this repo that contain a
	 * `library.properties` file.
	 * @returns {Promise.<Array.<String>>} The names of libraries in this repo.
	 */
	names() {
		const stat = promisify(fs.stat);
		// todo - map directory names back to the library name (if some encoding is used.)
		return getdirs(this.path).then(dirs => {
			const libPromises = dirs.map(dir => {
				const filePath = this.descriptorFile(dir);
				return stat(filePath)
					.then(stat => stat.isFile())
					.catch(error => false);
			});

			return Promise.all(libPromises).then(isLib => {
				return dirs.filter((_, i) => isLib[i]);
			});
		});
	}

	/**
	 * Retrieves the definition object for a given library.
	 * @param {FileSystemLibrary} lib   The library whose descriptor is fetched.
	 * @returns {Promise.<object>} The promised library descriptor.
	 */
	definition(lib) {
		// the descriptor is fetched eagerly on construction
		return Promise.resolve(lib.metadata);
	}

	extension(name) {
		const idx = name.lastIndexOf('.');
		return idx>=0 ? [name.substring(idx+1), name.substring(0,idx)] : ['', name];
	}

	isSourceFile(stat, name) {
		return stat.isFile() && this.isSourceFileName(name);
	}

	isSourceFileName(name) {
		//return this.sourceExtensions[this.extension(name)[0]]!==false;
		return name!==libraryProperties;
	}

	/**
	 * Retrieves the files for a library from the file system.
	 * @param {Library} lib the library whose files should be retrieved.
	 * @return {Promise<Array<LibraryFile>>} the files for this library
	 */
	files(lib) {
		const libraryDir = this.directory(lib.name);
		// iterate over all the files and

		return mapActionDir(libraryDir, (...args)=>this.isSourceFile(...args), (files, include) => {
			const filtered = removeFailedPredicate(files, include);
			return this.createLibraryFiles(lib, filtered);
		});
	}

	createLibraryFiles(lib, fileNames) {
		const libraryDir = this.directory(lib.name);
		const fileBuilders = fileNames.map((fileName) => this.createLibraryFile(libraryDir, fileName));
		return Promise.all(fileBuilders);
	}

	createLibraryFile(libraryDir, fileName) {
		const [extension, baseFile] = this.extension(fileName);
		return Promise.resolve(new FileSystemLibraryFile(libraryDir+fileName, baseFile, 'source', extension));
	}
}

