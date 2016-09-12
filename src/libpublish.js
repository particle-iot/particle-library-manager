import {validateLibrary} from './validation';

import zlib from 'zlib';
import tarfs from 'tar-fs';
import fs from 'fs';
import tmp from 'tmp';

export class LibraryPublisher {

	/**
	 * @param {FileSystemLibraryRepository} repo  The repo containing the library.
	 * @param {Particle.Client} client  The particle-api.js client.
	 */
	constructor({repo, client}) {
		Object.assign(this, {repo, client});
	}

	/**
	 * Creates a tar.gz stream containing the contents of the given directory in the file system that can be piped to another stream.
	 * @param {string} dir The directory to tar.gz
	 * @returns {ReadableStream} a stream that can be piped to a writableStream to provide the tar.gz file.
	 */
	targzdir(dir) {
		return new Promise((fulfill, reject) => {
			// WORKAROUND: form-data in superagent in particle-api-js only support file streams so copy to a temporary file
			const archive = tmp.fileSync();

			const archiveWriter = fs.createWriteStream(archive.name);
			const gzip = zlib.createGzip();
			const pack = tarfs.pack(dir);
			pack.pipe(gzip).pipe(archiveWriter);

			archiveWriter.on('finish', () => {
				const archiveReader = fs.createReadStream(archive.name);
				fulfill(archiveReader);
			});

			archiveWriter.on('error', reject);
		});
	}

	_publish(name, stream) {
		return this.client.publishLibrary(stream);
	}

	_validateLibrary(repo, name) {
		return validateLibrary(repo, name);
	}

	/**
	 * Publishes a library with the given name from the repo.
	 * @param {function} callback  Called during the publishing process:
	 *  callback('validatingLibrary', name)
	 *  callback('publishingLibrary', library)
	 *  callback('publishComplete', library)
	 *
	 * @param {string} name The name of the library to publish.
	 * @param {boolean} dryRun When true, the library is only validated, and not published.
	 * @return {Promise} to publish the named library.
	 */
	publish(callback, name, dryRun=false) {
		const libraryDirectory = this.repo.libraryDirectory(name);
		return this._doPublish(callback, name, libraryDirectory, dryRun);
	}

	_doPublish(callback, name, libraryDirectory, dryRun) {
		const validatePromise = this._buildValidatePromise(name);
		// mdm - not sure about allowing the site to wrap the promise since it can potentially cause parts of the command
		// code to not execute if the returned promise doesn't chain the validatePromise.
		return this._buildNotifyPromise(callback, 'validatingLibrary', validatePromise, libraryDirectory)
			.then(() => this._doPublishDirect(callback, name, libraryDirectory, dryRun));
	}

	_doPublishDirect(callback, name, libraryDirectory, dryRun) {
		return this.repo.fetch(name)
			.then((library) => {
				return this._doPublishLibrary(callback, library, libraryDirectory, dryRun);
			});
	}

	_doPublishLibrary(callback, library, libraryDirectory, dryRun) {
		const publishPromise = this._buildPublishPromise(libraryDirectory, library.name, dryRun);
		const notify = this._buildNotifyPromise(callback, 'publishingLibrary', publishPromise, library);
		return notify
			.then(() => callback('publishComplete', null, library));
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
					const error = new Error('Library is not valid.');
					error.validate = results;
					throw error;
				}
			});
	}

	/**
	 * Constructs a promise to perform the publishing of the library.
	 * @param {string} libraryDirectory      The directory of the library to publish.
	 * @param {string} libraryName           The name of the library in the repo
	 * @param {boolean} dryRun               When true, the library is only zipped, and not published.
	 * @returns {*|Promise.<boolean>}       Promise to publish the library.
	 * @private
	 */
	_buildPublishPromise(libraryDirectory, libraryName, dryRun) {
		return Promise.resolve(this.targzdir(libraryDirectory))
			.then(pipe => dryRun ? true : this._publish(libraryName, pipe));
	}
}

