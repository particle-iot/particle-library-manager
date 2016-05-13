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

/**
 * Base class of errors from a library repository.
 */
export class LibraryRepositoryError extends Error {
	constructor(repo, message) {
		super(message);
		this.repo = repo;
		this.name = 'LibraryRepositoryError';
	}
}


export class LibraryNotFoundError extends LibraryRepositoryError {
	constructor(repo, library, message) {
		super(repo, message);
		this.library = library;
		this.message = `library '${this.library}' not found in repo '${this.repo}'.`;
		this.name = 'LibraryNotFoundError';
	}
}


export class LibraryFormatError extends LibraryRepositoryError {
	constructor(repo, library, message) {
		super(repo, message);
		this.library = library;
		this.name = 'LibraryFormatError';
	}
}



/**
 * Describes a library repository. A repository provides access to named libraries.
 * Each library name is unique within the repository.
 */
export class LibraryRepository {
	/**
	 *
	 * @param {String} name  The name of the library to retrieve.
	 * @returns {Promise.<Library>} The library corresponding to the name, or
	 * LibraryNotFoundError if the library doesn't exist.
	 */
	fetch(name) {
		return Promise.reject(new LibraryNotFoundError(this, name));
	}

	/**
	 * Retrieves a list of known library names
	 * @returns {Promise.<Array>}   The library names in this repository.
	 */
	names() {
		return Promise.resolve([]);
	}
}

/**
 * Describes a library. The library is uniquely identified by it's name.
 */
export class Library {
	constructor(name) {
		this._name = name;
	}

	get name() {
		return this._name;
	}

	/**
	 * A promise of the library files available.
	 * @returns {Promise.<Array>}   The files that make up this library.
	 */
	files() {
		return Promise.resolve([]);
	}
}

export class LibraryFile {
	constructor(name, kind, extension) {
		this.name = name;
		this.kind = kind;
		this.extension = extension;
	}

	content(stream) {
		return new Promise((fulfill, reject) => {
			stream.end();
			fulfill(stream);
		});
	}
}

export class MemoryLibraryFile extends LibraryFile {
	constructor(name, kind, extension, content, id) {
		super(name, kind, extension);
		this.string_content = content;
		this.id = id;
	}

	/**
	 *
	 * @param {Writable} stream receives the streamed content.
	 * @returns {None} nothing
	 */
	content(stream) {
		const Readable = require('stream').Readable;
		const rs = new Readable;
		rs._read = () => {
			rs.push(this.string_content);
			rs.push(null);
		};
		rs.pipe(stream);
	}
}

/**
 * Abstract class provides properties for the associated repo, name and metadata.
 * It delegates to the repo to retrieve the associated descriptor and files.
 * Calls `definition(id,name)` and `files(id,name)` on the repo to retrieve the data
 * for the library data. The results of these are then passed to template methods
 * `process_definition()` and `process_files()`.
 */
export class AbstractLibrary extends Library
{
	constructor(name, metadata, repo) {
		super(name);
		this.metadata = metadata;
		this.repo = repo;
		this.cache = { definition: undefined, files: undefined };
		if (this.metadata.id.length < 1) {
			throw new LibraryNotFoundError(this.repo, name, 'no id');
		}
	}

	definition() {
		return new Promise((fulfill,rejected) => {
			if (!this.cache.definition) {
				return this.repo.definition(this.metadata.id, this.name)
					.then(desc => fulfill(this.process_definition(desc)))
					.catch(error => rejected(error));
			}
			fulfill(this.cache.definition);
		});
	}

	files() {
		return new Promise((fulfill,rejected) => {
			if (!this.cache.files) {
				return this.repo.files(this.metadata.id, this.name)
					.then(files => fulfill(this.process_files(files)))
					.catch(error => rejected(error));
			}
			fulfill(this.cache.files);
		});
	}

	process_definition(def) {
		return def;
	}

	process_files(files) {
		return files;
	}
}

/**
 * Provides the base contract required by the AbstractLibrary.
 */
export class AbstractLibraryRepository extends LibraryRepository {
	files(id, name) {
		return [];
	}

	definition(id, name) {
		return {id,name};
	}
}
