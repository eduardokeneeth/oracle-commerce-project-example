const Promise = require("bluebird")

const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const findAllStackInstances = require("./pageLayoutUtils").findAllStackInstances
const info = require("./logger").info
const walkRegions = require("./pageLayoutUtils").walkRegions
const warn = require("./logger").warn

/**
 * Page Layouts come down from the endpoint in groups. Process the supplied group
 * @param pageLayoutGroup
 * @param names
 * @param pageLayoutsArray
 * @param widgetInstanceMap
 * @returns A BlueBird promise or nothing.
 */
function processPageLayoutGroup(pageLayoutGroup, names, pageLayoutsArray, widgetInstanceMap) {

  return Promise.each(pageLayoutGroup.pageLayouts, pageLayout => {

    // See if we are filtering by name.
    if (names.length) {

      if (names.includes(pageLayout.layout.displayName)) {
        pageLayoutsArray.push(pageLayout)
      } else {
        // Don't go any further if we don't need the layout.
        return
      }
    } else {
      pageLayoutsArray.push(pageLayout)
    }

    // Need the structure information too.
    return getLayoutStructure(pageLayout, widgetInstanceMap)
  })
}

/**
 * Make we found all the layouts we came for.
 * @param names
 * @param pageLayouts
 */
function checkForMissingLayouts(names, pageLayouts) {

  if (names && names.length != pageLayouts.length) {
    names.forEach(name => {
      if (!pageLayouts.find(pageLayout => pageLayout.layout.displayName == name)) {
        error("matchingLayoutNotFound", {name})
      }
    })
  }
}

/**
 * Get page layout information for the current instance.
 * Optionally, the caller can ask for a specific page layout by names.
 */
function getPageLayouts(names) {

  // Need to have a list of all widget instances.
  return endPointTransceiver.listWidgets().then(results => {

    // Transform the widget instances into something we can quickly find things in.
    const widgetInstanceMap = mapByRepositoryId(results.data.items)

    // Start to build up a composite structure holding page layout information.
    const pageLayoutsArray = []

    return endPointTransceiver.listLayouts().then(results => {
      return Promise.each(results.data.items, pageLayoutGroup => {

        // Process the page layouts in the group.
        return processPageLayoutGroup(pageLayoutGroup, names, pageLayoutsArray, widgetInstanceMap)
      }).then(() => {

        // Make sure we found all the layouts we wanted.
        checkForMissingLayouts(names, pageLayoutsArray)

        // Send back the array for further processing.
        return pageLayoutsArray
      })
    })
  })
}

/**
 * Turn the widget instance list into something that we can quickly work with.
 * @param widgetInstances
 */
function mapByRepositoryId(widgetInstances) {

  return widgetInstances.reduce((map, widgetInstance) => {

    map.set(widgetInstance.repositoryId, widgetInstance)
    return map
  }, new Map())
}

/**
 * Need to add extra information to widget instances.
 * @param regions
 * @param widgetInstanceMap
 */
function preProcessRegions(regions, widgetInstanceMap) {

  // Recursively traverse the supplied regions.
  walkRegions(regions, region => {

    if (region.descriptor) {

      // Clear any ID in the descriptor just to be safe.
      delete region.descriptor.repositoryId

      // Warn them about any experiment slots and how we only transfer the structure.
      region.descriptor.slotType == "experimentSlot" && warn("experimentNotTransferred", {name: region.displayName})
    }

    region.widgets.forEach(widgetInstance => {

      // Need more information on the widget instance.
      const widgetInstanceDetails = widgetInstanceMap.get(widgetInstance.repositoryId)

      // Save off the widget version.
      widgetInstance.descriptor.version = widgetInstanceDetails.descriptor.version
    })

    // Get rid of the repo ID so it will not confuse the endpoint.
    region.oldRepositoryId = region.repositoryId
    delete region.repositoryId
  })
}

/**
 * Add structure information to page layout.
 * @param pageLayout
 * @param widgetInstanceMap
 * @returns {Promise.<TResult>|*}
 */
function getLayoutStructure(pageLayout, widgetInstanceMap) {

  return endPointTransceiver.getLayoutStructure([pageLayout.layout.repositoryId]).then(results => {

    // Add in the region structure.
    pageLayout.structure = results.data

    // Get the source code for the stack instances.
    return getStackInstanceSourceCode(pageLayout.structure.layout.regions).then(() => {

      // Augment the widget instance information too.
      preProcessRegions(pageLayout.structure.layout.regions, widgetInstanceMap)
    })
  })
}

/**
 * Find all the stack instances and get their source code.
 * @param regions
 * @returns {*}
 */
function getStackInstanceSourceCode(regions) {

  // Get the source code for each stack instance.
  return Promise.each(findAllStackInstances(regions), stackInstance => {

    // Add in a block to hold the source code.
    stackInstance.sourceCode = {}

    // Call each of the endpoints for the stack instance.
    return Promise.all([
      endPointTransceiver.getStackSourceCode([stackInstance.repositoryId]).then(results => {
        stackInstance.sourceCode.template = results.data.source
      }),
      endPointTransceiver.getStackLessVars([stackInstance.repositoryId]).then(results => {
        stackInstance.sourceCode.lessVars = results.data.source
      }),
      endPointTransceiver.getStackLess([stackInstance.repositoryId]).then(results => {
        stackInstance.sourceCode.less = results.data.source
      })
    ])
  })
}

exports.getPageLayouts = getPageLayouts
