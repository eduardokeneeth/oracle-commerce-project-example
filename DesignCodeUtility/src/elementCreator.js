const dirname = require('path').dirname

const buildExtension = require("./extensionBuilder").buildExtension
const classify = require("./classifier").classify
const constants = require("./constants").constants
const createFileFromTemplate = require("./templateUtils").createFileFromTemplate
const elementTagExists = require("./metadata").elementTagExists
const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const getInitialMatchName = require("./localeUtils").getInitialMatchName
const info = require("./logger").info
const initializeMetadata = require("./metadata").initializeMetadata
const inTransferMode = require("./state").inTransferMode
const makeTrackedTree = require("./utils").makeTrackedTree
const prompt = require("./elementWizard").prompt
const PuttingFileType = require("./puttingFileType").PuttingFileType
const readFile = require("./utils").readFile
const readJsonFile = require("./utils").readJsonFile
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const removeTrackedTree = require("./utils").removeTrackedTree
const renderWithTemplate = require("./templateUtils").renderWithTemplate
const reportErrors = require("./extensionSender").reportErrors
const reportWarnings = require("./extensionSender").reportWarnings
const sendExtension = require("./extensionSender").sendExtension
const spliceElementMetadata = require("./elementUtils").spliceElementMetadata
const t = require("./i18n").t
const widgetExistsOnTarget = require("./metadata").widgetExistsOnTarget
const writeMetadata = require("./metadata").writeMetadata
const writeFile = require("./utils").writeFile

/**
 * Create a skeleton new element on disk. Note that we don"t send it to the server.
 */
function create(clean, directory, directoryType, parentElementMetadata) {

  // When creating an element under a widget, widget must not exist server side. Need the metadata cache to check this.
  if (directoryType == PuttingFileType.WIDGET || directoryType == PuttingFileType.WIDGET_ELEMENT) {

    return initializeMetadata().then(() => {

      // Widget already on server - can't add element under it.
      if (widgetExistsOnTarget(directory)) {
        error("cantCreateElementUnderExistingWidget", {widgetDir: directory})
        return
      }

      // Element is under a widget.
      return prompt(clean, directory, directoryType, parentElementMetadata).then(responses =>
        buildSkeletonElement(responses, clean, directory, directoryType, parentElementMetadata))
    })
  } else {

    // Must be a global element.
    return prompt(clean, getTargetDir(directory, directoryType), directoryType, parentElementMetadata).then(responses =>
      buildSkeletonElement(responses, clean, directory, directoryType, parentElementMetadata))
  }
}

/**
 * Entry point to let us generate a complex element under a widget.
 * @param widgetResponses
 * @param context - from widget wizard
 */
function generateExampleWidgetElement(widgetResponses, widgetDir) {

  // Create a fake set of responses.
  const responses = {
    elementName: `${widgetResponses.widgetName} Widget Element`,
    type: "fragment",
    i18n: widgetResponses.i18n,
    withJavaScript: true,
    withSubElements: true,
    withHelpText: true,
    configOptions: ["available"]
  }

  // Generate the element, returning the element dir.
  return buildSkeletonElement(responses, true, widgetDir, PuttingFileType.WIDGET)
}

/**
 * If we add an element as a child of another element, we need to update its metadata.
 * @param directory
 * @param elementTag
 */
function updateExternalParentElementMetadata(directory, elementTag) {

  const userElementMetadataPath = `${directory}/${constants.userElementMetadata}`
  const userElementMetadata = readJsonFile(userElementMetadataPath)

  // Add in a children array if its not there.
  if (!userElementMetadata.children) {
    userElementMetadata.children = []
  }

  // Add in the tag for the new element.
  userElementMetadata.children.push(elementTag)

  // Write the changed metadata back.
  writeFile(userElementMetadataPath, JSON.stringify(userElementMetadata, null, 2))
}

/**
 * Using the existing context, build a new one.
 * @param context
 * @param overrides
 * @return a new context
 */
