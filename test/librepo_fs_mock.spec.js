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

import { expect, sinon } from './test-setup';
import concat from 'concat-stream';
import { AbstractLibrary } from '../src/librepo';
const promisify = require('es6-promisify');
const fs = require('fs');
const path = require('path');

import { FileSystemNamingStrategy, FileSystemLibraryRepository, getdirs, libraryProperties, sparkDotJson, isLibraryExample, pathsCommonPrefix } from '../src/librepo_fs';
import { LibraryFormatError, LibraryNotFoundError, MemoryLibraryFile } from '../src/librepo';
import VError from 'verror';


const libFileContents = { 'h': '// a header file', cpp:'// a cpp file' };

function makeFsError(code, errno, msg) {
	const err = new Error();
	err.errno = errno;
	err.code = code;
	err.message = msg;
	return err;
}

/**
 * Creates a mock filesystem structure for a library.
 * @param {String} name The name of the library.
 * @param {Boolean} metadata Adds the library properties file when true.
 * @returns {Object} representing the mock file system.
 */
function makeFsLib(name, metadata=true) {
	let result = {};
	result[`${name}.h`] = '// a header file';
	result[`${name}.cpp`] = '// a cpp file';
	if (metadata) {
		result[libraryProperties] = `name=${name}\nversion=1.2.3\n`;
	}
	return result;
}

const libFS = {
	'mydir' : {
		'lib1' : makeFsLib('lib1'),
		'yaya' : makeFsLib('yaya'),
		'zzz'  : makeFsLib('zzz', false),
		'hello.txt' : 'hello.txt',
		'.profile' : { '.secret' : 'sssh!' }
	}
};

const libData = {
	'lib1' : { lib: true },
	'yaya' : { lib: true },
	'zzz' : { lib: false },
	'hello.txt' : { lib: false },
	'.profile' : { lib: false }
};

function makeLibrary(name, definition, files) {
	const lib = {
		name: name,
		metadata: definition,
		files: function resolveFile() {
			return Promise.resolve(files);
		},
		definition: function resolveDefinition() {
			return Promise.resolve(definition);
		}
	};
	return lib;
}

function fetchContent(libraryFile) {
	return new Promise((resolve) => {
		const concat = require('concat-stream');
		const store = concat(resolve);
		libraryFile.content(store);
	});
}

function sourcesOnly(files) {
	return files.filter((file) => file.kind==='source');
}

function libsFilesEqual(expected, actual) {
	return Promise.all([expected, actual]).then((results) => {
		let [expectedFiles, actualFiles] = results;
		expectedFiles = sourcesOnly(expectedFiles);
		actualFiles = sourcesOnly(actualFiles);
		expect(actualFiles.length).to.equal(expectedFiles.length);
		const contentsSame = [];

		for (let i=0; i<actualFiles.length; i++) {
			const expectedFile = expectedFiles[i];
			const actualFile = actualFiles[i];

			expect(actualFile.name).to.be.equal(expectedFile.name);
			expect(actualFile.kind).to.be.equal(expectedFile.kind);
			expect(actualFile.extension).to.be.equal(expectedFile.extension);

			const checkContents = Promise.all([
				fetchContent(expectedFile),
				fetchContent(actualFile)
			]).then((contents) => {
				const [expectedContent, actualContent] = contents;
				expect(actualContent.toString()).to.be.equal(expectedContent.toString());
			});
			contentsSame.push(checkContents);
		}

		return Promise.all(contentsSame);
	});
}

function libDefinitionsEqual(expected, actual) {
	return Promise.all([expected,actual]).then((defs) => {
		const [expectedDefinition, actualDefinition] = defs;
		expect(actualDefinition).to.be.deep.equal(expectedDefinition);
	});
}

function libsEqual(expected, actual) {
	expect(actual.name).to.be.equal(expected.name);
	return Promise.all([
		libsFilesEqual(expected.files(), actual.files()),
		libDefinitionsEqual(expected.definition(), actual.definition())
	]);
}

/**
 * Validates the contents of a directory in the filesystem contains the files given by the spec. The filesytem may
 * contain additional files, beyond what is in the expected spec. These aren't tested.
 * @param {string} path The location in the file system containing the directory structure.
 * @param {object} expected The File system structure. The property name is the file system item - strings represent files,
 * objects represent subdirectories.
 * @return {Promise} promise will check the file system
 */
