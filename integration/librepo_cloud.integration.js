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

/**
 * Tests against the cloud API using particle-api-js
 */

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const mockfs = require('mock-fs');
import {CloudLibraryRepository} from '../src/librepo_cloud'
import {FileSystemLibraryRepository} from "../src/librepo_fs";

/*
const config = {
	endpoint: 'http://localhost:9090',
	// should probably fetch this from the environment
	auth: 'cf3fce66c7d84ee4ad228641680d4bfba9f63c00'
};

const particleApiJsConfig =
{
	baseUrl: config.endpoint,
	clientSecret: 'particle-api',
	clientId: 'particle-api',
	tokenDuration: 7776000 // 90 days
};

function createRepo() {
	return new CloudLibraryRepository({config: particleApiJsConfig, auth: config.auth});
}
*/

const auth = 'a1756ba10078bfacd21a26d68c1a6bb2274e565a';

function createRepo() {
	return new CloudLibraryRepository({auth});
}


describe('CloudLibraryRepository', () => {

	function validate(lib, name) {
		expect(lib).to.be.ok;
		expect(lib).to.have.property('name').equal(name);
		return lib.definition().then((def) => {
			expect(def).to.have.property('author');
			expect(def).to.have.property('version');
			expect(def).to.have.property('sentence');
		});
	}


	/* The cloud repo doesn't yet support fetching files individually.
		it('can fetch neopixel', () => {

			const sut = createRepo();
			const result = sut.fetch("neopixel").then(neopixel => {
				const promises = [
					neopixel.definition().then(definition => {
						expect(definition.name).to.be.equal('neopixel');
					}),
					neopixel.files().then(files => {
						expect(files.length).to.be.greaterThan(0);
					}).then(() => {
						const fs = new FileSystemLibraryRepository('./');
						return fs.add(neopixel);
					})
				];

				return Promise.all(promises);
			});
			return result;
		});
	*/

	beforeEach(function a(done) {
		this.timeout(5000);
		done();
	});

	it('can fetch a library', () => {
		const sut = createRepo();
		const fetchLib = sut.fetch('neopixel');
		return fetchLib.then((lib) => validate(lib, 'neopixel'));
	});

	// FIXME: listing all libraries just to get their names is not efficient. Do we need this?
	xit('can list libraries', () => {
		const sut = createRepo();
		return sut.names().then((names) => {
			expect(names).to.be.ok;
			expect(names).to.contain('neopixel');
		});
	});

	it('can download the library file', function a() {
		this.timeout(10000);
		const sut = createRepo();
		return sut.fetch('neopixel').then((lib) => {
			return lib.metadata.download();
		}).then(file => {
			expect(file).to.have.length.greaterThan(1000);
		});
	});


	describe('filesystem', () => {

		beforeEach(done => {
			mockfs({});
			done();
		});

		afterEach(done => {
			mockfs.restore();
			done();
		});

		it('can copy the library to the filesystem', () => {
			const sut = createRepo();
			return sut.fetch('neopixel').then((lib) => {
				return lib.copyTo('neopixel');
			}).then(() => {
				expect('neopixel').to.be.a.directory;
				expect('neopixel/LICENSE').to.be.a.file;
				expect('neopixel/libraries.properties').to.be.a.file;
				expect('neopixel/src/neopixel.cpp').to.be.a.file;
				expect('neopixel/src/neopixel.h').to.be.a.file;
			});
		});
	});
});
