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
import mock from 'mock-fs';

const chai = require('chai');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;


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
		result[libraryProperties] = `{ 'name':'${name}', 'id':'id_${name}' }`;
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
			return getdirs('mydir').then(dirs => {
				expect(dirs).to.contain('lib1');
				expect(dirs).to.contain('yaya');
				expect(dirs).to.contain('zzz');
				expect(dirs).to.not.contain('hello.txt');
				expect(dirs).to.not.contain('.profile2');
			});
		});
	});

	describe('Library Repository', () => {
		it('constructs', () => {
			const dir = {};
			const sut = new FileSystemLibraryRepository(dir);
			expect(sut.path).to.be.equal(dir);
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

		for (let [name,data] of Object.entries(libData)) {
			if (false) {
				it(`can fetch library '${name}' by name`, () => {
					const sut = new FileSystemLibraryRepository('mydir');
					if (data.lib) {
						expect(sut.fetch(name)).has.property('name').that.is.equal(name);
					} else {
						expect(() => {
							sut.fetch(name);
						}).throws(/LibraryNotFoundError/);
					}
				});
			}
		}
	});
});
