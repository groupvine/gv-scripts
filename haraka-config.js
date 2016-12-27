#!/usr/bin/env node

'use strict';

var path           = require('path');
var fs             = require('fs');
var config         = require('gv-config');

//
// Haraka configuration documentation:
//   https://haraka.github.io/manual/Config.html
//

var configSettings = {
    inbound : {
        databytes  : { databytes  : "20000000"        },
        me         : { serverName : config.serverName },
        host_list  : { hostList   : config.serverName },  // consider a list
        'smtp.ini' : { listenAdr  : config.serverAdr + ":25"}
    },

    outbound : {
        databytes  : { databytes  : "40000000"        },
        me         : { serverName : config.serverName },
        host_list  : { hostList   : config.serverName },  // consider a list

        // TODO: should the following two match to any of the serverDomains?
        'mail_from.access.whitelist_regex' : { regex  : ".*@" + config.serverDomains[0] },
        'dkim_sign.ini'                    : { domain : config.serverDomains[0] }
    }
};

// 
// Process args
//

function showUsage() {
    console.log('Usage: config inbound|outbound [options]');
    console.log('  Options:');
    console.log("  -d, --basedir     Base directory - *required");
}

var dir         = null;
var baseDirFlag = false;
var baseDir     = null;

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
        switch ( option ) {
        case '-d': case '--basedir':
            if ( baseDir === null ) {
                baseDirFlag = true; 
            }
            break;
        default:
            showUsage();
            process.exit(-1);
        }
    } else if (option == 'inbound') {
        dir = option;
    } else if (option = 'outbound') {
        dir = option;
    } else {
        showUsage();
        process.exit(-1);
    }
});

if (dir === null) {
    showUsage();
    process.exit(-1);
}

if ( baseDir === null ) {
    console.error("Must specify base directory (with -d flag)");
    showUsage();
    process.exit(-1);
}

//
// Process configuration
//

var configDir  = path.resolve(baseDir, 'config');
var configSet  = configSettings[dir];

var configFiles = Object.keys(configSet);
var configName;
var configFile;

var configVars;
var configVar;

var fileBody;

for (var i = 0; i < configFiles.length; i++) {
    configName = configFiles[i];
    configFile = path.resolve(configDir, configName);
    configVars = Object.keys(configSet[configName]);

    var templateFile = path.resolve(configDir, 'templates', configName + '.tmpl');

    if ( !fs.existsSync( templateFile ) ) {
        console.error("ERROR: Config template file " + templateFile + " doesn't exist, exiting!");
        process.exit(-1);
    }

    fileBody   = fs.readFileSync(templateFile, 'utf8');

    for (var j = 0; j < configVars.length; j++) {

        var regex = RegExp("\\${" + configVars[j] +  "}", 'gi');

        var newFileBody = fileBody.replace(regex, configSet[configName][configVars[j]]);
        if (newFileBody == fileBody) {
            console.error("ERROR: Unable to find variable " + configVars[j] + " in Config template file " + templateFile);
            process.exit(-1);
        }

        fileBody = newFileBody;
    }

    fs.writeFileSync(configFile, fileBody);

    console.log("Updated custom config file: ", configName);
}
