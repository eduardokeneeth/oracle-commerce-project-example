//// template.rule.js --- HTML Template substitution handler.
//
// Handle substituting templates modified locally by the user.
// templates are generally embedded in the page response so we will edit
// that json structure directly.
"use strict"

const constants    = require("../../constants").constants
const exists       = require('../../utils').exists
const sanitizeName = require("../../utils").sanitizeName
const readFile     = require('../../utils').readFile
const warn         = require('../../logger').warn
const debug        = require('../../logger').debug
const dataMaps     = require('../datamaps')

const path = require('path')

const koSeparator = "<!-- /ko -->"
const koContextBlock = "<!-- ko setContextVariable"

exports.name = "WidgetTemplate"
exports.doc  = "Handler for HTML Templates (Widgets and Elements)"

exports.rule = {
  method: 'GET',
  phase: 'response',

  // Intercept the page requests as json data.
  fullUrl: "__NODE__/ccstoreui/v1/pages/layout/:id*",
  mimeType: 'application/json',
  as: 'json'
}

exports.handler = doPageTemplateSubstitution

/**
 * Handle deconstructing the page request and replacing embedded resources with the contents
 * of local modifications under basePath.
 */
function doPageTemplateSubstitution (req, resp) {

  // Swap out the widget template.
  resp.json.regions.forEach((region) => {

    // If the region is a stack then we should have a client side template.
    if (region.structure === constants.stackStructure) {

      // First handle sub-region content
      region.regions.forEach((subregion) => {
        doRegionContentSubstitution(subregion)
      })
    }

    doRegionContentSubstitution(region)
  })
}

/**
 * Do the actual substitution of stuff inside a region: Widgets and elements.
 * @param pRegion Region object which is updated by this function.
 */
function doRegionContentSubstitution (pRegion) {
  // Now let's process the widgets on the region
  pRegion.widgets.forEach((widget) => {

    // Make sure there is a template URL.
    if (widget.templateUrl && widget.templateUrl.endsWith(".template")) {
      const urlSegments = widget.templateUrl.split("/")

      const widgetShortName = (urlSegments.length === 9) ? urlSegments[6] : urlSegments[7]
      const basePath = dataMaps.widget(widgetShortName)

      // Check if the basePath is mapped in our local mirror.
      if (!basePath) {
        warn("noLocalSubstituteFoundWarning", {item: widgetShortName})
        return
      }

      const saneInstanceName = sanitizeName(widget.instanceName)
      const localInstanceDir = path.join(basePath, constants.instanceDir, saneInstanceName)
      const localFilePath = path.join(localInstanceDir, constants.displayTemplate)

      let localSrc = widget.templateSrc
      if (exists(localFilePath)) {
        debug("doResourceSubstitutionMessage", {resource: saneInstanceName, path: localFilePath})
        localSrc = readFile(localFilePath)
      } else {
        warn("mappedFileNotFoundWarning", {resource: saneInstanceName, path: localFilePath})
      }

      if (widget.templateSrc.startsWith(koContextBlock)) {
        // Layout Template with Context Variables.

        // We need to get the Context Variables that the Server resolved for us and put them back
        // into our local template. These will be wrapped in a knockout binding at the top of the
        // template source.
        const contextVars = widget.templateSrc.split(koSeparator)[0] + koSeparator

        if (localSrc.startsWith(koContextBlock)) {
          // Phew - the user didn't delete it. Otherwise we just stick the vars onto
          // the front of whatever they've got and hope.
          localSrc = localSrc.split(koSeparator).slice(1).join(koSeparator)
        }

        widget.templateSrc = contextVars + localSrc
      } else {
        // Plain Layout Template.
        widget.templateSrc = localSrc
      }
    }
  })
}
