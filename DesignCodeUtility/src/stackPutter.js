"use strict"

const upath = require("upath")

const cacheStackInstances = require("./metadata").cacheStackInstances
const createStackInExtension = require("./stackCreator").createStackInExtension
const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const getCachedStackInstanceFromMetadata = require("./metadata").getCachedStackInstanceFromMetadata
const inTransferMode = require("./state").inTransferMode
const processPutResultAndEtag = require("./putterUtils").processPutResultAndEtag
const readFile = require("./utils").readFile
const readJsonFile = require("./utils").readJsonFile
const readMetadata = require("./metadata").readMetadata
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const resetEtag = require("./etags").resetEtag
const splitFromBaseDir = require("./utils").splitFromBaseDir
const updateMetadata = require("./metadata").updateMetadata
const walkDirectory = require("./utils").walkDirectory
const warn = require("./logger").warn
const writeDummyEtag = require("./etags").writeDummyEtag
const writeFile = require("./utils").writeFile
const shouldSuppressThemeCompile = require("./putterUtils").shouldSuppressThemeCompile
const shouldUpdateInstances = require('./putterUtils').shouldUpdateInstances
const shouldSendInstanceConfig = require('./putterUtils').shouldSendInstanceConfig

/* N.B. Stack instances differ from widget instances in that they are
 * always associated with a layout due to the sub-region structure.
 * Hence, it doesn't make sense to 'put/transfer' a stack instance to
 * a new node for which the layout structure has not been created.  Stack
 * instances will be handled as part of a PLSU transfer operation and only
 * Stack Descriptor resources will be transferred as part of DCU.
 */

/**
 * Do the needful to get the supplied template back to the server.
 * @param path
 * @return
 */
function putStackInstanceTemplate(path) {
  if (!inTransferMode()) {
    return getStackAndStackInstanceMetadata(path).then(metadata => {
      if (metadata) {
        return putStackInstanceFile(metadata, path, "updateStackSourceCode")
      }
    })
  }
}

/**
 * Get the stack metadata (that is, the stuff we let people change) back to
 * the server.
 *
 * @param path
 */
function putStackModifiableMetadata(path) {

    return putMetadata(path, constants.stackMetadataJson, "updateStackDescriptorMetadata",
        syncStackMetadata)
}

/**
 * Get the stack instance metadata (that is, the stuff we let people change)
 * back to the server.
 *
 * @param path
 */
function putStackInstanceModifiableMetadata(path) {

  // Firstly, make sure that we actually want to send stack instance metadata.
  if (!inTransferMode() && shouldSendInstanceConfig()) {

    // See if endpoint exists - metadata endpoints are a recent innovation.
    if (!endPointTransceiver.serverSupports("updateStackMetadata")) {
      warn("stackContentFileCannotBeSent", {path})
      return
    }

    return getStackAndStackInstanceMetadata(path).then(metadata => {

      if (metadata) {
        return endPointTransceiver.updateStackMetadata([metadata.instance.repositoryId],
          request().fromPathAsJSON(path, "metadata").withEtag(metadata.instance.etag)).tap(
          results => processPutResultAndEtag(path, results, syncStackInstanceMetadata))
      }
    })
  }
}

/**
 * This is fiddly. Users can change the display name and name of an instance which we
 * store internally (because we need it).  So we need to make sure that the
 * values held internally are the same as the external metadata.
 *
 * @param path
 */
function syncStackInstanceMetadata(path) {

  if (!inTransferMode()) {

    // Load up the display name and name values that the user can change.
    const userMetadata = readJsonFile(path)
    const displayName = userMetadata.displayName
    const name = userMetadata.name

    // If there are values (there should always be but play safe), use it to
    // modify the internal metadata.
    if (displayName && name) {
      updateMetadata(path, constants.stackInstanceMetadataJson, {displayName, name})
    }
  }
}

/**
 * This is fiddly. Users can change the display name of a stack which we store
 * internally (because we need it).  So we need to make sure that the display
 * name held by us is the same what the external metadata file says it is.
 * This is somewhat more complex in that stack names can be internationalized.
 *
 * @param path
 */
function syncStackMetadata(path) {

  if (inTransferMode()) {
    return
  }

  // Defensively load the translations array holding the display name value
  // that the user can change.
  const translations = readJsonFile(path).translations

  if (translations) {

    // Look for a translation with the same name as the current working locale.
    const translation = translations.find(t => t.language === endPointTransceiver.locale)

    // If there is one (there should be) use it to update the value in the
    // internal metadata.
    if (translation) {
      updateMetadata(path, constants.stackMetadataJson, {displayName : translation.name})
    }
  }
}