function forkContext(context, overrides) {

  // Make a deep copy of the existing context.
  const newContext = {}
  Object.keys(context).forEach(key => newContext[key] = context[key])

  // Overlay some values over the top.
  Object.keys(overrides).forEach(key => newContext[key] = overrides[key])

  return newContext
}

/**
 * Create an example container element, returning the new element tag.
 * @param context
 * @param targetDir
 * @param elementTag
 * @param directory
 * @param directoryType
 * @param children
 * @return {string}
 */
function createExampleContainerElement(context, targetDir, elementTag, directory, directoryType, children) {

  // Figure what the dir should be.
  const containerElementName = `${context.elementName} Example Container Element`
  const containerElementDir = `${targetDir}/${containerElementName}`

  // Need a shortened unique version of name - all lower case with spaces taken out.
  const containerElementTag = getUniqueElementTag(containerElementName)

  // Just create the metadata, passing in the leaf elements as children.
  createElementMetadata(
    forkContext(context,
      {
        type: "container",
        configOptions: ["available", "actual", "currentConfig", "preview"],
        elementName: containerElementName,
        elementTag: containerElementTag,
        children
      }),
    containerElementDir, containerElementTag, directory, directoryType)

  // Send back the tag as the parent element needs it.
  return containerElementTag
}

/**
 * Holds the boilerplate for building a leaf element.
 * @param context
 * @param targetDir
 * @param directory
 * @param directoryType
 * @param name
 * @param type
 * @param configOptions
 * @return {string}
 */
function createExampleLeafElement(context, targetDir, directory, directoryType, name, type, configOptions) {

  // Figure what the dir should be.
  const elementName = `${context.elementName} Example ${name}`
  const elementDir = `${targetDir}/${elementName}`

  // Need a shortened unique version of name - all lower case with spaces taken out.
  const elementTag = getUniqueElementTag(elementName)

  // Create the metadata, keeping note of the context.
  const staticElementContext = forkContext(context,
    {
      type,
      configOptions,
      elementName,
      elementTag,
      elementBody: `<P>${name} Contents</P>`
    })

  createElementMetadata(staticElementContext, elementDir, elementTag, directory, directoryType)

  // See if the user wants JavaScript.
  context.withJavaScript &&
  createElementFileFromTemplate(`${elementDir}/${constants.elementJavaScript}`, staticElementContext, "exampleJs")

  // Need to create the template.
  createElementFileFromTemplate(`${elementDir}/${constants.elementTemplate}`, staticElementContext, "exampleTemplate")

  // Send back the tag as the parent element needs it.
  return elementTag
}

/**
 * Create an example static fragment, passing back the tag.
 * @param context
 * @param targetDir
 * @param elementTag
 * @param directory
 * @param directoryType
 * @return {string}
 */
function createExampleStaticFragment(context, targetDir, elementTag, directory, directoryType) {
  return createExampleLeafElement(context, targetDir, directory, directoryType, "Static Element", "staticFragment", [])
}

/**
 * Create an example dynamic fragment, passing back the tag.
 * @param context
 * @param targetDir
 * @param elementTag
 * @param directory
 * @param directoryType
 * @return {string}
 */
function createExampleDynamicFragment(context, targetDir, elementTag, directory, directoryType) {
  return createExampleLeafElement(context, targetDir, directory, directoryType, "Dynamic Element", "dynamicFragment", ["textBox","fontPicker"])
}

/**
 * Create an example sub fragment, passing back the tag.
 * @param context
 * @param targetDir
 * @param elementTag
 * @param directory
 * @param directoryType
 * @return {string}
 */
function createExampleSubFragment(context, targetDir, elementTag, directory, directoryType) {
  return createExampleLeafElement(context, targetDir, directory, directoryType, "Sub Element", "subFragment", ["textBox", "fontPicker"])
}

/**
 * Create a complex element as a child of the supplied element.
 * @param context
 * @param elementDir
 * @param elementTag
 * @param directory
 * @param directoryType
 * @return {undefined}
 */
