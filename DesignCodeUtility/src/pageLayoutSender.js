const Promise = require("bluebird")
const dateFormat = require('dateformat')

const dump = require("./logger").dump
const endPointTransceiver = require("./endPointTransceiver")
const findAllStackInstances = require("./pageLayoutUtils").findAllStackInstances
const getPageLayoutByDisplayName = require("./pageLayoutMapper").getPageLayoutByDisplayName
const getPageLayoutByPageType = require("./pageLayoutMapper").getPageLayoutByPageType
const info = require("./logger").info
const loadReferenceData = require("./pageLayoutMapper").loadReferenceData
const mapAudienceIdsInRegion = require("./pageLayoutMapper").mapAudienceIdsInRegion
const mapWidgetRepositoryIdsInRegion = require("./pageLayoutMapper").mapWidgetRepositoryIdsInRegion
const mapSiteRepositoryIds = require("./pageLayoutMapper").mapSiteRepositoryIds
const request = require("./requestBuilder").request
const t = require("./i18n").t
const transferable = require("./pageLayoutMapper").transferable
const updatePageLayoutMaps = require("./pageLayoutMapper").updatePageLayoutMaps
const walkRegions = require("./pageLayoutUtils").walkRegions
const warn = require("./logger").warn

/**
 * Clear things from the layout structure that we don't need.
 * @param pagelayout
 */
function tidy(pagelayout) {

  delete pagelayout.links
  delete pagelayout.widgetPages
  delete pagelayout.layout.displayName
  delete pagelayout.layout.repositoryId
  delete pagelayout.layout.name
}

/**
 * Put the boilerplate for updating the structure in one place.
 * @param repositoryId
 * @param pageLayout
 * @returns A BlueBird promise
 */
function saveLayoutStructure(repositoryId, pageLayout) {
  return endPointTransceiver.saveLayoutStructure([repositoryId], request().withBody(pageLayout))
}

/**
 * Handles syncing the layout metadata.
 * @param repositoryId
 * @param sourcePageLayout
 * @returns A BlueBird promise
 */
function updateLayoutMetadata(repositoryId, sourcePageLayout) {

  // Stick a note in the notes section.
  sourcePageLayout.layout.notes += t("updatedByPlsuText", {datetime: dateFormat(new Date(), "yyyy-mm-dd h:MM:ss TT")})

  // Map any site IDs for multi-site.
  mapSiteRepositoryIds(sourcePageLayout)

  return endPointTransceiver.updateLayout([repositoryId], request().withBody({properties: sourcePageLayout.layout}))
}

/**
 * First Pass. Get the existing region structure ready for the first pass.
 * We need to get rid of all widgets from regions so we can delete them next pass.
 * @param pageLayout
 */
function cleanExistingStructure(pageLayout) {

  // Remove the bits we don't need for clarity.
  tidy(pageLayout)

  // Clear out the widgets from all the regions and update the layout.
  walkRegions(pageLayout.layout.regions, region => region.widgets = [])

  return pageLayout
}

/**
 * Figure out the level of nesting out layouts have.
 * @param pagelayout
 */
function getRegionDepth(regions, currentDepth = 1) {

  for (let region of regions) {

    if (region.regions) {

      let subDepth = getRegionDepth(region.regions, currentDepth + 1)

      if (subDepth > currentDepth) {
        currentDepth = subDepth
      }
    }
  }

  return currentDepth
}

/**
 * Second pass. Need to process the top level regions next.
 * @param destinationPageLayout
 * @param sourcePageLayout
 * @param repositoryId
 * @param depth
 * @returns {*|PromiseLike<T>|Promise<T>}
 */
function saveRegions(sourcePageLayout, destinationPageLayout, depth, currentDepth = 1) {

  // Copy regions at the current depth.
  copyAndMapRegions(sourcePageLayout.layout, destinationPageLayout.layout, currentDepth)

  // Now update the layout on the target system and sync the layout metadata at the same time.
  return saveLayoutStructure(destinationPageLayout.layout.repositoryId, destinationPageLayout).then(results => {

    // Make sure the previous update worked and see if we have more saves to do.
    if (endPointTransceiver.checkCallSucceeded(results) && currentDepth < depth) {

      // Call ourselves making the destination the source and the destination the result of last save.
      return saveRegions(destinationPageLayout, results.data, depth, currentDepth + 1)
    } else {

      // Just return the results of the last save.
      return results
    }
  })
}

/**
 * Sync the given page layout. This is a multi-pass process as the endpoint can't do everything at once.
 * @param repositoryId
 * @param sourcePageLayout
 * @returns {Promise.<TResult>|*}
 */
function transferLayoutStructure(repositoryId, sourcePageLayout) {

  // Get the current structure.
  return endPointTransceiver.getLayoutStructure([repositoryId]).then(results => {

    // First Pass. Clean stuff off the existing page layout.
    const destinationPageLayout = cleanExistingStructure(results.data)

    // Call the endpoint to get rid of the existing widgets first.
    return saveLayoutStructure(repositoryId, destinationPageLayout).then(results => {

      // Make sure the previous update worked.
      if (endPointTransceiver.checkCallSucceeded(results)) {

        // Now get to work on the regions. When the regions are done, take care of any stack instance customizations.
        return saveRegions(sourcePageLayout.structure, results.data, getRegionDepth(sourcePageLayout.structure.layout.regions))
          .then(results => transferStackInstanceChanges(sourcePageLayout.structure.layout.regions, results.data.layout.regions))
      }
    })
  })
}

/**
 * Using the current structure, transfer any stack instance templates, less and less variables.
 * @param sourceRegions
 * @param destinationRegions
 */
