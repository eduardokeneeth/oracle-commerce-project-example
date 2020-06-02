/**
 * The various main modules have common code so we put it all here.
 */

const compareVersions = require("compare-versions")

const constants = require("./constants").constants
const error = require("./logger").error
const package = require('../package.json')
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const t = require("./i18n").t

/**
 * Certain command line functions are mostly common to all utilities so put them in one place.
 */
function addCommonOptions(program) {

  return addMinimalCommonOptions(program)
    .option("-u, --username <userName>", t("usernameOptionText"), "admin")
    .option("-p, --password <password>", t("passwordOptionText"), "admin")
    .option("-b, --base <directory>", t("baseOptionText"))
}

/**
 * Certain command line options are really common to everything so put them here.
 * @param program
 */
function addMinimalCommonOptions(program) {

  return program.option("-n, --node <node>", t("nodeOptionText"))
    .option("-k, --applicationKey <key>", t("applicationKeyOptionText"))
    .version(package.version)
}

/**
 * Holds all the password handling logic in one place.
 */
function getPassword(password) {
  return process.env.CC_ADMIN_PASSWORD ? process.env.CC_ADMIN_PASSWORD : password
}

/**
 * Holds all the application key handling logic in one place.
 */
function getApplicationKey(applicationKey, envVarName = "CC_APPLICATION_KEY") {
  return process.env[envVarName] ? process.env[envVarName] : applicationKey
}

/**
 * Ensure the metadata on disk was not created by a previous version.
 * @param path
 * @return true if all is well; false otherwise.
 */
function checkMetadata(path) {

  const configMetadata = readMetadataFromDisk(path, constants.configMetadataJson)

  // Version on disk was created with an old version.
  if (configMetadata && compareVersions(package.version, configMetadata.packageVersion) == 1) {
    error("oldVersion")
    return false
  }

  // All well.
  return true
}

exports.addCommonOptions = addCommonOptions
exports.addMinimalCommonOptions = addMinimalCommonOptions
exports.checkMetadata = checkMetadata
exports.getApplicationKey = getApplicationKey
exports.getPassword = getPassword
