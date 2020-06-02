const dateFormat = require('dateformat')

const endPointTransceiver = require("./endPointTransceiver")
const info = require("./logger").info
const logInfo = require("./logger").logInfo
const request = require("./requestBuilder").request

/**
 * Send the supplied extension to the server.
 * @param vfsBase
 * @param extension
 * @returns A BlueBird promise.
 */
function sendExtension(vfsBase, extension, resultHandler) {

  // Need to create a unique name for the VFS.
  const vfsFileName = `${dateFormat(new Date(), "yyyymmddHHMMssl")}_ccw_${vfsBase}.zip`

  // Set up an object to hold segment and path information.
  const newFileInfo = {
    filename : `/extensions/${vfsFileName}`,
    segments : 1
  }

  // Firstly, tell the server we are about to upload something.
  return endPointTransceiver.startFileUpload(request().withBody(newFileInfo)).then(results => {

    // Build up the payload from the zip file
    const payload = {
      filename : newFileInfo.filename,
      file : extension.generate({base64 : true}),
      index : 0
    }

    // Upload the extension zip.
    return endPointTransceiver.doFileSegmentUpload([results.data.token], "?changeContext=designStudio", request().withBody(payload))
  }).then(results => endPointTransceiver.createExtension(request().withBody({name : vfsFileName}))).then(resultHandler)
}

/**
 * Output any warnings that came back from the extension upload.
 * @param warnings
 */
function reportWarnings(warnings) {

  if (warnings.length) {
    info("uploadWarningsFound")

    warnings.forEach(warning => {
      logInfo(warning)
    })
  }
}

/**
 * Output any warnings that came back from the extension upload.
 * @param errors
 */
function reportErrors(errors) {

  errors.forEach(error => logInfo(error))
}

exports.reportErrors = reportErrors
exports.reportWarnings = reportWarnings
exports.sendExtension = sendExtension