/**
 * Holds the boilerplate for getting a metadata file back to the server.
 * @param path
 * @param metadataType
 * @param endpoint
 * @param successCallback
 * @returns {Promise.<TResult>|*}
 */
function putMetadata(path, metadataType, endpoint, successCallback) {

  // See if endpoint exists - metadata endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports(endpoint)) {
    warn("stackContentFileCannotBeSent", {path})
    return
  }

  return readMetadata(path, metadataType).then(metadata => {

    if (metadata) {
      return endPointTransceiver[endpoint]([metadata.repositoryId],
        request().fromPathAsJSON(path, "metadata")
            .withEtag(metadata.etag)).tap(results => {
              processPutResultAndEtag(path, results, successCallback)
      })
    }
  })
}

/**
 * Boilerplate for sending base stack content file to server.
 * @param path
 * @param endpoint
 * @returns {Promise.<TResult>|*}
 */
function putBaseStackFile(path, endpoint, field) {

  // See if endpoint exists - base endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports(endpoint)) {
    warn("stackContentFileCannotBeSent", {path})
    return
  }

  // Get the metadata for the stack.
  return readMetadata(path, constants.stackMetadataJson).then(metadata => {

    if (metadata) {
      return endPointTransceiver[endpoint]([metadata.repositoryId],
        `?updateInstances=${shouldUpdateInstances()}`,
        request().fromPathAs(path, field)
            .withEtag(metadata.etag)).tap(results => {
              processPutResultAndEtag(path, results)
      })
    }
  })
}

/**
 * Get the contents of the base template back to the server.
 * @param path
 */
function putStackBaseTemplate(path) {

  checkSyncWithInstances(path, constants.stackTemplate, readFile(path))
  return putBaseStackFile(path, "updateStackDescriptorBaseTemplate", "source")
}

/**
 * Need to ensure that if we want sync instances with base content that the
 * file contents on disk match.
 *
 * @param path
 * @param fileName
 */
function checkSyncWithInstances(path, fileName, contents) {

  // See if we are syncing the instances with the base resources.
  if (shouldUpdateInstances()) {

    // Walk through the instances directory, looking for suitable files.
    walkDirectory(`${getStackBaseDir(path)}/instances`, {
      listeners : {
        file : (root, fileStat, next) => {

          const fullPath = upath.resolve(root, fileStat.name)

          // Look for any corresponding instance content.
          if (fullPath.endsWith(fileName)) {

            // Make the instance file look like the base file.
            writeFile(fullPath, contents)
          }

          // Jump to the next file.
          next()
        }
      }
    })
  }
}

/**
 * Find the base directory for the stack from the path.
 * @param path
 * @returns {string}
 */
function getStackBaseDir(path) {

  const tokens = path.split("/")
  return tokens.slice(0, tokens.indexOf("stack") + 2).join("/")
}

/**
 * Get the contents of the base less file back to the server.
 * @param path
 */
function putStackBaseLess(path) {

  checkSyncWithInstances(path, constants.stackLess,
      `${constants.stackInstanceSubstitutionValue} {\n${readFile(path)}\n}\n`)
  return putBaseStackFile(path, "updateStackDescriptorBaseLess", "source")
}

/**
 * Get the contents of the base less file back to the server.
 * @param path
 */
function putStackBaseLessVariables(path) {

  checkSyncWithInstances(path, constants.stackLess,
      `${constants.stackInstanceSubstitutionValue} {\n${readFile(path)}\n}\n`)
  return putBaseStackFile(path, "updateStackDescriptorBaseLessVars", "source")
}

/**
 * Do the needful to get the supplied stack instance less back on the server.
 * @param path
 */
function putStackInstanceLess(path) {

  if (!inTransferMode()) {
    return getStackAndStackInstanceMetadata(path).then(metadata => {
      if (metadata) {
        return putStackInstanceFile(metadata, path, "updateStackLess", true)
      }
    })
  }
}

/**
 * Do the needful to get the supplied stack instance less back on the server.
 * @param path
 */
function putStackInstanceLessVariables(path) {

  if (!inTransferMode()) {
    return getStackAndStackInstanceMetadata(path).then(metadata => {
      if (metadata) {
        return putStackInstanceFile(metadata, path, "updateStackLessVars", true)
      }
    })
  }
}

