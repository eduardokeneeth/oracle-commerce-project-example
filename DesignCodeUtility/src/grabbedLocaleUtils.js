/**
 * Purpose of this module is to provide a way of determining what locales have already been grabbed
 */

const constants = require("./constants").constants
const i18n = require("./i18n")
const upath = require("upath")
const walkDirectory = require("./utils").walkDirectory
const classify = require("./classifier").classify
const PuttingFileType = require("./puttingFileType").PuttingFileType
const dirname = require('path').dirname
const basename = require('path').basename
const endPointTransceiver = require("./endPointTransceiver")
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const getBasePath = require("./utils").getBasePath
const logDebug = require("./logger").logDebug
const logError = require("./logger").logError

/**
 * Handy function to filter out hidden files.
 * @param fileStat
 * @returns {boolean}
 */
function hidden(fileStat) {
  return fileStat.name.startsWith(".")
}

/**
 * Determine if file is under the tracking directory.
 * @param fullPath
 * @returns {boolean}
 */
function isTrackedFile(fullPath) {
  return fullPath.includes(`/${constants.trackingDir}/`)
}

/**
 * Gathers the locale folder names (e.g. en, de) by locating locale resource files
 * @param {Gathers} locales the Set of locale names that will be gathered
 */
function gatherLocaleFolderNames(locales) {

  return {
    listeners: {
      file: (root, fileStat, next) => {
     
        // Build the full file name and keep a note of it but not if under the tracking directory or hidden.
        const fullPath = upath.resolve(root, fileStat.name)

        // Knock out files in the .ccc dir or that are hidden.
        if (!isTrackedFile(fullPath) && !hidden(fileStat)) {

          // See if we recognize the file.
          const fileType = classify(fullPath)
          switch (fileType) {
            case PuttingFileType.WIDGET_BASE_SNIPPETS:
            case PuttingFileType.WIDGET_INSTANCE_SNIPPETS:
            case PuttingFileType.WIDGET_CONFIG_SNIPPETS:
            case PuttingFileType.STACK_BASE_SNIPPETS:
            case PuttingFileType.STACK_CONFIG_SNIPPETS:
              locales.add(basename(dirname(fullPath)))
          }
        }

        // Go to the next file
        next()
      }
    }
  }
}

/**
 * Gathers the set of locales which have previously been grabbed by waking the director
 * @param {string} path 
 * @returns {Set} set of previously grabbed locales
 */
function gatherGrabbedLocales(path) {

  // Gather the grabbed locales
  const locales = new Set();
  walkDirectory(path, gatherLocaleFolderNames(locales))
  return locales
}

/**
 * Get the name of the last locale that we grabbed with.
 * @param path - optional path to the file or directory we are using
 * @return name of the last locale we grabbed from or null if we can't find it.
 */
function getLocaleFromLastGrab(path) {

  // Find the base metadata - if we can find it.
  const metadata = readMetadataFromDisk(path, constants.configMetadataJson)

  // Just need the node value.
  return metadata ? metadata.grabLocale : null
}

/**
 * Check whether it is ok to proceed with a grab using the current locale
 * The grab can proceed if this is the first grab or we've already done a grab for the same locale
 * @returns {boolean}
 */
function isOkToGrabWithLocale() {

  // Determine the base path
  // If we have a path to the file or directory we are working with, use that.
  // If we don't have such a path, use the base directory. If we don't have that,
  // use the current working directory.
  const path = (getBasePath() ? getBasePath() : ".")

  // Check the last locale used in a grab if recorder
  const lastLocale = getLocaleFromLastGrab(path)
  if (lastLocale) {
    logDebug("locale of last grab is " + lastLocale + ", locale for this grab is " + endPointTransceiver.locale)
    return lastLocale === endPointTransceiver.locale
  }

  // So the last locale used wasn't recorded so we need to traverse the base directory to
  // determine if the requested locale has been grabbed before.
  logDebug("Gathering list of previously grabbed locales")
  const grabbedLocales = gatherGrabbedLocales(path)

  // OK to grab if this is the first grab or this locale has already been grabbed
  logDebug("Got " + grabbedLocales.size + " previously grabbed locales")
  return !grabbedLocales.size || grabbedLocales.has(endPointTransceiver.locale)

}

/**
 * Report an appropriate error about the inappropriate locale choice
 */
function logInvalidGrabLocaleError() {
  const errMsg = (endPointTransceiver.locales.length > 1)
  ? i18n.t("cannotGrabUsingAllLocales")
  : i18n.t("cannotGrabUsingCurrentLocale", endPointTransceiver.locale);
  logError(errMsg)
}

/**
 * Check whether it is ok to proceed with a grab using the current locale
 * If not an error is thrown
 */
function assertOkToGrabWithLocale() {
  const errMsg = (endPointTransceiver.locales.length > 1)
  ? i18n.t("cannotGrabUsingAllLocales")
  : i18n.t("cannotGrabUsingCurrentLocale", endPointTransceiver.locale);
  if (!isOkToGrabWithLocale()) {
    throw new Error(errMsg);
  }
}

exports.isOkToGrabWithLocale = isOkToGrabWithLocale
exports.assertOkToGrabWithLocale = assertOkToGrabWithLocale
exports.logInvalidGrabLocaleError = logInvalidGrabLocaleError
