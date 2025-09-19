import fse from 'fs-extra';
import path from 'path';
import { promises as fs } from 'fs';


/**
 * Processes a template file and replaces variables with values.
 * @param {string} templatePath - The path to the template file
 * @param {string} destinationPath - The path to the destination file
 * @param {object} options - The options to replace in the template
 * @return {Promise<void>} nothing
 */
export async function processTemplate ({ templatePath, destinationPath, options }){
	// open the template file
	let file = await fs.readFile(templatePath, 'utf8');

	for (const key in options) {
		const value = options[key];
		const regex = new RegExp(`<%-\\s*${key}\\s*%>`, 'g');
		file = file.replace(regex, value);
	}

	await fse.ensureDir(path.dirname(destinationPath));
	await fs.writeFile(destinationPath, file);
}
