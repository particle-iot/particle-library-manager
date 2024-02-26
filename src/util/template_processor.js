import fs from 'fs-extra';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';


export async function processTemplate ({ templatePath, destinationPath, options }){
	// open the template file
	let file = await readFile(templatePath, 'utf8');

	for (const key in options) {
		const value = options[key];
		const regex = new RegExp(`<%-\\s*${key}\\s*%>`, 'g');
		file = file.replace(regex, value);
	}
	// write the file to the destination path
	// ensure the directory exists
	await fs.ensureDir(path.dirname(destinationPath));
	await writeFile(destinationPath, file);

}

