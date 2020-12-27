const arg = require("arg");
const log = require("./util/log");
const help = require("./util/help");
const rootArgs = require("./util/args");
const commands = require("./commands");

const main = async () => {
    const args = arg(rootArgs, {
        permissive: true,
    });

    if (args["--help"] && args._.length === 0) {
        help();
        process.exit(0);
    }

    if (args._.length === 0) {
        log.error("No command specified.");
        help();
        process.exit(1);
    }

    const command = args._[0];

    if (command in commands) {
        log.trace(`Executing comand "${command}".`);
        await commands[command]();
    } else {
        log.error(`Unknown command "${command}".`);
        process.exit(1);
    }
};

main().catch((error) => {
    log.error(error.message || error);
    for (const line of error.stack.split("\n").slice(1)) {
        log.error(`${line}`);
    }
});