/**
 * Holds the boilerplate associated with getting a stack instance file
 * back on the server.
 *
 * @param metadata
 * @param path
 * @param endpoint
 * @param transform
 * @returns A Bluebird promise
 */
function putStackInstanceFile(metadata, path, endpoint, transform) {

  // See if endpoint exists - stack endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports(endpoint)) {
    warn("stacksCannotBeSent", {path})
    return
  }

  // Build the basic body.
  const body = request().fromPathAs(path, "source").withEtag(metadata.etag)

  // See if we need to transform the contents before sending.
  if (transform) {
    // Replace the substitution value in the file with the IDs on the target
    // system.
    body.replacing(constants.stackInstanceSubstitutionValue,
      `#${metadata.instance.descriptorRepositoryId}-${metadata.instance.repositoryId}`)
  }

  return endPointTransceiver[endpoint]([metadata.instance.repositoryId], `?suppressThemeCompile=${shouldSuppressThemeCompile()}`, body).tap(
    results => processPutResultAndEtag(path, results))
}

/**
 * Try to get the metadata for a stack instance - by hook or by crook.
 * @param path
 * @param stackMetadata
 * @returns A BlueBird promise.
 */
function getStackInstanceMetadata(path, stackMetadata) {

  // Load the metadata for the stack instance.
  return readMetadata(path, constants.stackInstanceMetadataJson)
      .then(stackInstanceMetadata => {

    // Looks like we have metadata but check it actually exists on the
    // server - someone could have deleted it.
    if (stackInstanceMetadata && getCachedStackInstanceFromMetadata(stackInstanceMetadata)) {

      stackMetadata.instance = stackInstanceMetadata
      return stackMetadata
    }
  })
}

/**
 * Using the path to a stack instance file, find the metadata.
 * @param path
 */
function getStackAndStackInstanceMetadata(path) {

  // Load the metadata for the base stack.
  return readMetadata(path, constants.stackMetadataJson)
      .then(stackMetadata => {

    if (stackMetadata) {

      return getStackInstanceMetadata(path, stackMetadata)
    } else {

      // This can happen in transfer mode.
      warn("cannotUpdateStack", {path})
      return null
    }
  })
}

/**
 * This is for when the stack does not exist on the target server and so
 * needs to be created.
 * @param path
 */
function putStack(path) {

  // Get the metadata for the stack.
  const localStackMetadata = readMetadataFromDisk(path, constants.stackMetadataJson)

  // Call the stack creator to do the business.
  return createStackInExtension(localStackMetadata.displayName, localStackMetadata.stackType, path)
}

/**
 * Special case. Here we do not actually put the instance or even create it
 * when it does not exist.  What we actually do is look and see if the stack
 * instance exists. If not, reset the etag files.
 *
 * @param path
 */
function putStackInstance(path) {

  if (inTransferMode()) {
    return
  }

  // Get the metadata for the stack.
  const localStackInstanceMetadata = readMetadataFromDisk(path, constants.stackInstanceMetadataJson)

  // See if it exists on the server.
  if (!getCachedStackInstanceFromMetadata(localStackInstanceMetadata)) {

    // Chop the directory up so we can insert the tracking dir.
    const splitDirs = splitFromBaseDir(path)
    const baseDir = splitDirs[0], subDir = splitDirs[1]

    // Walk through the tracking dir looking for etags.
    walkDirectory(`${baseDir}/${constants.trackingDir}/${subDir}`, {
      listeners: {
        file: (root, fileStat, next) => {

          const fullPath = upath.resolve(root, fileStat.name)

          // Replace any etag files with dummies.
          if (fullPath.endsWith(constants.etagSuffix)) {
            resetEtag(fullPath)
          }

          // Jump to the next file.
          next()
        }
      }
    })
  }
}

exports.putStack = putStack
exports.putStackBaseTemplate = putStackBaseTemplate
exports.putStackBaseLess = putStackBaseLess
exports.putStackBaseLessVariables = putStackBaseLessVariables
exports.putStackInstance = putStackInstance
exports.putStackInstanceLess = putStackInstanceLess
exports.putStackInstanceLessVariables = putStackInstanceLessVariables
exports.putStackInstanceTemplate = putStackInstanceTemplate
exports.putStackModifiableMetadata = putStackModifiableMetadata
exports.putStackInstanceModifiableMetadata = putStackInstanceModifiableMetadata
