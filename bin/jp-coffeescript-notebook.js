#!/usr/bin/env node

/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2017, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

var console = require("console");
var fs = require("fs");
var util = require("util");

var rc = require("./rc.js");
var context = rc.context;
var copyAsync = rc.copyAsync;
var doLog = rc.doLog;
var dontLog = rc.dontLog;
var getPackageVersion = rc.getPackageVersion;
var installKernelAsync = rc.installKernelAsync;
var log = rc.log;
var makeTmpdir = rc.makeTmpdir;
var readPackageJson = rc.readPackageJson;
var setIPythonInfoAsync = rc.setIPythonInfoAsync;
var setJupyterInfoAsync = rc.setJupyterInfoAsync;
var setPaths = rc.setPaths;
var setProtocol = rc.setProtocol;
var spawnFrontend = rc.spawnFrontend;

var usage = [
    "jp-CoffeeScript Notebook",
    "",
    "Usage:",
    "",
    "    jp-coffee-notebook <options>",
    "",
    "The recognised options are:",
    "",
    "    --help                       show all the help",
    "    --jp-debug                   enable debug messages",
    "    --jp-help                    show this help",
    "    --jp-hide-undefined          do not show undefined results",
    "    --jp-install=[local|global]  install kernel for user or globally",
    "    --jp-protocol=version        set protocol version, e.g. 5.0",
    "    --jp-show-undefined          show undefined results",
    "    --jp-spec-path=[none|full]   set whether kernel spec uses full paths",
    "    --jp-startup-script=path     run script on startup",
    "                                 (path can be a file or a folder)",
    "    --jp-working-dir=path        set session working directory",
    "                                 (default = current working directory)",
    "    --version                    show jp-CoffeeScript version",
    "    --versions                   show jp-CoffeeScript and library versions",
    "",
    "and any other options recognised by the Jupyter notebook; run:",
    "",
    "    jupyter notebook --help",
    "",
    "for a full list.",
].join("\n");

function parseCommandArgs(context) {
    context.args.kernel = [];
    context.args.frontend = [
        "jupyter",
        "notebook",
    ];
    context.flag.hideUndefined = true;

    process.argv.slice(2).forEach(function(e) {
        if (e === "--help") {
            console.log(usage);
            context.args.frontend.push(e);

        } else if (e === "--jp-debug") {
            DEBUG = true;
            log = doLog;

            context.flag.debug = true;
            context.args.kernel.push("--debug");

        } else if (e === "--jp-help") {
            console.log(usage);
            process.exit(0);

        } else if (e === "--jp-hide-undefined") {
            context.flag.hideUndefined = true;

        } else if (e.lastIndexOf("--jp-install=", 0) === 0) {
            context.flag.install = e.slice(14);
            if (context.flag.install !== "local" &&
                context.flag.install !== "global") {
                console.error(
                    util.format("Error: Unknown flag option '%s'\n", e)
                );
                console.error(usage);
                process.exit(1);
            }

        } else if (e.lastIndexOf("--jp-protocol=", 0) === 0) {
            context.protocol.version = e.slice(15);
            context.protocol.majorVersion = parseInt(
                context.protocol.version.split(".", 1)[0]
            );

        } else if (e === "--jp-show-undefined") {
            context.flag.hideUndefined = false;

        } else if (e.lastIndexOf("--jp-spec-path=", 0) === 0) {
            context.flag.specPath = e.slice(16);
            if (context.flag.specPath !== "none" &&
                context.flag.specPath !== "full") {
                console.error(
                    util.format("Error: Unknown flag option '%s'\n", e)
                );
                console.error(usage);
                process.exit(1);
            }

        } else if (e.lastIndexOf("--jp-startup-script=", 0) === 0) {
            context.flag.startup = fs.realpathSync(e.slice(21));

        } else if (e.lastIndexOf("--jp-working-dir=", 0) === 0) {
            context.flag.cwd = fs.realpathSync(e.slice(18));

        } else if (e.lastIndexOf("--jp-", 0) === 0) {
            console.error(util.format("Error: Unknown flag '%s'\n", e));
            console.error(usage);
            process.exit(1);

        } else if (e.lastIndexOf("--KernelManager.kernel_cmd=", 0) === 0) {
            console.warn(util.format("Warning: Flag '%s' skipped", e));

        } else if (e === "--version") {
            console.log(context.packageJSON.version);
            process.exit(0);

        } else if (e === "--versions") {
            console.log("jp-coffeescript", context.packageJSON.version);
            console.log("jmp", getPackageVersion("jmp"));
            console.log("jp-kernel", getPackageVersion("jp-kernel"));
            console.log("nel", getPackageVersion("nel"));
            console.log("uuid", getPackageVersion("uuid"));
            console.log("zeromq", getPackageVersion("zeromq"));
            process.exit(0);

        } else {
            context.args.frontend.push(e);
        }
    });

    if (context.flag.specPath === "full") {
        context.args.kernel = [
            context.path.node,
            context.path.kernel,
        ].concat(context.args.kernel);
    } else {
        context.args.kernel = [
            (process.platform === 'win32') ? 'jp-coffee-kernel.cmd' : 'jp-coffee-kernel',
        ].concat(context.args.kernel);
    }

    if (context.flag.startup) {
        context.args.kernel.push("--startup-script=" + context.flag.startup);
    }

    if (context.flag.cwd) {
        context.args.kernel.push("--session-working-dir=" + context.flag.cwd);
    }

    if (context.flag.hideUndefined) {
        context.args.kernel.push("--hide-undefined");
    } else {
        context.args.kernel.push("--show-undefined");
    }

    context.args.kernel.push("{connection_file}");
}


setPaths(context);

readPackageJson(context);

parseCommandArgs(context);

setJupyterInfoAsync(context, function() {
    setProtocol(context);

    installKernelAsync(context, function() {
        log("CONTEXT:", context);

        if (!context.flag.install) {
            spawnFrontend(context);
        }
    });
});
