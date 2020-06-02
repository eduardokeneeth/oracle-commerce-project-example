const dateFormat = require('dateformat')
const os = require('os')
const upath = require("upath")
const username = require('username')
const writeFileSync = require("fs").writeFileSync
const zip = new require("node-zip")

const endPointTransceiver = require("./endPointTransceiver")
const request = require("./requestBuilder").request
const t = require("./i18n").t
const walkDirectory = require("./utils").walkDirectory
const writeDummyEtag = require("./etags").writeDummyEtag

/**
 * Build up an extension in memory and send it to the server using the supplied parameters.
 *
 * @param idRequestText
 * @param manifestNameText
 * @param widgetName
 * @param shortName
 * @param sourceDir
 * @param extensionPathFor
 * @param extensionContentsFor
 * @param onCompleteCallBack
 */
function buildExtension(idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) {

  // Start to build up the zip file in memory.
  const extension = zip()

  // Build up the structure to send to the server
  const newExtensionInfo = {
    "name" : idRequestText,
    "type" : "extension"
  }

  // See if we can access the latest extension ID creation endpoints. If not, fall back to the old one.
  const extensionIdEndpoint = endPointTransceiver.serverSupports("createExtensionID") ?
    endPointTransceiver.createExtensionID : endPointTransceiver.createApplicationID

  // Firstly, need a new extension ID for the manifest.
  return extensionIdEndpoint(request().withBody(newExtensionInfo)).then(results => {

    // Add in the top level manifest.
    extension.file("ext.json", buildExtensionManifest(results.data.id, manifestNameText))

    // Walk through the supplied directory, looking for files.
    walkDirectory(sourceDir, {
      listeners : {
        file : (root, fileStat, next) => {

          // Build a full path to the file.
          const fullPath = upath.resolve(root, fileStat.name)

          // See where the file belongs in the extension - note that it may be a file type we dont recognise or
          // one we process elsewhere i.e. widget instance assets - in which case, the path will be undefined.
          const extensionPaths = extensionPathFor(shortName, fullPath)

          if (extensionPaths) {

            // More than one file.
            if (Array.isArray(extensionPaths)) {

              // Process each file.
              extensionPaths.forEach(extensionPath => extension.file(extensionPath, extensionContentsFor(fullPath)))
            } else {

              // Can add the file to the extension.
              extension.file(extensionPaths, extensionContentsFor(fullPath))

              // Also need to create a dummy etag for each item so subsequent update requests will succeed.
              // This is useful in the case where a widget has been created then deleted and is being created again.
              writeDummyEtag(fullPath)
            }
          }

          // Jump to the next file.
          next()
        }
      }
    })

    // Now the extension is set up, call the callback.
    return onCompleteCallBack(extension)
  })
}

/**
 * Builds up the Extension Manifest JSON.
 * @param extensionId
 * @param widgetName
 */
function buildExtensionManifest(extensionId, manifestNameText) {

  return JSON.stringify(
    {
      extensionID : extensionId,
      createdBy : t("extensionCreatedBy", {userName : username.sync(), hostName : os.hostname()}),
      name : manifestNameText,
      version : 1,
      timeCreated : dateFormat(new Date(), "yyyy-mm-dd"),
      description : t("extensionDescription")
    },
    null, 2)
}

/**
 * Handy for debugging - dump the supplied extension object to a file on disk.
 * @param extension
 * @param path
 */
function dumpExtensionTo(extension, path) {
  writeFileSync(path, extension.generate({base64 : false, compression : "DEFLATE"}), 'binary')
}

exports.buildExtension = buildExtension
exports.dumpExtensionTo = dumpExtensionTo
