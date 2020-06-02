const basename = require('path').basename

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const eTagFor = require("./etags").eTagFor
const getDefaultSiteId = require("./siteHandler").getDefaultSiteId
const processPutResultAndEtag = require("./putterUtils").processPutResultAndEtag
const request = require("./requestBuilder").request
const warn = require("./logger").warn

/**
 * Send the contents of the specified Application Level JS file back up to the server.
 * @param path
 * @returns A BlueBird promise
 */
function putApplicationJavaScript(path) {

  // Make sure the server supports the operation as this is a recent innovation.
  if (!endPointTransceiver.serverSupports("updateApplicationJavaScript")) {
    warn("applicationJavaScriptCannotBeSent")
    return
  }

  // Need the default site ID as the endpoint needs it or update will silently fail.
  return getDefaultSiteId().then(defaultSiteId => {

    return endPointTransceiver.updateApplicationJavaScript([basename(path)],
      request().fromPathAs(path, "source").withEtag(eTagFor(path)).withHeader(constants.siteHeader, defaultSiteId)).tap(
        results => processPutResultAndEtag(path, results))
  })
}

exports.putApplicationJavaScript = putApplicationJavaScript
