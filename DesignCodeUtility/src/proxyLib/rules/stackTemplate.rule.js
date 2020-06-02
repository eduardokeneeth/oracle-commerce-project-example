//// template.rule.js --- HTML Template substitution handler.
//
// Handle substituting templates modified locally by the user.
// templates are generally embedded in the page response so we will edit
// that json structure directly.
"use strict"

const constants    = require("../../constants").constants
const warn         = require('../../logger').warn
const dataMaps     = require('../datamaps')

const substituteLocalFileContents = require('../proxyUtils').substituteLocalFileContents

const path = require('path')

exports.name = "StackTemplate"
exports.doc  = "Handler for HTML Stack Templates"

exports.rule = {
  method: 'GET',
  phase: 'response',

  // Intercept the page requests as json data.
  fullUrl: "__NODE__/ccstoreui/v1/pages/layout/:id*",
  mimeType: 'application/json',
  as: 'json'
}

/**
 * Handle deconstructing the page request and replacing embedded resources with the contents
 * of local modifications under basePath.
 */
exports.handler = function (req, resp) {
  resp.json.regions.forEach((region) => {

    // If the region is a stack then we should have a client side template.
    if (region.structure === constants.stackStructure) {

      const basePath = dataMaps.stack(region.stackType)
      const displayName = region.displayName

      if (!basePath) {
        warn("noLocalSubstituteFoundWarning", {item: displayName})
        return
      }

      const localFilePath = path.join(basePath, constants.instanceDir, displayName, constants.stackTemplate)

      const contents = substituteLocalFileContents(displayName, localFilePath)
      if (contents) {
        region.templateSrc = contents
      }
    }
  })
}
