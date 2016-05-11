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

let chai = require('chai');
let sinon = require('sinon');
import {BuildLibraryRepository} from "../src/librepo_build";
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
let expect = chai.expect;


describe("Build Library Repo", () => {
   it("is constructed with the endpoint url", () => {
       let endpoint = "http://build.particle.io/libs";
       let sut = new BuildLibraryRepository(endpoint);
       expect(sut).has.property("endpoint").which.is.equal(endpoint)
   });
});