function generateExampleSubElements(context, elementDir, elementTag, directory, directoryType) {

  // Figure out the target dir.
  const targetDir = dirname(elementDir)

  // First, create one of each type of leaf element.
  const children = [
    createExampleStaticFragment(context, targetDir, elementTag, directory, directoryType),
    createExampleDynamicFragment(context, targetDir, elementTag, directory, directoryType),
    createExampleSubFragment(context, targetDir, elementTag, directory, directoryType)
  ]

  // Create a container element last.
  return createExampleContainerElement(context, targetDir, elementTag, directory, directoryType, children)
}

/**
 * Create an empty element on disk based on the information we have just gleaned from the user.
 * @param responses
 * @param clean
 * @param directory
 * @param directoryType
 * @param parentElementMetadata
 * @return {A}
 */
function buildSkeletonElement(responses, clean, directory, directoryType, parentElementMetadata) {

  // Need a shortened unique version of name - all lower case with spaces taken out.
  const elementTag = getUniqueElementTag(responses.elementName)

  // If a parent element was specified, need to update the metadata.
  if (directoryType == PuttingFileType.WIDGET_ELEMENT || directoryType == PuttingFileType.GLOBAL_ELEMENT) {
    updateExternalParentElementMetadata(directory, elementTag)
  }

  // Build up the context object for use with template generation.
  const context = buildContext(responses, elementTag)

  // Build the base directory.
  const elementDir = buildElementDir(responses, clean, directory, directoryType)

  // See if the user wants JavaScript.
  responses.withJavaScript &&
  createElementFileFromTemplate(`${elementDir}/${constants.elementJavaScript}`, context, "exampleJs")

  // Do the element template for non container elements and elements that do not use the available config option.
  !(responses.type == "hidden" ||
    responses.type == "container" ||
    (responses.type == "fragment" &&
      responses.configOptions && responses.configOptions.includes("available") && responses.configOptions.length == 1)) &&
  createElementFileFromTemplate(`${elementDir}/${constants.elementTemplate}`, context, "exampleTemplate")

  // If element is with sub-elements and we want example code, generate example sub-elements, keeping a note of the container tag.
  let childContainerTag
  if ((responses.withSubElements ||
    (responses.type == "fragment" && responses.configOptions.includes("available") && responses.configOptions.length == 1)) && responses.withHelpText) {
    context.children = [generateExampleSubElements(context, elementDir, elementTag, directory, directoryType)]
  }

  // Need to create metadata files.
  createElementMetadata(context, elementDir, elementTag, directory, directoryType)

  // Tell the user about the -g option.
  info("templateMarkupReminder")

  // Now we have the element on disk and we want to sync right away, send it to the server.
  if (responses.syncWithServer) {
    return createElementInExtension(responses.elementName, elementTag, responses.type, elementDir)
  } else {
    // Other case where we are being called from widget wizard - just return the top level directory.
    return elementDir
  }
}

/**
 Get the contents for the supplied path. This allows us to tweak the contents before they get written out.
 * @param path
 * @returns the file contents for the path ready to go in the extension.
 */
function extensionContentsFor(path) {

  // Need to combine user element metadata with the internal metadata.
  if (path.endsWith(`/${constants.userElementMetadata}`)) {

    return spliceElementMetadata(path)
  } else {

    // Just read the file and pass back the contents.
    return readFile(path)
  }
}

/**
 * Get the element onto the target server as an Extension.
 * @param elementName
 * @param elementTag
 * @param elementType
 * @param elementDir
 * @returns A Bluebird promise.
 */
function createElementInExtension(elementName, elementTag, elementType, elementDir) {

  // Build something helpful for the extension id text.
  const currentDateTime = new Date(new Date().getTime())
  const idRequestText = t("elementExtensionIdRequestDescription",
    {
      elementName,
      date: currentDateTime.toLocaleDateString(),
      time: currentDateTime.toLocaleTimeString()
    })

  // Build something helpful for the manifest text.
  const manifestNameText = t("elementExtensionName", {elementName})

  // Build the extension in memory as a suitably formatted zip file.
  return buildExtension(idRequestText, manifestNameText, elementTag, elementDir, extensionPathFor, extensionContentsFor, extension => {

    // Now send the zip file to the server and tell the user how it went.
    return sendExtension(`element_${elementTag}`, extension, results => {
      return handleUploadResults(elementName, elementTag, elementType, results)
    })
  })
}

