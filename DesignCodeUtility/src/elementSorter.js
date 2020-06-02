const constants = require("./constants").constants
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk

/**
 * Given an element directory, assign an ordinal value that ensures they
 * are created the the right order.
 * @param elementDir
 */
function classifyType(elementDir) {

  // Get the element type from the metadata and map it to a number we can sort on.
  switch(readMetadataFromDisk(elementDir, constants.elementMetadataJson).type) {

    case "subFragment":
    case "dynamicFragment":
    case "staticFragment":
      return 1
    case "hidden":
    case "container":
      return 2
    case "fragment" :
      return 3
  }
}

/**
 * Take the two element directories and determine their creation order based on type.
 * @param firstElementDir
 * @param secondElementDir
 */
function compareElements(firstElementDir, secondElementDir) {

  // Turn the types into an ordinal and return the difference.
  return classifyType(firstElementDir) - classifyType(secondElementDir)
}

exports.compareElements = compareElements
