
export * from './librepo';
export * from './librepo_build';
export * from './librepo_fs';
export * from './librepo_cloud';

const path = require('path');
const appRoot = require('app-root-path').toString();

function resourcesDir() {
	return path.join(appRoot, 'resources');
}

export {
	resourcesDir
};
