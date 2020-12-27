const which = require("npm-which")(process.cwd());
const kleur = require("kleur");
const isUrl = require("is-url");
const fs = require("./util/fs");
const npm = require("./util/npm");
const cmd = require("./util/cmd");
const path = require("./util/path");
const log = require("./util/log");
const misc = require("./util/misc");

const create = async (
    where,
    template,
    cache = path.resolve(require("os").homedir(), ".starters")
) => {
    const resolvedPath = path.resolveRelative(where);

    if (fs.exists(resolvedPath)) {
        if (fs.isDir(resolvedPath)) {
            if (fs.isEmpty(resolvedPath)) {
                fs.rm(resolvedPath);
            } else {
                log.error(`Directory is not empty: ${resolvedPath}`);
                throw new Error(`Directory is not empty: ${resolvedPath}`);
            }
        }
    }

    if (isUrl(template) || misc.isSSH(template)) {
        // Git repository
        try {
            log.info("Cloning repository.");
            log.info(kleur.blue("==============================="));
            cmd.exec(`git clone ${template} ${resolvedPath}`, {
                encoding: "utf8",
                stdio: "inherit",
            });
            log.info(kleur.blue("==============================="));
        } catch (error) {
            log.error("Error cloning repository.");
            throw error;
        }

        const configPath = path.resolve(resolvedPath, ".starter");

        if (
            fs.exists(path.resolve(configPath, "index.js")) ||
            fs.exists(path.resolve(configPath, "package.json"))
        ) {
            log.debug(`Found configuration in "${configPath}".`);
            try {
                const config = require(configPath);

                if (typeof config === "function") {
                    log.info("Running configuration script.");
                    await config({
                        inquirer: require("inquirer"),
                        render: require("render-in-place").default,
                        fs: require("fs"),
                        rimraf: require("rimraf"),
                        where,
                    });
                    log.info("Configuration complete.");
                } else {
                    throw new Error(
                        `TypeError: Expected a function but got "${typeof config}".`
                    );
                }
            } catch (error) {
                log.error(
                    `Could not import configuration from "${configPath}".`
                );
                throw error;
            }
        } else {
            log.debug(`No configuration found in "${configPath}".`);
        }
    } else {
        // NPM package
        const { name, version } = npm.parseNameWithVersion(template);

        log.info("Installing package.");

        if (!fs.exists(cache)) {
            fs.mkdir(cache);
        }

        try {
            await cmd.exec(
                `${which.sync(
                    "npm"
                )} install --no-save --prefix ${cache} ${template}`,
                {
                    encoding: "utf8",
                    cwd: cache,
                }
            );
        } catch (error) {
            log.error(`Could not install package "${template}".`);
            throw error;
        }

        try {
            const config = require(path.resolve(cache, "node_modules", name));

            if (typeof config === "function") {
                log.info("Running configuration script.");
                await config({
                    inquirer: require("inquirer"),
                    render: require("render-in-place").default,
                    fs: require("fs"),
                    rimraf: require("rimraf"),
                    where,
                });
                log.info("Configuration complete.");
            } else if (
                typeof config === "object" &&
                config.hasOwnProperty("repository")
            ) {
                log.warn("This package is using a legacy format.");
                // @NOTE(jakehamilton): This is to handle legacy template packages.
                //  Once all packages upgrade, we can safely remove this option.
                return await create(
                    resolvedPath,
                    `git@github.com:${config.repository}`,
                    cache
                );
            } else {
                throw new Error(
                    `TypeError: Expected a function but got "${typeof config}".`
                );
            }
        } catch (error) {
            log.error(`Could not run package "${template}".`);
            throw error;
        }
    }

    log.info("Access your new project by running the following:");
    log.info(
        `  ${kleur.dim("$")} ${kleur.white("cd")} ${path.relative(
            process.cwd(),
            resolvedPath
        )}`
    );
};

module.exports = create;