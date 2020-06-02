//// media.rule.js --- Source Media substitution handler.
//
// Handle substituting source media files referenced in certain widgets, e.g.
// Web Content.
// This is part 2 of a 2 step rule, which looks at the datamapping
// and substitutes source media entries.
"use strict"

const dataMaps = require('../datamaps')

const substituteLocalFileContents = require('../proxyUtils').substituteLocalFileContents

exports.name = "SourceMedia (Contents)"
exports.doc  = "Handle Source Media assets (HTML Request Phase)"

exports.rule = {
  method: 'GET',
  phase: 'response',

  // only intercept html templates
  fullUrl: "__NODE__/file/*",
  mimeType: 'text/html',

  // expose the response body as a big string
  as: 'string'
}

exports.handler = function (req, resp) {
  let uri = req._data.url

  const queryParamsIndex = uri.indexOf('?')
  if (queryParamsIndex >= 0) {
    uri = uri.substr(0, queryParamsIndex)
  }

  Object.keys(dataMaps.media()).forEach((resource) => {
    if (uri.endsWith(resource)) {
      const contents = substituteLocalFileContents(resource, dataMaps.media(resource))
      if (contents) {
        resp.string = contents
      }
    }
  })
}
