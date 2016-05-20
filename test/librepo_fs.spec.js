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

import {FileSystemLibraryRepository, getdirs, libraryProperties} from '../src/librepo_fs';
import {MemoryLibraryFile} from '../src/librepo';
import mock from 'mock-fs';
import concat from 'concat-stream';
const chai = require('chai');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const promisify = require('es6-promisify');

const libFileContents = { 'h': '// a header file', cpp:'// a cpp file'};

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
		result[libraryProperties] = `{"name":"${name}","version":"1.2.3"}`;
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
	const fs = require('fs');
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
				return stat.then((stat) => {
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


describe('File System', () => {

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

	describe('Library Repository', () => {
		it('constructor adds trailing slash if missing', () => {
			const dir = '';
			const sut = new FileSystemLibraryRepository(dir);
			expect(sut.path).to.be.equal('/');
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
			const md = {name: 'funbuns', 'id': '123'};
			const sut = new FileSystemLibraryRepository('not used');
			expect(sut.removeId(md)).to.be.deep.equal({name: 'funbuns'});
		});

		it('can fetch a filename from the library anem, file base and file extension', () => {
			const sut = new FileSystemLibraryRepository('mydir');
			expect(sut.libraryFileName('mylib', 'file', 'ext')).to.be.equal('mydir/mylib/file.ext');
		});

		it('can determine source code files', ()=> {
			const isSourceData = {'abcd/a.txt':false, '123/a.c': true, 'yaya/a.cpp': true, '../a.properties': false};

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
			const lib = makeLibrary(name, {name:name, version:'1.2.3'}, [
				new MemoryLibraryFile(name, 'source', 'cpp', '// a cpp file', 1),
				new MemoryLibraryFile(name, 'source', 'h', '// a header file', 2),
				new MemoryLibraryFile(name, 'example', 'ino', '// some content ino', 3)
			]);

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
	});
});
