const Promise = require("bluebird")

const constants = require("./constants").constants
const copyFieldContentsToFile = require("./grabberUtils").copyFieldContentsToFile
const endPointTransceiver = require("./endPointTransceiver")
const exists = require("./utils").exists
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const getInitialMatchName = require("./localeUtils").getInitialMatchName
const getFallBackName = require("./localeUtils").getFallBackName
const hasFallBack = require("./localeUtils").hasFallBack
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const makeTrackedTree = require("./utils").makeTrackedTree
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const sanitizeName = require("./utils").sanitizeName
const saveTrackingInformation = require("./snippetKeyTracker").saveTrackingInformation
const warn = require("./logger").warn
const writeEtag = require("./etags").writeEtag
const writeFile = require("./utils").writeFile
const writeFileAndETag = require("./grabberUtils").writeFileAndETag
const writeMetadata = require("./metadata").writeMetadata

// Set up a map to enable us to find the directory that corresponds to a widget type.
const widgetTypeToDirectoryMap = new Map()

/**
 * Grab all the widget instances on the system, assuming we have already got the base widgets.
 */
function grabWidgetInstances(widgetName) {

  return endPointTransceiver.listWidgets().then(results => {

    // Now look at each instance in turn.
    return Promise.map(preProcessInstances(results.data.items), widgetInstance => {

      // See if we are after a specific widget.
      if (widgetName && widgetName != widgetInstance.descriptor.displayName) {
        return
      }

      return grabWidgetInstance(widgetInstance)
    }, getGrabbingConcurrency())
  })
}

/**
 * Process the supplied widget instance.
 * @param widgetInstance
 */
function grabWidgetInstance(widgetInstance) {

  // Let the user know something is happening.
  info("grabbingWidgetInstance", {name: widgetInstance.displayName})

  // See if we can find a widget dir.
  const widgetDir = widgetTypeToDirectoryMap.get(widgetInstance.descriptor.widgetType)

  // If there's no widget dir, it implies the widget is not editable and can be ignored.
  if (widgetDir) {

    // Create directory for each widget instance.
    const widgetInstanceDir = getWidgetInstancePath(widgetInstance.descriptor.widgetType, widgetInstance.displayName)

    // See if we already have grabbed a version of the instance.
    if (exists(widgetInstanceDir)) {

      // Get the version from the instance we currently have on disk.
      const versionOnDisk = readMetadataFromDisk(widgetInstanceDir, constants.widgetInstanceMetadataJson).version

      // If the one on disk is more up to date, don't go any further.
      if (versionOnDisk > widgetInstance.descriptor.version) {
        return null
      }
    }

    // Safe to go ahead and start building.
    makeTrackedTree(widgetInstanceDir)

    // Save off the metadata for the instance.
    saveInstanceMetadata(widgetInstance, widgetInstanceDir)

    // Build up the default promise list. Always want the template, style sheet, snippets and modifiable metadata.
    return Promise.all([
      getInstanceTemplate(widgetInstance.descriptor.widgetType, widgetInstance.id, widgetInstanceDir),
      getInstanceCss(widgetInstance, widgetInstanceDir),
      getInstanceSnippets(widgetInstance, widgetInstanceDir),
      getInstanceMetadata(widgetInstance, widgetInstanceDir)
    ])
  }
}

/**
 * In certain scenarios, it is possible to get the multiple instances of the same name but different versions.
 * We only want instances of the latest version.
 * @param items
 */
function preProcessInstances(widgetInstances) {

  // Create a map to guarantee uniqueness.
  const instancesMap = new Map()

  // Walk through the list, looking for duplicates.
  widgetInstances.forEach(widgetInstance => {

    // We have seen an instance with this name before.
    if (instancesMap.has(widgetInstance.displayName)) {

      // See if the instance is more up to date than the one we have in the map.
      const storedInstance = instancesMap.get(widgetInstance.displayName)

      if (widgetInstance.version > storedInstance.version) {

        // This one is more up to date so replace what is in the map.
        instancesMap.set(widgetInstance.displayName, widgetInstance)
      }
    } else {

      // Never seen the instance before - just need to add it.
      instancesMap.set(widgetInstance.displayName, widgetInstance)
    }
  })

  // Send back the processed list.
  return instancesMap.values()
}

