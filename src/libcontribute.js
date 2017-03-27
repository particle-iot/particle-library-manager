import { validateLibrary } from './validation';
import EventEmitter from 'events';

import zlib from 'zlib';
import tarfs from 'tar-fs';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import { validationMessage } from './validation';

const minimatch = require('minimatch');

const defaultWhitelist = ['*.ino', '*.pde', '*.cpp', '*.c', '*.c++', '*.h', '*.h++', '*.hpp', '*.ipp', '*.properties', '*.md', '*.txt', '*.S', '*.a', 'LICENSE'];

/**
 * Creates the tar.gz stream for sending to the library api to contribute the library.
 */
export class LibraryContributor extends EventEmitter {

	/**
	 * @param {FileSystemLibraryRepository} repo  The repo containing the library.
	 * @param {Particle.Client} client  The particle-api.js client.
	 */
	constructor({ repo, client }) {
		super();
		Object.assign(this, { repo, client });
	}

	_isdirectory(name) {
		try {
			return fs.statSync(name).isDirectory();
		} catch (error) {
			return false;
		}
	}

	/**
	 * @param {string} dir  The directory the filter will be operating on.
	 * @param {Array.<string>} whitelist Array of glob patterns to whitelist.
	 * @return {function} a function that takes a filename as string and returns
	 * true if the file should be excluded from the library archive.
	 */
	_buildFilter(dir, whitelist) {
		const expr = this._buildMatchExpression(whitelist);
		// match the file base (ignore the directory)
		// allow dots as a prefix (allows .gitignore)
		// case-insensitive match
		const matcher = minimatch.filter(expr, { matchBase: true, dot: true, nocase: true });
		return (name) => {
			const originalName = name;
			const isdir = this._isdirectory(name);
			name = path.relative(dir, name);    // ensure it's relative
			if (isdir) {                        // designate as a directory
				name = name + path.sep;
			}
			const dirname = path.dirname(name);
			const dirs = dirname.split(path.sep);
			const isgit = dirs.length && dirs[0]==='.git';
			let result;
			if (isgit) {
				result = true;
			} else if (isdir) {
				result = false;  // // do not ignore - always allow directories. The glob is only applied to files
			} else {
				result = !matcher(name);
			}
			this.emit('file', originalName, result);
			return result;
		};
	}

	/**
	 * @param {Array.<string>} globs An array of glob expressions.
	 * @returns {string} The glob match expression
	 * @private
	 */
	_buildMatchExpression(globs) {
		globs = globs.map((item) => {
			return item.trim();
		});
		return '+(' + globs.join('|') + ')';
	}

	/**
	 * Creates a tar.gz stream containing the contents of the given directory in the file system that can be piped to another stream.
	 * @param {string} dir The directory to tar.gz
	 * @param {Array.<string>} whitelist The files to include in the library.
	 * @returns {ReadableStream} a stream that can be piped to a writableStream to provide the tar.gz file.
	 */
	_targzdir(dir, whitelist) {
		return new Promise((fulfill, reject) => {
			// WORKAROUND: form-data in superagent in particle-api-js only supports file streams so copy to a temporary file
			const archive = tmp.fileSync();

			const archiveWriter = fs.createWriteStream(archive.name);
			const gzip = zlib.createGzip();

			const pack = tarfs.pack(dir, {
				ignore: this._buildFilter(dir, whitelist),
				readable: true
			});
			pack.pipe(gzip).pipe(archiveWriter);

			archiveWriter.on('finish', () => {
				const archiveReader = fs.createReadStream(archive.name);
				fulfill(archiveReader);
			});

			archiveWriter.on('error', reject);
		});
	}

	_contribute(name, stream) {
		return this.client.contributeLibrary(stream);
	}

	_validateLibrary(repo, name) {
		return validateLibrary(repo, name);
	}

	/**
	 * Contributes a library with the given name from the repo.
	 * @param {function} callback  Called during the contributing process:
	 *  callback('validatingLibrary', name)
	 *  callback('contributingLibrary', library)
	 *  callback('contributeComplete', library)
	 *
	 * @param {string} name The name of the library to contribute.
	 * @param {boolean} dryRun When true, the library is only validated, and not contributeed.
	 * @return {Promise} to contribute the named library.
	 */
	contribute(callback, name, dryRun=false) {
		const libraryDirectory = this.repo.libraryDirectory(name);
		return this._doContribute(callback, name, libraryDirectory, dryRun);
	}

	_doContribute(callback, name, libraryDirectory, dryRun) {
		const validatePromise = this._buildValidatePromise(name);
		// mdm - not sure about allowing the site to wrap the promise since it can potentially cause parts of the command
		// code to not execute if the returned promise doesn't chain the validatePromise.
		return this._buildNotifyPromise(callback, 'validatingLibrary', validatePromise, libraryDirectory)
			.then(() => this._doContributeDirect(callback, name, libraryDirectory, dryRun));
	}

	_doContributeDirect(callback, name, libraryDirectory, dryRun) {
		return this.repo.fetch(name)
			.then((library) => {
				return this._doContributeLibrary(callback, library, libraryDirectory, dryRun);
			});
	}

	_buildWhitelist(defaultWhitelist, whitelist) {
		return defaultWhitelist.concat(whitelist);
	}

	/**
	 * Parses a whitelist string, which is a comma-separated list of glob expressions
	 * @param {string} whitelist    The string to parse
	 * @returns {Array.<string>}    The list of array globs.
	 * @private
	 */
	_parseWhitelist(whitelist) {
		return whitelist ? whitelist.split(',') : [];
	}

	_doContributeLibrary(callback, library, libraryDirectory, dryRun) {
		const whitelist = this._buildWhitelist(defaultWhitelist, this._parseWhitelist(library.whitelist));
		const contributePromise = this._buildContributePromise(libraryDirectory, library.name, whitelist, dryRun);
		const notify = this._buildNotifyPromise(callback, 'contributingLibrary', contributePromise, library);
		return notify
			.then(() => callback('contributeComplete', library));
	}

	/**
	 * Notifies the callback function with the given notification and promise and optinoal arguments.
	 * The callback may chain the promise or return a false value.
	 * @param {function} callback      The callback to call
	 * @param {string} notify        The notification event
	 * @param {Promise} promise       The promise that will be executed
	 * @param {Array} other         Additional arguments
	 * @returns {*|Promise.<*>} The promise that will notify the callback and run the promise.
	 * @private
	 */
	_buildNotifyPromise(callback, notify, promise, ...other) {
		return Promise.resolve()
			.then(() => callback(notify, promise, ...other))
			.then(wrapped => wrapped || promise);
	}

	_buildValidatePromise(name) {
		return this._validateLibrary(this.repo, name)
			.then((results) => {
				if (results && !results.valid) {
					const error = new Error('Library is not valid. '+validationMessage(results));
					error.validate = results;
					throw error;
				}
			});
	}

	/**
	 * Constructs a promise to perform the contributing of the library.
	 * @param {string} libraryDirectory      The directory of the library to contribute.
	 * @param {string} libraryName           The name of the library in the repo
	 * @param {string} libraryWhitelist      The array of globs to whitelist
	 * @param {boolean} dryRun               When true, the library is only zipped, and not contributeed.
	 * @returns {*|Promise.<boolean>}       Promise to contribute the library.
	 * @private
	 */
	_buildContributePromise(libraryDirectory, libraryName, libraryWhitelist, dryRun) {
		return Promise.resolve(this._targzdir(libraryDirectory, libraryWhitelist))
			.then(pipe => dryRun ? true : this._contribute(libraryName, pipe));
	}
}

