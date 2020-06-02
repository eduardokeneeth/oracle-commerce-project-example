//// template.rule.js --- HTML Template substitution handler.
//
// Handle substituting templates modified locally by the user.
// templates are generally embedded in the page response so we will edit
// that json structure directly.
"use strict"

const constants    = require("../../constants").constants
const readMetadata = require("../../metadata").readMetadataFromDisk
const exists       = require('../../utils').exists
const readFile     = require('../../utils').readFile
const warn         = require('../../logger').warn
const debug        = require('../../logger').debug
const dataMaps     = require('../datamaps')


const path = require('path')
const re = require('xregexp')

exports.name = "WidgetElementTemplate"
exports.doc  = "Handler for widget specific element templates"

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

      let localSrc = widget.templateSrc

      // We need to insert element source into the page DOM with the correct
      // ids so that the element binding will find them and not replace with
      // the remote version.
      // First, we'll do it for widget level elements (We can get the correct
      // Id from the element metadata.
      re.forEach(localSrc, /<\w+\s+data-bind="element:\s*'([^']+)'/g, (match, i) => {
        const elementId = match[1]
        const elementPath = dataMaps.element(elementId)

        if (!elementPath) {

          warn("noLocalSubstituteFoundWarning", {item: elementId})
          return
        }

        const elFilePath = path.join(elementPath, constants.elementTemplate)
        if (exists(elFilePath)) {
          const elementMD = readMetadata(elFilePath, constants.elementMetadataJson)

          // Only need to do this for widget level elements
          if (elementMD.widgetType) {
            const tag = `${widget.typeId}-${elementMD.tag}`
            const elementSrc = readFile(elFilePath)

            // Appending the script directly in the widget template seems ok.
            localSrc += `<script type='text/html' id='${tag}'>${elementSrc}</script>`

            debug("doResourceSubstitutionMessage", {resource: tag, path: elFilePath})
          }
        } else {
          warn("mappedFileNotFoundWarning", {resource: elementId, path: elFilePath})
        }
      })

      widget.templateSrc = localSrc
    }
  })
}
