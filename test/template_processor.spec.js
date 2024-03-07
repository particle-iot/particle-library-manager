import { expect } from './test-setup';
import path from 'path';
import fs from 'fs-extra';
import { processTemplate } from '../src/util/template_processor';
const TEMP_PATH = path.join(__dirname, '../', 'tmp', 'library');

describe('Template Processor', () => {
	afterEach(async () => {
		await fs.remove(TEMP_PATH);
	});
	it('should replace variables with values', async () => {
		const templatePath = path.join(__dirname, '../', 'src', 'init', 'templates', 'src', 'library.cpp');
		const options = {
			Name_code: 'Test',
			name: 'test',
			author: 'author test'
		};
		await processTemplate({
			templatePath,
			destinationPath: path.join(TEMP_PATH, 'src', 'library.cpp'),
			options
		});
		const file = fs.readFileSync(path.join(TEMP_PATH, 'src', 'library.cpp'), 'utf8');
		expect(file).to.include('#include "test.h"');
		expect(file).to.include('Test::Test()');
		expect(file).to.include('test library by author test');
	});

	it('should replace variables without spaces with values', async () => {
		const templatePath = path.join(__dirname, '../', 'src', 'init', 'templates', 'src', 'library.h');
		const options = {
			Name_code: 'Test',
			name: 'test',
			author: 'author test'
		};
		await processTemplate({
			templatePath,
			destinationPath: path.join(TEMP_PATH, 'src', 'library.cpp'),
			options
		});
		const file = fs.readFileSync(path.join(TEMP_PATH, 'src', 'library.cpp'), 'utf8');
		expect(file).to.include('class Test');
	});
});
