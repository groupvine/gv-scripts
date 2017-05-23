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
    console.log("  -l, --logpath     Path to directory for log file");
    console.log("  -n, --nvm         Use nvm (and obey version in closest .nvmrc file");
}

var now            = new Date();

var foregroundFlag = false;
var debugFlag      = false;
var serverName     = null;

var baseDir        = null;
var baseDirFlag    = false;

var logDir         = null;
var logDirFlag     = false;

var useNvm        = null;

process.argv.slice(2).forEach(function (option) {
    option = option.trim();
    
    if ( baseDirFlag ) {
        baseDirFlag = false;
        baseDir = option;
        
        if ( !fs.existsSync(baseDir) ) {
            console.error("Invalid base directory " + baseDir + ", exiting");
            process.exit(-1);
        }

    } else if ( logDirFlag ) {
        logDirFlag = false;
        logDir = option;

        if ( !fs.existsSync(logDir) ) {
            console.error("Invalid log directory " + logDir + ", exiting");
            process.exit(-1);
        }

    } else if (option[0] == '-') {
        switch(option) {
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
        case '-l':  case '--logpath':
            if ( logDir === null ) {
                logDirFlag = true; 
            }
            break;
        case '-n':  case '--nvm':
            useNvm = true;
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


if ( logDir === null ) {
    logDir = path.resolve(baseDir, 'log');
}

var logPath    = path.resolve(logDir, serverName + '.log');
var serverPath = path.resolve(baseDir, serverName + '.js');
var pidPath    = path.resolve(baseDir, serverName + '.pid');

var killerPath = path.resolve(__dirname, 'server-stopper-kill.js');

// 
// Make sure server file exists
//

if ( !fs.existsSync(serverPath) ) {
    console.error("Server " + serverPath + " not found, exiting");
    process.exit(-1);
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

var child;

// Issue a synchronous command to be sure we're sudo before 
// spawing process that needs sudo
spawner.execSync('sudo date');

// spawner.execSync('source ~/.nvm/nvm.sh; nvm -v');

function exitHandler() {
    try {
        spawner.exec('sudo date', () => {
            // be sure we're still su
            spawner.execSync('sudo node ' + killerPath + ' ' + child.pid);
        }); 
    } catch(err) {
        console.error(err);
        console.log("To kill server:\n\n   sudo kill -TERM -" + child.pid + "\n\n");
    }
}


var cmdArgs;
var nvmArgs = null;
if (useNvm) {
    nvmArgs = [__dirname + '/nodeVer'];
}

if ( foregroundFlag || debugFlag ) {
    //
    // Start server in 'foreground'
    //

    let nodeCmd;

    if ( !debugFlag ) {
        nodeCmd = 'node';
    } else {
        nodeCmd = 'node-debug';
    }

    if (nvmArgs != null) {
        // Can't run as sudo with 'nvm' since nvm is a shell 
        // script and relies on user environment settings
        cmdArgs = nvmArgs.concat([nodeCmd, serverPath]);
    } else {
        cmdArgs = ['sudo', nodeCmd, serverPath];
    }
    
    child = spawner.spawn(cmdArgs[0], cmdArgs.slice(1), {
        detached: true,
        cwd: baseDir
    });

    child.stdout.on('data', function(data) {
        console.log(data.toString().trim());
    });

    child.stderr.on('data', function(data) {
        console.log(data.toString().trim());
    });

    console.log("Started server " + serverName + " with process ID " + child.pid);

    process.on('SIGINT',            exitHandler); // ctl-c
    // process.on('exit',              exitHandler);
    // process.on('uncaughtException', exitHandler);

} else {
    //
    // Start server daemon
    //

    if (nvmArgs != null) {
        // Can't run as sudo with nvm of a version
        cmdArgs = nvmArgs.concat(['node', serverPath]);
    } else {
        cmdArgs = ['sudo', 'node', serverPath];
    }

    child = spawner.spawn(cmdArgs[0], cmdArgs.slice(1), {
        detached: true,
        cwd: baseDir,
        stdio: [ 'ignore', stdoutFile, stderrFile ]  // ignore stdin
    });

    console.log("Started server " + serverName + " with process ID " + child.pid);

    fs.writeFileSync(pidPath, '' + child.pid);

    child.unref();   // so we can exit(), and allow child process to continue
    process.exit(0);
}
