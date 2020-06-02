//// datamaps.js --- Mappings of Store resources to local files.
"use strict"

const constants = require("../constants").constants
const glob = require("../utils").glob
const sanitizeName = require("../utils").sanitizeName
const readJsonFile = require('../utils').readJsonFile

const path = require('path')


// widgetMap is a table of {widgetShortName -> Local Directory}
// elementMap is a table of {elementShortName -> Element Directory}
//
// Element directories can live under widget directories, or under the global
// element directory.
//
const widgetMap = {}
const elementMap = {}
const stackMap = {}
const mediaMap = {}


/**
 * We want to get path elements relative to our base directory so we
 * can chop off anything before the tracking directory.
 *
 * @param filePath A de-normalized path.
 */
function normalizedPathElements (filePath) {
  const pathElements = filePath.split("/")
  const idx = pathElements.indexOf(constants.trackingDir)

  return pathElements.slice(idx)
}

/**
 * Pre-process locations of Components (Widgets, Elements, Stacks) that we need
 * to swap out when evaluating proxy rules.
 */
function buildLocalDataMaps () {
  // Match widgets
  glob(`${constants.trackingDir}/${constants.widgetsDir}/**/${constants.widgetMetadataJson}`).forEach((filePath) => {
    const json = readJsonFile(filePath)
    widgetMap[json.widgetType] = path.join("widget", sanitizeName(json.displayName))
  })

  // Match widget level elements
  glob(`${constants.trackingDir}/widget/**/${constants.elementMetadataJson}`).forEach((filePath) => {
    const json = readJsonFile(filePath)
    const pathElements = normalizedPathElements(filePath)

    // Path will look like: .ccc / widget / <widget-name> / [version] / element / <element-name> / ...
    // So we need to handle the case where version is missing and keep indices 1, 2, x, y
    if (pathElements.length === 6) {
      elementMap[json.tag] = path.join(pathElements[1], pathElements[2], pathElements[3], pathElements[4])
    }

    if (pathElements.length === 8) {
      elementMap[json.tag] = path.join(pathElements[1], pathElements[2], pathElements[5], pathElements[6])
      //localElementMap[json.tag] = path.join(pathElements[1], pathElements[2], pathElements[3], pathElements[4], pathElements[5], pathElements[6])
    }
  })

  // Match stack data
  glob(`${constants.trackingDir}/${constants.stacksDir}/**/${constants.stackMetadataJson}`).forEach((filePath) => {
    const json = readJsonFile(filePath)
    const pathElements = normalizedPathElements(filePath)

    if (pathElements.length > 2) {
      stackMap[json.stackType] = path.join(pathElements[1], pathElements[2])
    }
  })

  // Match global elements
  glob(`${constants.trackingDir}/${constants.elementsDir}/**/${constants.elementMetadataJson}`).forEach((filePath) => {
    const json = readJsonFile(filePath)
    const pathElements = normalizedPathElements(filePath)

    if (pathElements.length > 2) {
      elementMap[json.tag] = path.join(pathElements[1], pathElements[2])
    }
  })

  // Debug: Set true to print data maps.
  if (false) {
    console.log(JSON.stringify(elementMap, null, 2))
    console.log(JSON.stringify(widgetMap, null, 2))
    console.log(JSON.stringify(stackMap, null, 2))
    console.log(JSON.stringify(mediaMap, null, 2))
  }
}

/**
 * Widget Map Accessor.
 *
 * @param name Name of widget val to act on.
 * @param val If set, mutate value.
 * @returns Widget item.
 */
exports.widget   = (name, val) => {
  if (!name) return widgetMap

  if (val)
    widgetMap[name] = val

  return widgetMap[name]
}

/**
 * Element Map Accessor.
 *
 * @param name Name of element val to act on.
 * @param val If set, mutate value.
 * @returns Element item.
 */
exports.element   = (name, val) => {
  if (!name) return elementMap

  if (val)
    elementMap[name] = val

  return elementMap[name]
}

/**
 * Stack Map Accessor.
 *
 * @param name Name of stack val to act on.
 * @param val If set, mutate value.
 * @returns Stack item.
 */
exports.stack   = (name, val) => {
  if (!name) return stackMap

  if (val)
    stackMap[name] = val

  return stackMap[name]
}

/**
 * Media Map Accessor.
 *
 * @param name Name of media val to act on.
 * @param val If set, mutate value.
 * @returns Media item.
 */
exports.media   = (name, val) => {
  if (!name) return mediaMap

  if (val)
    mediaMap[name] = val

  return mediaMap[name]
}

exports.buildDataMaps = buildLocalDataMaps

