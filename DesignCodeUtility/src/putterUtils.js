"use strict"

const error = require("./logger").error

const inTransferMode = require("./state").inTransferMode
const writeEtag = require("./etags").writeEtag

let updateInstances = false
let sendInstanceConfig = true
let preventThemeCompilation = false
let autoFixing = false

/**
 * Tell the module to update instances.
 */
function enableUpdateInstances() {
  updateInstances = true
}

function shouldUpdateInstances() {
  return updateInstances
}

/**
 * Tell the module not to send widget instance metadata to the server.
 * This can be useful when config varies between environments.
 */
function suppressConfigUpdate() {
  sendInstanceConfig = false
}

function shouldSendInstanceConfig() {
  return sendInstanceConfig
}

/**
 * Tell the module not to compile the theme after updating widget less.
 */
function suppressThemeCompile() {
  preventThemeCompilation = true
}

function shouldSuppressThemeCompile() {
  return preventThemeCompilation
}

/**
 * Enable auto-fixing for data where we know what needs to be done.
 *
 * 1) Conflicting widget instance names on target server (CCDS-9373)
 *    - Will rename the existing instance on the target then retry the
 *      transfer.
 */
function enableAutoFix() {
  autoFixing = true
}

/**
 * Check if auto-fixing is enabled.
 */
function autoFix() {
  return autoFixing
}

/**
 * Process the result of a put, telling the user how things went.
 * @param path
 * @param results
 * @returns true if it went OK, false otherwise.
 */
function processPutResult(path, results) {

  // See if we opt locked. Bomb out if we did.
  if (results.response.statusCode === 412) {

    error("alreadyBeenModified", {path}, "optimisticLock")
    return false

    // Any bad HTTP codes are taken as failure.
  } else if (results.response.statusCode < 200 || results.response.statusCode > 299) {
    return false
  }

  return true
}

/**
 * Does the requisite post processing after an attempted put.
 * If all goes well, write out the new etag for the file.
 * @param path
 * @param results
 * @return true if all went well, false otherwise.
 */
function processPutResultAndEtag(path, results, successCallback) {

  // If things went OK, write out the new etag unless we are in transfer mode.
  if (processPutResult(path, results) && !inTransferMode()) {

    writeEtag(path, results.response.headers.etag)

    // Looking good - call the succes callback if there is one.
    successCallback && successCallback(path)
  }
}

exports.processPutResult = processPutResult
exports.processPutResultAndEtag = processPutResultAndEtag
exports.enableUpdateInstances = enableUpdateInstances
exports.shouldUpdateInstances = shouldUpdateInstances
exports.suppressConfigUpdate = suppressConfigUpdate
exports.shouldSendInstanceConfig = shouldSendInstanceConfig
exports.shouldSuppressThemeCompile = shouldSuppressThemeCompile
exports.suppressThemeCompile = suppressThemeCompile
exports.enableAutoFix = enableAutoFix
exports.autoFix = autoFix
