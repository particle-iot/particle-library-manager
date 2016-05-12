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

import {LibraryNotFoundError, LibraryRepositoryError, LibraryFormatError} from '../src/librepo';
import {LibraryRepository, Library, LibraryFile} from '../src/librepo';

const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;

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
				const sut = new LibraryFormatError(repo, library, 'bad mojo');

				expect(sut.library).to.equal(library);
				expect(sut.repo).to.equal(repo);
				expect(sut.message).to.equal('bad mojo');
				expect(sut.name).to.equal('LibraryFormatError');
			});
		});

	});

	describe('Library', () => {

		it('has a name', () => {
			let sut = new Library('Borgian');
			expect(sut.name).to.equal('Borgian');
		});

		it('has no files', () => {
			let sut = new Library();
			return expect(sut.files()).to.eventually.have.length(0);
		});
	});

	describe('LibraryFile', () => {
		it('has a name and a type', () => {
			let name = {};
			let type = {};
			let sut = new LibraryFile(name, type);
			expect(sut.name).to.equal(name);
			expect(sut.type).to.equal(type);
		});

		it('has streamable content', () => {
			let sut = new LibraryFile('name', 'type');
			let stream = {end: sinon.spy()};
			let p = sut.content(stream);
			expect(stream.end).to.be.calledOnce;
			return expect(p).to.eventually.equal(stream);
		});
	});

	describe('LibraryRepository', () => {
		it('raises an error when fetching a library by name', () => {
			let sut = new LibraryRepository();
			return expect(sut.fetch('uberlib')).eventually.rejected.deep.equal(new LibraryNotFoundError(sut, 'uberlib'));
		});

		it('has no libraries', () => {
			let sut = new LibraryRepository();
			return expect(sut.names()).eventually.to.have.length(0);
		});
	});

});
