const fs = require('fs');
const path = require('path');
const mockfs = require('mock-fs');
const tar = require('tar-stream');
const zlib = require('zlib');
require('es6-promise').polyfill();
require('promise.prototype.finally');

import { expect, sinon } from './test-setup';
import { CloudLibraryRepository } from '../src/librepo_cloud';
import { CloudLibrary } from '../src/librepo_cloud';

// Build a gzipped tar buffer from an ordered list of entries. Unlike `tar c`
// over a real directory, this can emit a crafted sequence (e.g. a traversing
// name, or a symlink followed by a file that walks through it) used to exercise
// the extraction hardening in CloudLibrary.copyTo.
function makeTarGz(entries) {
	return new Promise((fulfill, reject) => {
		const pack = tar.pack();
		const add = (i) => {
			if (i >= entries.length) {
				return pack.finalize();
			}
			const entry = entries[i];
			const header = { name: entry.name, type: entry.type || 'file' };
			if (entry.linkname) {
				header.linkname = entry.linkname;
			}
			const next = (err) => (err ? reject(err) : add(i + 1));
			if (header.type === 'file') {
				pack.entry(header, entry.data || '', next);
			} else {
				pack.entry(header, next);
			}
		};
		const chunks = [];
		const gzip = zlib.createGzip();
		pack.pipe(gzip);
		gzip.on('data', (chunk) => chunks.push(chunk));
		gzip.on('end', () => fulfill(Buffer.concat(chunks)));
		gzip.on('error', reject);
		add(0);
	});
}

function libraryFrom(buffer) {
	return new CloudLibrary('malicious', { download: () => Promise.resolve(buffer) });
}



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

	it('rejects an archive entry whose name traverses outside the target directory', () => {
		// dir=/newlib, entry '../PWNED' -> path.join collapses to /PWNED, outside the target
		return makeTarGz([
			{ name: 'src/lib.h', data: '// ok\n' },
			{ name: '../PWNED', data: 'attacker-controlled\n' }
		]).then((buffer) => {
			mockfs({ '/':{} });
			return libraryFrom(buffer).copyTo('/newlib').then(
				() => {
					throw new Error('expected copyTo to reject');
				},
				(err) => {
					expect(err.message).to.match(/escapes target directory/);
				}
			).then(() => {
				expect(fs.existsSync('/PWNED')).to.equal(false);
				mockfs.restore();
			}, (err) => {
				mockfs.restore();
				throw err;
			});
		});
	});

	it('does not follow a symlink entry to write outside the target directory', () => {
		// A symlink 'link' -> /outside, then a file 'link/PWNED' that would walk
		// through it. The symlink entry is skipped, so 'link' is created as a
		// real directory inside the target and the file lands there, never in
		// /outside.
		return makeTarGz([
			{ name: 'link', type: 'symlink', linkname: '/outside' },
			{ name: 'link/PWNED', data: 'attacker-controlled\n' }
		]).then((buffer) => {
			mockfs({ '/outside':{} });
			return libraryFrom(buffer).copyTo('/newlib').then(() => {
				expect(fs.existsSync('/newlib/link/PWNED')).to.equal(true);
				expect(fs.existsSync('/outside/PWNED')).to.equal(false);
				mockfs.restore();
			}, (err) => {
				mockfs.restore();
				throw err;
			});
		});
	});


	describe('mockfs', () => {
		it('fails when the tar.gz is not valid', () => {
			const buffer = Buffer.alloc(2000);
			const lib = { download: sinon.stub().returns(Promise.resolve(buffer)) };
			const sut = new CloudLibrary('abcd', lib);
			return expect(sut.copyTo(require('tmp').dirSync().name)).to.eventually.be.rejected;
		});


	});

});
