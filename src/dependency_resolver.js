
//const semver = require('semver');

export class Dependency {
	constructor(name, version) {
		this.name = name;
		this.version = version;
	}
}


/**
 * Maintains state between invocations against a dependency resolver.
 */
export class DependencyResolverSession {

	constrctor(libraryRepo) {
		this.repo = libraryRepo;
	}

	dependencies(dependency) {

	}
}



/**
 * Encapsulates the logic required to resolve dependencies.
 */
export class DependencyResolver {


	/**
	 * Determines the transitive closure of dependencies from a given set of roots.
	 * @param {object} session   The dependency resolution session
	 * @param {Array<object>} roots     The dependency roots.
	 * @returns {object} something to please the linter
	 */
	collectDependencies(session, roots) {
		// iterate across the list of roots
		// for each root, fetch the subdependencies and add any that don't already
		// exist in the list to the end of the list.

		// after this, the list may contain multiple versions for a given library

	}

	resolveDependencies(session, dependencies) {
		// the dependencies are bucketed by library and version
		// then each version reduced to a single item (the most recent)

		// this provides the final list of dependencies for the given set of roots
	}

}

