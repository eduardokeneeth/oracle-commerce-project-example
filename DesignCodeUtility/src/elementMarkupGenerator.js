const dirname = require('path').dirname
const upath = require("upath")

const classify = require("./classifier").classify
const constants = require("./constants").constants
const error = require("./logger").error
const exists = require("./utils").exists
const PuttingFileType = require("./puttingFileType").PuttingFileType
const readJsonFile = require("./utils").readJsonFile
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const walkDirectory = require("./utils").walkDirectory

const tagToDirectoryMap = new Map()

// need this to build up the generated code.
let markup

/**
 * Used to build up the output in a big string.
 * @param text
 */
function addMarkup(text) {
  markup = `${markup}${text}\n`
}

/**
 * Markup for element div or span.
 * @param userElementMetadata
 * @param elementMetadata
 * @param indent
 */
function outputDivOrSpan(userElementMetadata, elementMetadata, indent = "") {
  const tag = userElementMetadata.inline ? "span" : "div"
  addMarkup(`${indent}<${tag} data-bind="element: '${elementMetadata.tag}'"></${tag}>`)
}

/**
 * Start an oc-section.
 * @param elementMetadata
 */
function openOcSection(elementMetadata) {
  addMarkup(`<!-- oc section: ${elementMetadata.tag} -->`)
}

/**
 * Close an oc-section.
 */
function closeOcSection() {
  addMarkup(`<!-- /oc -->`)
}

/**
 * Generate template markup for the element under the supplied directory.
 * @param directory
 */
function generate(elementDirectory, level = 1) {

  // Get the internal metadata first.
  const elementMetadata = readMetadataFromDisk(elementDirectory, constants.elementMetadataJson)

  // Try to get the external metadata for the current element.
  const userElementMetadataPath = `${elementDirectory}/${constants.userElementMetadata}`;
  const userElementMetadata = exists(userElementMetadataPath) ? readJsonFile(userElementMetadataPath) : null

  // If there is no user element metadata, we cant go any further.
  if (!userElementMetadata) {

    error("parentElementIsOracleSupplied", {elementDir: elementDirectory})
    return
  }

  // See what level we are at - make sure element looks OK.
  switch (level) {
    case 1:
      // At the top level - elements should be of type fragment.
      if (elementMetadata.type !== "fragment") {
        error("elementTypeShouldBeFragment", {elementDir: elementDirectory})
        return
      }

      // Reset the markup.
      markup = ""

      // Since we are at the top level, load up the tag to directory map once.
      loadTagToDirectoryMap(elementDirectory)

      // See if its a complex element with sub-elements.
      if (userElementMetadata.children && userElementMetadata.children.length) {

        openOcSection(elementMetadata)
        userElementMetadata.children.forEach(childTag => generate(tagToDirectoryMap.get(childTag), level + 1))
        closeOcSection()
      } else {
        
        // Simple case - its a standalone top level element.
        openOcSection(elementMetadata)
        outputDivOrSpan(userElementMetadata, elementMetadata, "  ")
        closeOcSection()
      }

      // Return the composite text.
      return markup

    case 2:
      // Next level down - should be of type container or hidden.
      if (elementMetadata.type !== "container" && elementMetadata.type !== "hidden") {
        error("elementTypeShouldBeContainerOrHidden", {elementDir: elementDirectory})
        return
      }

      if (userElementMetadata.children && userElementMetadata.children.length) {

        addMarkup(`  <div data-oc-id="${elementMetadata.tag}">`)
        userElementMetadata.children.forEach(childTag => generate(tagToDirectoryMap.get(childTag), level + 1))
        addMarkup(`  </div>`)
      }
      break
    case 3:
      // Lowest level - should of type staticFragment, dynamicFragment or subFragment.
      if (elementMetadata.type !== "staticFragment" && elementMetadata.type !== "dynamicFragment" && elementMetadata.type !== "subFragment") {
        error("elementTypeShouldBeStaticDynamicOrSub", {elementDir: elementDirectory})
        return
      }
      outputDivOrSpan(userElementMetadata, elementMetadata, "    ")
      break
  }
}

/**
 * Create a tag to directory map for the user created elements in the supplied directory.
 * @param elementsDir
 */
function mapElements(elementsDir) {

  walkDirectory(elementsDir, {
    listeners: {
      file: (root, fileStat, next) => {

        // Only interested in user element metadata. Map the tag to the element dir.
        fileStat.name == constants.userElementMetadata &&
          tagToDirectoryMap.set(readJsonFile(upath.join(root, fileStat.name)).tag, root)

        // Jump to the next file.
        next()
      }
    }
  })
}

/**
 * Create a map from tags to directory names.
 * @param elementDirectory
 */
function loadTagToDirectoryMap(elementDirectory) {

  // Load the global elements first.
  mapElements(constants.elementsDir)

  // If this is a widget element, load up the map with its elements as well.
  if (classify(elementDirectory) == PuttingFileType.WIDGET_ELEMENT) {
    mapElements(dirname(elementDirectory))
  }
}

exports.generate = generate
