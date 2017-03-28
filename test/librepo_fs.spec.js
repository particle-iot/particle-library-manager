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
import { FileSystemNamingStrategy, FileSystemLibraryRepository, isLibraryExample } from '../src/librepo_fs';
import { LibraryContributor } from '../src/libcontribute';
import { makeCompleteV2Lib } from './librepo_fs_mock.spec';
import { makeTestLib } from './librepo_fs_mock.spec';
import { NamingStrategy } from '../src/librepo_fs';
import { MemoryLibraryFile } from '../src/librepo';
const fs = require('fs');
const path = require('path');

describe('File System', () => {
	// this is an integration test, but since everything needed is available locally
	// and it's pretty quick we run it here in the unit test suite

	const tmp = require('tmp');
	const fse = require('fs-extra');
	const dircomp = require('dir-compare');
	tmp.setGracefulCleanup();

	const testdata = path.join(__dirname, '..', 'resources', 'libraries');

	it('can detect a v1 library', () => {
		const sut = new FileSystemLibraryRepository(testdata);
		return expect(sut.getLibraryLayout('library-v1')).to.eventually.be.equal(1);
	});

	it('can detect a v2 library', () => {
		const sut = new FileSystemLibraryRepository(testdata);
		return expect(sut.getLibraryLayout('library-v2')).to.eventually.be.equal(2);
	});

	it('rasies an exception attempting to migrate a v2 library to v1', () => {
		const sut = new FileSystemLibraryRepository(testdata);
		expect(sut.setLibraryLayout('library-v2', 1)).eventually.rejected;
	});

	it('is a no-op to migrate a v2 library to v2', () => {
		const sut = new FileSystemLibraryRepository(path.join(testdata, 'library-v2'));
		expect(sut.setLibraryLayout('library-v2', 2)).eventually.not.rejected;
	});

	describe('naming strategy', () => {
		it('requires toName to be overridden', () => {
			const sut = new NamingStrategy();
			expect(() => sut.toName()).to.throw(Error, 'not implemented');
		});
	});

	describe('direct naming strategy', () => {
		const sut = new FileSystemLibraryRepository(testdata+'/library-v2', FileSystemNamingStrategy.DIRECT);

		it('is a no-op to migrate a v2 library to v2 with direct naming strategy, default name', ()=>{
			return expect(sut.setLibraryLayout('', 2)).eventually.not.rejected;
		});

		it('is a no-op to migrate a v2 library to v2 with direct naming strategy, explicit name', ()=>{
			return expect(sut.setLibraryLayout('uber-library-example', 2)).eventually.not.rejected;
		});

		it('lists the library name as the only library', () => {
			return expect(sut.names()).to.eventually.deep.equal(['uber-library-example']);
		});

		it('fetches the library via its name', () => {
			return expect(sut.fetch('uber-library-example'))
				.to.eventually.have.property('name').equal('uber-library-example');
		});

		it('fetches the library via the empty name', () => {
			return expect(sut.fetch(''))
				.to.eventually.have.property('name').equal('uber-library-example');
		});
	});

	function assertMigrate(v1, v2, naming) {
		const v1data = path.join(testdata, v1);
		const v2data = path.join(testdata, v2);

		const tmpobj = tmp.dirSync();
		const dir = tmpobj.name;
		const name = 'testlib';
		const libdir = path.join(dir, name);

		fs.mkdirSync(libdir);

		fse.copySync(v1data, libdir);
		const comp1 = dircomp.compareSync(libdir, v1data, { compareContent:true });
		expect(comp1.same).to.be.true;

		const sut = new FileSystemLibraryRepository(dir, naming);
		return sut.setLibraryLayout(name, 2).then(() => {
			const comp2 = dircomp.compareSync(libdir, v2data, { compareContent:true });
			if (!comp2.same) {
//				const unequal = comp2.diffSet.filter(item => item.state!=='equal');
			}
			expect(comp2.same).to.be.true;
		});
	}

	it('can migrate a full v1 library to v2 format', () => {
		return assertMigrate('library-v1', 'library-v2');
	});

	it('can migrate a v1 library without tests to v2 format', () => {
		return assertMigrate('library-v1-notests', 'library-v2-notests');
	});

	it('can migrate a v1 library without examples to v2 format', () => {
		return assertMigrate('library-v1-noexamples', 'library-v2-noexamples');
	});

	it('can migrate a v1 library with nested examples to v2 format', () => {
		return assertMigrate('library-v1-nested-examples', 'library-v2-nested-examples');
	});


	describe('LibraryContributor', () => {

		it('fails if the library does not validate', () => {
			const name = 'fred';
			const client = undefined;
			const tmpobj = tmp.dirSync();
			const dir = tmpobj.name;
			const repo = new FileSystemLibraryRepository(dir);
			const lib = makeTestLib(name, '1.2.3');
			const sut = new LibraryContributor({ repo, client });

			sut._contribute = sinon.stub();

			const result = repo.add(lib, 2)
				.then(() => sut.contribute(() => {}, name));
			return expect(result).to.eventually.be.rejected;
		});

		it('can contribute a library as a tarball', () => {
			const name = 'fred';
			const client = undefined;

			const tmpobj = tmp.dirSync();
			const dir = tmpobj.name;
			const repo = new FileSystemLibraryRepository(dir);
			const lib = makeCompleteV2Lib(name, '1.2.3', [
				new MemoryLibraryFile('big', 'duff', 'pdf', '# readme', 100),
				new MemoryLibraryFile('.git/somefile', 'duff', '', '# readme', 101),
			]);

			const sut = new LibraryContributor({ repo, client });
			const callback = sinon.stub();
			sut._contribute = sinon.stub();

			const result = repo.add(lib, 2)
				.then(() => sut.contribute(callback, name))
				.then(() => {
					expect(sut._contribute).to.have.been.calledOnce;
					expect(sut._contribute).to.have.been.calledWith(name);
					const pipe = sut._contribute.firstCall.args[1];

					const zlib = require('zlib');
					const tar = require('tar-stream');
					const gunzip = zlib.createGunzip();
					const extract = tar.extract();
					const names = [];
					extract.on('entry', (header, stream, callback) => {
						names.push(header.name);
						stream.on('end', () => callback());
						stream.resume();
					});
					const promise = new Promise((fulfill, reject) => {
						extract.on('finish', fulfill);
						extract.on('error', reject);
						pipe.pipe(gunzip).pipe(extract);
					});
					return promise.then(() => {
						expect(names).to.include('README.md');
						expect(names).include('library.properties');
						expect(names).include('src/fred.cpp');
						expect(names).include('src/fred.h');
						expect(names).include('LICENSE');
						expect(names).to.not.include('big.pdf');
						expect(names).to.not.include('.git/something');

						expect(callback).to.have.been.calledWith('validatingLibrary');
						expect(callback).to.have.been.calledWith('contributingLibrary');
						expect(callback).to.have.been.calledWith('contributeComplete');
					});
				});
			return result;
		});

		it('can attempt to publish from a repo for real', () => {
			const repo = new FileSystemLibraryRepository('mydir');
			return expect(repo.contribute('abcd', {}, false, () => {})).to.eventually.be.rejected;
		});

		it('can attempt to publish from a repo as a dry run', () => {
			const repo = new FileSystemLibraryRepository('mydir');
			return expect(repo.contribute('abcd', {}, true, () => arguments[1])).to.eventually.be.rejected;
		});
	});

	describe('library examples', () => {
		describe('given an example via a relative path', () => {
			let example;
			let cwd;
			let files;
			const libname = 'library-v2-adapters';
			/**
			 * Make the current directory the test data
			 */
			beforeEach(() => {
				cwd = process.cwd();
				process.chdir(testdata);
				const examplePromise = isLibraryExample(path.join(libname, 'examples', 'blink-an-led'));

				return examplePromise.then((ex) => {
					example = ex;
					expect(example).to.be.ok;
				}).then(() => {
					files = {};
					return example.buildFiles(files);
				});
			});

			afterEach(() => {
				process.chdir(cwd);
			});

			it('recognizes it as an example', () => {
				expect(example).to.have.property('basePath').equal(path.resolve(testdata));
				expect(example).to.have.property('libraryPath').equal(libname);
				expect(example).to.have.property('example').equal(path.join(libname,'examples','blink-an-led')+path.sep);
				expect(files).to.have.property('map').that.is.ok;
				expect(files).to.have.property('basePath').that.is.equal(testdata);
			});


			function expectHasMapping(src, target=src) {
				// src is relative to the library
				src = path.join(libname, src);
				expect(files.map).has.property(target).equal(src);
			}

			it('moves library.properties to project.properties', () => {
				expectHasMapping('library.properties', 'project.properties');
			});

			it('moves the example sources to the sources of the project', () => {
				expectHasMapping(path.join('examples', 'blink-an-led', 'blink-an-led.cpp'), path.join('src', 'blink-an-led.cpp'));
			});

			it('moves the library sources to the sources directory', () => {
				expectHasMapping(path.join('src', 'uber-library-example.cpp'));
				expectHasMapping(path.join('src', 'uber-library-example.h'));
				expectHasMapping(path.join('src', 'a-c-example.c'));
			});

			describe('LibraryExample class', () => {
				it('_isFile returns true when the filename does not end with a slash', () => {
					expect(example._isFile('/abcd')).to.be.true;
				});

				it('_isFile returns false when the filename does end with a slash', () => {
					expect(example._isFile('abcd/')).to.be.false;
				});
			});

		});
	});

	describe('LibraryDirectStrategy', () => {
		it('matches empty name', () => {
			const sut = FileSystemNamingStrategy.DIRECT;
			expect(sut.matchesName({}, '')).to.be.true;
		});

		it('matches the descriptor name', () => {
			const sut = FileSystemNamingStrategy.DIRECT;
			expect(sut.matchesName({ name:'fred' }, 'fred')).to.be.true;
		});

		it('mismatches the descriptor name', () => {
			const sut = FileSystemNamingStrategy.DIRECT;
			expect(sut.matchesName({ name:'freddie' }, 'fred')).to.be.false;
		});

	});
});

