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

import 'babel-polyfill';
const fs = require('fs');
const promisify = require('es6-promisify');

import {LibraryRepository, Library} from './librepo';


export function getdirs(rootDir) {
	const stat = promisify(fs.stat);
	const readdir = promisify(fs.readdir);
	return readdir(rootDir)
		.then(files => {
			const dirPromises = files.map(file => {
				const filePath = rootDir + '/' + file;
				return stat(filePath)
					.then(stat => stat.isDirectory())
					.catch(error => false);
			});
			return Promise
				.all(dirPromises)
				.then(isDir => {
					return files.filter((_,i) => {
						const result = isDir[i];
						return result;
					});
				});
		});
}

export const libraryProperties = 'library.properties';

export class FileSystemLibrary extends Library
{

}


export class FileSystemLibraryRepository extends LibraryRepository {

	constructor(path) {
		super();
		this.path = path;
	}

	/**
	 * Locates the folder corresponding to the library.
	 * @param {string} name The name of the library to fetch.
	 * @return {Library} the library found
	 */
	fetch(name) {
		const filePath = this.descriptorFile(name);
		this.readJSON(filePath)
			.then(descriptor => this.buildLibrary(descriptor));
	}

	descriptorFile(name) {
		return this.path + '/' + name + '/' + libraryProperties;
	}

	readJSON(filename) {
		return fs.readFile(filename, 'utf8').then(JSON.parse);
	}

	buildLibrary(descriptor) {
		return null;
	}

	/**
	 * Finds the directories under the given path for this repo that contain a
	 * `library.properties` file.
	 * @returns {Promise.<Array.<String>>} The names of libraries in this repo.
	 */
	names() {
		const stat = promisify(fs.stat);
		return getdirs(this.path, stat).then(dirs => {
			const libPromises = dirs.map(dir => {
				const filePath = this.descriptorFile(dir);
				return stat(filePath)
					.then(stat => stat.isFile())
					.catch(error => false);
			});

			return Promise.all(libPromises).then(isLib => {
				return dirs.filter((_, i) => isLib[i]);
			});
		});
	}

}


