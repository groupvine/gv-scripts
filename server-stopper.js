#!/usr/bin/env node

'use strict';

var kill       = require('tree-kill');
var path       = require('path');
var fs         = require('fs');
var spawner    = require('child_process');

// 
// Process args
//

function showUsage() {
    console.log('Usage: [sudo] stop <process ID>|<process ID file path> [options]');
    console.log("  -d, --basedir     Base directory (required)");
    console.log('  If not given, default process ID fetched from bin/server.pid, if available');
}

var pidNum         = null;
var baseDir        = null;
var baseDirFlag    = false;
var pidPath        = null;

// First, get the path to the preferred node version being run
var nodejs = process.argv[0];

process.argv.slice(2).forEach(function (option) {
    option = option.trim();
    
    if ( baseDirFlag ) {
        baseDirFlag = false;
        baseDir = option;
        
        if ( !fs.existsSync(baseDir) ) {
            console.error("Invalid base directory " + baseDir + ", exiting");
            process.exit(-1);
        }

    } else if (option[0] == '-') {
        switch(option) {
        case '-d': case '--basedir':
            if ( baseDir === null ) {
                baseDirFlag = true; 
            }
            break;
        default:
            showUsage();
            process.exit(-1);
        }

    } else if (pidNum === null && pidPath === null) {
        pidNum = parseInt(option, 10);
        
        if (!pidNum) {
            pidPath = option;
            // showUsage();
            // process.exit(-1);
        }
    } else {
        showUsage();
        process.exit(-1);
    }
});


if (!pidPath) {
    if ( baseDir === null ) {
        console.error("Must either provid path to PID file, or specify base directory (with -d flag)");
        showUsage();
        process.exit(-1);
    }   

    pidPath    = path.resolve(baseDir, 'bin', 'server.pid');
}

var killerPath = path.resolve(__dirname, 'server-stopper-kill.js');

// 
// If not in command args, get process ID from server.pid file
//

var pidFileUsed = false;

if (!pidNum) {
    var fileStat = null;
    try {
        fileStat = fs.statSync(pidPath);
    } catch (err) {
        // continue
    }

    if ( !fileStat || !fileStat.isFile() ) {
        // Fail more gracefully now since we now typically use 'kill' or 'fkill' to ensure process is stopped
        console.log("Note that no PID was given and no server.pid file found");
        // showUsage();
        process.exit(-1);
    }

    pidFileUsed = true;

    try {
        pidNum = fs.readFileSync(pidPath);
        pidNum = parseInt(pidNum, 10);
    } catch (err) {
        // Fail more gracefully now since we now typically use 'kill' or 'fkill' to ensure process is stopped
        console.log("Note that a process ID could not be determined nor a valid PID found in server.pid");
        // showUsage();
        process.exit(-1);
    }
}

//
// Issue kill
//

console.log("Killing server process(es) rooted with process " + pidNum);
spawner.execSync('sudo ' + nodejs + ' ' + killerPath + ' ' + pidNum);

// Remove file
if ( pidFileUsed ) {
    fs.unlinkSync(pidPath);
}

