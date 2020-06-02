"use strict"

const colors = require('colors/safe')

const t = require("./i18n").t

let verbose = false

/**
 * Used to control debug level logging.
 * @param flag
 */
function setVerboseLogging(flag) {
  verbose = !!flag
}

/**
 * Record that an error has occurred in an international way.
 * @param key
 * @param substitutions
 */
function error(key, substitutions) {
  logError(t(key, substitutions))
}

/**
 * Record that something has occurred in an international way.
 * @param key
 * @param substitutions
 */
function info(key, substitutions) {
  logInfo(t(key, substitutions))
}

/**
 * Record that something worrying has occurred in an international way.
 * @param key
 * @param substitutions
 */
function warn(key, substitutions) {
  logWarn(t(key, substitutions))
}

/**
 * Record that something uninteresting has occurred in an international way.
 * @param key
 * @param substitutions
 */
function debug(key, substitutions) {
  if (verbose) {
    logDebug(t(key, substitutions))
  }
}

/**
 * Record that an error has occurred.
 * @param text
 */
function logError(text) {

  console.error(colors.red.bold(`${getPreamble("ERROR")}${text}`))

  // Remember that something went wrong for later.
  exports.hadSeriousError = true
}

/**
 * Record that something has occurred.
 * @param text
 */
function logInfo(text) {
  console.log(`${getPreamble("INFO")}${text}`)
}

/**
 * Record that something worrying has occurred.
 * @param text
 */
function logWarn(text) {
  console.warn(colors.yellow.bold(`${getPreamble("WARN")}${text}`))
}

/**
 * Record that something uninteresting has occurred.
 * @param text
 */
function logDebug(text) {
  if (verbose) {
    console.log(colors.gray(`${getPreamble("DEBUG")}${text}`))
  }
}

/**
 * Create extra text at the start of the logging line using the supplied message type.
 * @return {string}
 */
function getPreamble(severity) {
  const isoDate = new Date().toISOString()
  const paddedSeverity = severity.padStart(5, ' ')

  return (verbose) ? `[${isoDate}] ${paddedSeverity}: ` : ""
}

/**
 * Dump the supplied object in a readable way.
 * @param object
 */
function dump(object) {
  console.log(JSON.stringify(object, null, 2))
}

exports.debug = debug
exports.dump = dump
exports.error = error
exports.hadSeriousError = false
exports.info = info
exports.logError = logError
exports.logInfo = logInfo
exports.logWarn = logWarn
exports.logDebug = logDebug
exports.setVerboseLogging = setVerboseLogging
exports.warn = warn
