const Promise = require("bluebird")

const constants = require("./constants").constants
const copyFieldContentsToFile = require("./grabberUtils").copyFieldContentsToFile
const copyJsonFieldContentsToFile = require("./grabberUtils").copyJsonFieldContentsToFile
const endPointTransceiver = require("./endPointTransceiver")
const exists = require("./utils").exists
const deriveStackInstanceDir = require('./stackUtils').deriveStackInstanceDir
const friendlyStackInstanceName = require('./stackUtils').friendlyStackInstanceName
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const sanitizeName = require("./utils").sanitizeName
const splitPath = require("./utils").splitPath
const warn = require("./logger").warn
const writeMetadata = require("./metadata").writeMetadata
const t = require('./i18n').t
const writeFileAndETag = require("./grabberUtils").writeFileAndETag

/**
 * Grab all the instances for a specific stack e.g. stack/Name/instances.
 * @param directory
 */
function grabStackInstances(directory) {
  return tryToGrabStacks(splitPath(directory, 2))
}

/**
 * Grab a specific stack instance e.g. stack/Name/instances/Name.
 * @param directory
 */
function grabSpecificStackInstance(directory) {

  return tryToGrabStacks(splitPath(directory, 3), splitPath(directory))
}

/**
 * Grab a specific stack and all its instances e.g. stack/Accordion
 * @param directory
 */
function grabSpecificStack(directory) {
  return tryToGrabStacks(splitPath(directory))
}

/**
 * The endpoints we need to manipulate stacks were added fairly recently so let's not assume they are there.
 * @returns {boolean}
 */
function stacksCanBeGrabbed() {

  if (endPointTransceiver.serverSupports("getAllStackInstances", "getStackSourceCode", "getStackLessVars", "getStackLess")) {
    return true
  } else {
    warn("stacksCannotBeGrabbed")
    return false
  }
}

/**
 * Try to grab stack info that the user has asked for.
 * @param stackName
 * @param stackInstanceName
 */
function tryToGrabStacks(stackName, stackInstanceName) {

  const promises = []

  if (stacksCanBeGrabbed()) {

    promises.push(endPointTransceiver.getAllStackInstances().tap(results => {

      // Create stack top level dir first if it does not already exist.
      makeTrackedDirectory(constants.stacksDir)

      promises.push(grabStacks(results, stackName, stackInstanceName))
    }))
  }

  return Promise.all(promises)
}

/**
 * Pull down all the stacks from the server unless we specify which one.
 */
function grabAllStacks() {
  return tryToGrabStacks()
}

/**
 * Walk through the array contained in results creating files on disk.
 * @param results
 * @param stackName
 * @param stackInstanceName
 */
function grabStacks(results, stackName, stackInstanceName) {

  // Keep track of all the promises, returning them as a single promise at the end.
  const promises = []

  // Walk through the stacks, making sure we only grab what the user wants.
  results.data.items.filter(stack => {

    return !stackName || (stackName && stack.displayName === stackName)
  }).forEach(stack => promises.push(grabStack(stack, stackInstanceName)))

  // Warn if we did not find a match.
  if (stackName && promises.length === 0)
    warn("noMatchFound", {name : stackName})

  return Promise.all(promises)
}

/**
 * Get the resources for the supplied stack. Unlike widgets, there is only source
 * code associated with the instances.
 * @param stack
 * @param stackInstanceName
 */
function grabStack(stack, stackInstanceName) {

  // Let the user know something is happening...
  info("grabbingStack", {name : stack.displayName})

  // Create the top level dirs for the stack first.
  const stackDir = `${constants.stacksDir}/${sanitizeName(stack.displayName)}`
  makeTrackedDirectory(stackDir)

  writeStackMetadata(stack, stackDir)

  const instancesDir = `${stackDir}/instances`
  makeTrackedDirectory(instancesDir)

  // Keep track of all the promises, returning them as a single promise at the end.
  const promises = []

  // See if this is a user created widget.
  if (stack.source === 101) {
    promises.push(grabBaseContent(stack, stackDir))
  }

  // See if the user wants a specific instance.
  stack.instances.filter(stackInstance => stackInstanceName ? stackInstanceName === stackInstance.displayName : true)
    .forEach(stackInstance => {
      promises.push(grabStackInstance(instancesDir, stackInstance))
    })

  return Promise.all(promises)
}

/**
 * Create files based on the supplied stack instance
 * @param instancesDir - where to stick the files
 * @param stackInstance - info on the stack instance from the server
 */
