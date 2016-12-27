#!/usr/bin/env node

'use strict';

var kill   = require('tree-kill');
var pidNum = null;

process.argv.slice(2).forEach(function (option) {
    try {
        pidNum = parseInt(option, 10);
    } catch (err) {
        console.error("Invalid PID given");
        process.exit(-1);
    }
});

if (pidNum === null) {
    console.error("No valid PID given");
    process.exit(-1);
}

console.log("Killing server process tree with root process id " + pidNum);
kill(pidNum);
