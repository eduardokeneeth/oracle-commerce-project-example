"use strict"

const Promise = require("bluebird")

const constants = require("./constants").constants
const copyFieldContentsToFile = require("./grabberUtils").copyFieldContentsToFile
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const grabWidgetInstances = require("./widgetInstanceGrabber").grabWidgetInstances
const getFallBackName = require("./localeUtils").getFallBackName
const getInitialMatchName = require("./localeUtils").getInitialMatchName
const grabNonStandardFiles = require("./widgetAdditionalFilesGrabber").grabNonStandardFiles
const hasFallBack = require("./localeUtils").hasFallBack
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const sanitizeName = require("./utils").sanitizeName
const splitPath = require("./utils").splitPath
const warn = require("./logger").warn
const widgetTypeToDirectoryMap = require("./widgetInstanceGrabber").widgetTypeToDirectoryMap
const writeEtag = require("./etags").writeEtag
const writeFile = require("./utils").writeFile
const writeFileAndETag = require("./grabberUtils").writeFileAndETag
const writeMetadata = require("./metadata").writeMetadata

// Keep track of whether we found a match or not.
let foundMatch = false

/**
 * Grab the widgets the user asked us for.
 * @param widgetName
 * @returns a BlueBird Promise
 */
function grabRequestedWidgets(widgetName) {

  // Create widget top level dir first if it does not already exist.
  makeTrackedDirectory(constants.widgetsDir)

  // Look for Oracle supplied widgets. In parallel, grab any user created widgets. These will be grouped by type and be the latest version.
  // After we get the current versions, look about for any old ones.
  return Promise.all([
    endPointTransceiver.getAllWidgetInstances("?source=100")
      .then(results => grabWidgets(results.data.items, widgetName)),
    endPointTransceiver.getAllWidgetInstances("?source=101")
      .then(results => grabWidgets(results.data.items, widgetName))]).then(() => {

    // See if we were looking for something specific but didnt find it.
    !foundMatch && widgetName && warn("noMatchFound", {name: widgetName})
  })
}

/**
 * Pull down all widgets and instances from the server.
 * @returns a BlueBird Promise
 */
function grabAllWidgets() {

  return grabRequestedWidgets().then(grabWidgetInstances)
}

/**
 * Grab the named widget given a directory of the form widget/Name.
 * @param directory
 */
function grabSpecificWidget(directory) {
  return grabRequestedWidgets(splitPath(directory)).then(() => grabWidgetInstances(splitPath(directory)))
}

/**
 * Get the directory for the supplied widget type and version.
 * @param widgetType
 * @param version
 * @param isLatestVersion
 * @returns a string containing the relative path to the widget directory.
 */
function getDirectoryForWidget(widgetType, version, isLatestVersion) {

  // Elements belonging to the latest version will go in the top level directory.
  if (isLatestVersion) {

    return widgetTypeToDirectoryMap.get(widgetType)
  } else {
    // Not the latest version - stick them in a directory of the form widget/<widget name>/version/<version number>/element.
    const versionDir = `${widgetTypeToDirectoryMap.get(widgetType)}/${constants.versionDir}`
    const versionNumberDir = `${versionDir}/${version}`

    makeTrackedDirectory(versionDir)
    makeTrackedDirectory(versionNumberDir)

    return versionNumberDir
  }
}

/**
 * Walk through the array contained in results creating files on disk.
 * @param widgets
 * @param widgetName
 */
function grabWidgets(widgets, widgetName) {

  return Promise.map(widgets, widget => {

    // See if the user is after a specific widget.
    if (widgetName) {

      if (widgetName !== widget.displayName) {

        // Not the one we want - go home.
        return
      } else {

        // Record that we found a match.
        foundMatch = true
      }
    }

    // No point in grabbing widgets you can't edit.
    if (widget.editableWidget) {
      return grabWidget(widget)
    }
  }, getGrabbingConcurrency())
}

/**
 * Given the ID of widget, grab the associated JavaScript and write it to the supplied directory.
 * @param id
 * @param widgetDir
 */
