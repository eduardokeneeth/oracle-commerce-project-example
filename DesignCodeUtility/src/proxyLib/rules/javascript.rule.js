//// javascript.rule.js --- Javascript Module substitution handler.
//
// Handle substituting javascript modified locally by the user.
// We don't provide the javascript modules for OOTB features, so this will
// only take effect on uploaded javascript, or extension modules.
"use strict"

const constants = require("../../constants").constants
const warn      = require('../../logger').warn
const dataMaps  = require('../datamaps')

const substituteLocalFileContents = require('../proxyUtils').substituteLocalFileContents

const path = require('path')

exports.name = "Javascript"
exports.doc  = "Handler for Javascript modules"

exports.rule = {
  method: 'GET',
  phase: 'response',

  // only intercept js pages
  fullUrl: "__NODE__/file/*",
  mimeType: 'application/javascript',

  // expose the response body as a big string
  as: 'string'
}

/**
 * Handle locating and substituting Javascript resources.
 * Javascript files may be:
 *   - Application level Javascript
 *   - Widget Javascript (inc Global)
 *   - Element Javascript (inc Global)
 *
 * Additionally resources may be versioned so we need to resolve
 * the version from the URL and locate the appropriate files
 * under basePath.
 */
exports.handler = function (req, resp) {
  // Look out for widget files.
  const uri = req._data.url
  const urlSegments = uri.substring(1).split("/")

  // Look for static JS files e.g. /file/static/something.js.
  if (urlSegments[1] === "static") {

    // We can't predict the number of segments in the path but the last segment has to be the filename.
    let filename = urlSegments[urlSegments.length - 1]

    // Chop off the query string if present.
    const queryParamsIndex = filename.indexOf('?')
    if (queryParamsIndex >= 0) {
      filename = filename.substr(0, queryParamsIndex)
    }

    // Put the path to the file on disk together, leaving out the first and last segments and stick the filename.
    // on the end.
    const localPathSegments = urlSegments.slice(1, urlSegments.length - 1)
    localPathSegments.push(filename)

    // Now try and get the local disk contents.
    const contents = substituteLocalFileContents(filename, localPathSegments.join("/"))
    contents && (resp.string = contents)

    return
  }

  if (urlSegments[2] === "widget") {

    if (urlSegments[3] === "module") {
      const widgetShortName = (urlSegments.length === 9) ? urlSegments[5] : urlSegments[4]
      let jsFileName = (urlSegments.length === 9) ? urlSegments[8] : urlSegments[7]

      const queryParamsIndex = jsFileName.indexOf('?')
      if (queryParamsIndex >= 0) {
        jsFileName = jsFileName.substr(0, queryParamsIndex)
      }

      const minifyIndex = jsFileName.indexOf('.min.js')
      if (minifyIndex >= 0) {
        jsFileName = jsFileName.substr(0, minifyIndex) + ".js"
      }

      const basePath = dataMaps.widget(widgetShortName)
      if (!basePath) {
        warn("noLocalSubstituteFoundWarning", {item: jsFileName})
        return
      }

      const contents = substituteLocalFileContents(jsFileName, path.join(basePath, "module", "js", jsFileName))
      resp.string = contents || ""

      return
    }

    if (urlSegments.length === 6 || urlSegments.length === 7) { // Widget JS
      // Suck out the bits we need.
      const widgetShortName = (urlSegments.length === 7) ? urlSegments[4] : urlSegments[3]
      let jsFileName = (urlSegments.length === 7) ? urlSegments[6] : urlSegments[5]

      const queryParamsIndex = jsFileName.indexOf('?')
      if (queryParamsIndex >= 0) {
        jsFileName = jsFileName.substr(0, queryParamsIndex)
      }

      const minifyIndex = jsFileName.indexOf('.min.js')
      if (minifyIndex >= 0) {
        jsFileName = jsFileName.substr(0, minifyIndex) + ".js"
      }

      // Get the base path from the ID
      const basePath = dataMaps.widget(widgetShortName)
      if (!basePath) {
        warn("noLocalSubstituteFoundWarning", {item: jsFileName})
        return
      }

      const contents = substituteLocalFileContents(jsFileName, path.join(basePath, "js", jsFileName))
      if (contents) {
        resp.string = contents
      }
    }

    if (urlSegments.length === 8 || urlSegments.length === 9) { // Widget Element JS
      // Suck out the bits we need.
      const elShortName = (urlSegments.length === 9) ? urlSegments[6] : urlSegments[5]

      // Get the base path from the ID
      const basePath = dataMaps.element(elShortName)
      if (!basePath) {
        warn("noLocalSubstituteFoundWarning", {item: elShortName})
        return
      }

      const contents = substituteLocalFileContents(elShortName, path.join(basePath, constants.elementJavaScript))
      if (contents) {
        resp.string = contents
      }
    }
  }

  if (urlSegments[2] === "element") {
    // Suck out the bits we need.
    const elShortName = urlSegments[3]

    // Get the base path from the ID
    const basePath = dataMaps.element(elShortName)
    if (!basePath) {
      warn("noLocalSubstituteFoundWarning", {item: elShortName})
      return
    }

    const contents = substituteLocalFileContents(elShortName, path.join(basePath, constants.elementJavaScript))
    if (contents) {
      resp.string = contents
    }
  }

  if (urlSegments[2] === "global") {
    // Suck out the bits we need.
    let jsFileName = urlSegments[3]

    const queryParamsIndex = jsFileName.indexOf('?')
    if (queryParamsIndex >= 0) {
      jsFileName = jsFileName.substr(0, queryParamsIndex)
    }

    const minifyIndex = jsFileName.indexOf('.min.js')
    if (minifyIndex >= 0) {
      jsFileName = jsFileName.substr(0, minifyIndex) + ".js"
    }

    const basePath = path.join("global", jsFileName)
    const contents = substituteLocalFileContents(jsFileName, basePath)
    if (contents) {
      resp.string = contents
    }
  }
}
