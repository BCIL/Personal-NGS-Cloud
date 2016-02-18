/*
 * grunt-if
 * https://github.com/tylerbeck/grunt-if
 *
 * Copyright (c) 2014 Tyler Beck
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function( grunt ) {

    var q = require('q');

    // Project configuration.
    grunt.initConfig( {

        configBoolean: true,
        configString: "test",
        configInt: 5,


        jshint: {
            all: [
                'Gruntfile.js',
                'tasks/*.js',
                '<%= nodeunit.tests %>'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        // Before generating any new files, remove any previously-created files.
        clean: {
            tests: ['tmp']
        },

        // Configuration to be run (and then tested).
        if: {
            testConfigBoolean:{
                options:{
                    config: 'configBoolean'
                },
                ifFalse: [ 'ifFalse:testConfigBoolean' ],
                ifTrue: [ 'ifTrue:testConfigBoolean' ]
            },
            testConfigBooleanFalse:{
                options:{
                    config: {
                        property: 'configBoolean',
                        operand: '=',
                        value: false
                    }
                },
                ifFalse: [ 'ifFalse:testConfigBooleanFalse' ],
                ifTrue: [ 'ifTrue:testConfigBooleanFalse' ]
            },
            testConfigMissing:{
                options:{
                    config: 'configMissing'
                },
                ifFalse: [ 'ifFalse:testConfigMissing' ],
                ifTrue: [ 'ifTrue:testConfigMissing' ]
            },
            testConfigString:{
                options:{
                    config: 'configString'
                },
                ifFalse: [ 'ifFalse:testConfigString' ],
                ifTrue: [ 'ifTrue:testConfigString' ]
            },
            testConfigStringEquals:{
                options:{
                    config: {
                        property: 'configString',
                        value: 'test'
                    }
                },
                ifFalse: [ 'ifFalse:testConfigStringEquals' ],
                ifTrue: [ 'ifTrue:testConfigStringEquals' ]
            },
            testConfigStringNotEquals:{
                options:{
                    config: {
                        property: 'configString',
                        operand: '!=',
                        value: 'test'
                    }
                },
                ifFalse: [ 'ifFalse:testConfigStringNotEquals' ],
                ifTrue: [ 'ifTrue:testConfigStringNotEquals' ]
            },
            testConfigIntEquals:{
                options:{
                    config: {
                        property: 'configInt',
                        operand: '=',
                        value: 5
                    }
                },
                ifFalse: [ 'ifFalse:testConfigIntEquals' ],
                ifTrue: [ 'ifTrue:testConfigIntEquals' ]
            },
            testConfigIntNotEquals:{
                options:{
                    config: {
                        property: 'configInt',
                        operand: '!=',
                        value: 5
                    }
                },
                ifFalse: [ 'ifFalse:testConfigIntNotEquals' ],
                ifTrue: [ 'ifTrue:testConfigIntNotEquals' ]
            },
            testConfigIntGreater:{
                options:{
                    config: {
                        property: 'configInt',
                        operand: '>',
                        value: 1
                    }
                },
                ifFalse: [ 'ifFalse:testConfigIntGreater' ],
                ifTrue: [ 'ifTrue:testConfigIntGreater' ]
            },
            testConfigIntLess:{
                options:{
                    config: {
                        property: 'configInt',
                        operand: '>',
                        value: 10
                    }
                },
                ifFalse: [ 'ifFalse:testConfigIntLess' ],
                ifTrue: [ 'ifTrue:testConfigIntLess' ]
            },
            testTrue:{
                options:{
                    test: function(){
                        return true;
                    }
                },
                ifFalse: [ 'ifFalse:testTrue' ],
                ifTrue: [ 'ifTrue:testTrue' ]
            },
            testFalse:{
                options:{
                    test: function(){
                        return false;
                    }
                },
                ifFalse: [ 'ifFalse:testFalse' ],
                ifTrue: [ 'ifTrue:testFalse' ]
            },
            testAll:{
                options:{
                    test: [
                        function(){
                            return true;
                        },
                        function(){
                            return false;
                        }
                    ]
                },
                ifFalse: [ 'ifFalse:testAll' ],
                ifTrue: [ 'ifTrue:testAll' ]
            },
            testAsyncTrue: {
                options:{
                    test: function() {
                        var d = q.defer();

                        setTimeout( function() {
                            d.resolve( true );
                        }, 1000 );

                        return d.promise;
                    }
                },
                ifFalse: [ 'ifFalse:testAsyncTrue' ],
                ifTrue: [ 'ifTrue:testAsyncTrue' ]
            },
            testAsyncFalse: {
                options:{
                    test: function() {
                        var d = q.defer();

                        setTimeout( function() {
                            d.reject( 'test failed' );
                        }, 1000 );

                        return d.promise;
                    }
                },
                ifFalse: [ 'ifFalse:testAsyncFalse' ],
                ifTrue: [ 'ifTrue:testAsyncFalse' ]
            },
            executableTrue:{
                options:{
                    executable: 'npm'
                },
                ifFalse: [ 'ifFalse:executableTrue' ],
                ifTrue: [ 'ifTrue:executableTrue' ]

            },
            executableFalse:{
                options:{
                    executable: 'doesnotexist'
                },
                ifFalse: [ 'ifFalse:executableFalse' ],
                ifTrue: [ 'ifTrue:executableFalse' ]
            }

        },

        // Unit tests.
        nodeunit: {
            tests: ['test/*_test.js']
        },

        bump: {
            options: {
                files: ['package.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['package.json'],
                createTag: true,
                tagName: 'v%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: false,
                pushTo: 'upstream',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                regExp: false
            }
        }


    } );

    // Actually load this plugin's task(s).
    grunt.loadTasks( 'tasks' );

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks( 'grunt-bump' );
    grunt.loadNpmTasks( 'grunt-contrib-jshint' );
    grunt.loadNpmTasks( 'grunt-contrib-clean' );
    grunt.loadNpmTasks( 'grunt-contrib-nodeunit' );

    // Whenever the "test" task is run, first clean the "tmp" dir, then run this
    // plugin's task(s), then test the result.
    grunt.registerTask( 'test', ['clean', 'createResults', 'if', 'nodeunit'] );

    // By default, lint and run all tests.
    grunt.registerTask( 'default', ['jshint', 'test'] );

    grunt.registerTask( 'createResults', function(){
       grunt.file.write( 'tmp/results.json', '{}' );
    });

    function writeResults( test, value ){
        console.log( 'writeResults: '+test+' = '+value );
        var path = 'tmp/results.json';
        var results = grunt.file.readJSON( path );
        results[ test ] = value;
        grunt.file.write( path, JSON.stringify( results, undefined, "   " ) );
    }

    grunt.registerTask( 'ifFalse', function(){
        writeResults( this.args[ 0 ], false );
    });

    grunt.registerTask( 'ifTrue', function(){
        writeResults( this.args[ 0 ], true );
    });

};
