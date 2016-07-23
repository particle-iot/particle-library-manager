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

import {expect} from './test-setup';
import {FileSystemNamingStrategy, FileSystemLibraryRepository} from '../src/librepo_fs';
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
		const comp1 = dircomp.compareSync(libdir, v1data, {compareContent:true});
		expect(comp1.same).to.be.true;

		const sut = new FileSystemLibraryRepository(dir, naming);
		return sut.setLibraryLayout(name, 2).then(() => {
			const comp2 = dircomp.compareSync(libdir, v2data, {compareContent:true});
			if (!comp2.same) {
				//const unequal = comp2.diffSet.filter(item => item.state!=='equal');
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

});


