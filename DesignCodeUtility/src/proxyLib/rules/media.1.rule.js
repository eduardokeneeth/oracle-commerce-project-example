//// media.rule.js --- Source Media substitution handler.
//
// Handle substituting source media files referenced in certain widgets, e.g.
// Web Content.
// This is part 1 of a 2 step rule, which finds a reference to
// media content in the page response and writes it into the datamapping.
"use strict"

const constants    = require("../../constants").constants
const sanitizeName = require("../../utils").sanitizeName
const warn         = require('../../logger').warn
const dataMaps     = require('../datamaps')

const path = require('path')

exports.name = "SourceMedia (Page)"
exports.doc  = "Handle Source Media assets (Page Layout Phase)"

exports.rule = {
  method: 'GET',
  phase: 'response',

  // Intercept the page requests as json data.
  fullUrl: "__NODE__/ccstoreui/v1/pages/layout/:id*",
  mimeType: 'application/json',
  as: 'json'
}

exports.handler = function (req, resp) {
  resp.json.regions.forEach((region) => {
    if (region.structure === constants.stackStructure) {
      // First handle sub-region content
      region.regions.forEach((subregion) => {
        doRegionMediaMapping(subregion)
      })
    }

    doRegionMediaMapping(region)
  })
}

function doRegionMediaMapping(pRegion) {
  pRegion.widgets.forEach((widget) => {

    // Make sure there is a template URL.
    if (widget.templateUrl && widget.templateUrl.endsWith(".template")) {
      const urlSegments = widget.templateUrl.split("/")
      const widgetShortName = (urlSegments.length === 9) ? urlSegments[6] : urlSegments[7]
      const basePath = dataMaps.widget(widgetShortName)

      // Check if the basePath is mapped in our local mirror.
      if (!basePath) {
        warn("noLocalSubstituteFoundWarning", { item: widgetShortName })
        return
      }

      const saneInstanceName = sanitizeName(widget.instanceName)
      const localInstanceDir = path.join(basePath, constants.instanceDir, saneInstanceName)

      // If the widget has source media, make a note of the resource URI.
      if (widget.sourceMedia) {
        const localContentFile = path.join(localInstanceDir, "content.template")
        const mediaResource = widget.sourceMedia.split("webContent")[1] // Just the end.

        dataMaps.media(mediaResource, localContentFile)
      }
    }
  })
}
