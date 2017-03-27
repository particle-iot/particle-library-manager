
import { expect, sinon } from './test-setup';
import { LibraryContributor } from '../src/libcontribute';


describe('LibraryContributor', () => {
	const libraryDirectory = 'a/b/c';
	const libraryName = 'abcd';
	let repo, client, sut;

	beforeEach(() => {
		repo = {};
		client = {};
		sut = new LibraryContributor({ repo, client });
	});

	it('saves the client and repo', () => {
		expect(sut.repo).to.be.deep.equal(repo);
		expect(sut.client).to.be.deep.equal(client);
	});

	describe('_contribute()', () => {
		it('uses the client.contribute() method to contribute a stream', () => {
			client.contributeLibrary = sinon.stub();
			const stream = 'stream';
			sut._contribute(libraryName, stream);
			expect(client.contributeLibrary).to.have.been.calledWith(stream);
			expect(client.contributeLibrary).to.have.been.calledOnce;
		});
	});

	describe('_buildContributePromise', () => {
		it('tars the directory but doesn\'t contribute for a dry run', () => {
			sut._targzdir = sinon.stub().resolves({});
			sut._contribute = sinon.stub();
			const dryRun = true;
			const whitelist = ['*.*'];
			const exercise = sut._buildContributePromise(libraryDirectory, libraryName, whitelist, dryRun);
			const validate = () => {
				expect(sut._targzdir).to.be.calledWith(libraryDirectory, whitelist);
				expect(sut._contribute).to.not.have.been.called;
			};
			return exercise.then(validate);
		});

		it('tars the directory and contributes', () => {
			const pipe = 'pipe';
			sut._targzdir = sinon.stub().resolves(pipe);
			sut._contribute = sinon.stub();
			const dryRun = false;
			const exercise = sut._buildContributePromise(libraryDirectory, libraryName, dryRun);
			const validate = () => {
				expect(sut._targzdir).to.be.calledWith(libraryDirectory);
				expect(sut._contribute).to.have.been.calledWith(libraryName, pipe);
			};
			return exercise.then(validate);
		});
	});

	describe('_buildNotifyPromise', () => {
		function expectPromise(callbackPromise, callbackResult) {
			const notify = 'notifyMessage';
			const result = 'result';
			const promise = Promise.resolve(result);
			// duplicate the promise since sinon seems to detect that the original promise has
			// been resolved and uses the resolved value rather than the original promise for
			// call matching.
			const promise2 = Promise.resolve(result);
			const other1 = 'one';
			const other2 = 'two';
			const callback = sinon.stub().returns(callbackPromise);

			return sut._buildNotifyPromise(callback, notify, promise, other1, other2)
				.then((actualResult) => {
					expect(callback).to.have.been.calledWithMatch(notify, promise2, other1, other2);
					expect(actualResult).to.be.equal(callbackPromise ? callbackResult : result);
				});
		}

		it('returns the original promise when the callback returns a falsey value', () => {
			return expectPromise(false);
		});

		it('returns the overridden promise when the callback returns a truthy value', () => {
			return expectPromise(Promise.resolve(123), 123);
		});
	});

	describe('_buildValidatePromise', () => {
		describe('builds a promise that calls _validateLibrary', () => {
			afterEach(() => {
				expect(sut._validateLibrary).to.have.been.calledWith(repo, libraryName);
			});
		});

		function expectValidateResultSuccess(validateResult) {
			sut._validateLibrary = sinon.stub().resolves(validateResult);
			const exercise = () => sut._buildValidatePromise(libraryName);
			const validate = () => {};
			return exercise().then(validate);
		}

		it('validates with an empty result', () => {
			return expectValidateResultSuccess(undefined);
		});
		it('validates with a valid result', () => {
			return expectValidateResultSuccess({ valid: true });
		});
		it('fails with a invalid result and no details', () => {
			const validationResult = { valid: false };
			const verifyError = () => {
				throw Error('expected exception');
			};
			const verify = (error) => {
				expect(error.validate).to.be.deep.equal(validationResult);
				expect(error.message).to.be.equal('Library is not valid. ');
			};
			return expectValidateResultSuccess(validationResult)
				.then(verifyError).catch(verify);
		});

		it('fails with a invalid result and validation details', () => {
			const validationResult = { valid: false, errors: { sympathy: 'is needed' } };
			const verifyError = () => {
				throw Error('expected exception');
			};
			const verify = (error) => {
				expect(error.validate).to.be.deep.equal(validationResult);
				expect(error.message).to.be.equal('Library is not valid. sympathy is needed');
			};
			return expectValidateResultSuccess(validationResult)
				.then(verifyError).catch(verify);
		});
	});

	describe('_parseWhitelist', () => {
		it('parses undefined to an empty array', () => {
			expect(sut._parseWhitelist()).to.eql([]);
		});

		it('parses a comma separated list to an array', () => {
			expect(sut._parseWhitelist('*.cpp,*.h')).to.eql(['*.cpp', '*.h']);
		});
	});

	describe('_buildWhitelist', () => {
		it('appends the whitelist to the default whitelist', () => {
			expect(sut._buildWhitelist(['abc'], ['def', '123'])).eql(['abc', 'def', '123']);
		});

		it('appends the empty whitelist to the default whitelist', () => {
			expect(sut._buildWhitelist(['abc'], [])).eql(['abc']);
		});
	});

	describe('_buildMatchExpression', () => {
		it('trims each expression', () => {
			expect(sut._buildMatchExpression([' *.txt '])).to.equal('+(*.txt)');
		});

		it('trims each expression and joins with pipes', () => {
			expect(sut._buildMatchExpression([' *.txt ', 'a.b'])).to.equal('+(*.txt|a.b)');
		});
	});

	describe('_buildFilter', () => {
		let filter;
		const whitelist = ['*.in', 'LICENSE', '*.txt', 'b*.bin'];
		const results = {
			'a.in' : true,
			'A.IN' : true,  // case insensitive
			'a.inc' : false,
			'a.out' : false,
			'image.jpg' : false,
			'LICENSE' : true,
			'LICENSE.txt' : true,
			'LICENSE.' : false,
			'license' : true,
			'a.bin' : false,
			'b.bin' : true,
			'bozo.bin' : true,
			'somedir/b.bin' : true,      // glob is recursive by default
			'somedir/a.bin' : false,
			'.git/something.txt' : false,   // .git directory excluded
		};
		beforeEach(() => {
			filter = sut._buildFilter('', whitelist);
			expect(filter).isFunction;
		});

		for (const key of Object.keys(results)) {
			it((results[key] ? 'allows' : 'rejects') + ' the file '+key, () => {
				const listener = sinon.stub();
				sut.on('file', listener);
				const ignored = !results[key];
				expect(filter(key)).to.be.eql(ignored);
				expect(listener).to.have.been.called;
				expect(listener).to.have.been.calledWith(key, ignored);
			});
		}

	});

	describe('_doContributeLibrary', () => {
		it('calls _buildContributePromise', () => {
			const callback = sinon.stub();
			const whitelistString = '*.*';
			const whitelist = [whitelistString];
			sut._parseWhitelist = sinon.stub().returns(whitelist);
			sut._buildWhitelist = sinon.stub().returns(whitelist);
			sut._buildContributePromise = sinon.stub().resolves();
			sut._buildNotifyPromise = sinon.stub().resolves();
			const library = { name: libraryName, whitelist: whitelistString };
			const dryRun = 'dryRun';

			const exercise = sut._doContributeLibrary(callback, library, libraryDirectory, dryRun);
			const validate = () => {
				expect(sut._parseWhitelist).to.be.calledWith(whitelistString);
				expect(sut._buildWhitelist).to.be.calledWith(sinon.match.array, whitelist);
				expect(sut._buildContributePromise).to.be.calledWith(libraryDirectory, libraryName, whitelist, dryRun);
				expect(callback).to.be.calledWith('contributeComplete', library);
			};
			return exercise.then(validate);
		});
	});

	describe('contribute', () => {
		const contributeResult = 'contributeResult';
		beforeEach(() => {
			repo.libraryDirectory = sinon.stub().returns(libraryDirectory);
			sut._doContribute = sinon.stub().returns(contributeResult);
		});

		it('calls repo.libraryDirectory and passes that to _doContribute', () => {
			const callback = sinon.stub();
			const dryRun = 'dryRun';
			const result = sut.contribute(callback, libraryName, dryRun);
			expect(result).to.be.equal(contributeResult);
			expect(sut._doContribute).to.have.been.calledWith(callback, libraryName, libraryDirectory, dryRun);
		});

		afterEach(() => {
			expect(repo.libraryDirectory).to.have.been.calledWith(libraryName);
		});
	});

	describe('_doContribute', () => {
		const callback = sinon.stub();

		it('verify happy path', () => {
			const expectedResult = 123;
			const validatePromise = Promise.resolve({ valid:true });
			const setup = () => {
				sut._buildValidatePromise = sinon.stub().returns(validatePromise);
				sut._buildNotifyPromise = sinon.stub().resolves(validatePromise);
				sut._doContributeDirect = sinon.stub().resolves(expectedResult);
			};
			const dryRun = false;
			const exercise = () => sut._doContribute(callback, libraryName, libraryDirectory, dryRun);
			const verify = (result) => {
				expect(sut._buildValidatePromise).to.have.been.calledWith(libraryName);
				expect(sut._buildNotifyPromise).to.have.been.calledWith(callback, 'validatingLibrary', validatePromise, libraryDirectory);
				expect(sut._doContributeDirect).to.have.been.calledWith(callback, libraryName, libraryDirectory, dryRun);
				expect(result).equals(expectedResult);
			};

			return Promise.resolve().then(setup).then(exercise).then(verify);
		});

		it('propagates validation failure', () => {
			const validationError = new Error('didn\'t validate');
			const validatePromise = Promise.reject(validationError);
			const setup = () => {
				sut._buildValidatePromise = sinon.stub().returns(validatePromise);
				sut._buildNotifyPromise = sinon.stub().resolves(validatePromise);
				sut._doContributeDirect = sinon.stub();
			};

			const dryRun = false;
			const exercise = () => sut._doContribute(callback, libraryName, libraryDirectory, dryRun);
			const verify = (result) => {
				expect(sut._doContributeDirect).to.not.have.been.called;
				expect(result).to.be.equal(validationError);
			};
			const verifyFail = () => {
				throw Error('expected exception');
			};

			return Promise.resolve().then(setup).then(exercise).then(verifyFail).catch(verify);
		});
	});

	describe('targzdir', () => {
		let tmpdirobj;
		const path = require('path');
		const fs = require('fs');

		beforeEach(() => {
			const tmp = require('tmp');
			tmp.setGracefulCleanup();
			tmpdirobj = tmp.dirSync();
		});

		afterEach(() => {
			//require('tmp').removeCallback();
		});

		const files = {
			'src/file.cpp':'void f() { return 42;}',
			'src/file.h':'void f(); // meaning of life',
			'src/bigfile.bin' : 'ignored',
			'.gitignore':'me',
			'LICENSE': 'blah blah',
			'.git/blah':'gitty stuff'
		};

		function createFile(tmpdir, name, content) {
			const dir = path.join(tmpdir, path.dirname(name));
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir);
			}
			fs.writeFileSync(path.join(tmpdir, name), content);
		}

		function verifyFile(tmpdir, name, content) {
			const file = path.join(tmpdir, name);
			if (name.startsWith('.git/') || name.endsWith('.bin')) {
				expect(fs.existsSync(file), `file ${file} should not exist`).to.eql(false);
			} else {
				expect(fs.existsSync(file), `file ${file} should exist`).to.eql(true);
				expect(fs.readFileSync(file, 'utf-8'), `expected file ${file} content`).to.eql(content);
			}
		}

		it('makes a targz file that does not include the .git directory', () => {
			// given
			const tmpdir = tmpdirobj.name;
			Object.keys(files).forEach((key) => createFile(tmpdir, key, files[key]));
			const sut = new LibraryContributor({}, {});
			return sut._targzdir(tmpdir, ['*.cpp', '*.h', 'license', '.gitignore'])
				.then((stream) => {
					const resultdir = path.join(tmpdir, 'result');
					fs.mkdirSync(resultdir);

					const tarfs = require('tar-fs');
					const gunzip = require('gunzip-maybe');
					return new Promise((fulfill, reject) => {
						const extract = tarfs.extract(resultdir);
						extract.on('finish', fulfill);
						extract.on('error', reject);
						stream.pipe(gunzip()).pipe(extract);
					})
						.then(() => {
							Object.keys(files).forEach((key) => verifyFile(resultdir, key, files[key]));
						});
				});
		});
	});
});
