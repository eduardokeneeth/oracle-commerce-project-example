const basename = require('path').basename
const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getWidgetInstancePath = require("./widgetInstanceGrabber").getWidgetInstancePath
const makeTrackedTree = require("./utils").makeTrackedTree
const splitPath = require("./utils").splitPath
const writeFile = require("./utils").writeFile
const writeFileAndETag = require("./grabberUtils").writeFileAndETag

/**
 * Walk through the instance information, cleaning it up and pulling down any associated images.
 * @param widget
 * @param elementInstanceMetadata
 * @param etag
 */
function processElementInstances(widget, elements, etag) {

  // Gather up the element instance metadata.
  const elementInstanceMetadata = elements.filter(element => element.type == "instance")

  // Find out where files are supposed to go.
  const widgetInstanceDir = getWidgetInstancePath(widget.descriptor.widgetType, widget.displayName)

  const promises = []

  elementInstanceMetadata.forEach(elementInstance => {

    // Make an image directory if it is not already there.
    const imagesDirectory = `${widgetInstanceDir}/${constants.elementInstancesImagesDir}`
    makeTrackedTree(imagesDirectory)

    // Grab any images associated with instance.
    if (elementInstance.config.imageConfig && elementInstance.config.imageConfig.values.src) {
      promises.push(grabElementInstanceImage(elementInstance, imagesDirectory))

      // Put a shortened version of the file name in the JSON for later use.
      elementInstance.config.imageConfig.values.fileName = splitPath(elementInstance.config.imageConfig.values.src)
      delete elementInstance.config.imageConfig.values.src
    }

    // Tidy up the element instance so its easy to work with later.
    cleanElementInstance(elementInstance)
  })

  // Write out the sanitized data.
  writeFileAndETag(`${widgetInstanceDir}/${constants.userElementInstancesMetadataJson}`,
    JSON.stringify({elementInstances: elementInstanceMetadata}, null, 2), etag)

  // Wait for all the images to come down.
  return Promise.all(promises)
}

/**
 * Get the image associated with an element instance.
 * @param elementInstance
 * @param imagesDirectory
 * @returns {*|PromiseLike<T>|Promise<T>}
 */
function grabElementInstanceImage(elementInstance, imagesDirectory) {

  // Uri will be of the form /file/v4998724338791971926/general/city-background.jpg.
  const src = elementInstance.config.imageConfig.values.src

  // Make a path on local disk that should be recognizable.
  return endPointTransceiver.get(`${endPointTransceiver.instance}${src}`)
    .then(results => writeFile(`${imagesDirectory}/${basename(src)}`, results.data))
}

/**
 * Take the supplied element instance and chop off the bit we dont need and generally arrange things as we want them.
 * @param elementInstance
 */
function cleanElementInstance(elementInstance) {

  // Get rid of certain top level keys we know we don't want.
  const keysToDelete = ["repositoryId", "source", "inline", "children", "title", "type", "configOptions", "previewText"]
  keysToDelete.forEach(key => delete elementInstance[key])

  // Flatten the config blocks so they are easier to use later.
  Object.keys(elementInstance.config).forEach(key => {

    // Create a new empty object matching the current config block.
    elementInstance[key] = {}

    // Take the contents of the values block and plonk them in the new flatter config block.
    Object.keys(elementInstance.config[key].values).forEach(innerKey => {
      elementInstance[key][innerKey] = elementInstance.config[key].values[innerKey]
    })
  })

  // Don't need the config block any more.
  delete elementInstance.config

  // Clean off some IDs that we don't need.
  if (elementInstance.imageConfig) {
    delete elementInstance.imageConfig.titleTextId
    delete elementInstance.imageConfig.altTextId
  }

  elementInstance.richTextConfig && delete elementInstance.richTextConfig.sourceMedia
}

exports.processElementInstances = processElementInstances
