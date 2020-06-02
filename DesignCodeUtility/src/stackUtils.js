"use strict"

const constants    = require("./constants").constants
const exists       = require("./utils").exists
const readJsonFile = require("./utils").readJsonFile
const writeFile    = require("./utils").writeFile
const warn         = require("./logger").warn

const path = require('path')

/**
 * Get the actual name of a stack instance depending on whether the current
 * name looks like a repository ID or whatever. Who knows? We were doing this
 * in a bunch of places so here it is as a utility function. Also depends a
 * bit on what the repository data looks like so bets are off.
 *
 * @param {object} stackInstance Stack instance metadata object.
 * @return {string} Friendlier stack instance name maybe.
 */
function friendlyStackInstanceName (stackInstance) {
  return (!stackInstance.name || stackInstance.name === stackInstance.repositoryId)
    ? stackInstance.displayName
    : stackInstance.name
}

/**
 * Stack display name may not be unique, so we do a bit of extra work to generate
 * a unique, but still readable directory name for our contents and metadata.
 *
 * The first time we need to store a stack, we'll check if we can create a directory
 * using just the displayName, if so great. If not, we'll append an incrementing number.
 * In either case, we'll track the directory name against the repository ID in a
 * cache file.
 *
 * @param {string} stackInstancesDir The directory where instances of a
 *                                   stackType live.
 * @param {object} stackInstance The metadata of a stack instance.
 */
function deriveStackInstanceDir (stackInstancesDir, stackInstance) {
  const stackDirsFile = path.join(constants.trackingDir, "stack", "stackDirs.json")

  // Treat this file as a cache, so make sure it exists.
  if (!exists(stackDirsFile)) {
    writeFile(stackDirsFile, "{}")
  }

  const stackCache = readJsonFile(stackDirsFile) || {}
  const baseDirName = friendlyStackInstanceName(stackInstance)

  // We've already seen this
  if (stackCache[stackInstance.repositoryId]) {
    const dirName = stackCache[stackInstance.repositoryId]
    const stackDir = path.join(stackInstancesDir, dirName)

    // Exists checks if we already have created a directory for this stack
    // instance, but it may have been renamed in which case we should recreate it
    // with the new name anyway.
    if (exists(stackDir) && dirName.indexOf(baseDirName) > -1)
      return stackCache[stackInstance.repositoryId]

    // Doesn't exist (for some reason), we'll recreate it...
    delete stackCache[stackInstance.repositoryId]
  }

  // Let's try and iterate through numbers until we get one that works.
  let dirName = baseDirName
  let counter = 1
  while (exists(path.join(stackInstancesDir, dirName))) {
    dirName = `${baseDirName} (${counter})`
    counter += 1
  }

  if (dirName !== baseDirName) {
    warn("uniquifiedStackNameWarning", {oldName: baseDirName})
  }

  // Now store it in the cache so future look ups will get a deterministic
  // result.
  stackCache[stackInstance.repositoryId] = dirName
  writeFile(stackDirsFile, JSON.stringify(stackCache, null, 2))

  return dirName
}

exports.deriveStackInstanceDir = deriveStackInstanceDir
exports.friendlyStackInstanceName = friendlyStackInstanceName
