/**
 * Entry point for the Content Creation Wizard.
 */
const program = require("commander")

const constants = require("./constants").constants
const addCommonOptions = require("./optionsUtils").addCommonOptions
const classify = require("./classifier").classify
const elementCreator = require("./elementCreator")
const elementMarkupGenerator = require("./elementMarkupGenerator")
const endPointTransceiver = require("./endPointTransceiver")
const exitDueToInvalidCall = require("./exitHandler").exitDueToInvalidCall
const getApplicationKey = require("./optionsUtils").getApplicationKey
const getHostFromUrl = require("./utils").getHostFromUrl
const getLastNode = require("./metadata").getLastNode
const getPassword = require("./optionsUtils").getPassword
const info = require("./logger").info
const logInfo = require("./logger").logInfo
const PuttingFileType = require("./puttingFileType").PuttingFileType
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const t = require("./i18n").t
const exists = require("./utils").exists
const useBasePath = require("./utils").useBasePath
const error = require("./logger").error
const widgetCreator = require("./widgetCreator")
const siteSettingsCreator = require("./siteSettingsCreator")
const stackCreator = require("./stackCreator")

/**
 * Classify the supplied directory and make return true if it looks wrong.
 * @return {boolean}
 */
function validDirectoryType(directoryType) {

  return [PuttingFileType.WIDGET, PuttingFileType.WIDGET_ELEMENT, PuttingFileType.GLOBAL_ELEMENT, PuttingFileType.GLOBAL_ELEMENTS_DIRECTORY].includes(directoryType)
}

/**
 * Make sure the elemnt creation and target directory looks reasonable.
 * @param elementCreationDirectoryType
 * @param elementCreationDirectory
 * @return the parent element metadata - if any
 */
function validateElementCreationDirectory(elementCreationDirectoryType, elementCreationDirectory) {

  // If supplied, directory must be exist and be an element or widget directory.
  if (!validDirectoryType(elementCreationDirectoryType) || !exists(elementCreationDirectory)) {

    error("invalidParentElementType", {elementDir: elementCreationDirectory})
    exitDueToInvalidCall(program)
  }

  // If its an element dir, need to check a few things.
  if (elementCreationDirectoryType == PuttingFileType.WIDGET_ELEMENT || elementCreationDirectoryType == PuttingFileType.GLOBAL_ELEMENT) {

    // Get the metadata.
    const parentElementMetadata = readMetadataFromDisk(elementCreationDirectory, constants.elementMetadataJson)

    // Some types of elements cannot have kids.
    if (["dynamicFragment", "staticFragment", "subFragment"].includes(parentElementMetadata.type)) {

      error("parentElementShouldBeChildless", {elementDir: elementCreationDirectory})
      exitDueToInvalidCall(program)
    }

    // Cant add elements to oracle supplied elements.
    if (parentElementMetadata.source == 100) {

      error("parentElementIsOracleSupplied", {elementDir: elementCreationDirectory})
      exitDueToInvalidCall(program)
    }

    return parentElementMetadata
  }
}

exports.main = function (argv) {

  // Force use of ccw rather than the actual file name of index.js.
  program._name = "ccw"

  addCommonOptions(program)
    .option("-l, --locale <locale>", t("localeOptionText"))
    .option("-t, --createSiteSettings", t("createSiteSettingsOptionText"))
    .option("-s, --createStack", t("createStackOptionText"))
    .option("-w, --createWidget", t("createWidgetOptionText"))
    .option("-e, --createElement [widgetOrElementDirectory]", t("createElementOptionText"))
    .option("-g, --generateMarkup [elementDirectory]", t("generateElementMarkupOptionText"))
    .parse(argv)

  // Pass on the base path if it was set.
  program.base && useBasePath(program.base)

  // Must have exactly one operation - no more and no less.
  const operationsCount = ["createStack", "createWidget", "createElement", "generateMarkup", "createSiteSettings"].reduce(
    (total, currentValue) => total + (program[currentValue] ? 1 : 0), 0)

  // Make sure we know which server we are working with. If the user did not supply a node, try to use the last one.
  if (!program.node) {
    program.node = getLastNode()
  }

  // Make sure we've done an initial grab.
  if (!exists(constants.trackingDir)) {
    error("noContentGrabbedError")
    exitDueToInvalidCall(program)
  }

  // Something is not quite right - tell the user.
  if (operationsCount !== 1 || !program.node) {
    exitDueToInvalidCall(program)
  }

  // Make sure hostname is normalized
  program.node = getHostFromUrl(program.node)

  // Figure out what kind of target element directory we got - if any.
  const elementCreationDirectory = program.createElement === true ? null : program.createElement
  const elementCreationDirectoryType = elementCreationDirectory ? classify(elementCreationDirectory) : null

  // Keep hold of the parent element metadata (if any) for later use.
  let parentElementMetadata

  // Make sure dir looks right if we got one.
  if (elementCreationDirectoryType) {
    parentElementMetadata = validateElementCreationDirectory(elementCreationDirectoryType, elementCreationDirectory)
  }

  // Check out the markup
  const markupGenerationDirectory = program.generateMarkup === true ? null : program.generateMarkup
  const markupGenerationDirectoryType = markupGenerationDirectory ? classify(markupGenerationDirectory) : null

  if (markupGenerationDirectoryType &&
    markupGenerationDirectoryType != PuttingFileType.GLOBAL_ELEMENT &&
    markupGenerationDirectoryType != PuttingFileType.WIDGET_ELEMENT) {

    error("invalidMarkupGenerationTargetDirectory", {elementDir: markupGenerationDirectory})
    exitDueToInvalidCall(program)
  }

  // Sort out our endpoints first.
  return endPointTransceiver.init(
    program.node,
    program.username, getPassword(program.password),
    getApplicationKey(program.applicationKey),
    program.locale, true).then(() => {

    if (program.createStack) {
      return stackCreator.create(program.clean)
    }

    if (program.createWidget) {
      return widgetCreator.create(program.clean)
    }

    if (program.createElement) {
      return elementCreator.create(program.clean, elementCreationDirectory, elementCreationDirectoryType, parentElementMetadata)
    }

    if (program.createSiteSettings) {
      return siteSettingsCreator.create(program.clean)
    }

    if (program.generateMarkup) {
      // Tell the user what to do with the markup.
      info("elementMarkupPreamble")
      logInfo(elementMarkupGenerator.generate(program.generateMarkup))
    }
  })
}
