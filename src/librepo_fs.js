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

import {LibraryNotFoundError, LibraryRepositoryError} from './librepo';
import VError from 'verror';
const fs = require('fs');
const path = require('path');
const promisify = require('es6-promisify');
const properties = require('properties-parser');

import {AbstractLibraryRepository, AbstractLibrary, LibraryFile, LibraryFormatError} from './librepo';

/**
 *
 * @param {string} rootDir               The directory to scan, map and action.
 * @param {function} mapper       Called with (stat,file,filePath) for each item in the directory.
 * @param {function} action         Called with actionables from the mapper function.
 * @returns {Promise} promise that returns an array of items returned from involking the mapper and action for each
 *  item in the directory.
 */
export function mapActionDir(rootDir, mapper, action) {
	const stat = promisify(fs.stat);
	const readdir = promisify(fs.readdir);
	return readdir(rootDir)
	.then(files => {
		const filePromises = files.map(file => {
			const filePath = path.join(rootDir, file);
			return stat(filePath)
				.then(stat => mapper(stat, file, filePath));
		});
		return Promise
			.all(filePromises)
				.then(actionables => action(actionables, files));
	});
}

function isDirectory(stat) {
	return stat.isDirectory();
}

/**
 * Filters a given array and removes all with a non-truthy vale in the corresponding predicate index.
 * @param {Array} predicates        The predicates for each item to filter.
 * @param {Array} items             The items to filter.
 * @returns {Array<T>} The itmes array with all those that didn't satisfy the predicate removed.
 */
