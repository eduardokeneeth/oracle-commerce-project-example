const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const writeFileAndETag = require("./grabberUtils").writeFileAndETag
const warn = require("./logger").warn

exports.grabAllApplicationJavaScript = function () {

  // The endpoints we need to manipulate Application Level JS were added fairly recently so let's not assume they are there.
  if (endPointTransceiver.serverSupports("listAllApplicationJavaScript", "getApplicationJavaScript")) {

    // Create a directory for global JS.
    makeTrackedDirectory(constants.globalDir)

    return endPointTransceiver.listAllApplicationJavaScript().then(results => {

      return Promise.map(Object.keys(results.data.items), jsFile => {

        info("grabbingApplicationJavaScript", {name : jsFile})
        return endPointTransceiver.getApplicationJavaScript([jsFile],"?ignoreSite=true").tap(results => {

          // The result set of listing all javascript files may include results
          // which are site-specific, but the endpoint to get an individual JS
          // file by default only returns results for the current admin site context
          // so we need to check for a 404 or we create JS files containing 'undefined'.
          if (results.response.statusCode !== 404) {
            writeFileAndETag(`${constants.globalDir}/${jsFile}`,
              results.data.source, results.response.headers.etag)
          } else {
            warn("applicationJavaScriptIsSiteSpecificWarning", {name: jsFile})
          }

        })
      }, getGrabbingConcurrency())
    })
  } else {
    warn("applicationJavaScriptCannotBeGrabbed")
  }
}
