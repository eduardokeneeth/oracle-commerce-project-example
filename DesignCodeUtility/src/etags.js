"use strict"

const constants = require("./constants").constants
const findBaseDirFromPath = require("./utils").findBaseDirFromPath
const exists = require("./utils").exists
const readFile = require("./utils").readFile
const removeTree = require("./utils").removeTree
const writeFile = require("./utils").writeFile

const Path = require('path')

let nodeName

/**
 * Store the name of the node for etag file naming purposes.
 * @param name
 */
function setNodeName(name) {
  nodeName = name
}

/**
 * Write the supplied etag to the text file in the tracking directory.
 * @param path
 * @param etag
 */
function writeEtag(path, etag) {
  writeFile(getEtagPath(path), etag)
}

/**
 * Decode and dump the etag contents.
 * @param etag
 */
function dumpEtag(etag) {
  console.log(decodeEtag(etag))
}

/**
 * Turn the supplied etag into a readable string.
 * @param etag
 * @returns {string}
 */
function decodeEtag(etag) {
  return Buffer.from(etag, 'base64').toString()
}

/**
 * Find the stored etag for the supplied path if it can find the file.
 * @param path
 * @returns {string} a big long string, or an empty one.
 */
function eTagFor(path) {

  // May not be an etag if the server did not return one so be careful.
  const eTagPath = getEtagPath(path)

  if (exists(eTagPath)) {
    return readFile(eTagPath)
  } else {
    return ""
  }
}

/**
 * Given a path to an asset, find the path to its etag file.
 * @param path - could be relative or absolute.
 */
function getEtagPath(path) {

  // See if path needs a massage.
  if (Path.isAbsolute(path)) {

    // Find the base directory containing the tracking information.
    const baseDir = findBaseDirFromPath(path)

    // Remove the base dir from the supplied path.
    return `${baseDir}/${constants.trackingDir}/${path.replace(baseDir, "")}_${nodeName}${constants.etagSuffix}`
  } else {

    // Simple case - must be relative to current or supplied base directory.
    return `${constants.trackingDir}/${path}_${nodeName}${constants.etagSuffix}`
  }
}

/**
 * Write a dummy etag to satisfy optimistic locking. This is to deal with the scenario
 * where we create something and someone else edits it.
 */
function writeDummyEtag(path) {
  removeTree(getEtagPath(path))
}

/**
 * Given a path to an etag, reset the contents as if it was just being created.
 * @param etagPath
 */
function resetEtag(path) {
  removeTree(path)
}

exports.decodeEtag = decodeEtag
exports.dumpEtag = dumpEtag
exports.eTagFor = eTagFor
exports.setNodeName = setNodeName
exports.resetEtag = resetEtag
exports.writeDummyEtag = writeDummyEtag
exports.writeEtag = writeEtag
