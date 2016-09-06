import {validateLibrary} from './validation';

import zlib from 'zlib';
import tarfs from 'tar-fs';

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
		const gzip = zlib.createGzip();
		const pack = tarfs.pack(dir);
		return pack.pipe(gzip);
	}

	_publish(name, buffer) {

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
		const self = this;
		const libdir = self.repo.libraryDirectory(name);

		const validatePromise = validateLibrary(self.repo, name)
			.then((results) => {
				if (results && !results.valid) {
					throw results;
				}
			});

		// mdm - not sure about allowing the site to wrap the promise since it can potentially cause parts of the command
		// code to not execute if the returned promise doesn't chain the validatePromise.
		return Promise.resolve(callback('validatingLibrary', libdir, validatePromise))
			.then(promise => promise || validatePromise)
			.then(() => {
				return self.repo.fetch(name)
					.then((library) => {
						const publishPromise = Promise.resolve(self.targzdir(libdir))
							.then(pipe => dryRun ? true : self._publish(name, pipe));

						return Promise.resolve(callback('publishingLibrary', library, publishPromise))
							.then((promise) => promise || publishPromise)
							.then(() => callback('publishComplete', library));
					});
			});
	}
}