function removeFailedPredicate(predicates, items) {
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

export const libraryProperties = 'library.properties';

export class FileSystemLibrary extends AbstractLibrary {
	/**
	 *
	 * @param {string} name The name this library is identified by in the filesystem.
	 * @param {object} metadata The library descriptor.
	 * @param {FileSystemLibraryRepo} repo The repository this library is managed by.
	 */
	constructor(name, metadata, repo) {
		super(name, metadata, repo);
	}
}

export class NamingStrategy {

	/**
	 * Generates a filesystem safe name for a library.
	 * @param {object} metadata The library metadata to generate a name for.
	 * @return {string} An identifier for this library, derived from the library metadata.
	 * @abstract
	 */
	toName(metadata) {}

	nameToFilesystem(name) {
		return name;
	}

	/**
	 * Fetches all the names for a given repo.
	 * @param {FileSystemLibraryRepo} repo The repo to fetch the names for.
	 * @returns {Promise.<Array<string>>} The logical names of libraries available in this repo.
	 */
	names(repo) {
		const stat = promisify(fs.stat);
		return getdirs(repo.path).then(dirs => {
			const libPromises = dirs.map(dir => {
				const filePath = repo.descriptorFileV2(dir);
				// todo - map directory names back to the library name (if some encoding is used.)
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
	 * Determines if the given name matches the name corresponding to the descriptor.
	 * This allows the strategy to introduce name aliases.
	 * @param {object} descriptor The library metadata to check.
	 * @param {string} name The library identifier to check.
	 * @returns {boolean} true if the name matches the descriptor.
	 */
	matchesName(descriptor, name) {
		return this.toName(descriptor)===name;
	}
}

class LibraryNameStrategy extends NamingStrategy {
	toName(library) {
		return library.name;
	}
}

class LibraryNameAtVersionStrategy extends NamingStrategy {
	toName(library) {
		return `${library.name}@${library.version}`;
	}
}

class LibraryDirectStrategy extends NamingStrategy {

	toName(library) {
		return library.name;
	}

	/**
	 * Library stored in the root of the repo, so all names map to ''.
	 * @param {string} name The name of the library, as previously provided by `toName`.
	 * @returns {string} The filesystem name of the corresponding logical library name.
	 *
	 */
	nameToFilesystem(name) {
		return '';
	}

	matchesName(descriptor, name) {
		return name==='' ? true : super.matchesName(descriptor, name);
	}

	/**
	 * @param {FileSystemLibraryRepo} repo The repo to use that provides the library descriptors.
	 * @returns {Promise<Array<string>>} A list of the library names in the repo.
	 */
	names(repo) {
		const filename = repo.descriptorFileV2('');
		return repo.fileStat(filename)
			.then((stat) => {
				if (stat && stat.isFile()) {
					return repo.readDescriptorV2('', filename)
						.then(descriptor => [this.toName(descriptor)]);
				}
				return [];
			});
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

export const sparkDotJson = 'spark.json';
const firmwareDir = 'firmware';
const examplesDir = 'examples';
const testDir = 'test';
const unitDir = 'unit';
const srcDir = 'src';

export const FileSystemNamingStrategy = {
	BY_NAME: new LibraryNameStrategy(),
	BY_NAME_AT_VERSION: new LibraryNameAtVersionStrategy(),
	DIRECT: new LibraryDirectStrategy()
};

/**
 * A library repository that retrieves and stores libraries in a file system directory.
 * The repo has a root directory, and uses a naming strategy is used to determine how libraries are
 * stored under that directory.
 */
export class FileSystemLibraryRepository extends AbstractLibraryRepository {

	/**
	 * Creates a new FileSystemLibraryRepository instance.
	 * @param {string} path The location of the file system repository. The contained
	 * libraries are stored as subdirectories under the repo root.
	 * @param {NamingStrategy} namingStrategy The strategy that maps library metadata to an identifying name,
	 * and maps that name to the filesystem.
	 */
	constructor(path, namingStrategy) {
		super();
		if (!namingStrategy) {
			namingStrategy = FileSystemNamingStrategy.BY_NAME;
		}

		if (!path.endsWith('/')) {
			path += '/';
		}
		this.path = path;
		this.namingStrategy = namingStrategy;
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

	nameFor(library) {
		return this.namingStrategy.toName(library.metadata);
	}

	/**
	 * Determines the location of a library file in the filesystem.
	 * @param {string} libraryName the identifier for a library, as provided by the strategy.
	 * @param {string} fileName the filename of a logical file in the library
	 * @param {string} fileExt the extension of a logical file in the library
	 * @returns {string} The location in the filesystem of the file corresponding to the
	 * library file.
	 */
	libraryFileName(libraryName, fileName, fileExt) {
		return this.libraryDirectory(libraryName) + fileName + '.' + fileExt;
	}

	/**
	 * Copy a given file to this library.
	 * @param {string} libraryName the target library name (according to the naming strategy.)
	 * @param {LibraryFile} libraryFile   The library file to copy to the target library.
	 * @return {Promise} to copy the library file.
	 */
	copyLibraryFile(libraryName, libraryFile) {
		return Promise.resolve().then(() => {
			const fileName = this.libraryFileName(libraryName, libraryFile.name, libraryFile.extension);
			const dir = path.dirname(fileName);
			this.createDirectory(dir);
			const outputStream = fs.createWriteStream(fileName);
			libraryFile.content(outputStream);
		});
	}

	createDirectory(dir) {
		if (!fs.existsSync(dir)) {
			const parent = path.normalize(path.join(dir, '..'));
			this.createDirectory(parent);
			fs.mkdirSync(dir);
		}
	}


	/**
	 * Determines if a library file should be persisted. Only source files are persisted.
	 * @param {LibraryFile} libraryFile The file to be checked.
	 * @returns {boolean} true if the library should be persisted.
	 */
	includeLibraryFile(libraryFile) {
		return libraryFile.kind === 'source';
	}

	/**
	 * Adds a library to this repo. The descriptor and source files are written out. Example files are presently
	 * not included.
	 * @param {Library} library The library to add.
	 * @param {Number} layout   The layout version to use. 1 means legacy v1 (with firmware directory), 2 means library v2.
     * @return {Promise} promise to create the library.
	 */
	add(library, layout=2) {
		const name = this.nameFor(library);
		if (this.namingStrategy.nameToFilesystem(name)==='') {
			return Promise.reject(new LibraryRepositoryError(this, 'repo is not writable'));
		}

		const mkdir = promisify(fs.mkdir);
		return Promise.resolve()
			.then(() => mkdir(this.libraryDirectory(name)))
			.then(() => library.definition())
			.then(definition => {
				if (layout===1) {
					return this.writeDescriptorV1(this.descriptorFileV1(name), definition);
				} else {
					return this.writeDescriptorV2(this.descriptorFileV2(name), definition);
				}
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

	/**
	 * Writes the library v1 descriptor to file.
	 * @param {string} toFile The file to write to
	 * @param {object} metadata The library metadata
	 * @returns {*} Promise to write the descriptor to `toFile`.
	 */
	writeDescriptorV1(toFile, metadata) {
		const writeFile = promisify(fs.writeFile);
		const m = this.removeId(metadata);
		const content = JSON.stringify(m);
		return writeFile(toFile, content);
	}

	buildV2Descriptor(metadata) {
		let content = [];
		function addProperty(target, value, name) {
			if (value!==undefined) {
				content.push(`${name}=${value}\n`);
			}
		}

		addProperty(content, metadata.name, 'name');
		addProperty(content, metadata.version, 'version');
		addProperty(content, metadata.license, 'license');
		addProperty(content, metadata.author, 'author');
		addProperty(content, metadata.description, 'sentence');
		return content.join('');
	}

	writeDescriptorV2(toFile, metadata) {
		const writeFile = promisify(fs.writeFile);
		const content = this.buildV2Descriptor(metadata);
		this.prepareDescriptorV2(metadata);
		return writeFile(toFile, content);
	}

	prepareDescriptorV2(metadata) {
		if (!metadata.sentence && metadata.description) {
			metadata.sentence = metadata.description;
		}
		return metadata;
	}

	/**
	 * Fetches a library from the repo.
	 * @param {string} libraryIdentifier The filesystem identifier of the library to fetch,
	 * typically derived from one of the values returned by `names()`.
	 * @return {FileSystemLibrary} the library found.
	 *
	 * With the DIRECT strategy, a name of `` can be used to refer to the library at the
	 * filesystem root.
	 */
	fetch(libraryIdentifier) {
		// determine the real name used in the filesystem for a given library ID
		// (e.g. this allows the DIRECT strategy to map all names to '', since it supports
		// only one library in the root.)
		const name = this.namingStrategy.nameToFilesystem(libraryIdentifier);
		const filePath = this.descriptorFileV2(name);
		return this.readDescriptorV2(libraryIdentifier, filePath)
			.then((descriptor) => {
				// get the real name (the libraryIdentifier could be an alias.)
				libraryIdentifier = this.namingStrategy.toName(descriptor);
				return descriptor;
			})
			.then(descriptor => this._createLibrary(libraryIdentifier, descriptor))
			.catch(error => {
				throw new LibraryNotFoundError(this, name, error);
			});
	}

	readDescriptorV2(name, path) {
		const parse = promisify(properties.read);
		return parse(path)
			.then(props => {
				if (!this.namingStrategy.matchesName(props,name)) {
					throw new LibraryFormatError(this, name, 'name in descriptor does not match directory name');
				}
				if (props.sentence!==undefined) {
					props.description = props.sentence;
				}
				return props;
			});
	}

	/**
	 * Determines the location of a named directory within the filesystem space owned
	 * by this repo.
	 * @param {string} name a valid filename, not including a final path separator.
	 * @returns {string} The full path of the directory.
	 */
	directory(name) {
		return name ? this.path + name + '/' : this.path;
	}

	/**
	 * Determines the directory where a library using the given name (from the naming strategy) is located.
	 * @param {string} name The identifier of the library in the filesystem.
	 * @return {string} The directory in the filesystem corresponding to the library identifier.
	 */
	libraryDirectory(name) {
		return this.directory(this.namingStrategy.nameToFilesystem(name));
	}

	/**
	 * Determine the file that contains the library descriptor.
	 * @param {string} name The library name
	 * @returns {string}    The file path of the library descriptor for the named library.
	 */
	descriptorFileV1(name) {
		return this.libraryDirectory(name) + sparkDotJson;
	}

	descriptorFileV2(name) {
		return this.libraryDirectory(name) + libraryProperties;
	}

	readDescriptorV1(name, filename) {
		return this.readFileJSON(name, filename);
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
		const result = this.namingStrategy.names(this);
		return result;
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

	/**
	 * Splits the file into its extension and the basename. The extension is given without the leading dot.
	 * @param {string} name  the filename to split
	 * @returns {[ext,basename]}    The extension and the baename
	 */
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
		const libraryDir = this.libraryDirectory(this.nameFor(lib));
		// iterate over all the files and

		return mapActionDir(libraryDir, (...args)=>this.isSourceFile(...args), (include, files) => {
			const filtered = removeFailedPredicate(include, files);
			return this.createLibraryFiles(lib, filtered);
		});
	}

	createLibraryFiles(lib, fileNames) {
		const libraryDir = this.libraryDirectory(this.nameFor(lib));
		const fileBuilders = fileNames.map((fileName) => this.createLibraryFile(libraryDir, fileName));
		return Promise.all(fileBuilders);
	}

	createLibraryFile(libraryDir, fileName) {
		const [extension, baseFile] = this.extension(fileName);
		return Promise.resolve(new FileSystemLibraryFile(libraryDir+fileName, baseFile, 'source', extension));
	}

	/**
	 * Determines the layout of the library on disk.
	 * @param {string} name  The name of the library to check.
	 * @return {Number} 1 for layout version 1 (legacy) or 2 for layout version 2.
	 */
	getLibraryLayout(name) {
		const dir = this.libraryDirectory(this.namingStrategy.nameToFilesystem(name));
		const stat = promisify(fs.stat);
		const notFound = new LibraryNotFoundError(this, name);
		return Promise.resolve()
			.then(() => {
				return stat(dir).then((stat) => {
					return stat.isDirectory();
				});
			})
			.then(exists => {
				if (exists) {
					return stat(path.join(dir, sparkDotJson))
						.then(stat => {
							if (stat.isFile()) {
								return 1;
							}
							throw notFound;
						})
						.catch(() => stat(path.join(dir, libraryProperties)).then(stat => {
							if (stat.isFile()) {
								return 2;
							}
							throw notFound;
						}));
				}
				throw notFound;
			})
			.catch((err) => {
				throw notFound;     // todo - swallow the error? hmmm...
			});
	}

	mkdirIfNeeded(dir) {
		return promisify(fs.mkdir)(dir).catch(err => {
			// I tried using stat to check if the directory exists, but we then
			// end up with many checks queued first, followed by many calls to
			// mkdir, which would then fail. This is the most reliable way, if a bit smelly.
			if (err.code !== 'EEXIST') {
				throw err;  // ignore that it exists, throw other errors.
			}
		});
	}

	fileStat(filename) {
		return promisify(fs.stat)(filename).catch(() => null);
	}

	setLibraryLayout(name, layout) {
		return this.getLibraryLayout(name).then(currentLayout => {
			if (currentLayout!==layout) {                                   // some change needed
				if (layout!==2 || currentLayout!==1) {                      // support only migrate to v2 for now
					throw new LibraryRepositoryError(this, 'the requested library migration is not supported');
				}
				return this.migrateV2(name);
			}
		});
	}

	/**
	 * @param {string} orgName      The name of the library to migrate.
	 * @returns {Promise.<*>}    Promise to migrate the library.
	 * @private

	 migrate to a v2 structure
	 - read spark.json and serialize as library.properties
	 - change description to sentence property
	 - for each .cpp/.ino file in firmware/examples/, create a directory named after the base filename
	 and store the file in there, passing the file through the include fixup filter
	 - if it exists, change the path of firmware/test/* to test/unit/*
	 - change the path of firmware/* to src/*  (i.e. mv firmware src), and for each file fix up the include paths.

	 The copy operation is done in an idempotent manner, copying files to their new locations and then
	 destroying the old files.

	 When migration is complete:
	 - delete firmware recursively
	 - delete spark.json

	 */
	migrateV2(orgName) {
		const fse = require('fs-extra');
		const name = this.namingStrategy.nameToFilesystem(orgName);
		const libdir = this.libraryDirectory(name);
		const v1descriptorFile = this.descriptorFileV1(name, libdir);
		const v2descriptorFile = this.descriptorFileV2(name, libdir);

		const v1test = path.join(libdir, firmwareDir, testDir);
		const v2test = path.join(libdir, testDir, unitDir);
		let includeName;

		return this.readDescriptorV1(orgName, v1descriptorFile).then((v1desc) => {
			includeName = v1desc.name;
			const v2desc = this.migrateDescriptor(v1desc);
			return this.writeDescriptorV2(v2descriptorFile, v2desc);
		})
		.then(() => this.fileStat(v1test).then((stat) => {
			if (stat) {
				return this.mkdirIfNeeded(path.join(libdir, testDir))
					.then(() => promisify(fs.rename)(v1test, v2test));
			}
		}))
		.then(() => this.migrateSources(libdir, includeName))
		.then(() => this.migrateExamples(libdir, includeName))
		.then(() => promisify(fse.remove)(path.join(libdir, firmwareDir)))
		.then(() => promisify(fse.remove)(v1descriptorFile));
	}

	migrateSources(libdir, name) {
		const v1 = path.join(libdir, firmwareDir);
		const v2 = path.join(libdir, srcDir);
		const self = this;
		function mapper(stat, source, path) {
			if (stat.isFile()) {
				return self.migrateSource(name, source, v1, v2);
			}
		}
		return mapActionDir(v1, mapper, (promises) => promises.filter(item => item));
	}

	/**
	 * Migrates a single source file from v1 to v2.
	 * @param {string} lib the name of the library being migrated
	 * @param {string} source the name of the source file
	 * @param {string} v1dir the v1 library sources directory
	 * @param {string} v2dir the v2 library sources directory
	 * @returns {Promise} to migrate the source file
	 */
	migrateSource(lib, source, v1dir, v2dir) {
		return this.mkdirIfNeeded(v2dir)
			.then(() => promisify(fs.readFile)(path.join(v1dir, source))
			.then((v1source) => {
				const v2source = this.migrateSourcecode(v1source.toString('utf-8'), lib);
				const v2file = path.join(v2dir, source);
				return promisify(fs.writeFile)(v2file, v2source);
			}));
	}

	/**
	 * Migrates a single example file into a new directory in the v2 space.
	 * @param {string} lib       The name of the library being migrated - used to migrate include statements.
	 * @param {string} example   The name of the example source file (in the examples folder)
	 * @param {string} v1dir     The directory containing the v1 examples
     * @param {string} v2dir     The directory containing the v2 examples
	 * @returns {Promise}   The promise to create the output example.
	 */
	migrateExample(lib, example, v1dir, v2dir) {
		return this.mkdirIfNeeded(v2dir)
			// read the original example file
		.then(() => promisify(fs.readFile)(path.join(v1dir, example)))
		.then((v1example) => {
			const v2example = this.migrateSourcecode(v1example.toString('utf-8'), lib);
			const basename = this.extension(example)[1];
			const exampledir = path.join(v2dir, basename);
			const examplefile = path.join(exampledir, example);
			return this.mkdirIfNeeded(exampledir)
				.then(() => promisify(fs.writeFile)(examplefile, v2example));
		});
	}

	/**
	 * Migrates the examples directory
	 * @param {string} libdir    The directory containing the lib to migrate
	 * @param {string} name      The name of the lib
	 * @return {Promise} to migrate the examples
	 * @private
	 */
	migrateExamples(libdir, name) {
		const v1 = path.join(libdir, firmwareDir, examplesDir);
		const v2 = path.join(libdir, examplesDir);
		const self = this;
		function mapper(stat, example, path) {
			return self.migrateExample(name, example, v1, v2);
		}

		return this.fileStat(v1).then((stat) => {
			if (stat) {
				mapActionDir(v1, mapper, (promises) => promises);
			}
		});
	}

	/**
	 * Migrates a C++ source file from v1 to v2 format. The include directives for files matching the pattern
	 * #include "libname/rest/of/path" are changed to just #include "rest/of/path" to be compatible with the lib v2
	 * layout.
	 *
	 * @param {string} source The source code to migrate.
	 * @param {string} libname  The name of the library to migrate.
	 * @returns {string} The transformed source code.
	 */
	migrateSourcecode(source, libname) {
		const find = new RegExp(`(#include\\s+['"])${libname}[\\/\\\\]`, 'g');
		return source.replace(find, (match, inc) => {
			return inc;
		});
	}

	migrateDescriptor(desc) {
		// for now there's nothing to do.
		return desc;
	}

}

// keep all branches  of the ES6 transpilled code executed
export default () => {};

