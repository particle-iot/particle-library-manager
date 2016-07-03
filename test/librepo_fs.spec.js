import {FileSystemLibraryRepository} from '../src/librepo_fs';
const chai = require('chai');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const fs = require('fs');
const path = require('path');


describe('File System', () => {
	// this is an integration test, but since everything needed is available locally
	// and it's pretty quick we run it here in the unit test suite

	const tmp = require('tmp');
	const fse = require('fs-extra');
	const dircomp = require('dir-compare');
	tmp.setGracefulCleanup();

	const testdata = path.join(__dirname, 'data');

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

	it('is a no-op migrate a v2 library to v2', () => {
		const sut = new FileSystemLibraryRepository(testdata);
		expect(sut.setLibraryLayout('library-v2', 2)).eventually.not.rejected;
	});


	function assertMigrate(v1, v2) {
		const v1data = path.join(testdata, v1);
		const v2data = path.join(testdata, v2);

		const tmpobj = tmp.dirSync();
		const dir = tmpobj.name;
		const name = 'testlib';
		const libdir = path.join(dir, name);

		fs.mkdirSync(libdir);

		fse.copySync(v1data, libdir, {compareContent: true});
		const comp1 = dircomp.compareSync(libdir, v1data);
		expect(comp1.same).to.be.true;

		const sut = new FileSystemLibraryRepository(dir);
		return sut.setLibraryLayout(name, 2).then(() => {
			const comp2 = dircomp.compareSync(libdir, v2data);
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


