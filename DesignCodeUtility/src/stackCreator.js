//// stackCreator.js --- Stack content creation interface
"use strict"

const constants            = require("./constants").constants
const makeTrackedTree      = require("./utils").makeTrackedTree
const removeTrackedTree    = require("./utils").removeTrackedTree
const readFile             = require("./utils").readFile
const readJsonFile         = require("./utils").readJsonFile
const writeFile            = require("./utils").writeFile
const getInitialMatchName  = require("./localeUtils").getInitialMatchName
const initializeMetadata   = require("./metadata").initializeMetadata
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const writeMetadata        = require("./metadata").writeMetadata
const stackTypeExists      = require("./metadata").stackTypeExists
const info                 = require("./logger").info
const logError              = require("./logger").logError
const logWarn              = require("./logger").logWarn
const buildExtension       = require("./extensionBuilder").buildExtension
const sendExtension        = require("./extensionSender").sendExtension
const classify             = require("./classifier").classify
const endPointTransceiver  = require("./endPointTransceiver")
const inTransferMode       = require("./state").inTransferMode
const prompt               = require("./stackWizard").prompt
const PuttingFileType      = require("./puttingFileType").PuttingFileType
const t                    = require("./i18n").t

const dust     = require('dustjs-linkedin')
const fs       = require("fs")
const upath    = require("upath")

const componentType = "stack"

// Disable dust whitespace compression.
dust.optimizers.format = (ctx, node) => node

/**
 * Create a skeleton new stack on disk. Note that we don't send it to the server.
 */
function create(clean) {

  // Next need to find out what kind of stack the user needs.
  return prompt(clean).then(responses => {
    return buildSkeletonStack(responses, clean)
  })
}

/**
 * Build the base stack directory and return the path.
 *
 * @param responses Some object with a stackName property.
 * @param clean true if the stack directory should be cleaned prior to building
 *   a new one.
 * @returns {string} The path to the new directory
 */
function buildStackDir(responses, clean) {

  // Build up the base stack path.
  const stackDir = `${constants.stacksDir}/${responses.stackName}`

  // See if need to clean anything from disk first.
  if (clean) removeTrackedTree(stackDir)

  // Create the base dir.
  makeTrackedTree(stackDir)

  return stackDir
}

/**
 * Create all the config related files and directories.
 *
 * @param stackDir
 * @param context
 */
function createConfigDir(stackDir, context) {

  // Build the basic config dir.
  const configDir = `${stackDir}/config`
  makeTrackedTree(configDir)

  // Create a cut down basic config metadata file.
  const configPath = `${configDir}/${constants.userConfigMetadataJson}`

  createStackFileFromTemplate(configPath, context, "exampleConfigMetadataJson")

  // Build the basic locale dir first.
  const localesDir = `${configDir}/locales`
  makeTrackedTree(localesDir)

  // For all defined locales.
  endPointTransceiver.locales.forEach(locale => {

    const localeFilePath = `${localesDir}/getInitialMatchName(locale)}.json`

    // Add a empty locale file.
    createStackFileFromTemplate(localeFilePath, context, "exampleConfigResourcesJson")
  })
}

/**
 * Need a top level file for the stack metadata.
 *
 * @param context
 * @param stackDir
 * @param stackType
 */
function createStackMetadata(context, stackDir, stackType) {

  // Create the default internal metadata that the user cannot change.
  const internalMetadata = {
    "stackType" : stackType,
    "version" : 1,
    "source" : 101,
    "canEditSubRegion" : true,
    "minVariants" : 1,
    "maxVariants" : parseFloat(context.maxVariants),
    "displayName" : context.stackName,
    "regions": []
  }

  // We only need this region data to fill out the default region structure and
  // put in default names. It can hide away in the internal metadata.
  const variants = parseFloat(context.defaultVariants) || 1
  for (let k = 1; k <= variants; ++k) {
    internalMetadata.regions.push({
      name: "Region " + k,
    })
  }

  // Only put in i18n if we have to.
  if (context.i18n) internalMetadata.i18nresources = stackType

  // Write it out to the tracking dir.
  writeMetadata(`${stackDir}/${constants.stackMetadataJson}`, internalMetadata)

  // Load the default user modifiable metadata using the dust template.
  renderWithTemplate(figureStackPath("exampleMetadataJson"), context, (err, out) => {

    // Turn it into JSON so we can mess with it.
    const metadata = JSON.parse(out)

    // Add in translations array but only fully populate it if users ask for it.
    metadata.translations = []

    endPointTransceiver.locales.forEach(locale => {

      const translation = {
        "language" : getInitialMatchName(locale)
      }

      // For the default locale, leave off the language.
      translation.name = (locale.name === endPointTransceiver.locale)
      ? context.stackName
      : `${context.stackName} [${locale.name}]`

      metadata.translations.push(translation)
    })

    // Write out the metadata.
    const userStackMetadataPath = `${stackDir}/${constants.userStackMetadata}`
    writeFile(userStackMetadataPath, JSON.stringify(metadata, null, 2) + "\n")
  })
}