function grabAllJavaScript(id, widgetDir) {

  // Create the js dir under the widget if it does not exist already.
  const widgetJsDir = `${widgetDir}/js`
  makeTrackedDirectory(widgetJsDir)
  const widgetModuleDir = `${widgetDir}/module`
  makeTrackedDirectory(widgetModuleDir)
  const widgetModuleJsDir = `${widgetDir}/module/js`
  makeTrackedDirectory(widgetModuleJsDir)

  // Keep track of all the promises, returning them as a single promise at the end.
  const promises = []

  // Get the javascript - if any.
  endPointTransceiver.getWidgetDescriptorJavascriptInfoById([id]).then(results => {
    results.data.jsFiles && results.data.jsFiles.forEach(jsFile => {
      promises.push(endPointTransceiver.get(jsFile.url).tap(results => {

        if (isJavascriptModule(jsFile)) {
          writeFileAndETag(`${widgetModuleJsDir}/${jsFile.name}`, results.data, results.response.headers.etag)
        } else {
          writeFileAndETag(`${widgetJsDir}/${jsFile.name}`, results.data, results.response.headers.etag)
        }

      }))
    })
  })

  return Promise.all(promises)
}

/**
 * Holds the boilerplate for writing widget metadata.
 * @param widget
 * @param widgetDir
 * @return a Bluebird promise.
 */
function writeWidgetMetadata(widget, widgetDir) {

  // Set up the base metadata. Start with what is already there if we can.
  // This is to stop us losing metadata created by ccw which cannot be created from the endpoint data.
  const existingMetadata = readMetadataFromDisk(widgetDir, constants.widgetMetadataJson, true)
  const metadata = existingMetadata ? existingMetadata : {}

  // Some metadata is only available in more recent versions.
  const baseKeys = ["widgetType", "version", "displayName"]
  baseKeys.forEach(key => {
    metadata[key] = widget[key]
  })

  // If the widget has layouts, it means it plays well with elements. Need to know this for later.
  // Some web content instances are elementized but we don't mark them that way here.
  metadata.elementized = !!widget.layouts.length

  // The last four fields were added at the same time but later than the rest. Only needed for user defined widgets.
  if (widget.source === 101) {

    const possibleKeys = ["global", "i18nresources", "source"]
    possibleKeys.forEach(key => {
      widget[key] !== undefined && widget[key] !== null && (metadata[key] = widget[key])
    })

    metadata.javascript = widget.entrypoint
  }

  // Write out what we got to disk.
  writeMetadata(`${widgetDir}/${constants.widgetMetadataJson}`, metadata)

  // For user created widgets, we can allow them to change certain properties, post create.
  if (widget.source === 101) {

    // Also need to create the user modifiable metadata too.
    return createUserModifiableMetadata(widget, widgetDir)
  }
}

/**
 * Create a file on disk containing things associated with the widget that the user can change.
 * This will only ever get called for non-Oracle widgets.
 * @param widget
 * @param widgetDir
 */
function createUserModifiableMetadata(widget, widgetDir) {

  if (endPointTransceiver.serverSupports("getWidgetDescriptorMetadata")) {

    // Call the custom metadata endpoint created specially for this purpose.
    return endPointTransceiver.getWidgetDescriptorMetadata([widget.repositoryId]).then(results => {

      writeFileAndETag(`${widgetDir}/${constants.userWidgetMetadata}`,
        JSON.stringify(results.data.metadata, null, 2), results.response.headers.etag)
    })
  } else {
    warn("widgetDescriptorMetadataCannotBeGrabbed")
  }
}

/**
 * Create the top level and widget directory and do the house-keeping associated with it.
 * @param widget
 * @returns {string}
 */
function createWidgetDirectory(widget) {

  // Create the top level dirs for the widget first.
  const widgetDir = `${constants.widgetsDir}/${sanitizeName(widget.displayName)}`
  makeTrackedDirectory(widgetDir)

  // Record the directory for later use by things like element grabbing.
  widgetTypeToDirectoryMap.set(widget.widgetType, widgetDir)
  return widgetDir
}

/**
 * Write out the base snippets to the right place.
 * @param widgetDir
 * @param localeName
 * @param widget
 * @param results
 */
function writeWidgetBaseSnippets(widgetDir, localeName, widget, results) {

  // Create directory for the current locale.
  const localeDir = `${widgetDir}/locales/${localeName}`
  makeTrackedDirectory(localeDir)

  // Write out the text strings as a JSON file.
  const localeStringsFile = `${localeDir}/ns.${widget.i18nresources}.json`
  writeFile(localeStringsFile, JSON.stringify(results.data.localeData, null, 2))

  // Write out the etag.
  writeEtag(localeStringsFile, results.response.headers.etag)
}

