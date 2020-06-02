const Promise = require("bluebird")
const upath = require("upath")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getPuttingConcurrency = require("./concurrencySettings").getPuttingConcurrency
const info = require("./logger").info
const readFile = require("./utils").readFile
const request = require("./requestBuilder").request
const splitFromBaseDir = require("./utils").splitFromBaseDir
const toVfsPath = require("./frameworkPaths").toVfsPath
const walkDirectory = require("./utils").walkDirectory

/**
 * Send up a framework directory.
 * @param path
 */
function putFrameworkDirectory(path) {

  const paths = []

  // Walk through the files, making a list of paths.
  walkDirectory(path, {
    listeners: {
      file: (root, fileStat, next) => {
        paths.push(upath.resolve(root, fileStat.name))
        next()
      }
    }
  })

  // Drip feed these to the server so as not to cause a panic.
  return Promise.map(paths, sendFile, getPuttingConcurrency())
}

/**
 * Does the legwork to send a file to server.
 * @param path
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function sendFile(path) {

  // Set up an object to hold segment and path information.
  const newFileInfo = {
    "filename": toVfsPath(path),
    "segments": 1
  }

  // Firstly, tell the server we are about to upload something.
  return endPointTransceiver.startFileUpload(request().withBody(newFileInfo)).then(results => {

    // Build up the payload for the file.
    const payload = {
      filename: newFileInfo.filename,
      file: readFile(path, "base64"),
      index: 0
    }

    // Send up the base64'd file contents in a big JSON block.
    return endPointTransceiver.doFileSegmentUpload([results.data.token], request().withBody(payload)).tap(results => {

      results.data.result.hadSuccess &&
        info("frameworkFileSavedAt", {destination: results.data.result.fileResults[0].destination})
    })
  })
}

/**
 * Send up a framework file.
 * @param path
 */
function putFrameworkFile(path) {
  return sendFile(path)
}

exports.putFrameworkDirectory = putFrameworkDirectory
exports.putFrameworkFile = putFrameworkFile
