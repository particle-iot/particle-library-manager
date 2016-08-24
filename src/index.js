
export * from './librepo';
export * from './librepo_build';
export * from './librepo_fs';
export * from './libinit';
export * from './librepo_cloud';
export * from './validation';

const path = require('path');

const appRoot = require('../approot').root;

function resourcesDir() {
	return path.join(appRoot, 'resources');
}

export {
	appRoot,
	resourcesDir
};
