"use strict"

const Promise = require("bluebird")

const constants = require("./constants").constants
const classifyForRefresh = require("./classifier").classifyForRefresh
const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const exists = require("./utils").exists
const grabAllApplicationJavaScript = require("./applicationJavaScriptGrabber").grabAllApplicationJavaScript
const grabAllThemes = require("./themeGrabber").grabAllThemes
const grabTextSnippetsForLocaleDirectory = require("./textSnippetGrabber").grabTextSnippetsForLocaleDirectory
const grabCommonTextSnippets = require("./textSnippetGrabber").grabCommonTextSnippets
const grabAllStacks = require("./stackGrabber").grabAllStacks
const grabAllElements = require("./elementGrabber").grabAllElements
const grabAllSiteSettings = require("./siteSettingsGrabber").grabAllSiteSettings
const grabFramework = require("./frameworkGrabber").grabFramework
const grabFrameworkDirectory = require("./frameworkGrabber").grabFrameworkDirectory
const grabAllWidgets = require("./widgetGrabber").grabAllWidgets
const grabGlobalElement = require("./globalElementGrabber").grabGlobalElement
const grabSpecificStack = require("./stackGrabber").grabSpecificStack
const grabSpecificTheme = require("./themeGrabber").grabSpecificTheme
const grabSpecificWidget = require("./widgetGrabber").grabSpecificWidget
const grabWidgetElements = require("./widgetElementGrabber").grabWidgetElements
const info = require("./logger").info
const mkdirIfNotExists = require("./utils").mkdirIfNotExists
const packageVersion = require('../package.json').version
const PuttingFileType = require("./puttingFileType").PuttingFileType
const removeTrackedTree    = require("./utils").removeTrackedTree
const removeTree = require("./utils").removeTree
const writeMetadata = require("./metadata").writeMetadata
const warn = require("./logger").warn
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const isOkToGrabWithLocale = require("./grabbedLocaleUtils").isOkToGrabWithLocale
const logInvalidGrabLocaleError = require("./grabbedLocaleUtils").logInvalidGrabLocaleError

/**
 * User only wants to grab certain things.
 * @param directory
 * @return a BlueBird promise
 */
const refresh = Promise.method((directory, clean) => {

  // Call the grabber that matches the directory. This should normally return a BlueBird promise but if the endpoints
  // are not supported (rare these days) or the directory type is unrecognized, the return value could be null.
  const promise = callMatchingGrabber(directory, clean)

  if (promise) {
    return promise.then(() => info("allDone"))
  }
})

/**
 * Find the grabber for the directory type and call it.
 * @param directory
 * @param clean
 * @returns A Bluebird promise unless something went wrong.
 */
function callMatchingGrabber(directory, clean) {

  // First of all, see what the path looks like. We only do directories we can recognize.
  // Note that the directory may not exist yet.
  const puttingFileType = classifyForRefresh(directory)

  // If user wants to clean first, and we get a valid type, delete the directory first.
  clean && puttingFileType && removeTrackedTree(directory)

  // Check if the refresh can proceed with the current locale
  if (!clean && puttingFileType && !isOkToGrabWithLocale()) {
    logInvalidGrabLocaleError()
    return Promise.resolve()
  }

  // Perform the grab
  switch (puttingFileType) {

    case PuttingFileType.APPLICATION_LEVEL_JAVASCRIPT_DIRECTORY:
      return grabAllApplicationJavaScript()
    case PuttingFileType.GLOBAL_SNIPPETS_DIRECTORY:
      return grabCommonTextSnippets()
    case PuttingFileType.GLOBAL_SNIPPETS_LOCALE_DIRECTORY:
      return grabTextSnippetsForLocaleDirectory(directory)
    case PuttingFileType.STACKS_DIRECTORY:
      return grabAllStacks()
    case PuttingFileType.STACK:
      return grabSpecificStack(directory)
    case PuttingFileType.THEMES_DIRECTORY:
      return grabAllThemes()
    case PuttingFileType.THEME:
      return grabSpecificTheme(directory)
    case PuttingFileType.GLOBAL_ELEMENTS_DIRECTORY:
      return grabAllElements(false)
    case PuttingFileType.GLOBAL_ELEMENT:
      return grabGlobalElement(directory)
    case PuttingFileType.WIDGETS_DIRECTORY:
      return grabAllWidgets().then(() => grabWidgetElements())
    case PuttingFileType.WIDGET:
      return grabSpecificWidget(directory).then(() => grabWidgetElements(directory))
    case PuttingFileType.FRAMEWORK_DIRECTORY:
      return grabFrameworkDirectory(directory)
    case PuttingFileType.SITE_SETTINGS_DIRECTORY:
      return grabAllSiteSettings()
    default:
      error("unsupportedDirectoryType", {directory})
  }
}

/**
 * Grab everything the user can normally change.
 * @return {PromiseLike<void | never>}
 */
function grabAllModifiableContent() {

  return grabAllSiteSettings()
    .then(grabFramework)
    .then(grabAllStacks)
    .then(grabAllWidgets)
    .then(grabCommonTextSnippets)
    .then(grabAllElements)
    .then(grabAllThemes)
    .then(grabAllApplicationJavaScript)
    .then(() => info("allDone"));
}

/**
 * Entry point. Grabs all it can from the server.
 * @returns {Promise.<T>}
 */
function grab(node, clean, directory) {

  // See if we are doing an incremental grab.
  if (directory) {

    // We are not cleaning but doing an incremental grab.
    if (!clean) {

      const configMetadata = readMetadataFromDisk(directory, constants.configMetadataJson)

      if (configMetadata && configMetadata.node != node) {
        warn("grabFromDifferentNode", {node, "configMetadataNode" : configMetadata.node})
      }
    }

    // If the path has a trailing slash, do away with it.
    if (directory.endsWith("/") || directory.endsWith("\\")) {
      directory = directory.slice(0, -1)
    }
  }

  // Create tracking directory first if it does not already exist.
  mkdirIfNotExists(constants.trackingDir)

  // Check if we can grab with the current locale
  // Skip this check if starting afresh
  if (!clean && !isOkToGrabWithLocale()) {
    logInvalidGrabLocaleError()
    return Promise.resolve()
  }

  // See if the user wants everything or just certain things.
  if (directory) {

    // Store basic info in the tracking directory.
    storeNodeInfo(node, endPointTransceiver.commerceCloudVersion)

    // Let the refresh function manage the clean.
    return refresh(directory, clean)
  } else {

    // See if we want to start afresh.
    clean && clearExistingDirs()

    // Store basic info in the tracking directory.
    storeNodeInfo(node, endPointTransceiver.commerceCloudVersion)

    // User wants the complete works. Need to wait for everything to finish. They may also want the framework.
    return grabAllModifiableContent()
  }
}

/**
 * Store high level info about the grab in the tracking directory - including the node package version.
 * @param node
 */
function storeNodeInfo(node, commerceCloudVersion) {
  writeMetadata(constants.configMetadataJson, 
    {node, commerceCloudVersion, packageVersion, "grabLocale": endPointTransceiver.locale})
}

/**
 * Before we grab anything, get rid of what is already there.
 */
function clearExistingDirs() {
  [
    constants.trackingDir,
    constants.globalDir,
    constants.widgetsDir,
    constants.elementsDir,
    constants.stacksDir,
    constants.themesDir,
    constants.textSnippetsDir,
    constants.frameworkDir,
    constants.siteSettingsDir

  ].forEach(directory => exists(directory) && removeTree(directory)) // Make sure directory is actually there first.
}

exports.grab = grab
exports.refresh = refresh
