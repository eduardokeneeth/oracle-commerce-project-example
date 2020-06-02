const Promise = require("bluebird")

const endPointTransceiver = require("./endPointTransceiver")

// Make sure that once we figure out what the SiteId is, we do not do it again.
let defaultSiteId

/**
 * Need to find the default site ID for passing to certain endpoint calls.
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function getDefaultSiteId() {

  // See if we already have looked this up.
  if (defaultSiteId) {
    return defaultSiteId
  }

  // Need to ask the server for a list of sites.
  return endPointTransceiver.getSites().then(results => {

    // Find the default site.
    const defaultSite = results.data.items.find(site => site.defaultSite)

    // Save off the siteId for future reference.
    defaultSiteId = defaultSite.repositoryId

    // Make site ID available to later promise functions.
    return defaultSiteId
  })
}

exports.getDefaultSiteId = Promise.method(getDefaultSiteId)