function transferStackInstanceChanges(sourceRegions, destinationRegions) {

  // Need to build up a list of promises.
  const promises = []

  // Pull out all the stack instance regions. These should be in the same order and length.
  const sourceStackInstances = findAllStackInstances(sourceRegions)
  const destinationStackInstances = findAllStackInstances(destinationRegions)

  // Walk through the stack instances two by two.
  for (var index in sourceStackInstances) {

    const sourceCode = sourceStackInstances[index].sourceCode
    const sourceId = sourceStackInstances[index].oldRepositoryId
    const destinationId = destinationStackInstances[index].repositoryId

    // Make sure we don't do too many requests at the same time.
    promises.push(updateStackSource("Less", sourceCode.less, destinationId, sourceId, true).then(() =>
      updateStackSource("LessVars", sourceCode.lessVars, destinationId, sourceId, true)).then(() =>
      updateStackSource("SourceCode", sourceCode.template, destinationId)))
  }

  // Join all the promises up.
  return Promise.all(promises)
}

/**
 * Boilerplate for updating a stack instance source code asset.
 * @param endpoint
 * @param repositoryId
 * @param source
 * @return a BlueBird promise
 */
function updateStackSource(endpoint, source, destId, sourceId, suppressThemeCompile=false) {

  // If sourceId is not null then we'll do the conversion of sourceId to
  // destination repositoryId in the source code.
  if (sourceId) {
    source = source.replace(new RegExp(sourceId, 'g'), destId)
  }
  return endPointTransceiver[`updateStack${endpoint}`]([destId], `?suppressThemeCompile=${suppressThemeCompile}`,
    request().withBody({source}))
}

/**
 * Update the metadata and structure for an existing page layout.
 * @param sourcePageLayout
 * @returns {Promise.<TResult>|*}
 */
function updateExistingPageLayout(sourcePageLayout) {

  info("copyingPageLayout", {name: sourcePageLayout.layout.displayName})

  // Just update the metadata to make sure it matches.
  const destinationPageLayout = getPageLayoutByDisplayName(sourcePageLayout.layout.displayName)

  return updateLayoutMetadata(destinationPageLayout.layout.repositoryId, sourcePageLayout).then(results => {

    // Make sure that call worked before we go any further.
    if (endPointTransceiver.checkCallSucceeded(results)) {
      return transferLayoutStructure(destinationPageLayout.layout.repositoryId, sourcePageLayout)
    }
  })
}

/**
 * Create a new matching Page Layout with identical structure and metadata.
 * @param sourcePageLayout
 * @returns {Promise.<TResult>|*}
 */
function createNewMatchingPageLayout(sourcePageLayout) {

  // Need to create a new layout of the right type.
  info("creatingPageLayout", {name: sourcePageLayout.layout.displayName})

  // Stick a note in the notes section.
  sourcePageLayout.layout.notes += t("createdByPlsuText", {datetime: dateFormat(new Date(), "yyyy-mm-dd h:MM:ss TT")})

  // Map any site IDs for multi-site.
  mapSiteRepositoryIds(sourcePageLayout)

  // Find the matching page layout of the right type and clone it.
  const repositoryId = getPageLayoutByPageType(sourcePageLayout.pageType).layout.repositoryId
  return endPointTransceiver.cloneLayout([repositoryId], request().withBody({properties: sourcePageLayout.layout})).then(results => {

    // Make sure that call worked before we go any further.
    if (endPointTransceiver.checkCallSucceeded(results)) {

      // Update the page layout reference data as things have changed.
      updatePageLayoutMaps(results.data)

      // Now we know the layout exists, update the structure,
      return transferLayoutStructure(getPageLayoutByDisplayName(sourcePageLayout.layout.displayName).layout.repositoryId, sourcePageLayout)
    }
  })
}

/**
 * Process the sub-regions associated with the supplied region.
 * @param destination
 * @param source
 */
function copyAndMapRegions(source, destination, depth, currentDepth = 1) {

  // See if we are at the target depth.
  if (currentDepth == depth) {

    // Copy across the regions from the source.
    destination.regions = source.regions

    // Map the repository IDs.
    for (let regionIndex = 0; regionIndex < source.regions.length; regionIndex++) {

      // Fix up the widget IDs.
      mapWidgetRepositoryIdsInRegion(destination.regions[regionIndex])

      // Map any audiences.
      if (destination.regions[regionIndex].audiences) {
        mapAudienceIdsInRegion(destination.regions[regionIndex])
      }
    }
  } else {
    // Not far enough down yet. Walk through the regions and see if they have children.
    for (let regionIndex = 0; regionIndex < source.regions.length; regionIndex++) {

      if (source.regions[regionIndex].regions && source.regions[regionIndex].regions.length) {
        copyAndMapRegions(source.regions[regionIndex], destination.regions[regionIndex], depth, currentDepth + 1)
      }
    }
  }
}

/**
 * Using the supplied information, create or modify page layouts on the target system.
 * @param sourcePageLayouts
 */
function sendPageLayouts(sourcePageLayouts) {

  // Load all the lookups first.
  return loadReferenceData().then(() => {

    // Make sure the layouts look OK before we try to transfer them.
    if (transferable(sourcePageLayouts)) {

      // For each layout we want to transfer...
      return Promise.each(sourcePageLayouts, sourcePageLayout => {

        // See if the layout already exists.
        if (getPageLayoutByDisplayName(sourcePageLayout.layout.displayName)) {

          return updateExistingPageLayout(sourcePageLayout)
        } else {

          return createNewMatchingPageLayout(sourcePageLayout)
        }
      })
    }
  })
}

exports.sendPageLayouts = sendPageLayouts
