const Promise = require("bluebird")

const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const info = require("./logger").info

/**
 * Delete the supplied page layouts from the system.
 * @param pageLayouts
 */
function deletePageLayout(pageLayouts) {

  return Promise.each(pageLayouts, pageLayout => {

    // Make sure its not a default layout.
    if (pageLayout.layout.defaultPage) {
      error("cantDeleteDefaultPageLayout", {name : pageLayout.layout.displayName})
      return
    }

    // Let the user know whats happening.
    info("deletingPageLayout", {name : pageLayout.layout.displayName})

    // Call the endpoint to do the dirty deed.
    return endPointTransceiver.deleteLayout([pageLayout.layout.repositoryId])
  })
}

exports.deletePageLayout = deletePageLayout
