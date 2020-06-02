const basename = require('path').basename
const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const writeFile = require("./utils").writeFile
const writeEtag = require("./etags").writeEtag

/**
 * Figure out where the file should live on the local disk.
 * @return {string}
 */
function buildLocalPath(widgetDir, shortPath) {

  // Shear off the directory for templates and less files.
  return shortPath.endsWith(".less") || shortPath.endsWith(".template") ?
    `${widgetDir}/${basename(shortPath)}` : `${widgetDir}/${shortPath}`
}

/**
 * Holds the boilerplate for calling the endpoints and getting the resultant data into disk.
 * @param widget
 * @param shortPath
 * @param localPath
 * @return {PromiseLike<T | never>}
 */
function gatherFileData(widget, shortPath, localPath, results) {

  // We make two different calls here as the files endpoint does not support optimistic locking.
  return endPointTransceiver.checkOutWidgetDescriptorFile([widget.id, shortPath]).then(results => {

    // Save off the etag for the path from the server.
    writeEtag(localPath, results.response.headers.etag)
  }).then(() => endPointTransceiver.get(results.data.files[shortPath]).then(results => {

    // And write out the file contents.
    writeFile(localPath, results.data)
  }))
}

/**
 * Grab any additional non-standard files under the widget.
 * @param widget
 * @param widgetDir
 */
function grabNonStandardFiles(widget, widgetDir) {

  // First up make sure the endpoints exist on the server.
  if (endPointTransceiver.serverSupports("listWidgetDescriptorFiles", "checkOutWidgetDescriptorFile")) {

    // Firstly, see if there are any additional files.
    return endPointTransceiver.listWidgetDescriptorFiles([widget.id]).then(results => {

      // Keep track of all the promises, returning them as a single promise at the end.
      const promises = []

      // For each file...
      Object.keys(results.data.files).forEach(shortPath => {

        // Figure out where the path belongs.
        const localPath = buildLocalPath(widgetDir, shortPath)

        // Gather all the data about the file by making a bunch of server calls.
        promises.push(gatherFileData(widget, shortPath, localPath, results))
      })

      return Promise.all(promises)
    })
  }
}

exports.grabNonStandardFiles = Promise.method(grabNonStandardFiles)