function checkFileSystem(path, expected) {
	const checks = [];
	for (let [key, value] of Object.entries(expected)) {
		let fun;
		let promises = [];
		if (typeof value == 'string') {
			fun = () => {
				const readFile = promisify(fs.readFile);
				return readFile(path+'/'+key).then((contents) => {
					expect(contents.toString()).to.be.equal(value);
				});
			};
		} else {
			fun = () => {
				const stat = promisify(fs.stat);
				return stat(path+'/'+key).then((stat) => {
					expect(stat.isDirectory()).to.be.true;
				});
			};
			// check that the directory exists in the filesystem
			promises = checkFileSystem(path+'/'+key, value);
		}
		// ensure the directory is checked first before checking subcontents
		checks.push(Promise.resolve().then(fun));
		checks.concat(promises);
	}
	return checks;
}

/**
 * Does a white-box test of the files created for a library, since that is part of the externally
 * visible contact.
 * @param {Library} lib       The library to verify
 * @param {string} root      The root directory.
 * @return {Promise} which resolves to success
 */
function libFiles(lib, root) {
	const name = lib.name;
	const path = root+'/'+name;
	// the spec for the lib.
	const expected = makeFsLib(name);

	return Promise.all(checkFileSystem(path, expected));
}

export function makeTestLib(name, version) {
	const lib = makeLibrary(name, { name, version }, [
		new MemoryLibraryFile(name, 'source', 'cpp', '// a cpp file', 1),
		new MemoryLibraryFile(name, 'source', 'h', '// a header file', 2),
		new MemoryLibraryFile(name, 'example', 'ino', '// some content ino', 3)
	]);
	return lib;
}


export function makeCompleteV2Lib(name, version, extraFiles=[]) {
	const lib = makeLibrary(name, { name, version }, [
		new MemoryLibraryFile('src/'+name, 'source', 'cpp', '// a cpp file', 1),
		new MemoryLibraryFile('src/'+name, 'source', 'h', '// a header file', 2),
		new MemoryLibraryFile('README', 'source', 'md', '# readme', 3),
		new MemoryLibraryFile('LICENSE', 'source', '', '# license', 4),
	].concat(extraFiles));
	return lib;
}


