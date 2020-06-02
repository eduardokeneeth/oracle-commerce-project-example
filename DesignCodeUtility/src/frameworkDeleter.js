const Promise = require("bluebird")
const upath = require("upath")

const classify = require("./classifier").classify
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const info = require("./logger").info
const PuttingFileType = require("./puttingFileType").PuttingFileType
const removeTrackedTree = require("./utils").removeTrackedTree
const request = require("./requestBuilder").request
const toVfsPath = require("./frameworkPaths").toVfsPath
const walkDirectory = require("./utils").walkDirectory

const context = {}

/**
 * Delete a framework file or directory.
 * @param path
 */
function deleteFrameworkContent(path, node) {

  // Save off the current node for later use.
  context.node = node

  // Need to be careful here in case user specifies the framework directory itself - don't want to delete that.
  if (classify(path) === PuttingFileType.FRAMEWORK_DIRECTORY) {

    const paths = []

    // Walk through the framework files, making a list.
    walkDirectory(path, {
      listeners: {
        file: (root, fileStat, next) => {
          paths.push(upath.resolve(root, fileStat.name))
          next()
        }
      }
    })

    // Walk down the list, blowing away the files but don't panic the server.
    return Promise.map(paths, deletePath, getGrabbingConcurrency()).then(() => cleanEmptyDirectories(path))
  } else {

    // Not the framework directory so we can just blow it away.
    return deletePath(path)
  }
}

/**
 * Need to clean up the now empty directories as the files have now gone.
 * @param path
 */
function cleanEmptyDirectories(path) {

  // Walk through the now empty directories, deleting them.
  walkDirectory(path, {
    listeners: {
      directory: (root, fileStat, next) => {

        removeTrackedTree(upath.resolve(root, fileStat.name))
        next()
      }
    }
  })
}

/**
 * Holds the boilerplate to delete a framework file.
 * @param path
 * @return {*}
 */
function deletePath(path) {

  // Log message to say what we are up to.
  info("deletingPath", {path, node : context.node})

  // Build up the payload so we can delete the file on the server.
  const payload = {
    filename: toVfsPath(path),
    recursive: true
  }

  // Call the endpoint and then delete the file on disk.
  return endPointTransceiver.deleteFile([],
    request().withBody(payload)).tap(() => removeTrackedTree(path))
}

exports.deleteFrameworkContent = deleteFrameworkContent