/**
 * Get the base locale content for supplied widget and locale.
 * @param widget
 * @param widgetDir
 * @param locale
 */
function getWidgetBaseSnippets(widget, widgetDir, locale) {

  // Try for normal expected locale first.
  let localeName = getInitialMatchName(locale)

  // Get the text snippets for the "current" locale.
  return endPointTransceiver.getWidgetDescriptorBaseLocaleContent([widget.id, localeName],
    request().withLocale(localeName)).tap(results => {

    // See if we got any locale data and write it out if we did.
    if (results.data.localeData) {

      writeWidgetBaseSnippets(widgetDir, localeName, widget, results)

    } else if (hasFallBack(locale)) {

      // No strings found but we have a fallback - try that.
      localeName = getFallBackName(locale)

      return endPointTransceiver.getWidgetDescriptorBaseLocaleContent([widget.id, localeName],
        request().withLocale(localeName)).tap(results => {

          // If we got something this time, write it out.
          results.data.localeData && writeWidgetBaseSnippets(widgetDir, localeName, widget, results)
      })
    }
  })
}

/**
 * Grab the base locale associated with the widget.
 * @param widget
 * @param widgetDir
 * @returns {*}
 */
function grabBaseLocaleContent(widget, widgetDir) {

  // Make the locales directories first.
  makeTrackedDirectory(`${widgetDir}/locales`)

  // Then do the locales request one by one to stop us running out of connections.
  return Promise.each(endPointTransceiver.locales, locale => getWidgetBaseSnippets(widget, widgetDir, locale))
}

/**
 * If the server supports the right endpoints, grab the base content files.
 * @param widget
 * @param widgetDir
 */
function grabBaseContent(widget, widgetDir) {

  // Build up a list of promises.
  const promises = []

  // Just to be safe, check the endpoints are there.
  if (endPointTransceiver.serverSupports(
    "getWidgetDescriptorBaseTemplate", "getWidgetDescriptorBaseLess", "getWidgetDescriptorBaseLocaleContent")) {

    // No point in getting less or template for global widgets.
    if (!widget.global) {
      promises.push(copyFieldContentsToFile("getWidgetDescriptorBaseTemplate", widget.id, "source", `${widgetDir}/${constants.displayTemplate}`))
      promises.push(copyFieldContentsToFile("getWidgetDescriptorBaseLess", widget.id, "source", `${widgetDir}/${constants.widgetLess}`))
    }

    // Don't try to get i18 resources unless we have some.
    if (widget.i18nresources) {
      promises.push(grabBaseLocaleContent(widget, widgetDir))
    }
  } else {
    warn("baseWidgetContentCannotBeGrabbed")
  }

  // Gather all the promises together into a single one.
  return Promise.all(promises)
}

/**
 * Get the locale config file for supplied widget and locale and stick it in the supplied dir.
 * @param widget
 * @param configLocalesDir
 * @param locale
 * @returns {Promise.<TResult>|*}
 */
function getWidgetConfigSnippets(widget, configLocalesDir, locale) {

  // Get the initial locale to try.
  let localeName = getInitialMatchName(locale)

  return endPointTransceiver.getConfigLocaleContentForWidgetDescriptor([widget.repositoryId, localeName],
    request().withLocale(localeName)).then(results => {

    // Only write out strings if there are any.
    if (results.data.localeData) {

      writeFileAndETag(`${configLocalesDir}/${localeName}.json`, JSON.stringify(results.data.localeData, null, 2), results.response.headers.etag)
    } else if (hasFallBack(locale)) {

      // No match but there is a fallback - try that.
      let localeName = getFallBackName(locale)

      return endPointTransceiver.getConfigLocaleContentForWidgetDescriptor([widget.repositoryId, localeName],
        request().withLocale(localeName)).then(results => {

        // If we got a match this time, use that.
        results.data.localeData &&
          writeFileAndETag(`${configLocalesDir}/${localeName}.json`, JSON.stringify(results.data.localeData, null, 2), results.response.headers.etag)
      })
    }
  })
}

/**
 * Get the config related content for the supplied widget.
 * @param widget
 * @param widgetDir
 */