/**
 * Save information for widget instance off in the tracking directory.
 * @param widgetInstance
 * @param widgetInstanceDir
 */
function saveInstanceMetadata(widgetInstance, widgetInstanceDir) {

  const widgetInstanceJson = {
    version: widgetInstance.descriptor.version,
    displayName: widgetInstance.displayName
  }

  writeMetadata(`${widgetInstanceDir}/${constants.widgetInstanceMetadataJson}`, widgetInstanceJson)
}

/**
 * Get the template for the instance.
 * @param widgetType
 * @param widgetInstanceId
 * @param widgetInstanceDir
 * @returns A Bluebird promise.
 */
function getInstanceTemplate(widgetType, widgetInstanceId, widgetInstanceDir) {

  const promises = []

  // Grab the base template.
  promises.push(copyFieldContentsToFile("getWidgetSourceCode", widgetInstanceId, "source", `${widgetInstanceDir}/${constants.displayTemplate}`))

  // Web Content widgets are special in that the template with the actual content is on a different endpoint. Pull it down as well in a different file.
  if (widgetType === "webContent") {
    promises.push(copyFieldContentsToFile("getWidgetWebContent", widgetInstanceId, "content", `${widgetInstanceDir}/${constants.webContentTemplate}`))
  }

  return Promise.all(promises)
}

/**
 * Get the CSS for the supplied instance.
 * @param widgetInstance
 * @param widgetInstanceDir
 * @returns A BlueBird promise
 */
function getInstanceCss(widgetInstance, widgetInstanceDir) {

  // Match value will be a combination of widget ID and widget instance ID. We want to replace this with something
  // neutral that we can transform again when put the code back up.
  return copyFieldContentsToFile("getWidgetLess", widgetInstance.id, "source",
    `${widgetInstanceDir}/${constants.widgetLess}`, constants.lessFileSubstitutionReqExp, constants.widgetInstanceSubstitutionValue)
}

/**
 * Get all the snippet stuff for widget instance.
 * @param widgetInstance
 * @param widgetInstanceDir
 * @returns {*}
 */
function getInstanceSnippets(widgetInstance, widgetInstanceDir) {

  // Make the locales directories first.
  makeTrackedDirectory(`${widgetInstanceDir}/locales`)

  // Then do the locales request one by one to stop us running out of connections.
  return Promise.each(endPointTransceiver.locales, locale => getWidgetSnippets(widgetInstance, widgetInstanceDir, locale))
}

/**
 * Put the boilerplate in one place.
 * @param results
 * @return {localeData|{resources, custom}|{resources}|{localeKey}|number}
 */
function localeDataFound(results) {
  return results.data.localeData && Object.keys(results.data.localeData.resources).length
}

/**
 * Figure out the parameters we need to send to the endpoint.
 * @param widgetInstanceId
 * @param localeName
 * @return {*[]}
 */
function getSnippetEndpointParams(widgetInstanceId, localeName) {

  let endpointParams = [widgetInstanceId]

  if (endPointTransceiver["getWidgetLocaleContentForLocale"]) {
    endpointParams = [widgetInstanceId, localeName]
  }

  return endpointParams
}

/**
 * Get all the snippets associated with a specific locale and widget instance.
 * @param widgetInstance
 * @param widgetInstanceDir
 * @param locale
 * @returns a Bluebird promise.
 */
