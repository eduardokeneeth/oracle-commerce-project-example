const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const exists = require("./utils").exists
const getWidgetInstancePath = require("./widgetInstanceGrabber").getWidgetInstancePath
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const getDirectoryForWidget = require("./widgetGrabber").getDirectoryForWidget
const globalElementTags = require("./elementGrabberUtils").globalElementTags
const grabElementModifiableMetadata = require("./elementGrabberUtils").grabElementModifiableMetadata
const info = require("./logger").info
const isGlobal = require("./elementGrabberUtils").isGlobal
const isGrabbableElementType = require("./elementGrabberUtils").isGrabbableElementType
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const processElementInstances = require("./elementInstanceGrabber").processElementInstances
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const sanitizeName = require("./utils").sanitizeName
const splitPath = require("./utils").splitPath
const storeElementMetaData = require("./elementGrabberUtils").storeElementMetaData
const writeFileAndETag = require("./grabberUtils").writeFileAndETag

const processedWidgets = new Set()

// Need this to stop us processing the same element multiple times.
let grabbedWidgetElements

/**
 * Find all the elements associated with widgets on the server and grab them.
 * Global elements are handled separately.
 * @returns A BlueBird promise
 */
function grabWidgetElements(directory) {

  return endPointTransceiver.listWidgets().then(results =>
    grabElementsForWidgets(results.data.items, directory ? splitPath(directory) : null))
}

/**
 * Given a list of widgets, grab all their associated elements.
 * @param widgets
 * @param widget
 * @returns A BlueBird promise.
 */
function grabElementsForWidgets(widgets, widgetName) {

  // Make sure global element info has been loaded and we can get at global elements via an endpoint.
  if (globalElementTags.size == 0 && endPointTransceiver.serverSupports("getElements")) {

    return endPointTransceiver.getElements("?globals=true").then(results => {

      // Walk through each of the global elements
      results.data.items.forEach(globalElement => {
        !globalElementTags.has(globalElement.tag) && globalElementTags.add(globalElement.tag)
      })
    }).then(() => {

      // Now safe to grab widget elements.
      return grabNonGlobalElements(widgets, widgetName)
    })
  } else {
    // Normal case. We have been called as part of a grab.
    return grabNonGlobalElements(widgets, widgetName)
  }
}

/**
 * Get the files for an element associated with a widget.
 * @param widget
 * @param element
 * @param elementDir
 * @returns A Bluebird promise.
 */
function grabWidgetElementAssets(widget, element, elementDir) {

  // Build up a list of promises. Always try to get the template.
  const promises = [
    grabWidgetElementFile("getFragmentTemplate", widget.descriptor.repositoryId, element.tag, elementDir, constants.elementTemplate, "template")
  ]

  // Try to get the javascript and metadata for the element only if the parent widget has editable JS (and there may not be any anyway).
  if (widget.descriptor.jsEditable) {
    promises.push(grabWidgetElementFile("getFragmentJavaScript", widget.descriptor.repositoryId, element.tag, elementDir, constants.elementJavaScript, "javascript", 500))

    // Get the modifiable metadata too.
    promises.push(grabElementModifiableMetadata(widget, element, elementDir))
  }

  return Promise.all(promises)
}

/**
 * Boilerplate for grabbing elements under widgets.
 * @param widgets
 * @param widgetName
 * @returns A BlueBird promise
 */
function grabNonGlobalElements(widgets, widgetName) {

  return Promise.each(widgets, widget => {

    // If we are looking for a specific widget, bail out early.
    const descriptor = widget.descriptor

    if (widgetName && descriptor.displayName != widgetName) {
      return
    }

    return endPointTransceiver.getWidget([widget.repositoryId]).then(results => {

      let nonInstanceElementPromise

      // Make sure widget is editable and has not been processed before.
      if (descriptor.editableWidget && !grabbed(descriptor.repositoryId)) {
        nonInstanceElementPromise = grabNonInstanceElements(widget, results.data.fragments)
      }

      // Create directory for each widget instance.
      const widgetInstanceDir = getWidgetInstancePath(widget.descriptor.widgetType, widget.displayName)

      // See if we already have grabbed a version of the instance.
      if (exists(widgetInstanceDir)) {

        // Get the version from the instance we currently have on disk.
        const versionOnDisk = readMetadataFromDisk(widgetInstanceDir, constants.widgetInstanceMetadataJson).version

        // If the one on disk is more up to date, don't go any further.
        if (versionOnDisk > widget.descriptor.version) {
          return
        }
      }

      if (nonInstanceElementPromise) {
        return nonInstanceElementPromise.then(() =>
          processElementInstances(widget, results.data.fragments, results.response.headers.etag))
      } else {
        if (descriptor.editableWidget && descriptor.layouts.length) {

          return processElementInstances(widget, results.data.fragments, results.response.headers.etag)
        }
      }
    })
  })
}

