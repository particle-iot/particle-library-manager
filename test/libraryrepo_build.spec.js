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

import {BuildLibraryRepository} from '../src/librepo_build';
import {Agent} from '../src/agent';

describe('Build Library Repo', () => {
	it('is constructed with the endpoint url', () => {
		const endpoint = 'abcde';
		const sut = new BuildLibraryRepository({endpoint});
		expect(sut).has.property('endpoint').which.is.equal(endpoint);
		expect(sut).has.property('agent').which.is.instanceOf(Agent);
	});

	it('fetches the library index using an agent', sinon.test(() => {
		const sut = new BuildLibraryRepository({endpoint:'abc.com/'});
		const agent = sinon.stub(sut.agent);
		agent.get.returns(Promise.reject('unknown function'));
		agent.get.withArgs('abc.com/libs.json').returns(Promise.resolve({body:'123'}));
		return expect(sut.index()).to.eventually.equal('123');
	}));
});
