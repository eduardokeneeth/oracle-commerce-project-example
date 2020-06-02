const basename = require('path').basename

const buildExtension = require("./extensionBuilder").buildExtension
const classify = require("./classifier").classify
const constants = require("./constants").constants
const createFileFromTemplate = require("./templateUtils").createFileFromTemplate
const endPointTransceiver = require("./endPointTransceiver")
const getInitialMatchName = require("./localeUtils").getInitialMatchName
const info = require("./logger").info
const prompt = require("./siteSettingsWizard").prompt
const PuttingFileType = require("./puttingFileType").PuttingFileType
const t = require("./i18n").t
const makeTrackedTree = require("./utils").makeTrackedTree
const readFile = require("./utils").readFile
const removeTrackedTree = require("./utils").removeTrackedTree
const reportErrors = require("./extensionSender").reportErrors
const reportWarnings = require("./extensionSender").reportWarnings
const sendExtension = require("./extensionSender").sendExtension
const siteSettingsTypeExists = require("./metadata").siteSettingsTypeExists
const writeMetadata = require("./metadata").writeMetadata

/**
 * Get the site settings onto the target server as an Extension.
 * @param siteSettingsName
 * @param siteSettingsDir
 */
function createSiteSettingsInExtension(siteSettingsShortName, siteSettingsName, siteSettingsDir) {

  // Build something helpful for the extension id text.
  const currentDateTime = new Date(new Date().getTime())
  const idRequestText = t("siteSettingsExtensionIdRequestDescription",
    {
      siteSettingsName,
      date: currentDateTime.toLocaleDateString(),
      time: currentDateTime.toLocaleTimeString()
    })

  // Build something helpful for the manifest text.
  const manifestNameText = t("siteSettingsExtensionName", {siteSettingsName})

  // Make sure the site ID is unique.
  const uniqueSiteSettingsId = getUniqueSiteSettingsType(siteSettingsShortName)

  // Build the extension in memory as a suitably formatted zip file.
  return buildExtension(idRequestText, manifestNameText, siteSettingsShortName, siteSettingsDir, extensionPathFor, readFile, extension => {

    // Now send the zip file to the server and tell the user how it went.
    return sendExtension(`siteSettings_${siteSettingsShortName}`, extension, results => {
      return handleUploadResults(siteSettingsName, results)
    })
  })
}

/**
 * Turn the siteSettings textual name into a short unique name suitable for putting in a template.
 * @param siteSettingsName
 * @returns {string}
 */
function getUniqueSiteSettingsType(siteSettingsName) {

  // Start with the textual name with the spaces taken out and in lower case.
  const defaultSiteSettingsType = siteSettingsName.replace(/ /g, "").toLocaleLowerCase()

  let siteSettingsType = defaultSiteSettingsType
  let siteSettingsTypeCounter = 1

  while (siteSettingsTypeExists(siteSettingsType)) {

    // Looks like the current name already exists - try again.
    siteSettingsType = `${defaultSiteSettingsType}_${siteSettingsTypeCounter++}`
  }

  return siteSettingsType
}

/**
 * Called to handle the result of the extension upload.
 * @param siteSettingsName
 * @param results
 */
function handleUploadResults(siteSettingsName, results) {

  if (results.data.success) {

    info("siteSettingsUploadSuccess", {siteSettingsName: siteSettingsName})
    reportWarnings(results.data.warnings)

  } else {

    info("siteSettingsUploadFailure", {siteSettingsName: siteSettingsName})
    reportErrors(results.data.errors)
    reportWarnings(results.data.warnings)
  }
}

/**
 * Given a path to a file on disk, figure out where it needs to go in the extension.
 * Paths and names on disk are not always the same as in the extension so there is a bit of mapping required.
 * @param siteSettingsShortName
 * @param filePath
 */
