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

import { LibraryNotFoundError, LibraryRepositoryError } from './librepo';
import VError from 'verror';
import { LibraryContributor } from './libcontribute';
const fs = require('fs');
const path = require('path');
const promisify = require('es6-promisify');
const properties = require('properties-parser');

import { AbstractLibraryRepository, AbstractLibrary, LibraryFile, LibraryFormatError } from './librepo';

/**
 *
 * @param {string} rootDir               The directory to scan, map and action.
 * @param {function} mapper       Called with (stat,file,filePath) for each item in the directory.
 * @param {function} action         Called with actionables from the mapper function.
 * @returns {Promise} promise that returns an array of items returned from invoking the mapper and action for each
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
	 * Generates a filesystem-safe name for a library.
	 * @param {object} metadata The library metadata to generate a name for.
	 * @return {string} An identifier for this library, derived from the library metadata.
	 * @abstract
	 */
	toName(metadata) {
		throw new Error('not implemented');
	}

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
	 * @param {string} repoPath The location of the file system repository. The contained
	 * libraries are stored as subdirectories under the repo root.
	 * @param {NamingStrategy} namingStrategy The strategy that maps library metadata to an identifying name,
	 * and maps that name to the filesystem.
	 */
	constructor(repoPath, namingStrategy) {
		super();
		if (!namingStrategy) {
			namingStrategy = FileSystemNamingStrategy.BY_NAME;
		}

		if (!repoPath.endsWith(path.sep)) {
			repoPath += path.sep;
		}
		this.path = repoPath;
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
		return this.libraryDirectory(libraryName) + fileName + (fileExt ? '.' + fileExt : '');
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
		return libraryFile.kind === 'source' ||
				libraryFile.kind === 'header';
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

	buildV2Descriptor(metadata, withComments) {
		let content = [];
		function addProperty(target, value, name, comment) {
			if (value!==undefined) {
				content.push(`${name}=${value}\n`);
			} else if (withComments) {
				content.push(`# ${name}=${comment}\n`);
			}
		}

		addProperty(content, metadata.name, 'name', 'the name of this library');
		addProperty(content, metadata.version, 'version', 'the current version of this library');
		addProperty(content, metadata.license, 'license', 'insert your choice of license here');
		addProperty(content, metadata.author, 'author', 'library author, e.g. name + email address');
		addProperty(content, metadata.description, 'sentence', 'one sentence description of this library');
		addProperty(content, metadata.paragraph, 'paragraph', 'a longer description of this library, always prepended with sentence when shown');
		addProperty(content, metadata.url, 'url', 'the url for the project');
		addProperty(content, metadata.repository, 'repository', 'git repository for the project, like https://github.com/mygithub_user/my_repo.git');
		addProperty(content, metadata.architectures && metadata.architectures.join(','), 'architectures', 'a list of supported boards if this library is hardware dependent, like particle-photon,particle-electron');
		return content.join('');
	}

	writeDescriptorV2(toFile, metadata, withComments) {
		const writeFile = promisify(fs.writeFile);
		this.prepareDescriptorV2(metadata);
		const content = this.buildV2Descriptor(metadata, withComments);
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

	readDescriptorV2(name, repoPath) {
		const parse = promisify(properties.read);
		return parse(repoPath)
			.then(props => {
				if (!this.namingStrategy.matchesName(props,name)) {
					throw new LibraryFormatError(this, name, 'name in descriptor does not match directory name');
				}
				if (props.sentence!==undefined) {
					props.description = props.sentence;
				}
				if (props.architectures) {
					props.architectures = props.architectures.split(',');
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
		return name ? this.path + name + path.sep : this.path;
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
			.then(json => this._parseJSON(json))
			.catch(error => {
				throw new LibraryFormatError(this, name, new VError(error, 'error parsing "%s"', filename));
			});
	}

	_parseJSON(json) {
		return JSON.parse(json);
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
		const notFound = (error) => error!==undefined ? new LibraryNotFoundError(this, name, error) : new LibraryNotFoundError(this, name);
		return Promise.resolve()
			.then(() => {
				return stat(dir).then((stat) => {
					return stat.isDirectory();
				}).catch(err => {
					throw notFound(err);
				});
			})
			.then(exists => {
				if (exists) {
					return stat(path.join(dir, sparkDotJson))
						.then(stat => {
							if (stat.isFile()) {
								return 1;
							}
							throw notFound();
						})
						.catch(() => stat(path.join(dir, libraryProperties))
							.catch (err => {
								throw notFound(err);
							})
							.then(stat => {
								if (stat.isFile()) {
									return 2;
								}
								throw notFound();
							})
						);
				}
				throw notFound();
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
			return this.writeDescriptorV2(v2descriptorFile, v2desc, true);
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
		function mapper(stat, source, filePath) {
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
		function mapper(stat, example, filePath) {
			if (stat.isFile()) {
				return self.migrateExample(name, example, path.dirname(filePath), v2);
			} else {
				return mapActionDir(filePath, mapper, (promises) => promises);
			}
		}

		return this.fileStat(v1).then((stat) => {
			if (stat) {
				mapActionDir(v1, mapper, (promises) => promises);
			}
		});
	}

	escapeRegExp(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
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
		const libnameEscape = this.escapeRegExp(libname);
		const find = new RegExp(`(#include\\s+['"])${libnameEscape}[\\/\\\\]`, 'g');
		return source.replace(find, (match, inc) => {
			return inc;
		});
	}

	migrateDescriptor(desc) {
		if (desc.architectures) {
			desc.architectures = desc.architectures.split(',');
		}
		return desc;
	}

	_requireV2Format(libname) {
		return new LibraryRepositoryError(this, 'the library should be in v2 format before adapters can be added.');
	}

	_targetDirectoryDoesNotExist(dir) {
		new LibraryRepositoryError(this, `The target directory ${dir} does not exist.`);
	}

	addAdapters(callback, libname, dir) {
		return this.getLibraryLayout(libname)
			.then((layout) => {
				if (layout!==2) {
					throw this._requireV2Format(libname);
				}
				return this.fileStat(dir);
			})
			.then(stat => {
				if (stat===null || !stat.isDirectory()) {
					throw this._targetDirectoryDoesNotExist(dir);
				}
				return this._addAdapters(callback, libname, dir);
			});
	}

	/**
	 * Creates files in the given directory that allow the old libname/libname.h include notation
	 * to be used.
	 * @param {function} callback receives notification of the current progress.
	 * @param {string} libname  The library name/identifier. This is used with the naming scheme
	 * to determine the library directory in the file system.
	 * @param {string} dir the directory in the include path that the files should be copied to. if
	 * not defined, the files are copied to the library sources.
	 * @returns {Promise} to create the adapter header files.
	 */
	_addAdapters(callback, libname, dir) {
		const name = this.namingStrategy.nameToFilesystem(libname);
		const libdir = this.libraryDirectory(name);
		return this.fetch(libname)
			.then(lib => {
				const libsrcdir = path.join(libdir, 'src');
				const targetdir = path.join(dir, lib.name);
				return this._addAdaptersImpl(callback, targetdir, libsrcdir);
			});
	}

	isHeaderFile(name) {
		const headers = ['h', 'hxx', 'hpp', 'h++'];
		return headers.includes(this.extension(name)[0]);
	}

	/**
	 * Recursively adds adapter header files from the given source directoyr into the given target directory.
	 * @param {function} callback   Notification of header file creation and recursion. (Currently unused.)
	 * @param {string} targetdir The directory the header files are created in
	 * @param {string} srcdir    The directory containing the existing header files
	 * @param {Array<string>} ignore    The current working list of source directories to not copy
	 * @returns {undefined} nothing
	 * @private
	 */
	_addAdaptersImpl(callback, targetdir, srcdir, ignore = [targetdir]) {
		const self = this;
		if (!ignore.includes(srcdir)) {
			ignore.push(targetdir);
			const writeFile = promisify(fs.writeFile);
			const relative = path.relative(targetdir, srcdir);
			const handleFile = (stat, file, filePath) => {
				if (stat.isDirectory()) {
					return self._addAdaptersImpl(callback, path.join(targetdir, file), path.join(srcdir, file), ignore);
				} else {
					if (stat.isFile() && self.isHeaderFile(file)) {
						return self.mkdirIfNeeded(targetdir).then(() => writeFile(path.join(targetdir, file), `#include "${relative}/${file}"`));
					} else {
						return false;
					}
				}
			};

			return mapActionDir(srcdir, handleFile, () => {});
		}
	}

	contribute(name, client, dryRun, callback) {
		const pub = new LibraryContributor({ repo: this, client });
		return pub.contribute(callback, name, dryRun);
	}
}


function isLibraryV2(directory) {
	return new FileSystemLibraryRepository(directory, FileSystemNamingStrategy.DIRECT)
		.getLibraryLayout().
		then(layout => layout===2);
}

function normalizeAndSplitPath(p, cwd, absPaths) {
	let abs = path.resolve(cwd, p);
	absPaths.push(abs);
	const stat = fs.statSync(abs);
	if (!stat.isDirectory()) {
		abs = path.dirname(abs);
	}
	const split = abs.split(path.sep);
	return split;
}

function longestArrayCommonPrefix(current, next) {
	if (!current) {
		return next;
	}

	const upper = Math.min(current.length, next.length);
	let i = 0;
	while (i<upper && current[i]===next[i]) {
		i++;
	}
	const prefix = current.slice(0, i);
	return prefix;
}

/**
 * Computes the common prefix of a list of files. Files that are not absolute are made absolute
 * relative to cwd.
 * @param {Array<String>} files the files to find the common prefix of
 * @param {Array<String>} relative optional array that receives the paths relative to the common prefix
 * @param {string} cwd   The directory that relative paths are assumed relative to
 * @return {string} the longest common path prefix
 * If there is no common prefix, the empty string is returned. This can be the case on OSs without
 * a unified filesystem namespace and files are on disjoint paths of the filesystem (e.g. different drives in Windows.)
 *
 * <DANGER: for expediency we are using sync fs functions here. This should only be used
 * from client code: REGNAD>
 */
export function pathsCommonPrefix(files, relative=undefined, cwd=process.cwd()) {

	let result = '';
	if (files.length) {
		let longest;
		const absFiles = [];
		for (let file of files) {
			const split = normalizeAndSplitPath(file, cwd, absFiles);
			longest = longestArrayCommonPrefix(longest, split);
		}

		result = longest.join(path.sep);
		if (relative) {
			for (let file of absFiles) {
				relative.push(path.relative(result, file));
			}
		}
	}
	return result;
}


/**
 * This computes a mapping between 2 namespaces:
 * - the files as they really exist in the file system (the library v2 format)
 * - the project structure required by the compiler service to build the project.
 *
 * The original namespace is represented by the data members, basePath, libraryPath and example,
 * with libraryPath and example relative to basePath.
 */
class LibraryExample {
	/**
	 * The paths are either absolute or relative to basePath
	 * @param {string} basePath         The relative directory for all other paths
	 * @param {string} libraryPath      The library path relative to the base path
	 * @param {string} example          The example path relative to the base path
	 */
	constructor({ basePath, libraryPath, example }) {
		Object.assign(this, { basePath, libraryPath, example });
	}

	/**
	 *
	 * @param {Object} files `list` - the actual filenames to send, `alias` the filenames as seen by the user, maps each
	 *  index to the corresponding file in `list`, `map`. `baseDir` the root directory relative to the filenames in `list`.
	 * @returns {Promise} to build the file mapping
	 *
	 * The library directory is assumed to be the common parent and this is made the base directory.
	 *
	 */
	buildFiles(files) {
		// the physical location of files is what is shown in error messages so that they are consistent from the
		// user's working directory
		// The target namespace moves the library.properties into the root as project.properties
		files.list = [];
		files.map = {};
		files.basePath = this.basePath;
		const srcDirectory = this._asDirectory('src');
		const libDirectory = this._asDirectory('lib');

		return Promise.all([
			// add the example file, or the contents of the example directory to 'src' in the target
			this._addFiles(files, this.example, srcDirectory),

			// rename the library to project files
			this._addFiles(files, path.join(this.libraryPath, 'library.properties'), 'project.properties'),

			// copy the library sources into src (potential name-clash with example sources?)
			this._addFiles(files, path.join(this.libraryPath, srcDirectory), srcDirectory, false),
			this._addFiles(files, path.join(this.libraryPath, libDirectory), libDirectory, false)
		]);
	}

	_asDirectory(p) {
		return this._isFile(p) ? p + path.sep : p;
	}

	/**
	 * Adds a mapping. The mapping is from the target file to the source file - that is, the mapping shows all files in the
	 * target project, and the corresponding source files where the content can be obtained from.
	 * @param {Object} files the file mapping object with a `map` property and `basePath` for defining the logical namespace.
	 * @param {String} source The source file relative to `this.basePath`
	 * @param {String} target The target file relative to `files.basePath` (the target namespace)
	 * @returns {undefined} nothing
	 * @private
	 */
	_addFileMapping(files, source, target) {
		// given a target file, retrieve the physical file where it lives, relative to this.basePath
		files.map[target] = source;
	}

	/**
	 * Adds all the files under the given directory to a mapping recursively.
	 * @param {Object} files     The structure to populate. It is updated by calling `_addFileMapping` for each file added.
	 * @param {string} source  The path of the files to copy - this part of the path is not featured in the destination path
	 * @param {string} destination The path of the destination.
	 * @param {string} subdir   The current recursion point below the source folder
	 * @returns {Promise} to add a mapping from all files in the source directory to the destination directory
	 * @private
	 */
	_addDirectory(files, source, destination, subdir='') {
		function mapper(stat, file, filePath) {
			const traversePath = path.join(subdir, file);
			const sourcePath = path.join(source, traversePath);             // the path to the source file
			const destinationPath = path.join(destination, traversePath);   // the path to the destination file
			if (stat.isDirectory()) {
				// recurse
				return this._addDirectory(files, source, destination, traversePath);
			} else {
				// add the file - todo should this filter out files like the CLI does?
				this._addFileMapping(files, sourcePath, destinationPath);
			}
		}
		const directory = path.resolve(path.join(files.basePath, source, subdir));
		return mapActionDir(directory, mapper.bind(this), () => {});
	}

	/**
	 * Adds files to the file mappings. Directories are indicated by ending with a trailing slash.
	 * @param {Files} files     The object that holds the mappings. `basePath` defies the root for the files
	 * @param {String} source    The source file or directory, relative to `files.basePath` If it is a file, the file is copied to the destination.
	 *  If it is a directory, the directory path is not part of the destination name, only files and subdirectories
	 *  under the directory are mapped to the destination path.
	 * @param {String} destination   The destination path relative to the target filesystem.
	 * @param {boolean} mandatory   When `false` silently returns when the source does not exist
	 * @returns {Promise} to add the files to the `files` mapping
	 * @private
	 */
	_addFiles(files, source, destination, mandatory=true) {
		const destinationFile = this._isFile(destination);

		const stat = promisify(fs.stat);

		let promise = stat(path.join(this.basePath, source)).then((stat) => {
			const sourceFile = stat.isFile();
			// if the source is a file, and the target a directory, compute the full target path.
			if (sourceFile) {
				if (!destinationFile) {
					destination = path.join(destination, source);
				}
				this._addFileMapping(files, source, destination);
			} else {
				// assume destination is a directory, since copying a source directory to a file
				// makes little sense here.
				return this._addDirectory(files, source, destination);
			}
		});

		if (!mandatory) {
			// chomp chomp
			promise = promise.catch(error => 0);
		}
		return promise;
	}

	_isFile(p) {
		return !p.endsWith(path.sep);
	}
}


/**
 * Determines if the file represents a library example, and returns a `LibraryExample` instance if it is.
 * @param {String} file The name of the example file or example directory
 * @param {String} cwd The path that `file` is relative to.
 * @returns {*} a falsey value if it is not an example in a v2 library.
 *  otherwise returns a LibraryExample instance.
 */
export function isLibraryExample(file, cwd=process.cwd()) {
	const stat = promisify(fs.stat);
	// the directory containing the example
	const examplePath = path.resolve(cwd, file);
	return stat(examplePath)
		.then(stat => {
			const directory = (stat.isDirectory()) ? examplePath : path.resolve(examplePath, '..');
			// the examples directory
			const examplesDirectory = path.resolve(directory, '..');
			// the library directory
			const libraryDirectory = path.resolve(examplesDirectory, '..');
			// `/examples`
			const examplesSingleDir = path.sep+examplesDir;
			// todo - case insensitive comparison on file systems that are case insensitive?
			let isExample = examplesDirectory.endsWith(examplesSingleDir);
			isExample = isExample && isLibraryV2(libraryDirectory).
				then((isV2) => {
					if (isV2) {
						return new LibraryExample({
							basePath: cwd,
							libraryPath: path.relative(cwd, libraryDirectory),
							example: file + (stat.isDirectory() ? path.sep : '')
						});
					}
				});
			return isExample;
		});
}


// keep all branches  of the ES6 transpilled code executed
/* istanbul ignore next: not executed on node 7 */
export default () => {};

