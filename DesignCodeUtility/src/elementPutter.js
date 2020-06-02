const constants = require("./constants").constants
const createElementInExtension = require("./elementCreator").createElementInExtension
const endPointTransceiver = require("./endPointTransceiver")
const inTransferMode = require("./state").inTransferMode
const warn = require("./logger").warn
const processPutResultAndEtag = require("./putterUtils").processPutResultAndEtag
const readFile = require("./utils").readFile
const readJsonFile = require("./utils").readJsonFile
const readMetadata = require("./metadata").readMetadata
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const updateMetadata = require("./metadata").updateMetadata

/**
 * We have a global element that does not exist on the target instance.
 * Need to create it via an extension.
 * @param path
 */
function putGlobalElement(path) {

  // Need element endpoint - make sure it exists.
  if (!endPointTransceiver.serverSupports("getElements")) {
    warn("elementsCannotBeCreated", {path})
    return
  }

  // Get the metadata for the widget.
  const localElementMetadata = readMetadataFromDisk(path, constants.elementMetadataJson)

  if (localElementMetadata) {
    // Call the widget creator to do the business.
    return createElementInExtension(
      localElementMetadata.title, localElementMetadata.tag, localElementMetadata.type,
      path)
  }
}

/**
 * Contains the boilerplate for put an element file on the server.
 * @param path
 * @param endpoint
 * @param field
 * @returns A BlueBird promise.
 */
function putElementFile(path, endpoint, field) {

  // See if endpoint exists - element endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports(endpoint)) {
    warn("elementsCannotBeSent", {path})
    return
  }

  // Find the metadata for the element.
  return readMetadata(path, constants.elementMetadataJson).then(metadata => {

    if (metadata) {

      return endPointTransceiver[endpoint](buildUrlParameters(metadata),
        request().withBody(buildPayload(field, path)).withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results))
    } else {
      warn("cannotUpdateElement", {path})
    }
  })
}

/**
 * Builds up the URL parameters array to pass to the endpoint.
 * @param metadata
 * @returns {Array}
 */
function buildUrlParameters(metadata) {

  // See if this element is associated with a widget, include the widget ID.
  const urlParameters = []

  if (metadata.widgetId) {
    urlParameters.push(metadata.widgetId)
  }

  // Always need the element tag.
  urlParameters.push(metadata.tag)

  return urlParameters
}

/**
 * Boilerplate for building up the payload.
 * @param field
 * @param path
 * @returns {{code: {}}}
 */
function buildPayload(field, path) {

  // Set up the payload based on the parameters we got.
  const payload = {
    code : {}
  }

  payload.code[field] = readFile(path)

  return payload
}

/**
 * This is fiddly. Users can change the title of an element which we store internally (because we need it).
 * So we need to make sure that the display name held by us is the same what the external metadata file says it is.
 * This is somewhat more complex in that element names can be internationalized.
 * @param path
 */
function syncElementMetadata(path) {

  if (!inTransferMode()) {

    // Defensively load the translations array holding the display name value that the user can change.
    const translations = readJsonFile(path).translations

    if (translations) {

      // Look for a translation with the same name as the current working locale.
      const translation = translations.find(t => t.language == endPointTransceiver.locale)

      // If there is one (there should be) use it to update the value in the internal metadata.
      if (translation) {
        updateMetadata(path, constants.elementMetadataJson, {title: translation.title})
      }
    }
  }
}

/**
 * Holds the boilerplate to update element metadata.
 * @param path
 * @param endpoint
 */
function sendElementMetadata(path, endpoint) {

  if (!endPointTransceiver.serverSupports(endpoint)) {

    warn("elementsCannotBeSent", {path})
    return
  }

  // Find the metadata for the element.
  return readMetadata(path, constants.elementMetadataJson).then(metadata => {

    if (metadata) {

      return endPointTransceiver[endpoint](buildUrlParameters(metadata),
        request().withBody(readJsonFile(path)).withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results, syncElementMetadata))
    }

  })
}

exports.putElementJavaScript = path => putElementFile(path, "updateFragmentJavaScript", "javascript")
exports.putElementMetadata = path => sendElementMetadata(path, "updateFragmentMetadata")
exports.putElementTemplate = path => putElementFile(path, "updateFragmentTemplate", "template")
exports.putGlobalElement = putGlobalElement
exports.putGlobalElementJavaScript = path => putElementFile(path, "updateGlobalElementJavaScript", "javascript")
exports.putGlobalElementMetadata = path => sendElementMetadata(path, "updateGlobalElementMetadata")
exports.putGlobalElementTemplate = path => putElementFile(path, "updateGlobalElementTemplate", "template")
