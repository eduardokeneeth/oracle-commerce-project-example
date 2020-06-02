//// textSnippet.rule.js --- Text snippet substitution handler.
//
// Handle substituting Text Snippets modified locally by the user.
// Text snippets are returned for the current locale already in SF, so we
// should look at the URL and find the corresponding locale in the snippets
// directory if it exists.
//
// Our snippets files organize strings into bundles by component type. The
// storefront resources are flattened, so here we just iterate our individual
// local bundles and stick everything into the response resource map.
"use strict"

const constants    = require("../../constants").constants
const exists       = require('../../utils').exists
const readJsonFile = require('../../utils').readJsonFile
const warn         = require('../../logger').warn

const url = require('url')

exports.name = "GlobalTextSnippets"
exports.doc = "Handler for Global Text Snippets."

exports.rule = {
  method: 'GET',
  phase: 'response',

  // Intercept strings as json data.
  fullUrl: "__NODE__/ccstoreui/v1/resources/ns.common*",
  mimeType: 'application/json',
  as: 'json'
}

exports.handler = function (req, resp) {
  const resources = resp.json.resources
  const urlParts = url.parse(req._data.url, true)

  // Check if we're grabbing resources for a different locale but fall back
  // to en
  const locale = urlParts.query.locale || 'en'
  const snippetsFile = `${constants.textSnippetsDir}/${locale}/${constants.snippetsJson}`

  // We might not have grabbed resources for all locales
  if (exists(snippetsFile)) {
    const stringPacks = readJsonFile(snippetsFile)

    Object.keys(stringPacks).forEach((bundle) => {
      const strings = stringPacks[bundle]
      Object.keys(strings).forEach((key) => {
        resources[key] = strings[key]
      })
    })
  } else {
    warn("noSnippetsAvailableForLocale", {locale})
  }
}

