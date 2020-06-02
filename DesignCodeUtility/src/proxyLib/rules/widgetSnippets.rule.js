//// template.rule.js --- HTML Template substitution handler.
//
// Handle substituting templates modified locally by the user.
// templates are generally embedded in the page response so we will edit
// that json structure directly.
"use strict"

const constants    = require("../../constants").constants
const readMetadata = require("../../metadata").readMetadataFromDisk
const exists       = require('../../utils').exists
const glob         = require("../../utils").glob
const sanitizeName = require("../../utils").sanitizeName
const readFile     = require('../../utils').readFile
const readJsonFile = require('../../utils').readJsonFile
const warn         = require('../../logger').warn
const debug        = require('../../logger').debug
const dataMaps     = require('../datamaps')

const substituteLocalFileContents = require('../proxyUtils').substituteLocalFileContents

const path = require('path')
const re = require('xregexp')

exports.name = "WidgetTextSnippets"
exports.doc  = "Handler for widget specific text snippets"

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
    if (region.structure === constants.stackStructure) {
      // First handle sub-region content
      region.regions.forEach((subregion) => {
        doWidgetSnippetSubstitution(subregion)
      })
    }

    doWidgetSnippetSubstitution(region)
  })
}

function doWidgetSnippetSubstitution (pRegion) {
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

      // We'll need to handle widget specific snippets in here too.
      const locale = widget.locale

      // If a file exists for the "locale namespace" trust that, otherwise try stripping
      // some extra information off the widget type ID and see if there's a file corresponding
      // to that we can fall back on.
      if (widget.localeResources && widget.localeResources[locale]) {
        const resourceNameA = widget.localeResources[locale].namespace
        const resourceNameB = widget.typeId.split("_")[0].toLowerCase()

        const resourcePathA = path.join(localInstanceDir, "locales", locale, resourceNameA + ".json")
        const resourcePathB = path.join(localInstanceDir, "locales", locale, "ns." + resourceNameB + ".json")

        if (exists(resourcePathA)) {
          widget.localeResources[locale].resources = readJsonFile(resourcePathA).resources
        } else if (exists(resourcePathB)) {
          widget.localeResources[locale].resources = readJsonFile(resourcePathB).resources
        }
      }
    }
  })
}
