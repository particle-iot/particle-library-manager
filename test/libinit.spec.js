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

import { expect, sinon } from './test-setup';

const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const timekeeper = require('timekeeper');


import { LibraryInitGenerator } from '../src/libinit';
const TEMP_PATH = path.join(__dirname, '../', 'tmp', 'library');

describe('library initialize', function doit() {
	const testData = { name: 'nominative', version: '1.2.3', author: 'Borges <borges@example.com>' };

	before(function freezeTime() {
		timekeeper.freeze(Date.parse('2015-12-15'));
	});

	after(async function releaseTime() {
		timekeeper.reset();
		await fsExtra.remove(TEMP_PATH);
	});

	/**
	 * Asserts that a generated (actual) file matches the expected file in the test fixture.
	 * @param {string} expected  The name of the expected file. This is read from the `generator` folder at
	 *  the same level as these tests.
	 * @param {string} actual    The name of the actual file created. Assumes equal to 'expected' if not defined.
	 * @returns {nada} nothing
	 */
	function assertGeneratedContent(expected, actual) {
		if (actual === undefined) {
			actual = expected;
		}
		const expectedContent = fs.readFileSync(path.join(__dirname,'./generator/', expected), 'utf8');
		const actualContent = fs.readFileSync(path.join(TEMP_PATH, actual), 'utf8');
		expect(expectedContent).to.equal(actualContent);
	}

	/**
	 * Validates that the library files are created that match the files in the test fixture.
	 * @returns {undefined} nothing. nada. I exist only to pacify linting rules.
	 */
	function validateOutput() {
		assertGeneratedContent('library.properties');
		assertGeneratedContent('README.md');
		assertGeneratedContent('LICENSE');
		assertGeneratedContent('src/nominative.cpp');
		assertGeneratedContent('src/nominative.h');
		assertGeneratedContent('examples/usage/usage.ino');
	}

	describe('generator', () => {
		const prompt = sinon.stub().resolves();

		it('interpolates all template files', async () => {
			this.timeout(30000);
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut._destinationRoot = TEMP_PATH;
			await sut.run({ options: testData });
			expect(sut.prompt).to.have.been.calledWith([]);
			validateOutput();
		});

		it('should prompt for all properties if not provided', async () => {
			this.timeout(30000);
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves(testData) });
			sut._destinationRoot = TEMP_PATH;
			await sut.run();
			validateOutput();
		});

		it('sets the year from the "year" options', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = { year: 1234 };
			const date = new Date();
			sut._setYear(date);
			expect(sut.options.year).to.eql(1234);
		});

		it('sets the year from the current year when "year" option not defined', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = {};
			const date = new Date();
			sut._setYear(date);
			expect(sut.options.year).to.eql(date.getFullYear());
		});


		it('sets the output directory from the "dir" option', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = { dir: 'abcd' };
			sut.destinationRoot = sinon.stub();
			sut._setOutputDir();
			expect(sut.destinationRoot).to.have.been.calledWith('abcd');
		});

		it('does not set the output directory when the dir option is not present', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = { };
			sut.destinationRoot = sinon.stub();
			sut._setOutputDir();
			expect(sut.destinationRoot).to.have.not.been.called;
		});

		it('sets the name_code option to the code-safe name with the first letter lowercased', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = {};
			sut._handlePrompts({ name:'SparkLib++' });
			expect(sut.options).to.have.property('name_code').equal('sparkLib');
		});

		it('sets the Name_code option to the code-safe name with first letter capitalized', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = {};
			sut._handlePrompts({ name:'my-lib++' });
			expect(sut.options).to.have.property('Name_code').equal('Mylib');
		});

		it('does not set the Name_code option when name is not present', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			sut.options = {};
			sut._handlePrompts({ name2:'abcd' });
			expect(sut.options).to.not.have.property('Name_code');
		});

		describe('validation', () => {
			const nameError = 'name: must only contain letters, numbers, dashes, underscores and plus signs';
			const versionError = 'version: must be formatted like 1.0.0';
			it('validates the name', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = {};
				expect(() => sut._handlePrompts({ name:'ab/cd' })).to.throw(nameError);
			});

			it('validates the version', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = {};
				expect(() => sut._handlePrompts({ version:'ab/cd' })).to.throw(versionError);
			});

			it('validates the author, which is freeform', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = {};
				expect(() => sut._handlePrompts({ author:'ab/cd' })).to.not.throw();
			});

			it('validates the initial name value', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = { name: '//' };
				expect(() => sut._checkFields()).to.throw(nameError);
			});

			it('validates the initial version value', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = { version: '//' };
				expect(() => sut._checkFields()).to.throw(versionError);
			});

			it('validates the initial version value when set as a number', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = { version: 123 };
				expect(() => sut._checkFields()).to.throw(versionError);
			});


			it('validates the prompts', () => {
				const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
				sut.options = {};
				const prompts = sut._allPrompts();
				expect(prompts).has.property('length').equal(3);

				expect(prompts[0].validate('ab/cd')).to.equal(nameError + '.');
				expect(prompts[1].validate('ab/cd')).to.equal(versionError);
				expect(prompts[2].validate('ab/cd')).to.be.true;
			});
		});

		it('the _prompt method configures and fetches options', () => {
			const sut = new LibraryInitGenerator({ prompt: prompt.resolves() });
			// given
			sut._setYear = sinon.stub();
			sut._setOutputDir = sinon.stub();
			sut._allPrompts = sinon.stub().returns('abcd');
			sut._handlePrompts = sinon.stub().returns('handled');
			sut.prompt = sinon.stub().returns(Promise.resolve({ name:'123' }));
			// when
			return sut._prompt()
				.then((result) => {
					expect(result).to.be.equal('handled');
					expect(sut._handlePrompts).to.have.been.calledWith({ name:'123' });
					expect(sut._allPrompts).to.have.been.calledOnce;
					expect(sut._setOutputDir).to.have.been.calledOnce;
				});
		});
	});
});