function grabStackInstance(instancesDir, stackInstance) {

  // Set up a dir for this instance.
  const stackInstanceOrigName = friendlyStackInstanceName(stackInstance)
  const stackInstanceUniqueName = deriveStackInstanceDir(instancesDir, stackInstance)
  const stackInstanceDir = `${instancesDir}/${sanitizeName(stackInstanceUniqueName)}`

  // See if we have already grabbed a version of stack.
  if (exists(stackInstanceDir)) {

    // Get the version from the instance we currently have on disk.
    const metadataFromDisk = readMetadataFromDisk(stackInstanceDir, constants.stackInstanceMetadataJson)

    // If the one on disk is more up to date, don't go any further.
    if (metadataFromDisk && metadataFromDisk.version >= stackInstance.descriptor.version) {
      warn("newerVersionWarning", {
        name: stackInstance.displayName,
        diskVersion: metadataFromDisk.version,
        fetchVersion: stackInstance.descriptor.version
      })

      return null
    }
  }

  // We can now safely make the directory.
  makeTrackedDirectory(stackInstanceDir)

  // Need to store the stack instance ID in the tracking dir for later.
  const stackInstanceJson = {
    version: stackInstance.descriptor.version,
    displayName: stackInstance.displayName,
    name: stackInstance.name
  }

  writeMetadata(`${stackInstanceDir}/${constants.stackInstanceMetadataJson}`, stackInstanceJson)

  const promises = []

  promises.push(copyFieldContentsToFile("getStackSourceCode", stackInstance.id, "source", `${stackInstanceDir}/${constants.stackTemplate}`))
  promises.push(copyFieldContentsToFile("getStackLessVars", stackInstance.id, "source", `${stackInstanceDir}/${constants.stackVariablesLess}`))
  promises.push(copyFieldContentsToFile("getStackLess", stackInstance.id, "source", `${stackInstanceDir}/${constants.stackLess}`))

  if (endPointTransceiver.serverSupports("getStackMetadata")) {
    promises.push(
      copyJsonFieldContentsToFile("getStackMetadata", stackInstance.id,
        "metadata", `${stackInstanceDir}/stackInstanceMetadata.json`)
    )
  }

  // I promise to eventually get stack source code, less variables, and less stylesheet.
  return Promise.all(promises)
}

/**
 * Holds the boilerplate for writing stack metadata.
 * @param stack
 * @param stackDir
 * @return a Bluebird promise.
 */
function writeStackMetadata(stack, stackDir) {

  // Set up the base metadata. Start with what is already there if we can.
  // This is to stop us losing metadata created by ccw which cannot be created from the endpoint data.
  const existingMetadata = readMetadataFromDisk(stackDir, constants.stackMetadataJson, true)
  const metadata = existingMetadata ? existingMetadata : {}

  // Some metadata is only available in more recent versions.
  const baseKeys = ["stackType", "regions", "version", "displayName", "maxVariants", "canEditSubRegion"]
  baseKeys.forEach(key => {
    metadata[key] = stack[key]
  })

  // Write out what we got to disk.
  writeMetadata(`${stackDir}/${constants.stackMetadataJson}`, metadata)

  // For user created stacks, we can allow them to change certain properties, post create.
  if (stack.source === 101) {

    // Also need to create the user modifiable metadata too.
    return createUserModifiableMetadata(stack, stackDir)
  }
}

/**
 * Create a file on disk containing things associated with the stack that the user can change.
 * This will only ever get called for non-Oracle stacks.
 * @param stack
 * @param stackDir
 */
function createUserModifiableMetadata(stack, stackDir) {

  if (endPointTransceiver.serverSupports("getStackDescriptorMetadata")) {

    // Call the custom metadata endpoint created specially for this purpose.
    return endPointTransceiver.getStackDescriptorMetadata([stack.repositoryId]).then(results => {

      writeFileAndETag(`${stackDir}/${constants.userStackMetadata}`,
        JSON.stringify(results.data.metadata, null, 2), results.response.headers.etag)
    })
  } else {
    warn("stackDescriptorMetadataCannotBeGrabbed")
  }
}

/**
 * If the server supports the right endpoints, grab the base content files.
 * @param stack
 * @param stackDir
 */
function grabBaseContent(stack, stackDir) {

  // Build up a list of promises.
  const promises = []

  // Just to be safe, check the endpoints are there.
  if (endPointTransceiver.serverSupports(
    "getStackDescriptorBaseTemplate", "getStackDescriptorBaseLess", "getStackDescriptorBaseLessVars")) {

    promises.push(copyFieldContentsToFile("getStackDescriptorBaseTemplate", stack.id, "source", `${stackDir}/${constants.stackTemplate}`))
    promises.push(copyFieldContentsToFile("getStackDescriptorBaseLess", stack.id, "source", `${stackDir}/${constants.stackLess}`))
    promises.push(copyFieldContentsToFile("getStackDescriptorBaseLessVars", stack.id, "source", `${stackDir}/${constants.stackLessVariables}`))

  } else {
    warn("baseStackContentCannotBeGrabbed")
  }

  // Gather all the promises together into a single one.
  return Promise.all(promises)
}

exports.grabAllStacks = grabAllStacks
exports.grabSpecificStack = grabSpecificStack
exports.grabStackInstances = grabStackInstances
exports.grabSpecificStackInstance = grabSpecificStackInstance
