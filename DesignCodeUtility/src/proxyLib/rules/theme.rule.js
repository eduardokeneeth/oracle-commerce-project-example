//// theme.rule.js --- Theme substitution handler.
//
// Handle substituting a locally compiled preview theme.
// If a theme has been compiled locally via DCU, then this rule will substitute
// it for the storefront.css, or optimized CSS requests.
//
// The CSS will either be delivered as a single 'storefront.css' file, or as
// optimized chunked files (base.css, common.css, and other instance/site
// specific files.) All we need to do is deliver the locally compiled
// storefront file once (for either storefront.css or base.css requests) and
// blank out the responses of other CSS requests under the /file/ endpoint.
// (This rule should *not* intercept framework CSS requests!)
"use strict"

const constants = require("../../constants").constants
const exists    = require('../../utils').exists

const substituteLocalFileContents = require('../proxyUtils').substituteLocalFileContents

exports.name = "ThemeCSS"
exports.doc  = "Handler for Storefront theme"

exports.rule = {
  method: 'GET',
  phase: 'response',

  // Intercept the storefront css request.
  fullUrl: "__NODE__/file/*/css/*.css",
  mimeType: 'text/css',
  as: 'string'
}

exports.handler = function (req, resp) {

  if (exists(`${constants.trackingDir}/theme/storefront.css`)) {
    let url = req._data.url.split("?")[0] // url without params.

    const queryParamsIndex = url.indexOf('?')
    if (queryParamsIndex >= 0) {
      url = url.substr(0, queryParamsIndex)
    }

    if (url.endsWith("base.css") || url.endsWith("storefront.css")) {
      doStorefrontCssSubstitution(req, resp)
    } else {
      resp.string = ""
    }
  }
}

/**
 * Handle locating and substituting the storefront CSS file. If we have a
 * local compiled version of storefront.css under our metadata directory, use
 * this as it will contain any locally made theme / less modifications.
 */
function doStorefrontCssSubstitution (req, resp) {
  const localStorefrontCSS = `${constants.trackingDir}/${constants.themesDir}/${constants.storefrontCss}`
  const contents = substituteLocalFileContents("storefront.css", localStorefrontCSS)
  if (contents) {
    resp.string = contents
  }
}

