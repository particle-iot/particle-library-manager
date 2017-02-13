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

const fs = require('fs');
const path = require('path');
const mockfs = require('mock-fs');
require('es6-promise').polyfill();
require('promise.prototype.finally');

import { expect, sinon } from './test-setup';
import { CloudLibraryRepository } from '../src/librepo_cloud';
import { CloudLibrary } from '../src/librepo_cloud';



describe('CloudLibraryRepository', () => {

	const client = { api: {} };
	const sut = new CloudLibraryRepository({ auth:'auth', client });

	it('can be instantiated with auth token', () => {
		const sut = new CloudLibraryRepository({ auth:'auth' });
		expect(sut).to.be.ok;
		expect(sut).to.have.property('client').that.is.ok;
		expect(sut).to.have.property('api').that.is.equal(sut.client.api);
		expect(sut).to.have.property('auth').that.is.equal('auth');
	});

	it('can be instantiated without auth token', () => {
		const sut = new CloudLibraryRepository({});
		expect(sut).to.be.ok;
		expect(sut).to.have.property('client').that.is.ok;
		expect(sut).to.have.property('api').that.is.equal(sut.client.api);
		expect(sut).to.have.property('auth').that.is.undefined;
	});


	it('can be instantiated with a client', () => {
		const sut = new CloudLibraryRepository({ auth:'auth', client });
		expect(sut).to.have.property('client').that.is.equal(client);
		expect(sut).to.have.property('api').that.is.equal(client.api);
		expect(sut).to.have.property('auth').that.is.equal('auth');
	});

	it('delegates getLibrary to the client', () => {
		client.library = sinon.stub();
		sut._getLibrary('somelib', '1.2.3');
		expect(client.library).to.be.calledWith('somelib', { version:'1.2.3' });
	});

	it('can create a new library', () => {
		const lib = sut._createLibrary('name', 'meta');
		expect(lib).to.be.deep.equal(new CloudLibrary('name', 'meta', sut));
	});

	it('delegates fetch to _getLibrary and _createLibrary', () => {
		const lib = { name: 'mylib' };
		sut._getLibrary = sinon.stub().returns(Promise.resolve(lib));
		return sut.fetch('mylib').then((result) => {
			expect(result).to.deep.equal(new CloudLibrary('mylib', lib, sut));
			expect(sut._getLibrary).to.have.been.calledWith('mylib');
		});
	});

	it('delegates index() to client.libraries()', () => {
		const libs = [{ name: 'lib1' }, { name: 'lib2' }];
		client.libraries = sinon.stub().returns(Promise.resolve(libs));
		return sut.index().then((result) => {
			expect(result).to.be.deep.equal(libs);
			expect(client.libraries).to.have.been.calledWith();
		});
	});

	it('delegates names() to index and extractNames', () => {
		const libs = [{ name: 'lib1' }, { name: 'lib2' }];
		sut.index = sinon.stub().returns(Promise.resolve(libs));
		return sut.names().then((names) => {
			expect(sut.index).to.be.calledWith();
			expect(names).to.be.deep.equal(['lib1', 'lib2']);
		});
	});

	it('definition fetches the library metadata', () => {
		const lib = { metadata: 'abcd' };
		expect(sut.definition(lib)).to.eventually.be.equal('abcd');
	});

	it('can expand a tar.gz file to a directory', () => {
		const buffer = fs.readFileSync(path.join(__dirname, 'fixtures', 'tarball.tar.gz'));
		const lib = {};
		lib.download = sinon.stub().returns(Promise.resolve(buffer));
		const sut = new CloudLibrary('abcd', lib);

		mockfs({ '/':{} });
		// this isn't a pure unit test, but is simpler to code than mocking the tar.gz functionality.
		return sut.copyTo('/newlib')
			.then((lib) => {
				expect(lib).to.be.deep.equal(sut);
				expect('/newlib/library.properties').to.be.a.file;
				expect('/newlib/project.properties').to.not.be.a.file;
				expect('/newlib/project.properties').to.not.be.a.file;
				expect('/newlib/src/neopixel.cpp').to.be.a.file;
				expect('/newlib/src/neopixel.h').to.be.a.file;
				mockfs.restore();
			})
			.catch(() => {
				mockfs.restore();
			});
	});

	it('ignores symlinks ', () => {
		// todo - build a tar.gz containing symblinks

	});


	describe('mockfs', () => {
		it('fails when the tar.gz is not valid', () => {
			const buffer = new Buffer(2000);
			buffer.fill(0);
			const lib = { download: sinon.stub().returns(Promise.resolve(buffer)) };
			const sut = new CloudLibrary('abcd', lib);
			expect (sut.copyTo('tmp')).to.eventually.reject;
		});


	});

});
