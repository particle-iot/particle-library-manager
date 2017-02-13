# Changelog

## 0.1.10 - 7 February 2017

- updated library resources to include the architectures flag. Fixes migration tests in the CLI.

## 0.1.9

- Comment out some library fields in template
- Make sentence mandatory during validation
- Handle architectures during migration

## 0.1.7

- Migrate examples in nested subdirectories

## 0.1.6

- Fix validation and tarball creation on Windows

## 0.1.5

- fix [case sensitivity issue](https://github.com/spark/particle-library-manager/issues/17)

## 0.1.4

- adds longest common directory prefix calculation for a list of filenames. 

## 0.1.3

- Polish library template for init
- Generate project to compile example on the fly

## 0.1.2

- bump mock-fs dependency version to fix babel-polyfill problems running the test
- Add support for the architectures multi-value property
- Pass the version number when installing a library

## 0.1.1

- Allow 'special' characters in the library name (such as +)

## 0.1.0

- Add library validation
- Add library publish
- Separate contribute/publish
- Make yeoman an optional dependency


## 0.0.4 - 2016-07-06

- Small fixes

## 0.0.3 - 2016-07-03

- Add library migration

## 0.0.2 - 2016-05-25

- added src/index.js to re-export key library items to hide internal structure from clients
- excluded unneeded items in .npmignore


## 0.0.1 - 2016-05-23

- Build library repository
- File system library repository
- 100% unit test coverage

