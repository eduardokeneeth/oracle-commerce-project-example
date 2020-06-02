const Promise = require("bluebird")

const constants = require('./constants').constants
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const globalElementTags = require("./elementGrabberUtils").globalElementTags
const grabElementModifiableMetadata = require("./elementGrabberUtils").grabElementModifiableMetadata
const info = require("./logger").info
const isGrabbableElementType = require("./elementGrabberUtils").isGrabbableElementType
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const request = require("./requestBuilder").request
const splitPath = require("./utils").splitPath
const sanitizeName = require("./utils").sanitizeName
const storeElementMetaData = require("./elementGrabberUtils").storeElementMetaData
const warn = require("./logger").warn
const writeFileAndETag = require("./grabberUtils").writeFileAndETag

/**
 * Get the template and JavaScript for the supplied global element.
 * @param element
 * @param elementsDir
 * @returns A BlueBird Promise
 */
function grabGlobalElementAssets(element, elementsDir) {

  // Start with an empty list of promises.
  const promises = []

  // Let the user know something is happening...
  info("grabbingElement", {name: element.title})

  // Then create a directory for the specific element in the global directory. Get rid of any invalid characters.
  const elementDir = `${elementsDir}/${sanitizeName(element.title)}`
  makeTrackedDirectory(elementDir)

  // Write out the metadata.
  storeElementMetaData(element, null, null, elementDir)

  // Only try to get the modifiable metadata and JavaScript for non-Oracle supplied elements.
  if (element.source != 100) {
    promises.push(grabGlobalElementFile("getGlobalElementJavaScript", element.tag, elementDir, constants.elementJavaScript, "javascript", 404))
    promises.push(grabElementModifiableMetadata(null, element, elementDir))
  }

  // Get the template.
  promises.push(grabGlobalElementFile("getGlobalElementTemplate", element.tag, elementDir, constants.elementTemplate, "template"))

  return Promise.all(promises)
}

/**
 * Holds the boilerplate for grabbing templates and JS for global elements.
 * @param endpoint
 * @param tag
 * @param elementDir
 * @param fileName
 * @param field
 * @param httpCode
 * @returns A BlueBird Promise
 */
function grabGlobalElementFile(endpoint, tag, elementDir, fileName, field, httpCode) {

  return endPointTransceiver[endpoint]([tag], request().ignoring(httpCode)).tap(results => {

    if (results.data.code && results.data.code[field]) {
      writeFileAndETag(`${elementDir}/${fileName}`, results.data.code[field], results.response.headers.etag)
    }
  })
}

/**
 * If we can, grab all global elements, optionally supplying the name of an element we are interested in.
 */
const tryToGrabGlobalElements = Promise.method(elementName => {

  // This endpoint was added specifically to support this script so make sure it exists.
  if (endPointTransceiver.serverSupports("getElements")) {

    // Create a top level element directory.
    const elementsDir = `${constants.elementsDir}`
    makeTrackedDirectory(elementsDir)

    // Keep track of whether we found a match.
    let foundMatch = false

    // Get a list of global elements.
    return endPointTransceiver.getElements("?globals=true").tap(results => {

      return Promise.map(results.data.items, globalElement => {

        // Make sure the element is one we are looking for
        if (elementName) {

          if (elementName != globalElement.title) {

            // Element is not the one we want - leave.
            return
          } else {

            // Found the one we want - remember this for later.
            foundMatch = true
          }
        }

        // Make sure the element is not from the wrong side of the tracks.
        if (!isGrabbableElementType(globalElement.type)) {
          return
        }

        // See if we have processed this element already.
        if (globalElementTags.has(globalElement.tag)) {
          return
        }

        // Keep a note of the tags for later.
        globalElementTags.add(globalElement.tag)

        // Get the files associated with the global element while we are about it.
        return grabGlobalElementAssets(globalElement, elementsDir)
      }, getGrabbingConcurrency())
    }).then(() => {

      // If we didn't get a match, warn the user.
      !foundMatch && elementName && warn("noMatchFound", {name: elementName})
    })
  } else {
    warn("globalElementsCannotBeGrabbed")
    return
  }
})

/**
 * Find all the global elements and display them.
 */
function grabGlobalElements() {
  return tryToGrabGlobalElements()
}

/**
 * Grab a specific global element.
 * @param directory
 */
function grabGlobalElement(directory) {
  return tryToGrabGlobalElements(splitPath(directory))
}

exports.grabGlobalElement = grabGlobalElement
exports.grabGlobalElements = grabGlobalElements