/**
 * Called to handle the result of the extension upload.
 * @param elementName
 * @param elementTag
 * @param elementType
 * @param results
 */
function handleUploadResults(elementName, elementTag, elementType, results) {

  if (results.data.success) {

    // Try to provide a helpful message to the user based on the element type.
    switch (elementType) {
      case "container":
      case "hidden":
        info("hiddenOrContainerElementUploadSuccess", {elementName})
        break
      case "dynamicFragment":
      case "staticFragment":
      case "subFragment":
        info("leafElementUploadSuccess", {elementName})
        break
      default:
        info("elementUploadSuccess", {elementName})
        break
    }

    reportWarnings(results.data.warnings)

    // We created a new element so the cache will now be out of wack.
    return initializeMetadata()
  } else {

    info("elementUploadFailure", {elementName})
    reportErrors(results.data.errors)
    reportWarnings(results.data.warnings)
  }
}

/**
 * Given a path to a file on disk, figure out where it needs to go in the extension.
 * Paths and names on disk are not always the same as in the extension so there is a bit of mapping required.
 * @param elementTag
 * @param filePath
 */
function extensionPathFor(elementTag, filePath) {

  // Figure out what the base path is.
  const elementBasePath = `element/${elementTag}`

  switch (classify(filePath)) {
    case PuttingFileType.GLOBAL_ELEMENT_TEMPLATE:
      return `${elementBasePath}/templates/template.txt`
    case PuttingFileType.GLOBAL_ELEMENT_JAVASCRIPT:
      return `${elementBasePath}/js/${constants.elementJavaScript}`
    case PuttingFileType.GLOBAL_ELEMENT_METADATA:
      return `${elementBasePath}/${constants.elementMetadataJson}`
  }
}

/**
 * Given an output path, a set of user responses an a template name, render an example widget file.
 * @param outputPath
 * @param context
 * @param name
 */
function createElementFileFromTemplate(outputPath, context, name) {
  createFileFromTemplate(outputPath, context, figureElementPath(name))
}

/**
 * Need a top level file for the widget metadata
 * @param context
 * @param elementDir
 * @param elementTag
 * @param widgetDir
 * @param directoryType
 */
function createElementMetadata(context, elementDir, elementTag, widgetDir, directoryType) {

  // Load up the widget metadata for later if we are under a widget.
  const widgetMetadata = widgetDir ? readMetadataFromDisk(widgetDir, constants.widgetMetadataJson) : null

  // Create the default internal metadata that the user cannot change.
  // Note that we are missing the element repositoryId and widgetId which will be added when we create the element.
  const internalMetadata = {
    "tag": elementTag,
    "source": 101,
    "type": context.type,
    "title": context.elementName
  }

  // Element is to be under a widget so we need the widget version.
  if (widgetMetadata) {
    internalMetadata.version = widgetMetadata.version
  }

  // Write it out to the tracking dir.
  writeMetadata(`${elementDir}/${constants.elementMetadataJson}`, internalMetadata)

  // Load the default user modifiable metadata using the dust template.
  renderWithTemplate(figureElementPath("exampleMetadataJson"), context, (err, out) => {

    // Turn it into JSON so we can mess with it.
    const metadata = JSON.parse(out)

    // Add in translations array but only fully populate it if users ask for it.
    metadata.translations = createElementMetadataTranslations(context)

    //  Figure out the element availability.
    if (directoryType == PuttingFileType.WIDGET || directoryType == PuttingFileType.WIDGET_ELEMENT) {

      // Under a widget. Just make it usable with that widget.
      metadata.supportedWidgetType = [widgetMetadata.widgetType]
    } else {

      // Element is global. Make it usable with any widget.
      metadata.availableToAllWidgets = true
    }

    // Write out the metadata.
    writeFile(`${elementDir}/${constants.userElementMetadata}`, JSON.stringify(metadata, null, 2))
  })
}

