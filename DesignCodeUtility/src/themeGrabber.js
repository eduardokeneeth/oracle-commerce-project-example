const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const sanitizeName = require("./utils").sanitizeName
const splitPath = require("./utils").splitPath
const warn = require("./logger").warn
const writeFileAndETag = require("./grabberUtils").writeFileAndETag
const writeMetadata = require("./metadata").writeMetadata

/**
 * Boilerplat for grabbing themes.
 * @param themeName
 * @returns {*|PromiseLike<T>|Promise<T>}
 */
function grabThemes(themeName) {

  // Create a directory to bung the themes in.
  makeTrackedDirectory(constants.themesDir)

  // Firstly get a list of themes.
  return endPointTransceiver.getThemes("?type=custom").then(results => {

    // User may be after a specific theme.
    const themes = themeName ? results.data.items.filter(theme => theme.name == themeName) : results.data.items

    // We were looking for a specific theme.
    themeName && !themes.length && warn("noMatchFound", {name : themeName})

    return Promise.map(themes, theme => grabTheme(theme), getGrabbingConcurrency())
  })
}

/**
 * Get all the custom themes we can find and download their bits.
 * @returns a Bluebird promise
 */
function grabAllThemes() {
  return grabThemes()
}

/**
 * Download a specific custom theme given by the supplied path.
 * @param directory
 */
function grabSpecificTheme(directory) {
  return grabThemes(splitPath(directory))
}

/**
 * Write out the supplied theme to the various files.
 * @param theme
 * @returns a Bluebird promise
 */
function grabTheme(theme) {

  // Let the user know something is happening...
  info("grabbingTheme", {name: theme.name})

  // Create a directory for the name.
  const themeDir = `${constants.themesDir}/${sanitizeName(theme.name)}`
  makeTrackedDirectory(themeDir)

  // Save off the metadata.
  writeMetadata(`${themeDir}/${constants.themeMetadataJson}`, { displayName : theme.name })

  return endPointTransceiver.getThemeSource([theme.repositoryId]).tap(results => {

    writeFileAndETag(`${themeDir}/${constants.themeVariables}`, results.data.variables, results.response.headers.etag)
    writeFileAndETag(`${themeDir}/${constants.themeStyles}`, results.data.styles, results.response.headers.etag)

    // Only write additional styles if there are any.
    if (results.data.additionalStyles) {
      writeFileAndETag(`${themeDir}/${constants.themeAdditionalStyles}`, results.data.additionalStyles, results.response.headers.etag)
    } else {
      writeFileAndETag(`${themeDir}/${constants.themeAdditionalStyles}`, "", results.response.headers.etag)
    }
  })
}

exports.grabAllThemes = grabAllThemes
exports.grabSpecificTheme = grabSpecificTheme
