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

const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;

import {BuildLibraryRepository, BuildLibrary} from '../src/librepo_build';
import {Agent} from '../src/agent';

describe('Build', () => {

	describe('Library Repo', () => {
		it('is constructed with the endpoint url', () => {
			const endpoint = 'abcde';
			const sut = new BuildLibraryRepository({endpoint});
			expect(sut).has.property('endpoint').which.is.equal(endpoint);
			expect(sut).has.property('agent').which.is.instanceOf(Agent);
		});

		it('fetches the library index using an agent', sinon.test(() => {
			const sut = new BuildLibraryRepository({endpoint: 'abc.com/'});
			const agent = sinon.stub(sut.agent);
			agent.get.returns(Promise.reject('unknown args'));
			agent.get.withArgs('abc.com/libs.json').returns(Promise.resolve({body: '123'}));
			return expect(sut.index()).to.eventually.equal('123');
		}));

		it('rubs the lotion on its skin or it gets the hose again', () => {
			const sut = Promise.reject('the lotion');
			expect(sut).eventually.reject;
		});

		it('fetches library names', sinon.test(()=> {
			const sut = new BuildLibraryRepository({endpoint: 'abc.com/'});
			const index = sinon.stub(sut, 'index');
			index.returns(Promise.resolve([{title: 'lib1'}, {title: 'lib2'}]));
			return expect(sut.names()).eventually.deep.equal(['lib1', 'lib2']);
		}));

		it('fetches known libraries', sinon.test(() => {
			const sut = new BuildLibraryRepository({endpoint: '$$$/'});
			const get = sinon.stub(sut, 'get');
			const lib = {title: 'uberlib', id: '123'};
			get.returns(Promise.reject('unknown args'));
			get.withArgs('libs.json', {name: 'uberlib'}).returns(Promise.resolve([lib]));
			return expect(sut.fetch('uberlib')).eventually.deep.equal(new BuildLibrary('uberlib', lib, sut));
		}));

		it('throws exception for unknown libraries', sinon.test(() => {
			const sut = new BuildLibraryRepository({endpoint: '$$$/'});
			const get = sinon.stub(sut, 'get');
			get.returns(Promise.reject('unknown args'));
			get.withArgs('libs.json', {name: 'uberlib'}).returns(Promise.resolve([]));
			return expect(sut.fetch('uberlib')).eventually.rejectedWith('library \'uberlib\' not found in repo \'[object Object]\'.');
		}));
	});
});
