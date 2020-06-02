/**
 * Recursively walk through the supplied regions array, applying the supplied function.
 * @param regions
 * @param callback
 */
function walkRegions(regions, callback) {

  regions && regions.forEach(region => {

    // Do whatever work the user wants to do on the region.
    callback(region)

    // Process any nested regions.
    if (region.regions) {
      walkRegions(region.regions, callback)
    }
  })
}

/**
 *  Find all the stack instances in the region tree.
 * @param regions
 * @returns {Array}
 */
function findAllStackInstances(regions) {

  const stackInstances = []

  walkRegions(regions, region => {
    region.descriptor && region.descriptor.stackType && stackInstances.push(region)
  })

  return stackInstances
}

exports.findAllStackInstances = findAllStackInstances
exports.walkRegions = walkRegions