function grabConfigContent(widget, widgetDir) {

  // Make sure the server can do what we want.
  if (endPointTransceiver.serverSupports("getConfigMetadataForWidgetDescriptor")) {

    // Build up a list of promises.
    const promises = []

    // Create a config dir first.
    const configDir = `${widgetDir}/config`
    makeTrackedDirectory(configDir)

    // Get the config file.
    promises.push(endPointTransceiver.getConfigMetadataForWidgetDescriptor([widget.id]).then(results => {

      writeFileAndETag(`${configDir}/${constants.userConfigMetadataJson}`,
        JSON.stringify(results.data.metadata, null, 2), results.response.headers.etag)
    }))

    // Make the locales directories first.
    const configLocalesDir = `${configDir}/locales`
    makeTrackedDirectory(configLocalesDir)

    // Then do the locales request one by one to stop us running out of connections.
    promises.push(Promise.each(endPointTransceiver.locales, locale => getWidgetConfigSnippets(widget, configLocalesDir, locale)))

    // Gather all the promises together into a single one.
    return Promise.all(promises)
  } else {
    warn("widgetConfigCannotBeGrabbed")
  }
}

/**
 * Using the supplied widget information, pull all available files from the server
 * and write them to disk.
 * @param widget
 */
function grabWidget(widget) {

  // Let the user know something is happening...
  info("grabbingWidget", {name: widget.displayName})

  // Create the top level directory.
  const widgetDir = createWidgetDirectory(widget)

  // Keep track of all the promises, returning them as a single promise at the end.
  const promises = []

  // Need to store internal metadata in the tracking dir for later (and maybe additional metadata for user defined widgets).
  promises.push(writeWidgetMetadata(widget, widgetDir))

  // Only try to pull the JS if we are allowed to.
  if (widget.jsEditable) {
    promises.push(grabAllJavaScript(widget.id, widgetDir))
  } else {
    // if there is javascript module / extension code grab it.
    if (("javascriptExtension" in widget) && (widget.javascriptExtension !== null)) {
      promises.push(grabOnlyModuleJavascript(widget.id, widgetDir))
    }
  }

  // See if this is a user created widget.
  if (widget.source === 101) {
    promises.push(grabBaseContent(widget, widgetDir))

    // See if the widget is configurable.
    if (widget.configurable) {
      promises.push(grabConfigContent(widget, widgetDir))
    }

    // Also grab any non-standard files.
    promises.push(grabNonStandardFiles(widget, widgetDir))
  }

  // Make an instances directory for future use.
  const instancesDir = `${widgetDir}/instances`
  makeTrackedDirectory(instancesDir)

  return Promise.all(promises)
}

/*
 * Checks to see if the jsFile is an extension / moudule javascript file.
 * @param jsFile - jsFile object
 */
function isJavascriptModule(jsFile) {
  let retValue = false

  if ("extension" in jsFile) {

    if (typeof(jsFile.extension) === "string") {
      retValue = jsFile.extension.toLowerCase() == 'true'
    }
  }

  return retValue
}

/*
 * Given the ID of widget, grab the associated Module JavaScript and write it to the supplied directory.
 * To be used on widget that are not jsEditable
 * @param id the widget id
 * @param widgetDir the widget directory.

 */
function grabOnlyModuleJavascript(id, widgetDir) {

  // Create the js dir under the widget if it does not exist already.
  const widgetJsDir = `${widgetDir}/js/`
  makeTrackedDirectory(widgetJsDir)
  const widgetModuleDir = `${widgetDir}/module`
  makeTrackedDirectory(widgetModuleDir)
  const widgetModuleJsDir = `${widgetDir}/module/js`
  makeTrackedDirectory(widgetModuleJsDir)

  // Get the javascript - if any.
  return endPointTransceiver.getWidgetDescriptorJavascriptExtensionInfoById([id]).then(results => {

    // Keep track of all the promises, returning them as a single promise at the end.
    const promises = []

    results.data.jsFiles && results.data.jsFiles.forEach(jsFile => {
      promises.push(endPointTransceiver.get(jsFile.url).tap(results => {

        if (isJavascriptModule(jsFile)) {
          writeFileAndETag(`${widgetModuleJsDir}/${jsFile.name}`, results.data, results.response.headers.etag)
        }

      }))
    })

    return Promise.all(promises)
  })
}

exports.getDirectoryForWidget = getDirectoryForWidget
exports.grabAllWidgets = grabAllWidgets
exports.grabSpecificWidget = grabSpecificWidget
