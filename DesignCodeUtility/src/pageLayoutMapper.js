const Promise = require("bluebird")

const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const logger = require("./logger")
const walkRegions = require("./pageLayoutUtils").walkRegions

/**
 * Put all the reference data we need to map in a big block.
 */
const referenceData = {}

/**
 * Build up the reference data up front (widgets, layouts, audiences, sites) in a block of maps for fast searching.
 * @returns {*|PromiseLike<{}>|Promise<{}>}
 */
function loadReferenceData() {

  return Promise.all([
    endPointTransceiver.getAllWidgetInstances().then(results => {

      referenceData.widgetInstances = mapBy(results.data.items.reduce((array, item) => {

          item.instances.forEach(instance => {
            array.push(instance)
            instance.descriptorRepositoryId = item.repositoryId
          })

          return array
        }, []),
        widgetInstance => `${widgetInstance.displayName}_${widgetInstance.version}`)
    }),
    endPointTransceiver.listLayouts().then(results => {
      referenceData.pageLayoutsByDisplayName = mapPageLayoutsBy(results.data.items, pageLayout => pageLayout.layout.displayName)
      referenceData.pageLayoutsByPageType = mapPageLayoutsBy(results.data.items, pageLayout => pageLayout.pageType)
    }),
    endPointTransceiver.listAudiences().then(results => {
      referenceData.audiences = mapBy(results.data.items, audience => audience.displayName)
    }),
    endPointTransceiver.getSites().then(results => {
      referenceData.sites = mapBy(results.data.items, site => site.name)
    }),
    endPointTransceiver.getAllStackDescriptors().then(results => {
      referenceData.stacks = mapBy(results.data.items, stack => stack.stackType)
    })
  ])
}

/**
 * Logic for building a key to look up the widget instance map.
 * @param widgetInstance
 * @returns {string}
 */
function asWidgetInstanceKey(widgetInstance) {
  return `${widgetInstance.displayName}_${widgetInstance.descriptor.version}`
}

/**
 * Walk through the supplied page layouts so that we are trying to transfer something is not mappable.
 * This is to make plsu more transactional in character.
 * @param pageLayouts
 * @returns {boolean}
 */
function transferable(pageLayouts) {

  // Walk through each page layout, keeping track of what we find.
  pageLayouts.forEach(pageLayout => {

    pageLayout.siteNames.forEach(siteName => {

      // See if site with given name exists on target system.
      !referenceData.sites.has(siteName) &&
      error("siteNotFoundOnTarget", {name: siteName})
    })

    // Recursively traverse the supplied regions.
    walkRegions(pageLayout.structure.layout.regions, region => {

      // Have a look at the widgets.
      region.widgets.forEach(widgetInstance => {

        !referenceData.widgetInstances.has(asWidgetInstanceKey(widgetInstance)) &&
        error("widgetInstanceNotFoundOnTarget", {name: widgetInstance.displayName})
      })

      // Now audiences (if any).
      region.audiences && region.audiences.forEach(audience => {

        !referenceData.audiences.has(audience.displayName) &&
        error("audienceNotFoundOnTarget", {name: audience.displayName})
      })

      // Look for stacks.
      if (region.descriptor && region.descriptor.stackType) {

        !referenceData.stacks.has(region.descriptor.stackType) &&
        error("stackNotFoundOnTarget", {name: region.displayName})
      }
    })
  })

  // The logger will know if we found anything bad.
  return !logger.hadSeriousError
}

/**
 * Turn the page layout information from the endpoint into something we can quickly search.
 * @param items
 * @param keyMapper
 * @returns a page layout map indexed by display name
 */
function mapPageLayoutsBy(items, keyMapper) {

  return items.reduce((map, item) => {

    item.pageLayouts.forEach(pageLayout => {
      map.set(keyMapper(pageLayout), pageLayout)
    })

    return map
  }, new Map())
}

/**
 * Fix up the repository IDs in the supplied region.
 * @param region
 */
function mapWidgetRepositoryIdsInRegion(region) {

  region.widgets.forEach(widgetInstance => {

    // Find the matching instance on the destination.
    const matchingWidgetInstance = referenceData.widgetInstances.get(asWidgetInstanceKey(widgetInstance))

    // Make sure there is a match.
    if (matchingWidgetInstance) {

      // Need to find equivalent repo ids.
      widgetInstance.repositoryId = matchingWidgetInstance.repositoryId
      widgetInstance.descriptor.repositoryId = matchingWidgetInstance.descriptorRepositoryId
    } else {

      // We should not ordinarily get in here because of the pre-pass.
      error("widgetInstanceNotFoundOnTarget", {name: widgetInstance.displayName})
    }
  })
}

/**
 * Map audience IDs in the region to correct IDs in the target system.
 * @param region
 */
function mapAudienceIdsInRegion(region) {

  region.audiences.forEach(audience => {

    // See if audience is defined on the target.
    if (referenceData.audiences.has(audience.displayName)) {

      // Map the repository key.
      audience.repositoryId = referenceData.audiences.get(audience.displayName).repositoryId

    } else {
      // We are unlikely to get in here because of the pre-pass. Warn the user that we have hit a snag but keep going.
      error("audienceNotFoundOnTarget", {name: audience.displayName})
    }
  })
}

/**
 * Walk through the layout, mapping any sites to their equivalents on the target system.
 * @param sourcePageLayout
 */
function mapSiteRepositoryIds(sourcePageLayout) {

  // Clear any existing repository keys.
  sourcePageLayout.layout.sites = []

  sourcePageLayout.siteNames.forEach(siteName => {

    // See if site with given name exists on target system.
    if (referenceData.sites.has(siteName)) {
      // Put the corresponding key into the JSON we are sending to the server.
      sourcePageLayout.layout.sites.push(referenceData.sites.get(siteName).repositoryId)
    } else {
      // We are unlikely to get in here because of pre-pass. Tell the user we couldn't find the site.
      error("siteNotFoundOnTarget", {name: siteName})
    }
  })
}

/**
 * Turn the supplied array into a map using the supplied function to generate the key.
 * @param items
 * @param keyMapper
 */
function mapBy(items, keyMapper) {

  return items.reduce((map, item) => {

    map.set(keyMapper(item), item)
    return map
  }, new Map())
}

/**
 * Update the maps with the new layout.
 * @param results
 */
function updatePageLayoutMaps(pageLayout) {
  referenceData.pageLayoutsByDisplayName.set(pageLayout.layout.displayName, pageLayout)
  referenceData.pageLayoutsByPageType.set(pageLayout.pageType, pageLayout)
}

/**
 * Return the page layout with the supplied name.
 * @param displayName
 */
function getPageLayoutByDisplayName(displayName) {
  return referenceData.pageLayoutsByDisplayName.get(displayName)
}

/**
 * Get the first matching layout of the supplied type.
 * @param pageType
 */
function getPageLayoutByPageType(pageType) {
  return referenceData.pageLayoutsByPageType.get(pageType)
}

exports.getPageLayoutByDisplayName = getPageLayoutByDisplayName
exports.getPageLayoutByPageType = getPageLayoutByPageType
exports.loadReferenceData = loadReferenceData
exports.mapSiteRepositoryIds = mapSiteRepositoryIds
exports.mapAudienceIdsInRegion = mapAudienceIdsInRegion
exports.mapWidgetRepositoryIdsInRegion = mapWidgetRepositoryIdsInRegion
exports.transferable = transferable
exports.updatePageLayoutMaps = updatePageLayoutMaps
