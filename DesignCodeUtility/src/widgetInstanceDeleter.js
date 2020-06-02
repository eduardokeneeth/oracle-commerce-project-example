const endPointTransceiver = require("./endPointTransceiver")
const warn = require("./logger").warn
const info = require("./logger").info
const processDeleteResult = require("./deleterUtils").processDeleteResult
const removeTrackedTree = require("./utils").removeTrackedTree
const constants = require("./constants").constants
const readMetadata = require("./metadata").readMetadata
const getCachedWidgetInstanceFromMetadata = require("./metadata").getCachedWidgetInstanceFromMetadata
const shouldSuppressThemeCompile = require("./putterUtils").shouldSuppressThemeCompile

/**
 * Deletes the widget instance associated with the given path
 * @param path the widget instance path
 * @param node the node that the widget instance will be deleted from
 */
function deleteWidgetInstance(path, node) {

  info("deletingPath", {path, node})

  // Check that the widget instance exists
  return getWidgetInstanceMetadata(path).then(metadata => {
    if (!metadata) {
      return
    }

    // Make sure the deleteWidgetInstance endpoint exists
    if (!endPointTransceiver.serverSupports("deleteWidgetInstance")) {
      warn("widgetInstanceCannotBeDeleted", {name: metadata.displayName})
      return  
    }

    // Invoke the deleteWidgetInstance endpoint to delete the widget instance
    // Also remove the local folder for the widget instance if the endpoint call is successful
    info("deletingWidgetInstance", { name: metadata.displayName })
    return endPointTransceiver.deleteWidgetInstance([metadata.repositoryId], `?suppressThemeCompile=${shouldSuppressThemeCompile()}`).tap(results => {
      if (processDeleteResult(path, results)) {
        removeTrackedTree(path)
      }
    })
  })
}

/**
 * Gets metadata about the widget instance
 * @param path
 * @returns A Promise
 */
function getWidgetInstanceMetadata(path) {
  // Load the metadata for the widget instance.
  return readMetadata(path, constants.widgetInstanceMetadataJson).then(widgetInstanceMetadata => {

    // Looks like we have metadata but check it actually exists on the server - someone could have deleted it.
    if (widgetInstanceMetadata && getCachedWidgetInstanceFromMetadata(widgetInstanceMetadata)) {
      return widgetInstanceMetadata
    } 
  })
}

exports.deleteWidgetInstance = deleteWidgetInstance