function extensionPathFor(siteSettingsShortName, filePath) {

  // Figure out the base path.
  const siteSettingsBasePath = `config/${siteSettingsShortName}`

  // See what kind of file it is and knock up the path.
  const puttingFileType = classify(filePath)

  switch (puttingFileType) {

    case PuttingFileType.SITE_SETTINGS_METADATA:
      return `${siteSettingsBasePath}/config.json`

    case PuttingFileType.SITE_SETTINGS_SNIPPETS:
      return `${siteSettingsBasePath}/locales/${basename(filePath)}`
  }
}

/**
 * Generate the locale files from the canned template.
 * @param context
 * @param siteSettingsDir
 */
function buildLocaleFiles(context, siteSettingsDir) {

  // Build the locale dir first.
  const localesDir = `${siteSettingsDir}/locales`
  makeTrackedTree(localesDir)

  // Build a locale strings file for each locale.
  endPointTransceiver.locales.forEach(locale => {
    createSiteSettingsFileFromTemplate(`${localesDir}/${getInitialMatchName(locale)}.json`, context, "exampleSiteSettingsResourcesJson")
  })
}

/**
 * Given an output path, a set of user responses an a template name, render an example widget file.
 * @param outputPath
 * @param context
 * @param name
 */
function createSiteSettingsFileFromTemplate(outputPath, context, name) {
  createFileFromTemplate(outputPath, context, figureSiteSettingsPath(name))
}

/**
 * Put the path logic in one place.
 * @param path
 * @returns {string}
 */
function figureSiteSettingsPath(path) {
  return `siteSettings/${path}`
}

/**
 * Create an empty site settings structure on disk based on the information we have just gleaned from the user.
 * @param responses
 */
function buildSkeletonSiteSettings(responses, clean) {

  // Need a shortened unique version of name - all lower case with spaces taken out.
  const siteSettingsType = getUniqueSiteSettingsType(responses.siteSettingsName)

  // Build up the context object for use with template generation.
  const context = buildContext(responses, siteSettingsType)

  // Build the base directory.
  const siteSettingsDir = buildSiteSettingsDir(responses, clean)

  // Build the locale files.
  buildLocaleFiles(context, siteSettingsDir)

  // Build the config metadata file.
  createSiteSettingsFileFromTemplate(
    `${siteSettingsDir}/${constants.siteSettingsConfigMetadataFile}`, context, "exampleSiteSettingsConfigMetadata")

  // Generate the internal metadata while we are at it.
  writeMetadata(`${siteSettingsDir}/${constants.siteSettingsMetadataJson}`,
    {
      displayName: responses.siteSettingsName,
      id: siteSettingsType
    })

  // Now we have the widget on disk and we want to sync right away, send it to the server.
  if (responses.syncWithServer) {
    return createSiteSettingsInExtension(siteSettingsType, responses.siteSettingsName, siteSettingsDir)
  }
}

/**
 * Build up an object to guide the template generation.
 * @param responses
 * @param siteSettingsType
 */
function buildContext(responses, siteSettingsType) {

  const context = {siteSettingsType}

  Object.keys(responses).forEach(key => context[key] = responses[key])

  return context
}

/**
 * Build the base siteSettings directory and return the path.
 *
 * @param responses Some object with a siteSettingsName property, apparently.
 * @param clean Non-false value if the directory should be cleaned prior to
 *   creation.
 * @returns {string} The path to the new directory
 */
function buildSiteSettingsDir(responses, clean) {

  // Build up the base siteSettings path.
  const siteSettingsDir = `${constants.siteSettingsDir}/${responses.siteSettingsName}`

  // // See if need to clean anything from disk first.
  clean && removeTrackedTree(`${constants.siteSettingsDir}/${responses.siteSettingsName}`)

  // Create the base dir.
  makeTrackedTree(`${constants.siteSettingsDir}/${responses.siteSettingsName}`)

  return siteSettingsDir
}

/**
 * Create a skeleton new site settings structure on disk. Note that we don"t send it to the server.
 */
function create(clean) {

  // Next need to find out what kind of site settings the user needs.
  return prompt(clean).then(responses => buildSkeletonSiteSettings(responses, clean))
}

exports.create = create
exports.createSiteSettingsInExtension = createSiteSettingsInExtension
