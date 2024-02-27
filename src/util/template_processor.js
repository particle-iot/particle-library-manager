import fs from 'fs-extra';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';

/**
 * Processes a template file and replaces variables with values.
 * @param {string} templatePath - The path to the template file
 * @param {string} destinationPath - The path to the destination file
 * @param {object} options - The options to replace in the template
 * @return {Promise<void>} nothing
 */
export async function processTemplate ({ templatePath, destinationPath, options }){
	// open the template file
	let file = await readFile(templatePath, 'utf8');

	for (const key in options) {
		const value = options[key];
		const regex = new RegExp(`<%-\\s*${key}\\s*%>`, 'g');
		file = file.replace(regex, value);
	}

	await fs.ensureDir(path.dirname(destinationPath));
	await writeFile(destinationPath, file);
}