/**
 * Turn the stack textual name into a short unique name suitable for putting in a template.
 *
 * @param stackName
 * @returns {string}
 */
function getUniqueStackType(stackName) {

  // Start with the textual name with the spaces taken out and in lower case.
  const defaultStackType = stackName.replace(/\s+/g, "").toLocaleLowerCase()

  let stackType = defaultStackType
  let stackTypeCounter = 1

  while (stackTypeExists(stackType)) {
    // Looks like the current name already exists - try again.
    stackType = `${defaultStackType}_${stackTypeCounter}`

    stackTypeCounter += 1
  }

  return stackType
}

/**
 * Create files for non global stacks.
 *
 * @param stackDir
 * @param context
 */
function createNonGlobalFiles(stackDir, context) {

  // Write out the base template.
  const stackTemplatePath = `${stackDir}/${constants.stackTemplate}`
  createStackFileFromTemplate(stackTemplatePath, context, "exampleTemplate")

  // Write out the base less file.
  createStackFileFromTemplate(`${stackDir}/${constants.stackLess}`, context, "exampleLess")

  // Write out the base less-variables file.
  createStackFileFromTemplate(`${stackDir}/${constants.stackLessVariables}`, context, "exampleLessVariables")

  // Make the instances dir for later use.
  makeTrackedTree(`${stackDir}/instances`)
}

/**
 * Get the stack onto the target server as an Extension.
 *
 * @param stackName
 * @param stackType
 * @param stackDir
 * @returns A Bluebird promise.
 */
function createStackInExtension(stackName, stackType, stackDir) {
  // Build something helpful for the extension id text.
  const currentDateTime = new Date(new Date().getTime())
  const idRequestText = t("ccwExtensionIdRequestDescription",
    {
      stackName,
      date : currentDateTime.toLocaleDateString(),
      time : currentDateTime.toLocaleTimeString()
    })

  // Build something helpful for the manifest text.
  const manifestNameText = t("ccwExtensionName", {componentType, componentName: stackName})

  // Build the extension in memory as a suitably formatted zip file.
  return buildExtension(idRequestText, manifestNameText, stackType, stackDir,
    extensionPathFor, extensionContentsFor,
    // On complete call-back.
    (extension) => {

      // Now send the zip file to the server and tell the user how it went.
      return sendExtension(`stack_${stackType}`, extension, (results) => {
        return handleUploadResults(stackName, results)
      })
    })
}

/**
 * Build up an object to guide the template generation.
 *
 * @param responses
 * @param stackType
 */
function buildContext(responses, stackType) {

  const keys = [
    "stackName", "maxVariants", "defaultVariants",
    "i18n", "configurable", "withHelpText"
  ]

  const context = {stackType}
  keys.forEach(key => context[key] = responses[key])

  return context
}

/**
 * Create an empty stack on disk based on the information we have just
 * gleaned from the user.
 *
 * @param responses An object with a stackName property, probably.
 * @param clean true if the any existing stack assets should be cleaned before
 *   creating the skeleton.
 */
function buildSkeletonStack(responses, clean) {

  // Need a shortened unique version of name - all lower case with spaces taken out.
  const stackType = getUniqueStackType(responses.stackName)

  // Build up the context object for use with template generation.
  const context = buildContext(responses, stackType)

  // Build the base directory.
  const stackDir = buildStackDir(responses, clean)

  // Need to create metadata files.
  createStackMetadata(context, stackDir, stackType)

  // Create instances, templates and less.
  createNonGlobalFiles(stackDir, context)

  // Now we have the stack on disk and we want to sync right away, send it to the server.
  if (responses.syncWithServer) {
    return createStackInExtension(responses.stackName, stackType, stackDir)
  }
}

/**
 * Need to combine the user and internal metadata in the extension.
 *
 * @param fullPath
 */
function spliceStackMetadata(fullPath) {

  // Get the internal metadata minus etag.
  const internalMetadata = readMetadataFromDisk(fullPath, constants.stackMetadataJson, true)

  // Get the user metadata.
  const userMetadata = readJsonFile(fullPath)

  // Carefully splice the two together.
  userMetadata.version = internalMetadata.version
  userMetadata.stackType = internalMetadata.stackType
  userMetadata.minVariants = internalMetadata.minVariants
  userMetadata.maxVariants = internalMetadata.maxVariants
  userMetadata.canEditSubRegion = internalMetadata.canEditSubRegion
  userMetadata.regions = internalMetadata.regions

  // Add in i18n if it's in the base metadata.
  if (internalMetadata.i18nresources) {
    userMetadata.i18nresources = internalMetadata.i18nresources
  }

  // Add in name if user metadata has no translations array.
  if (!userMetadata.translations) {
    userMetadata.name = internalMetadata.displayName
  }

  // For stacks on pre-18.1 systems, we need to set a name and delete
  // translations as the instance gets messed up.
  if (!userMetadata.name && !endPointTransceiver.serverSupports("getStackMetadata")) {

    // Use the internal display name that the user gave the stack.
    userMetadata.name = internalMetadata.displayName

    // Get rid of the translations block.
    delete userMetadata.translations
  }

  // Return the massaged metadata as a string.
  return JSON.stringify(userMetadata)
}

