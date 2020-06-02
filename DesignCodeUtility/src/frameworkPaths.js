const basename = require('path').basename

const constants = require("./constants").constants
const splitFromBaseDir = require("./utils").splitFromBaseDir

/**
 * Hold the base path in the VFS in one place.
 * @return {string}
 */
function getBaseVfsPath() {
  return "static"
}

/**
 * Given a path to file on disk figure out where it would live in the VFS.
 * @param path
 */
function toVfsPath(path) {

  return `${getRelativePath(path)}/${basename(path)}`
}

/**
 * Make path relative to the base dir, removing the framework dir on the way.
 * This means that something/framework/directory/myfile becomes framework/directory.
 * @param path
 * @return {String|*|void|string}
 */
function getRelativePath(path) {
  return `${getBaseVfsPath()}${splitFromBaseDir(path)[1].replace(constants.frameworkDir, "")}`
}

/**
 * Given a directory, figure out where it be in the VFS.
 * @param path
 */
function toVfsDir(path) {

  // Prepend the VFS base path.
  return getRelativePath(path)
}

/**
 * Turn the dir returned from the endpoint into something we can write to disk.
 * @param path
 * @return {*}
 */
function toOutputDir(path) {

  return `${constants.frameworkDir}/${path.replace(getBaseVfsPath(), "")}`
}

exports.getBaseVfsPath = getBaseVfsPath
exports.toOutputDir = toOutputDir
exports.toVfsDir = toVfsDir
exports.toVfsPath = toVfsPath