function getWidgetSnippets(widgetInstance, widgetInstanceDir, locale) {

  // Web Content widgets have no snippets so don't even bother trying.
  if (widgetInstance.descriptor.widgetType === constants.webContent) {
    return
  }

  // Get the name we will first try to match on.
  let localeName = getInitialMatchName(locale)

  // Prefer an endpoint that will lock at locale level if available.
  let getSnippetsEndpoint = endPointTransceiver["getWidgetLocaleContent"]
  if (endPointTransceiver["getWidgetLocaleContentForLocale"]) {
    getSnippetsEndpoint = endPointTransceiver["getWidgetLocaleContentForLocale"]
  }

  // Get the text snippets for the "current" locale.
  return getSnippetsEndpoint(getSnippetEndpointParams(widgetInstance.id, localeName),
    request().withLocale(localeName).ignoring(500)).tap(results => {

    // See if we got any locale data.
    if (localeDataFound(results)) {

      writeWidgetSnippets(widgetInstanceDir, localeName, results, widgetInstance)
    } else if (hasFallBack(locale)) {

      // No snippets were found but there is a fallback - try again with that.
      localeName = getFallBackName(locale)

      return getSnippetsEndpoint(getSnippetEndpointParams(widgetInstance.id, localeName),
        request().withLocale(localeName).ignoring(500)).tap(results => {

        // See if we got any locale data this time.
        if (localeDataFound(results)) {

          writeWidgetSnippets(widgetInstanceDir, localeName, results, widgetInstance)
        } else {

          // Still didn't find any - tell the user.
          warn("localeInstanceDataNotFound", {
            displayName : widgetInstance.displayName,
            localeName
          })
        }
      })
    } else {
      // Not found and no fall back - tell the user all is not well.
      warn("localeInstanceDataNotFound", {
        displayName : widgetInstance.displayName,
        localeName
      })
    }
  })
}

/**
 * Boilerplate to write out the widget snippets.
 * @param widgetInstanceDir
 * @param localeName
 * @param results
 * @param widgetInstance
 */
function writeWidgetSnippets(widgetInstanceDir, localeName, results, widgetInstance) {

  // Need to keep of the snippet keys for oracle supplied widgets.
  if (widgetInstance.descriptor.source !== 101) {
    saveTrackingInformation(widgetInstanceDir, widgetInstance, Object.keys(results.data.localeData.resources))
  }

  // Create directory for the current locale.
  const widgetInstanceLocaleDir = `${widgetInstanceDir}/locales/${localeName}`
  makeTrackedDirectory(widgetInstanceLocaleDir)

  // If there are custom field values, use these to override the base values.
  results.data.localeData.custom && Object.keys(results.data.localeData.resources).forEach(key => {
    if (results.data.localeData.custom[key]) {
      results.data.localeData.resources[key] = results.data.localeData.custom[key]
    }
  })

  // Then extract just what we want for the file.
  const fileContents = {
    resources: results.data.localeData.resources
  }

  // Write out the text strings as a JSON file.
  const localeStringsFile = `${widgetInstanceLocaleDir}/ns.${widgetInstance.descriptor.i18nresources}.json`
  writeFile(localeStringsFile, JSON.stringify(fileContents, null, 2))

  // Write out the etag.
  writeEtag(localeStringsFile, results.response.headers.etag)
}

/**
 * Get user modifiable metadata for the instance.
 * @param widgetInstance
 * @param widgetInstanceDir
 * @returns {Promise.<TResult>|*}
 */
function getInstanceMetadata(widgetInstance, widgetInstanceDir) {

  // Make sure the endpoint exists on the instance.
  if (endPointTransceiver.serverSupports("getWidgetMetadata")) {

    // Call the custom metadata endpoint created specially for this purpose.
    return endPointTransceiver.getWidgetMetadata([widgetInstance.repositoryId]).then(results => {

      // Write out the massaged data.
      writeFileAndETag(`${widgetInstanceDir}/${constants.userWidgetInstanceMetadata}`,
        JSON.stringify(results.data.metadata, null, 2), results.response.headers.etag)
    })

  } else {
    warn("widgetInstanceMetadataCannotBeGrabbed")
  }
}

/**
 * We need to be able to get the correct path for a widget instance from more than one place.
 * @param widgetType
 * @param displayName
 * @returns {string}
 */
function getWidgetInstancePath(widgetType, displayName) {

  return `${widgetTypeToDirectoryMap.get(widgetType)}/instances/${sanitizeName(displayName)}`;
}

exports.getWidgetInstancePath = getWidgetInstancePath
exports.grabWidgetInstances = grabWidgetInstances
exports.widgetTypeToDirectoryMap = widgetTypeToDirectoryMap