/*
function mock(...args) {
	const mockfs = require('mock-fs');
	mock.restore = mockfs.restore;
	return mockfs(...args);
}
*/
describe('File System Mock', () => {

	function mkdir(name) {
		if (!fs.existsSync(name)) {
			fs.mkdirSync(name);
		}
	}

	function mkdirp(name) {
		const parent = path.dirname(name);
		if (parent && parent!=='/') {
			mkdirp(parent);
		}
		mkdir(name);
	}

	const mock = require('mock-fs');

	beforeEach(done => {
		mock(libFS);
		done();
	});

	afterEach(done => {
		mock.restore();
		done();
	});

	describe('getdirs', () => {
		it('lists correct subdirectories', () => {
			return getdirs('mydir/').then(dirs => {
				expect(dirs).to.contain('lib1');
				expect(dirs).to.contain('yaya');
				expect(dirs).to.contain('zzz');
				expect(dirs).to.not.contain('hello.txt');
				expect(dirs).to.not.contain('.profile2');
			});
		});
	});

	describe('Library Repository', () => {      // eslint-disable-line max-statements
		it('constructor adds trailing slash when missing', () => {
			const dir = '';
			const sut = new FileSystemLibraryRepository(dir);
			expect(sut.path).to.be.equal('/');
		});

		it('constructor does not add a trailing slash when already present', () => {
			const dir = '/';
			const sut = new FileSystemLibraryRepository(dir);
			expect(sut.path).to.be.equal('/');
		});

		it('appends a directory with a trailing slash', () => {
			const dir = '/';
			const sut = new FileSystemLibraryRepository(dir);
			expect(sut.directory('abc')).to.be.equal('/abc/');
		});

		it('doesn\'t append a slash if the directory is empty', () => {
			const dir = '/123/';
			const sut = new FileSystemLibraryRepository(dir);
			expect(sut.directory('')).to.be.equal('/123/');
		});


		it('nameToFs is currently a no-op', () => {
			const sut = new FileSystemLibraryRepository('');
			const name = 'abc$§/0\0';
			expect(sut.nameToFs(name)).to.equal(name);
		});

		it('extension splits filename at a dot when present', () => {
			const sut = new FileSystemLibraryRepository('');
			const result = sut.extension('abc.txt');
			expect(result[1]).to.equal('abc');
			expect(result[0]).to.equal('txt');
		});

		it('extension returns basename when dot not present', () => {
			const sut = new FileSystemLibraryRepository('');
			const result = sut.extension('abc');
			expect(result[1]).to.equal('abc');
			expect(result[0]).to.equal('');
		});

		it('extension returns empty extension with dot in last position', () => {
			const sut = new FileSystemLibraryRepository('');
			const result = sut.extension('abc.');
			expect(result[1]).to.equal('abc');
			expect(result[0]).to.equal('');
		});


		it('can list exising libraries', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			const promise = sut.names().then(names => {
				expect(names).to.contain('lib1');
				expect(names).to.contain('yaya');
				expect(names).to.not.contain('zzz');
			});
			return promise;
		});

		it('can fetch a single library directly, named implicitly', () => {
			const sut = new FileSystemLibraryRepository('mydir/lib1', FileSystemNamingStrategy.DIRECT);
			return expect(sut.fetch('')).to.eventually.be.ok;
		});

		describe('can fetch libraries by name', () => {
			for (let [name,data] of Object.entries(libData)) {
				it(`can fetch library '${name}' by name`, () => {
					const sut = new FileSystemLibraryRepository('mydir');
					const promiseLib = sut.fetch(name);
					expect(promiseLib).to.be.ok;
					if (data.lib) {
						return promiseLib.then((lib) => {
							expect(lib).has.property('name').that.is.equal(name);
							return lib.files().then((files) => {
								expect(files.length).to.be.equal(2);
								const checkContents = [];
								for (let file of files) {
									expect(file.name).to.be.equal(name);
									expect(file.extension).to.be.oneOf(['cpp', 'h']);
									// verify contents
									const expectedContents = libFileContents[file.extension];
									checkContents.push(new Promise((resolve)=> {
										const store = concat((content) => {
											expect(content.toString()).to.be.equal(expectedContents);
											resolve();
										});
										file.content(store);
									}));
								}
								return Promise.all(checkContents);
							});
						});
					} else {
						return expect(promiseLib).eventually.rejectedWith(/library '.*' not found.*/);
					}
				});
			}
		});

		it('can remove the id property from metadata', () => {
			const md = { name: 'funbuns', 'id': '123' };
			const sut = new FileSystemLibraryRepository('not used');
			expect(sut.removeId(md)).to.be.deep.equal({ name: 'funbuns' });
		});

		it('can fetch a filename from the library anem, file base and file extension', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			expect(sut.libraryFileName('mylib', 'file', 'ext')).to.be.equal('mydir/mylib/file.ext');
		});

		it('can fetch a filename from the library anem, file base and empty extension', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			expect(sut.libraryFileName('mylib', 'file')).to.be.equal('mydir/mylib/file');
		});

		it('can determine source code files', () => {
			const isSourceData = { 'abcd/a.txt':false, '123/a.c': true, 'yaya/a.cpp': true, '../a.properties': false };

			for (let [name,isSource] of Object.entries(isSourceData)) {
				it(`can determine if file '${name}' is source code`, () => {
					const sut = new FileSystemLibraryRepository('mydir');
					expect(sut.isSourceFileName(name)).to.be.equal(isSource);
				});
			}
		});

		it('can add a library', () => {
			const name = 'belgianblondeguzzler';
			const sut = new FileSystemLibraryRepository('mydir');
			const lib = makeTestLib(name, '1.2.3');
			const result = sut.add(lib)
				.then(() => sut.fetch(name))
				.then((fetched) => {
					return Promise.all([
						libsEqual(lib, fetched),
						libFiles(lib, 'mydir')
					]);
				}
			);

			return result;
		});


		const desc = 'name=abcd\n' +
			'version=1.2.3\n' +
			'license=dummy\n' +
			'author=Mr Big\n' +
			'sentence=Fixes the world\n' +
			'architectures=avr,particle-photon,spark-core\n' +
			'dot.notation=supported';

		function checkProps(desc) {
			expect(desc.name).to.be.equal('abcd');
			expect(desc.version).to.be.equal('1.2.3');
			expect(desc.license).to.be.equal('dummy');
			expect(desc.author).to.be.equal('Mr Big');
			expect(desc.description).to.be.equal('Fixes the world');
			expect(desc.architectures).to.be.eql(['avr', 'particle-photon', 'spark-core']);
			//expect(desc['dot']).to.equal({notation:'supported'});
			expect(desc['dot.notation']).to.equal('supported');
		}

		it('can read a v2 descriptor', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			const path = 'mydir/test.propertes';
			fs.writeFileSync(path, desc);
			return sut.readDescriptorV2('abcd', path).then(checkProps);
		});

		it('prepares v2 descriptor and doesn\'t modify an existing sentence property', () => {
			const desc = { sentence: 'abc', description: 'def' };
			const sut = new FileSystemLibraryRepository('mydir');
			expect(sut.prepareDescriptorV2(desc)).to.be.deep.equal({ sentence: 'abc', description: 'def' });
		});

		it('prepares v2 descriptor by setting the sentence property if not defined', () => {
			const desc = { description: 'def' };
			const sut = new FileSystemLibraryRepository('mydir');
			expect(sut.prepareDescriptorV2(desc)).to.be.deep.equal({ sentence: 'def', description: 'def' });
		});


		it('fails to read a v2 descriptor when the name doesn\'t match', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			const path = 'mydir/test.propertes';
			fs.writeFileSync(path, desc);
			return expect(sut.readDescriptorV2('noname', path))
				.eventually.be.rejected.and.deep.equal(new LibraryFormatError(sut, 'noname', 'name in descriptor does not match directory name'));
		});

		it('can build a fully populated v2 descriptor', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			const content = sut.buildV2Descriptor({
				name: 'abcd', version: '1.2.3', license: 'dummy', author: 'Mr Big', 'description': 'Fixes the world',
				architectures: ['particle-photon', 'particle-p1']
			}, true);
			expect(content).to.be.equal(
				'name=abcd\n' +
				'version=1.2.3\n' +
				'license=dummy\n' +
				'author=Mr Big\n' +
				'sentence=Fixes the world\n' +
				'# paragraph=a longer description of this library, always prepended with sentence when shown\n'+
				'# url=the url for the project\n'+
				'# repository=git repository for the project, like https://github.com/mygithub_user/my_repo.git\n' +
				'architectures=particle-photon,particle-p1\n');
		});

		it('can build an empty v2 descriptor', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			const content = sut.buildV2Descriptor({
				name: 'abcd', version: '1.2.3'
			});
			expect(content).to.be.equal(
				'name=abcd\n' +
				'version=1.2.3\n');
		});

		it('can read a v1 descriptor', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			fs.writeFileSync('mydir/test.json', '{"name":"myname", "description":"desc"}');
			return expect(sut.readFileJSON('name_not_used', 'mydir/test.json'))
				.to.eventually.deep.equal({ name:'myname', description:'desc' });
		});

		it('rejects an invalid v1 descriptor', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			fs.writeFileSync('mydir/test.json', '{"name":"myname, "description":"desc"}');
			const msg = 'Unexpected token d in JSON at position 18';
			sut._parseJSON = sinon.stub().throws(new Error(msg));
			return expect(sut.readFileJSON('somename', 'mydir/test.json'))
				.to.eventually.be.rejected.and.deep.equal(new LibraryFormatError(sut, 'somename',
					new VError(new Error(msg), 'error parsing "mydir/test.json"')));
		});

		describe('layout', () => {

			it('throws exception for layout if library directory does not exist', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				const name = 'abcd__';
				const result = sut.getLibraryLayout(name);
				const cause = makeFsError('ENOENT', 34, 'ENOENT, no such file or directory \'mydir/abcd__/\'');
				return expect(result).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, name, cause));
			});

			it('can detect legacy layout', () => {
				mkdir('mydir');
				fs.mkdirSync('mydir/legacy');
				fs.writeFileSync('mydir/legacy/spark.json', '');
				const sut = new FileSystemLibraryRepository('mydir');
				return expect(sut.getLibraryLayout('legacy')).to.eventually.equal(1);
			});

			it('can detect v2 layout', () => {
				mkdir('mydir');
				mkdir('mydir/v2');
				fs.writeFileSync('mydir/v2/library.properties', '');
				const sut = new FileSystemLibraryRepository('mydir');
				return expect(sut.getLibraryLayout('v2')).to.eventually.equal(2);
			});

			it('can detect invalid layout', () => {
				mkdir('mydir');
				mkdir('mydir/invalid');
				const sut = new FileSystemLibraryRepository('mydir');
				const cause = makeFsError('ENOENT', 34, 'ENOENT, no such file or directory \'mydir/invalid/library.properties\'');
				return expect(sut.getLibraryLayout('invalid')).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, 'invalid', cause));
			});

			it('can write legacy layout', () => {
				const name = 'legacylib';
				const lib = makeTestLib(name, '1.2.3');   // a library object in memory.

				const sut = new FileSystemLibraryRepository('mydir');
				const result = sut.add(lib, 1)
					.then(() => sut.getLibraryLayout(name));
				return expect(result).to.eventually.equal(1);
			});

			function buildLibDir(name='testlib') {
				mkdir('mydir');
				const libdir = path.join('mydir', name);
				mkdir(libdir);
				const sut = new FileSystemLibraryRepository('mydir');
				return [sut, name, libdir];
			}

			it('rejects a library layout when library.properties is a directory', () => {
				const [sut, name, libdir] = buildLibDir();
				mkdir(path.join(libdir, libraryProperties));
				return expect(sut.getLibraryLayout(name)).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, name));
			});

			it('rejects a library layout when spark.json is a directory', () => {
				const [sut, name, libdir] = buildLibDir();
				mkdir(path.join(libdir, sparkDotJson));
				const cause = makeFsError('ENOENT', 34, 'ENOENT, no such file or directory \'mydir/testlib/library.properties\'');
				return expect(sut.getLibraryLayout(name)).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, name, cause));
			});

			it('rejects a library layout when no metadata is present', () => {
				const [sut, name] = buildLibDir();
				const cause = makeFsError('ENOENT', 34, 'ENOENT, no such file or directory \'mydir/testlib/library.properties\'');
				return expect(sut.getLibraryLayout(name)).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, name, cause));
			});

			it('rejects a library layout when no directory is present', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				const name = 'whatever';
				const cause = makeFsError('ENOENT', 34, 'ENOENT, no such file or directory \'mydir/whatever/\'');
				return expect(sut.getLibraryLayout(name)).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, name, cause));
			});

			it('rejects a library layout when expected location is a file', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				const name = 'whatever';
				fs.writeFileSync(path.join('mydir', name, ''));
				return expect(sut.getLibraryLayout(name)).to.eventually.be.rejected.deep.equal(new LibraryNotFoundError(sut, name));
			});
		});

		describe('migrate', () => {
			it('can migrate source file', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				const testSource = `
				#pragma don't change me
				#include "mylib/mylib.h"
				  #include 'mylib\\mylib.h'
				  #include "mylib2/mylib2.h"
				  // note this is perverse and beyond what reasonable code does
				  "#include 'mylib/mylib_is_best.h'"
				  //#include 'mylib/mylib_is_best.h'
				`;
				const expected = `
				#pragma don't change me
				#include "mylib.h"
				  #include 'mylib.h'
				  #include "mylib2/mylib2.h"
				  // note this is perverse and beyond what reasonable code does
				  "#include 'mylib_is_best.h'"
				  //#include 'mylib_is_best.h'
				`;

				const actual = sut.migrateSourcecode(testSource, 'mylib');
				expect(actual).to.be.equal(expected);
			});

			it('can migrate with special regex characters', () => {
				const sut = new FileSystemLibraryRepository('mydir');

				const testSource = `
				#include "mylib++../mylib++...h"
				`;
				const expected = `
				#include "mylib++...h"
				`;
				const actual = sut.migrateSourcecode(testSource, 'mylib++..');
				expect(actual).to.eql(expected);
			});
		});



		describe('fileStat', () => {
			it('retrieves a null value for a non-existent file', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				return expect(sut.fileStat('$$$.@@@1')).to.eventually.be.equal(null);
			});
		});

		describe('mkdirIfNeeded', () => {
			it('raises no error when the directory already exists', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				return expect(sut.mkdirIfNeeded('mydir')).to.eventually.not.be.rejected;
			});

			it('mkdir raises error if something other than "EEXIST"', () => {
				const sut = new FileSystemLibraryRepository('mydir');
				return expect(sut.mkdirIfNeeded('mydir/:/!|,')).to.eventually.be.rejected;
			});
		});

		it('createDirectory can create a nested directory', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			const dir = 'one/two/three';
			sut.createDirectory(dir);
			sut.createDirectory(dir);       // do it again so we exercise the already exists case.
			expect(dir).to.be.a.directory;
		});
	});

	describe('File system naming strategies', () => {
		describe('Name Strategy', () => {
			const sut = FileSystemNamingStrategy.BY_NAME;
			it('returns the library name for the library ident', () => {
				expect(sut.toName({ name:'finbarr' })).to.be.equal('finbarr');
			});

			it('returns the same name for filesystem', () => {
				expect(sut.nameToFilesystem('abcd')).to.be.equal('abcd');
			});

			it('matches the same name', () => {
				return expect(sut.matchesName({ name:'abcd' }, 'abcd')).to.be.true;
			});
		});
	});

	describe('Name@Version Strategy', () => {
		const sut = FileSystemNamingStrategy.BY_NAME_AT_VERSION;

		it('returns the library name@version for the library ident', () => {
			expect(sut.toName({ name:'finbarr', version:'fnarr' })).to.be.equal('finbarr@fnarr');
		});

		it('returns the same name for filesystem', () => {
			expect(sut.nameToFilesystem('abcd')).to.be.equal('abcd');
		});

		it('matches the same name@version', () => {
			return expect(sut.matchesName({ name:'abcd', version:'1' }, 'abcd@1')).to.be.true;
		});
	});

	describe('Direct Strategy', () => {
		const sut = FileSystemNamingStrategy.DIRECT;
		it('returns the library name for the library ident', () => {
			expect(sut.toName({ name:'finbarr', version:'fnarr' })).to.be.equal('finbarr');
		});

		it('returns the empty name for filesystem', () => {
			expect(sut.nameToFilesystem('abcd')).to.be.equal('');
		});

		it('matches the same name', () => {
			return expect(sut.matchesName({ name:'abcd', version:'1' }, 'abcd')).to.be.true;
		});

		it('matches the empty string', () => {
			return expect(sut.matchesName({ name:'abcd', version:'1' }, '')).to.be.true;
		});

		it('provides the name by reading the library in the directory', () => {
			const mockRepo = {};
			mockRepo.descriptorFileV2 = sinon.stub().returns('file');
			mockRepo.readDescriptorV2 = sinon.stub().returns(Promise.resolve({ name:'abcd' }));
			mockRepo.fileStat = sinon.stub().returns(Promise.resolve({ isFile: () => true }));

			// const filePath = this.descriptorFileV2(name);
			// return this.readDescriptorV2(name, filePath)
			return sut.names(mockRepo).then((names) => {
				expect(names).to.be.deep.equal(['abcd']);
				expect(mockRepo.descriptorFileV2).to.have.been.calledWith('');
				expect(mockRepo.readDescriptorV2).to.have.been.calledOnce;
				expect(mockRepo.readDescriptorV2).to.have.been.calledWith('', 'file');
				expect(mockRepo.fileStat).to.have.been.calledOnce;
				expect(mockRepo.fileStat).to.have.been.calledWith('file');
			});
		});

		it('is not writable', () => {
			const repo = new FileSystemLibraryRepository('.', sut);
			return expect(repo.add({ metadata: { name:'test' } })).to.be.rejected.and.eventually.have.property('name').equal('LibraryRepositoryError');
		});

		it('can retrieve a library by default', () => {
			const repo = new FileSystemLibraryRepository('./mydir/lib1', sut);
			return repo.fetch('').then(lib => {
				expect(lib.name).to.be.equal('lib1');
			});
		});

		it('can retrieve a library by name', () => {
			const repo = new FileSystemLibraryRepository('./mydir/lib1', sut);
			return repo.fetch('lib1').then(lib => {
				expect(lib.name).to.be.equal('lib1');
			});
		});

		it('throws LibraryNotFoundError if the requested name does not match the library name', () => {
			const repo = new FileSystemLibraryRepository('./mydir/lib1', sut);
			return expect(repo.fetch('lib2')).to.eventually.be.rejected;
		});

		it('returns no names if the directory is not a valid library', () => {
			const repo = new FileSystemLibraryRepository('./mydir/zzz', sut);
			return expect(repo.names()).to.eventually.deep.equal([]);
		});

		it('throws library not found error for default name when directory is not a valid library', () => {
			const repo = new FileSystemLibraryRepository('./mydir/zzz', sut);
			return expect(repo.fetch('')).to.be.rejected.and.eventually.has.property('name').equal('LibraryNotFoundError');
		});
	});

	describe('addAdapter', () => {
		let sut, callback;

		beforeEach(() => {
			sut = new FileSystemLibraryRepository('./mydir', FileSystemNamingStrategy.DIRECT);
			callback = sinon.stub();
		});

		it('raises an error when the layout is not v2', () => {
			sut.fileStat = sinon.stub().withArgs('somedir').returns(Promise.resolve({ isDirectory: () => true }));
			sut._addAdapters = sinon.spy();
			sut.getLibraryLayout = sinon.stub().returns(Promise.resolve(1));
			// when
			return sut.addAdapters(callback, 'abcd', 'somedir')
				.then(() => {
					throw Error('expected an exception');
				})
				.catch(error => {
					expect(error).to.deep.equal(sut._requireV2Format('abcd'));
				});
		});

		it('raises an error when the target directory does not exist', () => {
			sut.fileStat = sinon.stub().withArgs('somedir').returns(Promise.resolve({ isDirectory: () => false }));
			sut._addAdapters = sinon.spy();
			sut.getLibraryLayout = sinon.stub().returns(Promise.resolve(2));
			// when
			return sut.addAdapters(callback, 'abcd', 'somedir')
				.then(() => {
					throw Error('expected an exception');
				})
				.catch(error => {
					expect(error).to.deep.equal(sut._targetDirectoryDoesNotExist('somedir'));
				});
		});

		it('calls _addAdapter when the layout is v2 and the directory exists', () => {
			sut.fileStat = sinon.stub().withArgs('somedir').returns(Promise.resolve({ isDirectory: () => true }));
			sut._addAdapters = sinon.spy();
			sut.getLibraryLayout = sinon.stub().returns(Promise.resolve(2));
			// when
			return sut.addAdapters(callback, 'abcd', 'somedir')
				.then(() => {
					expect(sut._addAdapters).to.have.been.calledOnce;
					expect(sut._addAdapters).to.have.been.calledWith(callback, 'abcd', 'somedir');
				});
		});

		it('adds the library name to the target directory', () => {
			// given
			sut.fetch = sinon.stub().returns(Promise.resolve(new AbstractLibrary('abc')));
			sut._addAdaptersImpl = sinon.stub().returns(Promise.resolve(123));
			// when

			return sut._addAdapters(callback, 'abc', 'mydir')
				.then(result => {
					expect(result).to.equal(123);

					expect(sut._addAdaptersImpl).to.be.calledOne;
					expect(sut._addAdaptersImpl).to.be.calledWith(callback, 'mydir/abc', 'mydir/src');
				});
		});

		it('adds adapter files recursively and does not recurse into adapter directories', () => {
			// given
			fs.mkdirSync('mydir/lib');
			fs.mkdirSync('mydir/headers');
			fs.writeFileSync('mydir/header1.h');
			fs.writeFileSync('mydir/header2.h');
			fs.writeFileSync('mydir/lib/header1.h');
			fs.writeFileSync('mydir/headers/lib.h');

			function fileExists(name, content) {
				expect(fs.statSync(name).isFile()).to.be.true;
				expect(fs.readFileSync(name, 'utf-8')).to.equal(content);
			}

			function fileNotExists(name) {
				expect(fs.existsSync(name)).to.be.false;
			}

			return sut._addAdaptersImpl(callback, 'mydir/lib', 'mydir')
				.then(() => {
					fileExists('mydir/lib/header1.h', '#include "../header1.h"');
					fileExists('mydir/lib/header2.h', '#include "../header2.h"');
					fileExists('mydir/lib/headers/lib.h', '#include "../../headers/lib.h"');
					fileExists('mydir/lib/header2.h', '#include "../header2.h"');
					fileNotExists('mydir/lib/lib/header1.h');
				});
		});

		describe('isHeaderFile', () => {
			it('.h is a valid header file', () => {
				expect(sut.isHeaderFile('abc.h')).to.be.true;
			});

			it('.hpp is a valid header file', () => {
				expect(sut.isHeaderFile('abc.hpp')).to.be.true;
			});

			it('.hxx is a valid header file', () => {
				expect(sut.isHeaderFile('abc.hxx')).to.be.true;
			});

			it('.h++ is a valid header file', () => {
				expect(sut.isHeaderFile('abc.h++')).to.be.true;
			});

			it('.cpp is not a valid header file', () => {
				expect(sut.isHeaderFile('abc.cpp')).to.be.false;
			});

			it('.c is not a valid header file', () => {
				expect(sut.isHeaderFile('abc.c')).to.be.false;
			});

			it('no extension is not a valid header file', () => {
				expect(sut.isHeaderFile('abc')).to.be.false;
			});
		});
	});

	describe('isLibraryExample', () => {
		let cwd;
		beforeEach(() => {
			cwd = process.cwd();
		});

		afterEach(() => {
			process.chdir(cwd);
		});

		function buildV2Library(name) {
			mkdir('mydir');
			mkdir('mydir/v2');
			const base = 'mydir/v2/'+name+'/';
			mkdir(base);
			fs.writeFileSync(base+'library.properties', '');
			mkdir(base+'examples');
			mkdir(base+'examples/huzzah');
			fs.writeFileSync(base+'examples/huzzah/code.ino', '');
			return base;
		}

		it('throws an exception when the file does not exist', () => {
			const promise = isLibraryExample('somedir');
			return promise.
				then(() => {
					throw Error('expected stat error');
				})
				.catch(error => {
					expect(error).has.property('code').equal('ENOENT');
				});
		});

		it('can successfully detect a relative example file', () => {
			const base = buildV2Library('mylib');
			const basePath = base+'examples/huzzah';
			process.chdir(basePath);
			return expect(isLibraryExample('code.ino')).to.eventually.eql({ basePath:path.resolve(), libraryPath:'../..', example:'code.ino' });
		});

		it('can successfully detect an example directory from the root of the library', () => {
			const base = buildV2Library('mylib');
			const basePath = base;
			process.chdir(basePath);
			return expect(isLibraryExample('examples/huzzah')).to.eventually.eql({ basePath:path.resolve(), libraryPath:'', example:'examples/huzzah/' });
		});

		it('can successfully detect an example directory as the current folder', () => {
			const base = buildV2Library('mylib');
			const basePath = base+'examples/huzzah';
			process.chdir(basePath);
			return expect(isLibraryExample('.')).to.eventually.eql({ basePath:path.resolve(), libraryPath:'../..', example:'./' });
		});

		it('can successfully detect an example file given the full path from the current folder', () => {
			const base = buildV2Library('mylib');
			const basePath = cwd;
			return expect(isLibraryExample(base+'examples/huzzah')).to.eventually.eql({ basePath, libraryPath:base.slice(0,-1), example:base+'examples/huzzah/' });
		});
	});

	describe('pathsCommonPrefix', () => {
		it('the longest common prefix of an empty array is the empty string', () => {
			expect(pathsCommonPrefix([])).to.equal('');
		});

		it('the longest common prefix of a single absolute file is the directory the file is in', () => {
			mkdir('/mydir');
			mkdir('/mydir/dir2');
			fs.writeFileSync(path.join('/mydir', 'dir2', 'file.txt'), '');
			const result = pathsCommonPrefix(['/mydir/dir2/file.txt']);
			expect(result).to.equal('/mydir/dir2');
		});

		it('the longest common prefix of a relative file is the absolute directory the file is in', () => {
			mkdir('/mydir');
			mkdir('/mydir/dir2');
			fs.writeFileSync(path.join('/mydir', 'dir2', 'file.txt'), '');
			const result = pathsCommonPrefix(['/mydir/dir2/file.txt'], undefined, '/mydir');
			expect(result).to.equal('/mydir/dir2');
		});

		function createFilesAndComputePrefix(paths, relative, cwd) {
			for (let p of paths) {
				if (p.endsWith('/')) {
					mkdirp(p);
				} else {
					mkdirp(path.dirname(p));
					fs.writeFileSync(p, '');
				}
			}
			const result = pathsCommonPrefix(paths, relative, cwd);
			return result;
		}

		it('computes the longest common prefix of several files and directories where filenames have a common prefix', () => {
			const paths = [
				path.join('/mydir', 'dir2', 'src')+'/',
				path.join('/mydir', 'dir2', 'src', 'file.txt'),
				path.join('/mydir', 'dir2', 'src', 'file2.txt'),
				path.join('/mydir', 'dir2', 'src', 'fi', 'file2.txt')
			];
			expect(createFilesAndComputePrefix(paths)).to.equal('/mydir/dir2/src');
		});

		it('computes the longest common prefix with disjoint subtrees', () => {
			const paths = [
				path.join('/mydir', 'dir2', 'lib', 'file.txt'),
				path.join('/mydir', 'dir2', 'src', 'file2.txt'),
				path.join('/mydir', 'dir2', 'src', 'fi', 'file2.txt')
			];
			expect(createFilesAndComputePrefix(paths)).to.equal('/mydir/dir2');
		});

		it('computes the longest common prefix with disjoint subtrees', () => {
			const paths = [
				path.join('/mydir', 'dir2', 'lib', 'file.txt'),
				path.join('/mydir', 'dir2', 'src', 'file2.txt')
			];
			for (let p of paths) {
				mkdirp(path.dirname(p));
				fs.writeFileSync(p, '');
			}
			const result = pathsCommonPrefix(['dir2/lib/file.txt', 'dir2/src/file2.txt'], undefined, '/mydir');
			expect(result).to.equal('/mydir/dir2');
		});

		it('when the 2nd parameter is given, then it computes the relative path of each file to the common prefix', () => {
			const paths = [
				path.join('/mydir', 'dir2', 'lib', 'file.txt'),
				path.join('/mydir', 'dir2', 'src', 'file2.txt')
			];
			for (let p of paths) {
				mkdirp(path.dirname(p));
				fs.writeFileSync(p, '');
			}
			const relative = [];
			const result = pathsCommonPrefix(['dir2/lib/file.txt', 'dir2/src/file2.txt'], relative, '/mydir');
			expect(result).to.equal('/mydir/dir2');
			expect(relative).to.eql(['lib/file.txt', 'src/file2.txt']);
		});
	});


});

