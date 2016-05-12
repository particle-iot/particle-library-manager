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
 * Tests for real the Agent class using an external service.
 */

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;

import {BuildLibraryRepository} from '../src/librepo_build'

const endpoint = 'http://localhost:3000/';
// const endpoint = 'http://build.particle.io/';


describe('BuildLibraryRepository', () => {
	it('can fetch index', () => {
		const sut = new BuildLibraryRepository({endpoint});
		const result = sut.index();
		return result.then((result) => {
			expect(result).to.have.length.greaterThan(0);
			for (let lib of result) {
				expect(lib).to.have.property('id');
				expect(lib).to.have.property('title');
				expect(lib).to.have.property('content');
				expect(lib).to.have.property('version');
				expect(lib).to.have.property('visibility').equal('public');
			}
		});
	});

	it("can fetch names", () => {
		const sut = new BuildLibraryRepository({endpoint});
		const promise = sut.names().then((result) => {
			expect(result).to.have.length.greaterThan(0);
			expect(result).instanceOf(Array);
			for (let title of result) {
				expect(typeof title).to.be.equal('string');
			}
		});
		return promise;
	});
});