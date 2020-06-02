//// template.rule.js --- HTML Template substitution handler.
//
// Handle substituting templates modified locally by the user.
// templates are generally embedded in the page response so we will edit
// that json structure directly.
"use strict"

const constants    = require("../../constants").constants
const readMetadata = require("../../metadata").readMetadataFromDisk
const glob         = require("../../utils").glob
const sanitizeName = require("../../utils").sanitizeName
const readFile     = require('../../utils').readFile
const warn         = require('../../logger').warn
const debug        = require('../../logger').debug
const dataMaps     = require('../datamaps')


const path = require('path')
const re = require('xregexp')

exports.name = "GlobalElementTemplate"
exports.doc  = "Handler for global element templates"

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
      const widgetMD = readMetadata(localFilePath, constants.widgetInstanceMetadataJson)

      let localSrc = widget.templateSrc

      // For global elements we need to stamp out a copy of the element source
      // for every widget whether or not the widget uses that element - this
      // is just duplicating the behaviour of the element binding. Try not to
      // think about it.
      glob(`element/**/${constants.elementTemplate}`).forEach((template) => {
        const elementMD = readMetadata(template, constants.elementMetadataJson)
        const elementSrc = readFile(template)
        const tag = `${widgetMD.descriptorRepositoryId}-${elementMD.tag}`

        localSrc += `<script type='text/html' id='${tag}'>${elementSrc}</script>`

        debug("doResourceSubstitutionMessage", {resource: tag, path: template})
      })

      widget.templateSrc = localSrc
    }
  })
}
