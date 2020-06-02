const basename = require('path').basename
const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const processPutResult = require("./putterUtils").processPutResult
const readFile = require("./utils").readFile
const readMetadata = require("./metadata").readMetadata
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const splitFromBaseDir = require("./utils").splitFromBaseDir
const warn = require("./logger").warn
const writeEtag = require("./etags").writeEtag

/**
 * Holds the boilerplate to get a non-standard widget file up to the server.
 * @param path
 * @param serverPath
 */
function sendWidgetAdditionalFile(path, serverPath) {

  // See if the server has the endpoints we need.
  if (endPointTransceiver.serverSupports("checkInWidgetDescriptorFile")) {

    // Get the widget metadata as we need the id.
    return readMetadata(path, constants.widgetMetadataJson).then(metadata => {

      if (metadata) {

        return endPointTransceiver.checkInWidgetDescriptorFile([metadata.repositoryId, serverPath],
          request().withEtag(metadata.etag)).then(results => {

          // Make sure the first call worked.
          if (processPutResult(path, results)) {

            // Save off the etag as we only want to update it on disk if the subsequent calls worked.
            const etag = results.response.headers.etag

            // Set up an object to hold segment and path information.
            const newFileInfo = {
              filename: `/widget/${metadata.widgetType}${serverPath}`,
              segments: 1
            }

            // Firstly, tell the server we are about to upload something.
            return endPointTransceiver.startFileUpload(request().withBody(newFileInfo)).then(results => {

              const payload = {
                filename: newFileInfo.filename,
                file: readFile(path, "base64"),
                index: 0
              }

              // ...and get the data up there.
              return endPointTransceiver.doFileSegmentUpload([results.data.token], "?changeContext=designStudio",
                request().withBody(payload)).then(() => {

                // Should be safe to update the etag now.
                writeEtag(path, etag)
              })
            })
          }
        })
      }
    })

  } else {

    // Tell the user we can't take this any further.
    warn("additionalWidgetFileCannotBeSent", {path})
  }
}

/**
 * Used to send a widget file that is not one of the standard ones but not an less file nor template.
 * @param path
 */
function putWidgetAdditionalFile(path) {

  const subDir = splitFromBaseDir(path)[1]
  const pathUnderWidget = subDir.replace(/widget\/[^/]+/, "")

  return sendWidgetAdditionalFile(path, `${pathUnderWidget}/${basename(path)}`)
}

/**
 * Used to end an additional less file to the server.
 * Need to do a bit fiddling with the path to make sure it goes to the right bit of the VFS.
 * @param path
 */
function putWidgetAdditionalLessFile(path) {

  return sendWidgetAdditionalFile(path, `/less/${basename(path)}`)
}

/**
 * Used to end an additional template file to the server.
 * Need to do a bit fiddling with the path to make sure it goes to the right bit of the VFS.
 * @param path
 */
function putWidgetAdditionalTemplateFile(path) {

  return sendWidgetAdditionalFile(path, `/templates/${basename(path)}`)
}

exports.putWidgetAdditionalFile = Promise.method(putWidgetAdditionalFile)
exports.putWidgetAdditionalLessFile = Promise.method(putWidgetAdditionalLessFile)
exports.putWidgetAdditionalTemplateFile = Promise.method(putWidgetAdditionalTemplateFile)
