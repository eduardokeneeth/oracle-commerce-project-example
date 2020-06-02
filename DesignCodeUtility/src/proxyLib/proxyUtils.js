"use strict"

const exists   = require('../utils').exists
const readFile = require('../utils').readFile
const warn     = require('../logger').warn
const debug    = require('../logger').debug


exports.substituteLocalFileContents = function (resourceName, localFilePath) {
  if (!exists(localFilePath)) {
    warn("mappedFileNotFoundWarning", {resource: resourceName, path: localFilePath})
    return null
  }

  // Substitute out the local copy of the widget file.
  debug("doResourceSubstitutionMessage", {resource: resourceName, path: localFilePath})
  return readFile(localFilePath)
}

