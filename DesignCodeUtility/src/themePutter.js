const dirname = require('path').dirname

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const inTransferMode = require("./state").inTransferMode
const processPutResult = require("./putterUtils").processPutResult
const readFile = require("./utils").readFile
const readMetadata = require("./metadata").readMetadata
const request = require("./requestBuilder").request
const warn = require("./logger").warn
const writeEtag = require("./etags").writeEtag

/**
 * Send a Theme related file back to the server.
 * @param path
 * @param field
 * @returns A BlueBird promise.
 */
function putThemeFile(path, field) {

  // Find the metadata for the theme.
  return readMetadata(path, constants.themeMetadataJson).then(metadata => {

    // If we got metadata, theme must exist on target server.
    if (metadata) {

      return updateThemeSource(path, field, metadata)
    } else {

      warn("cannotUpdateTheme", {path})
    }
  })
}

/**
 * Send an entire Theme to the server.
 * @param path
 */
function putTheme(path) {

  // Find the metadata for the theme.
  return readMetadata(path, constants.themeMetadataJson).then(metadata => {

    // If we got metadata, theme must exist on target server.
    if (metadata) {

      return updateTheme(path, metadata)
    } else if (inTransferMode()) {

      // Theme does not exist so we need to create it first.
      return createAndApplyChangesToTheme(path)
    } else {
      // Trying to put a Theme to server that we have no metadata for and no way to get it.
      warn("cannotUpdateTheme", {path})
    }
  })
}

/**
 * Update the complete Theme on the server.
 * @param path
 * @param repositoryId
 */
function updateTheme(path, metadata) {

  // Going to update all three files with one call.
  const themeStylesPath = `${path}/${constants.themeStyles}`
  const additionalStylesPath = `${path}/${constants.themeAdditionalStyles}`
  const themeVariablesPath = `${path}/${constants.themeVariables}`

  // Gather the three Theme files into one object.
  const payload = {
    styles : readFile(themeStylesPath),
    additionalStyles : readFile(additionalStylesPath),
    variables : readFile(themeVariablesPath)
  }

  // Build up the request, adding the etag if we got one.
  const requestBuilder = request().withBody(payload)
  metadata.etag && requestBuilder.withEtag(metadata.etag)

  return endPointTransceiver.updateThemeSource([metadata.repositoryId], requestBuilder).tap(results => {

    // If we are not transferring content between servers, update the etags for the three files.
    if (processPutResult(path, results) && !inTransferMode()) {

      [themeStylesPath, additionalStylesPath, themeVariablesPath].forEach(themeFilePath =>
        writeEtag(themeFilePath, results.response.headers.etag))
    }
  })
}

/**
 * Update the theme file on the remote server and update the etag after.
 * @param path
 * @param field
 * @param metadata
 * @returns A BlueBird promise.
 */
function updateThemeSource(path, field, metadata) {

  return endPointTransceiver.updateThemeSource([metadata.repositoryId],
    request().fromPathAs(path, field).withEtag(metadata.etag)).tap(results => {

    // See if things went OK.
    if (processPutResult(path, results)) {

      // All three Theme files share an etag, therefore need to update the etag for all three after a put.
      [constants.themeVariables, constants.themeStyles, constants.themeAdditionalStyles].forEach(themeFile =>
        writeEtag(`${dirname(path)}/${themeFile}`, results.response.headers.etag))
    }
  })
}

/**
 * We have been asked to update a theme but the theme does not exist.
 * @param path
 */
function createAndApplyChangesToTheme(path) {

  warn("creatingTheme", {path})

  // Get a list of themes from the target system.
  return endPointTransceiver.getThemes("?type=custom").then(results => {

    // Make a new Theme by cloning one of the existing themes. Path will look like: theme/Mono Theme so get last piece.
    const pieces = path.split("/")
    const payload = {
      name : pieces[pieces.length - 1]
    }

    // Clone the first one we find.
    return endPointTransceiver.cloneTheme([results.data.items[0].repositoryId],
      request().withBody(payload)).then(results => {

      if (processPutResult(path, results)) {
        return updateTheme(path, {repositoryId : results.data.repositoryId})
      }
    })
  })
}

exports.putTheme = putTheme
exports.putThemeStyles = path => putThemeFile(path, "styles")
exports.putThemeAdditionalStyles = path => putThemeFile(path, "additionalStyles")
exports.putThemeVariables = path => putThemeFile(path, "variables")
