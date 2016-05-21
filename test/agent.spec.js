import {Agent} from '../src/agent.js';

const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;

describe('agent', () => {
	describe('sanitize', () => {
		it('canitizes empty file list', () => {
			const sut = new Agent();
			expect(sut._sanitize({})).to.be.deep.equal({});
		});

		it('sanitizes file names', () => {
			const sut = new Agent();
			const original = {'one': 'content1', 'two': 'content2'};
			const actual = sut._sanitize(original);
			expect(actual).to.be.ok;
			expect(actual).to.have.property('file');
			expect(actual).to.have.property('file2');
			for (let value of Object.values(actual)) {
				expect(value).to.have.property('path').oneOf(Object.keys(original));
				expect(value).to.have.property('data').equal(original[value.path]);
			}
		});

		it('can get a resource', () => {
			const sut = new Agent();
			sut.request = sinon.stub();
			sut.request.returns('123');
			expect(sut.get('abcd', 'auth', 'query')).to.be.equal('123');
			expect(sut.request).to.be.calledWith({auth: 'auth', method: 'get', query: 'query', uri: 'abcd'});
		});

		it('can head a resource', () => {
			const sut = new Agent();
			sut.request = sinon.stub();
			sut.request.returns('123');
			expect(sut.head('abcd', 'auth')).to.be.equal('123');
			expect(sut.request).to.be.calledWith({auth: 'auth', method: 'head', uri: 'abcd'});
		});

		it('can post a resource', () => {
			const sut = new Agent();
			sut.request = sinon.stub();
			sut.request.returns('123');
			expect(sut.post('abcd', 'data', 'auth')).to.be.equal('123');
			expect(sut.request).to.be.calledWith({auth: 'auth', method: 'post', data:'data', uri: 'abcd'});
		});

		it('can put a resource', () => {
			const sut = new Agent();
			sut.request = sinon.stub();
			sut.request.returns('123');
			expect(sut.put('abcd', 'data', 'auth')).to.be.equal('123');
			expect(sut.request).to.be.calledWith({auth: 'auth', method: 'put', data:'data', uri: 'abcd'});
		});

		it('can delete a resource', () => {
			const sut = new Agent();
			sut.request = sinon.stub();
			sut.request.returns('123');
			expect(sut.delete('abcd', 'data', 'auth')).to.be.equal('123');
			expect(sut.request).to.be.calledWith({auth: 'auth', method: 'delete', data:'data', uri: 'abcd'});
		});
	});

	describe('authorize', () => {
		it('authorize no auth is unchanged', () => {
			const sut = new Agent();
			expect(sut._authorizationHeader({})).to.be.deep.equal({});
		});

		it('authorize with object', () => {
			const sut = new Agent();
			const authfn = sinon.spy();
			const req = {auth: authfn};
			const auth = {username: 'me', password: 'pwd'};
			expect(sut._authorizationHeader(req, auth)).to.be.equal(req);
			expect(authfn).to.have.been.calledWith('me', 'pwd');
		});

		it('authorize with bearer', () => {
			const auth = '123';
			const bearer = 'Bearer 123';
			const sut = new Agent();
			const setfn = sinon.spy();
			const req = {set: setfn};
			expect(sut._authorizationHeader(req, auth)).to.be.equal(req);
			expect(setfn).to.have.been.calledWith({Authorization: bearer});
		});
	});

	describe('build request', () => {
		it('uses prefix if provided', () => {
			const sut = new Agent();
			sut.prefix = 'abc';
			const use = sinon.stub();
			const req = sinon.stub();
			req.returns({use: use});
			const result = sut._buildRequest({uri: 'uri', method: 'get', makerequest: req});
			expect(result).to.be.ok;
			expect(req).to.be.calledWith('get', 'uri');
			expect(use).to.be.calledWith('abc');
		});

		it('does not call used if no prefix provided', () => {
			const sut = new Agent();
			const use = sinon.stub();
			const req = sinon.stub();
			req.returns({use: use});
			const result = sut._buildRequest({uri: 'uri', method: 'get', makerequest: req});
			expect(result).to.be.ok;
			expect(req).to.be.calledWith('get', 'uri');
			expect(use).to.be.notCalled;
		});

		it('should invoke authorize with the request and auth', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const request = {};
			const req = sinon.stub();
			req.returns(request);
			const authorize = sinon.stub();
			sut._authorizationHeader = authorize;
			sut._buildRequest({uri: 'uri', method: 'get', auth: '123', makerequest: req});
			expect(authorize).to.be.calledWith(sinon.match.same(request), '123');
		});

		it('should invoke query with the given query', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const query = sinon.stub();
			const req = sinon.stub();
			req.returns({query: query, authorize: sinon.stub()});
			sut._buildRequest({uri: 'uri', method: 'get', query: '123', makerequest: req});
			expect(query).to.be.calledWith('123');
		});

		it('should not query when no query given', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const query = sinon.stub();
			const req = sinon.stub();
			req.returns({query: query, _authorizationHeader: sinon.stub()});
			sut._buildRequest({uri: 'uri', method: 'get', makerequest: req});
			expect(query).to.be.notCalled;
		});

		it('should invoke send when data given', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const req = sinon.stub();
			const send = sinon.stub();
			req.returns({send: send});
			sut._buildRequest({uri: 'uri', method: 'get', data: 'abcd', makerequest: req});
			expect(send).to.be.calledWith('abcd');
		});

		it('should setup form send when form data is given', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const req = sinon.stub();
			const send = sinon.stub();
			const type = sinon.stub();
			req.returns({send: send, type: type});
			sut._buildRequest({uri: 'uri', method: 'get', form: 'abcd', makerequest: req});
			expect(send).to.be.calledWith('abcd');
			expect(type).to.be.calledWith('form');
		});

		it('should attach files', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const req = sinon.stub();
			const attach = sinon.stub();
			req.returns({attach: attach});
			const files = {
				file: {data: 'filedata', path: 'filepath'},
				file2: {data: 'file2data', path: 'file2path'}
			};
			sut._buildRequest({uri: 'uri', method: 'get', files: files, makerequest: req});
			expect(attach.callCount).to.be.equal(2);
			expect(attach).to.be.calledWith('file', 'filedata', 'filepath');
			expect(attach).to.be.calledWith('file2', 'file2data', 'file2path');
		});

		it('should attach files and form data', () => {
			const sut = new Agent();
			sut.prefix = undefined;
			const req = sinon.stub();
			const attach = sinon.stub();
			const field = sinon.stub();
			req.returns({attach: attach, field: field});
			const files = {
				file: {data: 'filedata', path: 'filepath'},
				file2: {data: 'file2data', path: 'file2path'}
			};
			const form = {form1: 'value1', form2: 'value2'};
			sut._buildRequest({uri: 'uri', method: 'get', files: files, form: form, makerequest: req});
			expect(attach.callCount).to.be.equal(2);
			expect(attach).to.be.calledWith('file', 'filedata', 'filepath');
			expect(attach).to.be.calledWith('file2', 'file2data', 'file2path');
			expect(field.callCount).to.be.equal(2);
			expect(field).to.be.calledWith('form1', 'value1');
			expect(field).to.be.calledWith('form2', 'value2');
		});
	});
});
