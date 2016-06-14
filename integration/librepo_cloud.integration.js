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

import {CloudLibraryRepository} from '../src/librepo_cloud'
import {FileSystemLibraryRepository} from "../src/librepo_fs";

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


describe('CloudLibraryRepository', () => {
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
});