/**
 * Holds all the boilerplate to grab non instance element stuff.
 * @param widget
 * @param elements
 * @returns {*|PromiseLike<T>|Promise<T>}
 */
function grabNonInstanceElements(widget, elements) {

  // Make sure widget actually has some interesting elements.
  if (hasGrabbableNonGlobalElements(elements)) {

    const descriptor = widget.descriptor

    // Create a directory for elements under the widget. Get the widgetGrabber to tell us where.
    const baseElementDir =
      `${getDirectoryForWidget(descriptor.widgetType, descriptor.version, descriptor.isLatestVersion)}/${constants.elementsDir}`

    makeTrackedDirectory(baseElementDir)

    // Clear the grabbed widget elements list.
    grabbedWidgetElements = []

    return Promise.map(elements, element => grabWidgetElement(widget, element, baseElementDir), getGrabbingConcurrency())
  }
}

/**
 * Returns true if at least one of the elements in the array is grabbable.
 * @param elements
 * @returns {boolean}
 */
function hasGrabbableNonGlobalElements(elements) {
  return elements && elements.some((element) => isGrabbableElementType(element.type) && !isGlobal(element.tag))
}

/**
 * Return true if we have already seen an instance of this widget. We need this to stop us processing the same elements
 * more than once.
 * @param widgetDescriptor
 */
function grabbed(widgetRespositoryId) {

  if (processedWidgets.has(widgetRespositoryId)) {
    return true
  } else {
    // Record the fact that we have seen this so the next time we return true.
    processedWidgets.add(widgetRespositoryId)
    return false
  }
}

/**
 * Holds the boilerplate for getting the file associated with an non-global element.
 * @param endpoint
 * @param widgetRepositoryId
 * @param tag
 * @param elementDir
 * @param fileName
 * @param field
 * @returns A BlueBird promise
 */
function grabWidgetElementFile(endpoint, widgetRepositoryId, tag, elementDir, fileName, field, httpCode) {

  return endPointTransceiver[endpoint]([widgetRepositoryId, tag], request().ignoring(httpCode)).tap(results => {
    // Only write anything out if we got anything.
    if (results.data.code && results.data.code[field]) {
      writeFileAndETag(`${elementDir}/${fileName}`, results.data.code[field], results.response.headers.etag)
    }
  })
}

/**
 * Pull down the assets associated with widgets element.
 * @param widget
 * @param element
 * @param baseElementDir
 * @returns A BlueBird promise.
 */
const grabWidgetElement = Promise.method((widget, element, baseElementDir) => {

  // Figure out what the element dir would be. Get rid of any invalid characters.
  const elementDir = `${baseElementDir}/${sanitizeName(element.title)}`

  // Ensure element is global and of the right type and it has not already been processed.
  if (!isGlobal(element.tag) && isGrabbableElementType(element.type) && !grabbedWidgetElements.includes(elementDir)) {

    // Note that we have now processed the widget element.
    grabbedWidgetElements.push(elementDir)

    // Let the user know something is happening...
    info("grabbingElement", {name: element.title})

    // Then create a directory for the specific element under its widget.
    makeTrackedDirectory(elementDir)

    // Save off the metadata.
    storeElementMetaData(element, widget.descriptor.widgetType, widget.descriptor.version, elementDir)

    // Lastly get template and possibly the JavaScript and process the elements children.
    return grabWidgetElementAssets(widget, element, elementDir).then(() =>
      Promise.each(element.children, element => grabWidgetElement(widget, element, baseElementDir)))
  }
})

exports.grabWidgetElements = grabWidgetElements
