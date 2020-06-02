const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const warn = require("./logger").warn
const writeFileAndETag = require("./grabberUtils").writeFileAndETag
const writeMetadata = require("./metadata").writeMetadata

const globalElementTags = new Set()

// Keys that we want to store but in a secret place...
const internalKeys = ["tag", "source", "type", "title"]
const hiddenKeys = ["source", "repositoryId", "type", "title", "global", "version", "defaultText"]

/**
 * Create the modifiable metadata associated with the element.
 * @param widget
 * @param element
 * @param elementDir
 */
const grabElementModifiableMetadata = Promise.method((widget, element, elementDir) => {

  // Figure out which endpoint we should be calling and make sure it exists.
  if (!endPointTransceiver.serverSupports(widget ? "getFragmentMetadata" : "getGlobalElementMetadata")) {

    // These endpoints have not always been there.
    warn("someElementMetadataCannotBeGrabbed", {path : elementDir})

    // Try to put it together from what we have.
    processElementMetadata(element, elementDir)
  } else {

    // Call the endpoint as appropriate then process what we got back.
    if (widget) {
      return endPointTransceiver.getFragmentMetadata([widget.descriptor.repositoryId, element.tag]).tap(results => {
        processElementMetadata(results.data, elementDir, results.response.headers.etag)
      })
    } else {
      return endPointTransceiver.getGlobalElementMetadata([element.tag]).tap(results => {
        processElementMetadata(results.data, elementDir, results.response.headers.etag)
      })
    }
  }
})

/**
 * Turn the element metadata into something we can show to the user.
 * @param element
 * @param elementDir
 * @param etag
 */
function processElementMetadata(element, elementDir, etag) {

  // Make a copy of the object so we can mess with it.
  const modifiableMetadata = Object.assign({}, element)

  // Saw off a few bits on the way.
  hiddenKeys.forEach(key => delete modifiableMetadata[key])

  // Deal with any null values as the endpoint does not like them.
  Object.keys(modifiableMetadata).forEach(key => {
    if (modifiableMetadata[key] === null) {
      delete modifiableMetadata[key]
    }
  })

  // Need to process the children so we just have the tags.
  if (modifiableMetadata.children) {
    modifiableMetadata.children = modifiableMetadata.children.map(child => child.tag ? child.tag : child)
  }

  // Write what we have to disk.
  writeFileAndETag(`${elementDir}/${constants.userElementMetadata}`, JSON.stringify(modifiableMetadata, null, 2), etag)
}

/**
 * Write out the metadata for the element.
 * @param element
 * @param widgetType - optional.
 * @param version - optional.
 * @param elementDir
 */
function storeElementMetaData(element, widgetType, version, elementDir) {

  // Start to build up the internal metadata.
  const internalMetadata = {}

  // Need to store some secret information about the element.
  internalKeys.forEach(key => internalMetadata[key] = element[key])

  // Need to store widget type and version if supplied.
  if (widgetType) {
    internalMetadata.widgetType = widgetType
  }

  if (version) {
    internalMetadata.version = version
  }

  // Write it out
  writeMetadata(`${elementDir}/${constants.elementMetadataJson}`, internalMetadata)
}

/**
 * Return true if the element type passed in is suitable for grabbing.
 * @param elementType
 */
function isGrabbableElementType(elementType) {
  return ["panel", "instance"].every((unwantedType) => elementType != unwantedType)
}

/**
 * Return true if the supplied element title refers to a global element.
 * @param tag
 */
function isGlobal(tag) {
  return globalElementTags.has(tag)
}

exports.globalElementTags = globalElementTags
exports.grabElementModifiableMetadata = grabElementModifiableMetadata
exports.isGlobal = isGlobal
exports.isGrabbableElementType = isGrabbableElementType
exports.storeElementMetaData = storeElementMetaData
