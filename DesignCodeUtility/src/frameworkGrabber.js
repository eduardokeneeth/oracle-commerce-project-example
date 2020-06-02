const dirname = require('path').dirname
const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const getBaseVfsPath = require("./frameworkPaths").getBaseVfsPath
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const makeTrackedTree = require("./utils").makeTrackedTree
const toOutputDir = require("./frameworkPaths").toOutputDir
const toVfsDir = require("./frameworkPaths").toVfsDir
const warn = require("./logger").warn
const writeFileAndETag = require("./grabberUtils").writeFileAndETag

/**
 * Get the VFS files for the specified path.
 * @param path
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function getFiles(path) {

  // Look in the supplied VFS directory.
  return endPointTransceiver.getFiles(`?folder=${path}&assetType=all`).then(results => {

    // Walk through each entry, examining what's there.
    return Promise.map(results.data.items, item => {

      // Call ourselves on the folders.
      if (item.type !== "fileFolder") {

        // Tell the user what we are up to.
        info("grabbingFrameworkFile", {name: item.path, url: item.url})

        // Just get the file.
        return endPointTransceiver.get(`${item.url}?render=false`).then(results => {

          // Create a tracked directory on disk for opt locking purposes.
          makeTrackedTree(dirname(toOutputDir(item.path)))

          // Write out the file and etag.
          writeFileAndETag(toOutputDir(item.path), results.data, results.response.headers.etag)
        })
      }
    }, getGrabbingConcurrency())
  })

}

/**
 * Grab all the framework files and put them out on disk.
 */
function grabFramework() {

  // Make sure the server has the requisite support.
  return endPointTransceiver.getUploadTypes().then(results => {

    // We added a new upload type - make sure its there.
    if (results && results.data && results.data.items.find(uploadType => uploadType.name == "staticFile")) {

      // Create a directory to bung the themes in.
      makeTrackedDirectory(constants.frameworkDir)

      // Firstly get a list of files.
      return getFiles(getBaseVfsPath())
    } else {

      // Server does not support this feature so apologise to the user and move on.
      warn("staticFilesCannotBeGrabbed")
    }
  })
}

/**
 * Grab all the framework files for a specific directory.
 * @param path
 */
function grabFrameworkDirectory(path) {

  return getFiles(toVfsDir(path))
}

exports.grabFrameworkDirectory = grabFrameworkDirectory
exports.grabFramework = grabFramework