/**
 * Build up the translations in the metadata.
 * @param context
 * @returns {Array}
 */
function createElementMetadataTranslations(context) {

  const translations = []

  // User wants an 18n element.
  if (context.i18n) {

    endPointTransceiver.locales.forEach(locale => {

      const translation = {
        "language": getInitialMatchName(locale),
        "description": ""
      }

      // For the default locale, leave off the language.
      if (locale.name == endPointTransceiver.locale) {
        translation.title = context.elementName
      } else {
        translation.title = `${context.elementName} [${locale.name}]`
      }

      translations.push(translation)
    })
  } else {
    translations.push({
      "language": endPointTransceiver.locale,
      "title": context.elementName,
      "description": ""
    })
  }

  return translations
}

/**
 * Put the path logic in one place.
 * @param path
 * @returns {string}
 */
function figureElementPath(path) {
  return `element/${path}`
}

/**
 * Turn the element textual name into a short unique name suitable for putting in a template.
 * @param elementName
 * @returns {string}
 */
function getUniqueElementTag(elementName) {

  // Start with the textual name with spaces replaced by hyphens and in lower case.
  const defaultElementTag = elementName.replace(/ /g, "-").toLocaleLowerCase()

  let elementTag = defaultElementTag
  let elementTagCounter = 1

  while (elementTagExists(elementTag)) {
    // Looks like the current name already exists - try again.
    elementTag = `${defaultElementTag}-${elementTagCounter++}`
  }

  return elementTag
}

/**
 * Build up an object to guide the template generation.
 * @param responses
 * @param elementTag
 */
function buildContext(responses, elementTag) {

  // Start with the template tag and tack on all the responses.
  const context = {elementTag}

  Object.keys(responses).forEach(key => context[key] = responses[key])

  // textBox config option is special.
  responses.configOptions && (context.textBox = responses.configOptions.includes("textBox"))

  return context
}

/**
 * Given an widget element dir, get the path to the underlying widget.
 * @param directory
 * @return {string}
 */
function getWidgetDirFromElementDir(directory) {

  const segments = directory.split("/")
  return segments.slice(0, segments.length - 2).join("/")
}

/**
 * Get the directory that the new element will be built in.
 * @param directory
 * @param directoryType
 * @return {string}
 */
function getTargetDir(directory, directoryType) {

  // See what kind of directory we have.
  if (directoryType == PuttingFileType.WIDGET) {

    // We are adding an element under a widget.
    return `${directory}/${constants.elementsDir}`

  } else if (directoryType == PuttingFileType.WIDGET_ELEMENT) {

    // We are adding an element as a child of another element which is under a widget.
    return `${getWidgetDirFromElementDir(directory)}/${constants.elementsDir}`
  } else {
    // Must be a global element
    return constants.elementsDir
  }
}

/**
 * Build up the path to the element directory
 * @param elementName
 * @param directory
 * @returns {string}
 */
function figureElementDirPath(elementName, directory, directoryType) {

  return `${getTargetDir(directory, directoryType)}/${elementName}`
}

/**
 * Build the base Element directory and return the path.
 * @param elementName
 * @param clean
 * @param directory
 * @param directoryType
 * @returns The path to the new directory
 */
function buildElementDir(responses, clean, directory, directoryType) {

  // Build up the base Element path.
  const elementDir = figureElementDirPath(responses.elementName, directory, directoryType)

  // See if need to clean anything from disk first.
  clean && removeTrackedTree(elementDir)

  // Create the base dir.
  makeTrackedTree(elementDir)

  return elementDir
}

exports.create = create
exports.createElementInExtension = createElementInExtension
exports.generateExampleWidgetElement = generateExampleWidgetElement