/**
 * Get the contents for the supplied path. This allows us to tweak the contents
 * before they get written out.
 *
 * @param fullPath
 * @returns the file contents for the path ready to go in the extension.
 */
function extensionContentsFor(fullPath) {

  // Need to combine user stack metadata with the internal metadata.
  if (fullPath.endsWith(`/${constants.userStackMetadata}`)) {

    return spliceStackMetadata(fullPath)

  } else {
    // Just read the file and pass back the contents.
    return readFile(fullPath)
  }
}

/**
 * Called to handle the result of the extension upload.
 *
 * @param stackName
 * @param results
 */
function handleUploadResults(stackName, results) {

  if (results.data.success) {

    info("ccwUploadSuccess", {componentType, componentName: stackName})
    reportWarnings(results.data.warnings)

    // We created a new stack so the cache will now be out of whack.
    return initializeMetadata()

  } else {

    info("ccwUploadFailure", {componentType, componentName: stackName})
    reportErrors(results.data.errors)
    reportWarnings(results.data.warnings)
  }
}

/**
 * Output any warnings that came back from the extension upload.
 *
 * @param warnings
 */
function reportWarnings(warnings) {

  if (warnings.length) {
    info("ccwUploadWarningsFound")

    warnings.forEach(warning => {
      logWarn(warning)
    })
  }
}

/**
 * Output any warnings that came back from the extension upload.
 * @param errors
 */
function reportErrors(errors) {

  errors.forEach(error => logError(error))
}

/**
 * Given a path to a file on disk, figure out where it needs to go in the
 * extension.
 *
 * Paths and names on disk are not always the same as in the extension so there
 * is a bit of mapping required.
 *
 * @param stackType
 * @param filePath
 */
function extensionPathFor(stackType, filePath) {

  const stackBasePath = `stack/${stackType}`

  // Chop the path up.
  const tokens = filePath.split("/")

  // See what kind of file it is.
  const puttingFileType = classify(filePath)

  // There are only certain file types we support right now.
  switch (puttingFileType) {
    case PuttingFileType.STACK_BASE_TEMPLATE:
      return `${stackBasePath}/templates/${constants.stackTemplate}`

    case PuttingFileType.STACK_BASE_LESS:
      return `${stackBasePath}/less/${constants.stackLess}`

    case PuttingFileType.STACK_BASE_VARIABLES_LESS:
      return `${stackBasePath}/less/${constants.stackLessVariables}`

    case PuttingFileType.STACK_METADATA_JSON:
      return `${stackBasePath}/${constants.stackMetadataJson}`

    case PuttingFileType.STACK_BASE_SNIPPETS:
      return `${stackBasePath}/locales/${tokens[tokens.length - 2]}/${tokens[tokens.length - 1]}`

    case PuttingFileType.STACK_CONFIG_SNIPPETS:
      return `${stackBasePath}/config/locales/${tokens[tokens.length - 1]}`

    case PuttingFileType.STACK_CONFIG_JSON:
      return `${stackBasePath}/config/config.json`
  }

  // If the file type is undefined, we bung the file in the extension anyway.
  if (!puttingFileType) {

    // Need to cut off the stack/My Stack pieces.
    return `${stackBasePath}/${filePath.replace(/.*stack\/[^/]*\//, "")}`
  }
}

/**
 * Load up the template, compile it and render it via the callback.
 *
 * @param name
 * @param context
 * @param renderHandler
 */
function renderWithTemplate(name, context, renderHandler) {

  const src = fs.readFileSync(upath.resolve(__dirname, `${figureExamplePath(name)}.dust`), 'utf8')
  dust.loadSource(dust.compile(src, name))

  // Render it based on what the user wants to do.
  dust.render(name, context, renderHandler)
}

/**
 * Given an output path, a set of user responses an a template name, render an
 * example file.
 *
 * @param outputPath
 * @param context
 * @param name
 */
function createFileFromTemplate(outputPath, context, name) {

  renderWithTemplate(name, context, (err, out) => writeFile(outputPath, out))
}

/**
 * Given an output path, a set of user responses an a template name, render an
 * example stack file.
 *
 * @param outputPath
 * @param context
 * @param name
 */
function createStackFileFromTemplate(outputPath, context, name) {
  createFileFromTemplate(outputPath, context, figureStackPath(name))
}

/**
 * Put the path handling logic in one place.
 *
 * @param path
 * @returns {string}
 */
function figureExamplePath(path) {
  return `./examples/${path}`
}

/**
 * Put the path logic in one place.
 *
 * @param path
 * @returns {string}
 */
function figureStackPath(path) {
  return `stack/${path}`
}

exports.create = create
exports.createStackInExtension = createStackInExtension
