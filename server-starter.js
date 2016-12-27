#!/usr/bin/env node

'use strict';

var path       = require('path');
var fs         = require('fs');
var spawner    = require('child_process');

// 
// Process args
//

function showUsage() {
    console.log('Usage: start <server name> [options]');
    console.log('  Options:');
    console.log("  -d, --basedir     Base directory (required)");
    console.log("  -b, --build       Build CSS & JS before running");
    console.log("  -f, --foreground  Don't spawn separate process");
    console.log("  -g, --debug       Debug mode");
}

var now            = new Date();

var buildFlag      = false;
var foregroundFlag = false;
var debugFlag      = false;
var serverName     = null;

var baseDir        = null;
var baseDirFlag    = false;

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
        case '-b':  case '--build':
            buildFlag = true;
            break;
        case '-f':  case '--foreground':
            foregroundFlag = true;
            break;
        case '-g':  case '--debug':
            debugFlag = true;
            break;
        case '-d': case '--basedir':
            if ( baseDir === null ) {
                baseDirFlag = true; 
            }
            break;
        default:
            showUsage();
            process.exit(-1);
        }

    } else if (serverName === null) {
        serverName = option;
    } else {
        showUsage();
        process.exit(-1);
    }
});

if ( serverName === null ) {
    console.error("ERROR: No serverName given, exiting");
    showUsage();
    process.exit(-1);
}

//
// Set paths
// 

if ( baseDir === null ) {
    console.error("Must specify base directory (with -d flag)");
    showUsage();
    process.exit(-1);
}

var serverPath = path.resolve(baseDir, serverName + '.js');
var logPath    = path.resolve(baseDir, 'log', serverName + '.log');
var pidPath    = path.resolve(baseDir, 'bin', 'server.pid');
var killerPath = path.resolve(__dirname, 'server-stopper-kill.js');

// 
// Make sure server file exists
//

if ( !fs.existsSync(serverPath) ) {
    console.error("Server " + serverPath + " not found, exiting");
    process.exit(-1);
}

if (buildFlag) {
    //
    // Rebuild JS & CSS
    //

    console.log("Rebuilding JS and CSS for " + serverName);

    spawner.execFileSync(baseDir + '/bin/build');
}

//
// Put restart markers in output files
//

var startMsg = "========== Starting server " + serverName + " ==========";
startMsg     = '\n' + now.toISOString() + ' ' + startMsg + '\n\n';

if ( foregroundFlag || debugFlag) {
    console.log(startMsg);
} else {
    fs.appendFileSync(logPath, startMsg);
}

//
// Prepare to kickoff server process
//

var stdoutFile = fs.openSync(logPath, 'a');
var stderrFile = fs.openSync(logPath, 'a');

// Issue a synchronous command to be sure we're sudo before 
// spawing process that needs sudo
spawner.execSync('sudo date');

if ( foregroundFlag || debugFlag ) {
    //
    // Start server in 'foreground'
    //

    var child;

    if ( !debugFlag ) {
        child = spawner.spawn('sudo', ['node', serverPath], {
            detached: true,
            cwd: baseDir
        });
    } else {
        child = spawner.spawn('sudo', ['node-debug', serverPath], {
            detached: true,
            cwd: baseDir
        });
    }

    child.stdout.on('data', function(data) {
        console.log(data.toString().trim());
    });

    child.stderr.on('data', function(data) {
        console.log(data.toString().trim());
    });

    console.log("Started server " + serverName + " with process ID " + child.pid);

    function exitHandler() {
        console.log("Killing server process(es) " + child.pid);
        spawner.execSync('sudo node ' + killerPath + ' ' + child.pid);
    }

    process.on('SIGINT',            exitHandler); // ctl-c
    // process.on('exit',              exitHandler);
    // process.on('uncaughtException', exitHandler);

} else {
    //
    // Start server daemon
    //

    var child = spawner.spawn('sudo', ['node', serverPath], {
        detached: true,
        cwd: baseDir,
        stdio: [ 'ignore', stdoutFile, stderrFile ]  // ignore stdin
    });

    console.log("Started server " + serverName + " with process ID " + child.pid);

    fs.writeFileSync(pidPath, '' + child.pid);

    child.unref();   // so we can exit(), and allow child process to continue
    process.exit(0);
}
