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
	 */
	content(stream) {
		const Readable = require('stream').Readable;
		var s = new Readable;
		s._read = () => { rs.push(this.string_content); rs.push(null); };
		s.pipe(stream);
	}
	
}