const constants = require("./constants").constants
const readJsonFile = require("./utils").readJsonFile
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk

/**
 * Turn an element instance tag e.g. fred@1234 into fred.
 * @param instanceTag
 * @return {*|string}
 */
function getBaseElementTag(instanceTag) {
  return instanceTag.split("@")[0]
}

/**
 * Turn an element instance tag e.g. fred@1234 into 1234.
 * @param instanceTag
 * @return {*|string}
 */
function getElementTagRepoId(instanceTag) {
  return instanceTag.split("@")[1]
}

/**
 * Need to combine the user and internal metadata in the extension.
 * @param path
 */
function spliceElementMetadata(path) {

  // Get the internal metadata minus etag.
  const internalMetadata = readMetadataFromDisk(path, constants.elementMetadataJson, true)

  // Get the user metadata.
  const userMetadata = readJsonFile(path)

  // Carefully splice the two together.
  userMetadata.type = internalMetadata.type
  userMetadata.tag = internalMetadata.tag

  // Add in title if user metadata has no translations array.
  !userMetadata.translations && (userMetadata.title = internalMetadata.title)

  // If there is no availability data, add in a default. This information did not used to be available.
  if (!userMetadata.supportedWidgetType && !userMetadata.availableToAllWidgets) {
    userMetadata.availableToAllWidgets = true
  }

  // Return the massaged metadata as a string.
  return JSON.stringify(userMetadata)
}

exports.getBaseElementTag = getBaseElementTag
exports.getElementTagRepoId = getElementTagRepoId
exports.spliceElementMetadata = spliceElementMetadata
