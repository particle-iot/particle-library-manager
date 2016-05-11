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
export class LibraryRepositoryError extends Error
{
    constructor(repo) {
        super();
        this.repo = repo;
        Error.captureStackTrace(this, this.constructor);
    }
}


export class LibraryNotFoundError extends LibraryRepositoryError
{
    constructor(repo, library) {
        super(repo);
        this.library = library;
        this.message = `library '${this.library}' not found in repo '${this.repo}'.`;
    }

}


/**
 * Describes a library repository. A repository provides access to named libraries.
 * Each library name is unique within the repository.
 */
export class LibraryRepository
{
    /**
     *
     * @param library_name  The name of the library to retrieve.
     * @returns {Promise}
     */
    fetch(library_name) {
        return Promise.reject(new LibraryNotFoundError(this, library_name));
    }

    /**
     * Retreieves a list of known library names
     * @returns {Promise.<Array>}
     */
    all_names() {
        return Promise.resolve([]);
    }
}

/**
 * Describes a library. The library is uniquely identified by it's name.
 */
export class Library
{
    constructor(name)
    {
        this.name = name
    }

    files() {
        return Promise.resolve([]);
    }
}

export class LibraryFile
{
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }

    content(stream) {
        return new Promise((fulfill, reject) => {
            stream.end();
            fulfill(stream);
        });
    }
}

