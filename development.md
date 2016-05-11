

## Setting up WebStorm for ES6

http://blog.jetbrains.com/webstorm/2015/05/ecmascript-6-in-webstorm-transpiling/


To transpile tests (which takes longer)

```
--compilers js:babel-register
```

to The Debug/Run configurations for Mocha.

With WebStorm automatically running Babel in the background on file changes, tests run quicker
when run directly from the transpiled sources.