const logInfo = require("./logger").logInfo

/**
 * List all the layouts on the system.
 * @param pageLayouts
 * @param detailed
 */
function listLayouts(pageLayouts, detailed) {

  pageLayouts.forEach(pageLayout => {

    // See if they want the lot.
    if (detailed) {
      logInfo(JSON.stringify(pageLayout, null, 2))
    } else {
      logInfo(pageLayout.layout.displayName)
    }
  })
}

exports.listLayouts = listLayouts
