'use strict';

var grunt = require('grunt');

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

var testProps = [
  'testConfigBoolean',
  'testConfigBooleanFalse',
  'testConfigMissing',
  'testConfigString',
  'testConfigStringEquals',
  'testConfigStringNotEquals',
  'testConfigIntEquals',
  'testConfigIntNotEquals',
  'testConfigIntGreater',
  'testConfigIntLess',
  'testTrue',
  'testFalse',
  'testAll',
  'testAsyncTrue',
  'testAsyncFalse',
  'executableTrue',
  'executableFalse'
];

var tests = {
  setUp: function( done ) {
    // setup here if necessary
    done();
  }
};

testProps.forEach( function( prop ) {
  tests[ prop ] = function( test ) {
    test.expect( 1 );
    var actual = grunt.file.readJSON( 'tmp/results.json' )[prop];
    var expected = grunt.file.readJSON( 'test/expected/results.json' )[prop];
    //var expected = grunt.file.readJSON( 'test/expected/results.json' )[prop];
    test.equal( actual, expected, prop + ' result not expected ' );
    test.done();
  };
} );

exports.if = tests;
