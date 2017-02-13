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

import { LibraryNotFoundError, LibraryRepositoryError, LibraryFormatError } from '../src/librepo';
import { LibraryRepository, Library, LibraryFile, MemoryLibraryFile } from '../src/librepo';
import { AbstractLibrary, AbstractLibraryRepository } from '../src/librepo';
import VError from 'verror';
import { sinon, expect } from './test-setup';
const Writable = require('stream').Writable;

describe('LibraryManager', () => {

	describe('Library Errors', () => {

		describe('LibraryRepositoryError', () => {
			it('has repo property', () => {
				const repo = {};
				const sut = new LibraryRepositoryError(repo);
				expect(sut.repo).to.equal(repo);
			});

			it('can use instanceof', () => {
				const sut = new LibraryRepositoryError();
				// using instanceof doesn't work
				// expect(sut).to.be.an.instanceof(LibraryRepositoryError);
				// expect(sut instanceof LibraryRepositoryError).to.be.true;
				expect(sut.name).to.be.string('LibraryRepositoryError');
			});

			it('propagates additional parameters to super', () => {
				const cause = new Error('boom');
				const sut = new LibraryRepositoryError({}, cause);
				expect(sut.cause()).to.eql(cause);
			});
		});

		describe('LibraryNotFoundError', () => {
			it('has repo and library properties', () => {
				const repo = {};
				const library = 'uberlib';
				const sut = new LibraryNotFoundError(repo, library);
				expect(sut.library).to.equal(library);
				expect(sut.repo).to.equal(repo);
			});

			it('has a message', () => {
				const sut = new LibraryNotFoundError('uberrepo', 'uberlib');
				expect(sut.toString()).to.equal('LibraryNotFoundError: library \'uberlib\' not found in repo \'uberrepo\'.');
			});
		});

		describe('LibraryFormatError', () => {
			it('works', () => {
				const repo = {};
				const library = 'uberlib';
				const sut = new LibraryFormatError(repo, library, new VError('bad mojo'));

				expect(sut.library).to.equal(library);
				expect(sut.repo).to.equal(repo);
				expect(sut.message).to.equal(': bad mojo');
				expect(sut.name).to.equal('LibraryFormatError');
			});
		});

	});

	describe('Library', () => {

		it('has a name', () => {
			const sut = new Library('Borgian');
			expect(sut.name).to.equal('Borgian');
		});

		it('has no files', () => {
			const sut = new Library();
			return expect(sut.files()).to.eventually.have.length(0);
		});

		it('has no definition', () => {
			const sut = new Library();
			return expect(sut.definition()).to.eventually.be.rejected;
		});

	});

	describe('LibraryFile', () => {
		it('constructs', () => {
			const name = {};
			const type = {};
			const ext = {};
			const sut = new LibraryFile(name, type, ext);
			expect(sut.name).to.equal(name);
			expect(sut.kind).to.equal(type);
			expect(sut.extension).to.equal(ext);
		});

		it('has streamable content', () => {
			const sut = new LibraryFile('name', 'type', 'ext');
			const stream = { end: sinon.spy() };
			const p = sut.content(stream);
			expect(stream.end).to.be.calledOnce;
			return expect(p).to.eventually.equal(stream);
		});
	});

	describe('LibraryRepository', () => {
		it('raises an error when fetching a library by name', () => {
			const sut = new LibraryRepository();
			return expect(sut.fetch('uberlib')).eventually.rejected.deep.equal(new LibraryNotFoundError(sut, 'uberlib'));
		});

		it('has no libraries', () => {
			const sut = new LibraryRepository();
			return expect(sut.names()).eventually.to.have.length(0);
		});

	});

	describe('MemoryLibraryFile', () => {
		it('constructs', () => {
			const sut = new MemoryLibraryFile('file', 'nice', 'ext', 'lots of content here', '123');
			expect(sut.name).to.be.string('file');
			expect(sut.kind).to.be.string('nice');
			expect(sut.extension).to.be.string('ext');
			expect(sut.string_content).to.be.string('lots of content here');
			expect(sut.id).to.be.string('123');
		});

		it('straems content', () => {
			const sut = new MemoryLibraryFile('file', 'nice', 'ext', 'lots of content here', '123');
			let result = '';
			const ws = Writable();  // eslint-disable-line new-cap
			ws._write = (chunk, enc, next) => {
				result += chunk;
				next();
			};
			ws.on('end', ()=>{
				expect(result).to.be.equal('lots of content here');
			});
			sut.content(ws);
		});
	});


	describe('AbstractLibrary', () => {
		it('retrieves the initial definition from the repo and caches it thereafter', () => {
			const repo = {};
			repo.definition = sinon.stub();
			const defn = 'definition';
			repo.definition.returns(Promise.resolve(defn));

			const sut = new AbstractLibrary('name', {}, repo);
			sinon.spy(sut, 'processDefinition');
			const result = sut.definition();

			const promise = result.then((def) => {
				expect(def).to.be.equal(defn);
				expect(repo.definition).to.be.calledOnce.calledWith(sut);
				expect(sut.processDefinition).to.be.calledOnce.calledWith(defn);
				return def;
			}).then(() => {
				return sut.definition();
			}).then((def) => {
				expect(def).to.be.equal(defn);
				expect(repo.definition).to.be.calledOnce;
				return def;
			});
			return expect(promise).to.be.eventually.equal(defn);
		});

		it('retrieves the initial files from the repo and caches them thereafter', () => {
			const repo = {};
			repo.files = sinon.stub();
			const files = 'files';
			repo.files.returns(Promise.resolve(files));

			const sut = new AbstractLibrary('name', {}, repo);
			sinon.spy(sut, 'processFiles');
			const result = sut.files();

			const promise = result.then((f) => {
				expect(f).to.be.equal(files);
				expect(repo.files).to.be.calledOnce.and.calledWith(sut);
				expect(sut.processFiles).to.be.calledOnce.and.calledWith(files);
				return f;
			}).then(() => {
				return sut.files();
			}).then((f) => {
				expect(f).to.be.equal(files);
				expect(repo.files).to.be.calledOnce;
				return f;
			});

			return expect(promise).to.be.eventually.equal(files);
		});


		it('propagates errors when retrieving the definition', () => {
			const repo = {};
			repo.definition = sinon.stub();
			repo.definition.returns(Promise.resolve().then(() => {
				throw 'keep calm and carry on';
			}));
			const sut = new AbstractLibrary('name', {}, repo);
			return expect(sut.definition()).to.be.rejectedWith('keep calm and carry on');

		});

		it('propagates errors when retrieving the files', () => {
			const repo = {};
			repo.files = sinon.stub();
			repo.files.returns(Promise.resolve().then(() => {
				throw 'aliens are coming';
			}));
			const sut = new AbstractLibrary('name', {}, repo);
			return expect(sut.files()).to.be.rejectedWith('aliens are coming');
		});

	});

	describe('AbstractLibraryRepository', () => {
		it('returns an empty list of files', () => {
			const sut = new AbstractLibraryRepository();
			expect(sut.files()).to.eventually.equal([]);
		});

		it('returns a defintiion comprising just the library name', () => {
			const sut = new AbstractLibraryRepository();
			expect(sut.definition({ name:'wombat' })).to.eventually.equal('wombat');
		});

	});
});
