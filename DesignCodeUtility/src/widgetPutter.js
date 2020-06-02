"use strict"

const basename = require('path').basename
const dirname = require('path').dirname
const Promise = require("bluebird")
const upath = require("upath")

const cacheWidgetInstances = require("./metadata").cacheWidgetInstances
const checkForSnippetKeyMismatch = require("./snippetKeyTracker").checkForSnippetKeyMismatch
const createWidgetInExtension = require("./widgetCreator").createWidgetInExtension
const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const eTagFor = require("./etags").eTagFor
const error = require("./logger").error
const exists = require("./utils").exists
const findCachedWidgetInstanceMatchingDisplayName = require('./metadata').findCachedWidgetInstanceMatchingDisplayName
const getBaseElementTag = require("./elementUtils").getBaseElementTag
const getCachedWidgetInstanceFromMetadata = require("./metadata").getCachedWidgetInstanceFromMetadata
const getElementByTag = require("./metadata").getElementByTag
const getElementTagRepoId = require("./elementUtils").getElementTagRepoId
const i18n = require("./i18n")
const info = require("./logger").info
const inTransferMode = require("./state").inTransferMode
const logDebug = require("./logger").logDebug
const makeTrackingDirTree = require("./utils").makeTrackingDirTree
const processPutResultAndEtag = require("./putterUtils").processPutResultAndEtag
const readFile = require("./utils").readFile
const readJsonFile = require("./utils").readJsonFile
const readMetadata = require("./metadata").readMetadata
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request
const resetEtag = require("./etags").resetEtag
const shouldSuppressThemeCompile = require("./putterUtils").shouldSuppressThemeCompile
const splitFromBaseDir = require("./utils").splitFromBaseDir
const updateMetadata = require("./metadata").updateMetadata
const walkDirectory = require("./utils").walkDirectory
const warn = require("./logger").warn
const writeDummyEtag = require("./etags").writeDummyEtag
const writeFile = require("./utils").writeFile
const shouldUpdateInstances = require('./putterUtils').shouldUpdateInstances
const shouldSendInstanceConfig = require('./putterUtils').shouldSendInstanceConfig
const autoFix = require('./putterUtils').autoFix

/**
 * Do the jiggery-pokery required to upload a file.
 * @param elementInstance
 * @param imagePath
 * @return {*|PromiseLike<T>|Promise<T>}
 */
function uploadImage(elementInstance, imagePath) {

  // Need to do the file upload dance. Set up an object to hold segment and path information.
  const newFileInfo = {
    "filename": elementInstance.imageConfig.fileName,
    "segments": 1,
    "uploadtype": "general"
  }

  // Firstly, tell the server we are about to upload something.
  return endPointTransceiver.startFileUpload(request().withBody(newFileInfo)).then(results => {

    // Build up the payload from the image file.
    const payload = {
      filename: newFileInfo.filename,
      file: readFile(imagePath, "base64"),
      index: 0
    }

    // Send up the base64'd image in a big JSON block.
    return endPointTransceiver.doFileSegmentUpload([results.data.token], request().withBody(payload)).then(results => {

      // Make sure upload worked.
      if (results.data.success) {

        // Lastly, find out what the URI for the file is.
        return endPointTransceiver.getFileURI([`general/${elementInstance.imageConfig.fileName}`]).then(results => {

          // Update the URI so we are pointing at the right thing.
          elementInstance.imageConfig.src = results.data.uri
        })
      }
    })
  })
}

/**
 * Walk through the supplied element instances, looking for any images.
 * @param path
 * @param elementInstances
 * @return A BlueBird promise
 */
function processImages(path, elementInstances) {

  // Firstly we only want element instances with image config.
  return Promise.each(elementInstances.filter(elementInstance => elementInstance.imageConfig), elementInstance => {

    // Figure out where the image file should be.
    const imagePath = `${dirname(path)}/${constants.elementInstancesImagesDir}/${elementInstance.imageConfig.fileName}`

    // Make sure file is actually there.
    if (exists(imagePath)) {
      return uploadImage(elementInstance, imagePath)
    } else {
      // Warn that we cant find image.
      info("elementImageNotFound", {imagePath})
    }

  }).then(() => elementInstances)
}

/**
 * Put the path computation logic in one place.
 * @param path
 * @return {string}
 */
function figureUserElementInstancesPath(path) {
  return `${dirname(path)}/${constants.userElementInstancesMetadataJson}`
}

/**
 * Walk through the element instances creating or deleting any as necessary.
 * @param path
 * @param metadata
 * @return {PromiseLike<T | never>}
 */
function ensureElementInstances(metadata, path) {

  // Load up the instances array.
  const elementInstances = readJsonFile(figureUserElementInstancesPath(path)).elementInstances

  // Load up the display template for future use.
  const template = getShornTemplate(path)

  // Massage the element instances into something we can send to the server.
  return Promise.each(elementInstances, elementInstance => {

      // Fill in the type field.
      elementInstance.type = "instance"

      // Fill in the config options field from the user metadata.
      const elementByInstanceMetadata = getElementByTag(getBaseElementTag(elementInstance.tag))

      if (elementByInstanceMetadata) {
        elementInstance.configOptions = elementByInstanceMetadata.configOptions
      } else {
        logDebug("Didn't get a match for elementTag: " + getBaseElementTag(elementInstance.tag))
        elementInstance.configOptions = {}
      }

      // If the matching instance actually appears on the layout AND either :
      // we are in transfer mode OR the element instance does not exist.
      if (template.includes(getElementTagRepoId(elementInstance.tag)) &&
        (inTransferMode() || !getElementByTag(elementInstance.tag))) {

        // Need a new element instance tag.
        return endPointTransceiver.createFragmentInstance(
          [metadata.repositoryId, getBaseElementTag(elementInstance.tag)])
          .then(results => {

          // Keep track of old tag, new tag and repo ID so we can mess with the template if we have to.
          elementInstance.oldTag = elementInstance.tag
          elementInstance.tag = results.data.tag
          elementInstance.repositoryId = results.data.repositoryId
        })
      } else {

        // We did not create the instance. If its not used on the template add it to the delete list.
        if (!template.includes(getElementTagRepoId(elementInstance.tag))) {

          elementInstance.unused = true
        }
      }
    },
    []).then(() => processImages(path, elementInstances))
}

/**
 * Helps with element instance repository key substitution.
 * @param repositoryId
 * @return {string}
 */
function makeMatcher(repositoryId) {
  return `id: '${repositoryId}'`
}

/**
 * Load up the display template for an elementized widget, cutting off the setContextVariable gubbins at the top.
 * @param path
 * @return {*|string}
 */
function getShornTemplate(path) {
  return readFile(path).replace(/<!-- ko setContextVariable: [\s\S]*? \/ko -->/gm, "")
}

/**
 * Turn the layout source into something we can send to the server.
 * @param path
 * @param elementInstances
 * @return {*}
 */
function prepareLayoutSource(path, elementInstances) {

  // Need to chop off the setContextVariable binding stuff first.
  const templateText = getShornTemplate(path)

  // Then we need to map any repo IDs in the template.
  return elementInstances.filter(elementInstance => elementInstance.oldTag)
  .reduce((templateText, elementInstance) =>
      templateText.replace(makeMatcher(getElementTagRepoId(elementInstance.oldTag)), makeMatcher(elementInstance.repositoryId)),
    templateText)
}

/**
 * Holds the boilerplate for updating an elementized widget instance.
 * @param metadata
 * @param path
 * @return {PromiseLike<T | never | never>}
 */
function sendElementizedWidget(metadata, path) {

  // Walk through the element instances.
  return ensureElementInstances(metadata, path).then(elementInstances => {

    // Build up the payload.
    const payload = {
      layoutConfig: [
        {
          // Only send instances that we are not deleting.
          fragments: elementInstances.filter(elementInstance => !elementInstance.unused)
        }
      ],
      widgetConfig: {
        name: metadata.displayName, // Need this or the endpoint will choke.
        notes: ""
      },
      layoutSource: prepareLayoutSource(path, elementInstances), // Need to massage the layout so the endPoint is happy.
      layoutDescriptorId: metadata.layoutDescriptorId // This also is vital.
    }

    // Only put in layout instance ID if we have it.
    metadata.layoutInstanceId && (payload.layoutInstanceId = metadata.layoutInstanceId)

    // Call the endpoint, do not supply a etag for now.
    return deleteElementInstances(metadata, elementInstances.filter(elementInstance =>
      elementInstance.unused && !inTransferMode())).then(() =>
        endPointTransceiver.updateWidget([metadata.repositoryId], request().withBody(payload)))
  })
}

/**
 * From the server, take a note of all existing element instances for later use.
 * @param metadata
 */
function getExistingElementInstances(metadata) {

  return endPointTransceiver.getWidget([metadata.repositoryId]).then(results => {
    if (results.data.fragments) {
      return results.data.fragments.filter(element => element.type == "instance")
    } else {
      return []
    }
  })
}

/**
 * Does the trickery required to update an elementized widget.
 * @param metadata
 * @param path
 * @return a BlueBird promise
 */
function putElementizedWidget(metadata, path) {

  // Check we have an elementized layout to send
  const template = readFile(path)
  const elementInstances = readJsonFile(figureUserElementInstancesPath(path)).elementInstances
  if (!template || !elementInstances.length) {
    info("emptyElementizedLayoutForWidget", {path: dirname(path)})
    return
  }

  if (inTransferMode()) {

    // In transfer mode, we always create a new element instance for each instance that is used in the template.
    // We do not attempt to reuse any existing instances as we cant guarantee these and we delete them at the very end.
    return getExistingElementInstances(metadata).then(existingInstances =>
      deleteElementInstances(metadata, existingInstances).then(() =>
        sendElementizedWidget(metadata, path)))
  } else {

    // Outside of transfer mode, things are less awkward.
    return sendElementizedWidget(metadata, path)
  }
}

/**
 * Blow away the supplied element instances that are marked for deletion.
 * @param instancesToDelete
 * @return {*}
 */
function deleteElementInstances(metadata, elementInstances) {

  return Promise.each(elementInstances, instance => {

    // Only try to delete the element if it is actually there.
    if (getElementByTag(instance.tag)) {

      // In non-transfer mode i.e. --put/--putAll, we delete element instances that are not in the template.
      // In transfer mode - previous instances are deleted and all replaced.
      !inTransferMode() && warn("deletingUnusedElementInstance", {tag : instance.tag})

      return endPointTransceiver.deleteFragment([metadata.repositoryId, instance.tag])
    }
  })
}

/**
 * Do the needful to get the supplied template back to the server.
 * @param path
 * @return
 */
function putWidgetInstanceTemplate(path) {

  // Template may not exist; silently return if it does not.
  return exists(path) && getWidgetAndWidgetInstanceMetadata(path).then(metadata => {
    if (metadata) {

      // Elementized widgets are updated via a different endpoint.
      // Version 1 web content instances are not elementized however.
      if (metadata.elementized && !(metadata.widgetType == "webContent" && metadata.instance.version == 1)) {
        return putElementizedWidget(metadata.instance, path)
      } else {
        // Just a plain ordinary widget.
        return putWidgetInstanceFile(metadata, path, "updateWidgetSourceCode")
      }
    }
  })
}

/**
 * Get the widget metadata (that is, the stuff we let people change) back to the server.
 * @param path
 */
function putWidgetModifiableMetadata(path) {

  return putMetadata(path, constants.widgetMetadataJson, "updateWidgetDescriptorMetadata", syncWidgetMetadata)
}

/**
 * Get the widget instance metadata (that is, the stuff we let people change) back to the server.
 * @param path
 */
function putWidgetInstanceModifiableMetadata(path) {

  // Firstly, make sure that we actually want to send widget instance metadata.
  if (shouldSendInstanceConfig()) {

    // See if endpoint exists - metadata endpoints are a recent innovation.
    if (!endPointTransceiver.serverSupports("updateWidgetMetadata")) {
      warn("widgetContentFileCannotBeSent", {path})
      return
    }

    return getWidgetAndWidgetInstanceMetadata(path).then(metadata => {

      if (metadata) {
        return endPointTransceiver.updateWidgetMetadata([metadata.instance.repositoryId],
          request().fromPathAsJSON(path, "metadata").withEtag(metadata.instance.etag)).tap(
          results => processPutResultAndEtag(path, results, syncWidgetInstanceMetadata))
      }
    })
  }
}

/**
 * This is fiddly. Users can change the display name of an instance which we store internally (because we need it).
 * So we need to make sure that the display name held by us is the same what the external metadata file says it is.
 * @param path
 */
function syncWidgetInstanceMetadata(path) {

  if (!inTransferMode()) {

    // Load up the display name value that the user can change.
    const displayName = readJsonFile(path).displayName

    // If there is a value (there should always be but play safe), use it to modify the internal metadata.
    displayName && updateMetadata(path, constants.widgetInstanceMetadataJson, {displayName})
  }
}

/**
 * This is fiddly. Users can change the display name of a widget which we store internally (because we need it).
 * So we need to make sure that the display name held by us is the same what the external metadata file says it is.
 * This is somewhat more complex in that widget names can be internationalized.
 * @param path
 */
function syncWidgetMetadata(path) {

  if (!inTransferMode()) {

    // Defensively load the translations array holding the display name value that the user can change.
    const translations = readJsonFile(path).translations

    if (translations) {

      // Look for a translation with the same name as the current working locale.
      const translation = translations.find(t => t.language == endPointTransceiver.locale)

      // If there is one (there should be) use it to update the value in the internal metadata.
      if (translation) {
        updateMetadata(path, constants.widgetMetadataJson, {displayName: translation.name})
      }
    }
  }
}

/**
 * Holds the boilerplate for getting a metadata file back to the server.
 * @param path
 * @param metadataType
 * @param endpoint
 * @param successCallback
 * @returns {Promise.<TResult>|*}
 */
function putMetadata(path, metadataType, endpoint, successCallback) {

  // See if endpoint exists - metadata endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports(endpoint)) {
    warn("widgetContentFileCannotBeSent", {path})
    return
  }

  return readMetadata(path, metadataType).then(metadata => {

    if (metadata) {
      return endPointTransceiver[endpoint]([metadata.repositoryId],
        request().fromPathAsJSON(path, "metadata").withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results, successCallback))
    }
  })
}

/**
 * Boilerplate for sending base widget content file to server.
 * @param path
 * @param endpoint
 * @returns {Promise.<TResult>|*}
 */
function putBaseWidgetFile(path, endpoint, field) {

  // See if endpoint exists - base endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports(endpoint)) {
    warn("widgetContentFileCannotBeSent", {path})
    return
  }

  // Get the metadata for the widget.
  return readMetadata(path, constants.widgetMetadataJson).then(metadata => {

    if (metadata) {
      return endPointTransceiver[endpoint]([metadata.repositoryId],
        `?updateInstances=${shouldUpdateInstances()}`,
        request().fromPathAs(path, field).withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results))
    }
  })
}

/**
 * Get the contents of the base template back to the server.
 * @param path
 */
function putWidgetBaseTemplate(path) {

  checkSyncWithInstances(path, constants.displayTemplate, readFile(path))
  return putBaseWidgetFile(path, "updateWidgetDescriptorBaseTemplate", "source")
}

/**
 * Need to ensure that if we want sync instances with base content that the file contents on disk match.
 * @param path
 * @param fileName
 */
function checkSyncWithInstances(path, fileName, contents) {

  // See if we are syncing the instances with the base resources.
  if (shouldUpdateInstances()) {

    // Walk through the instances directory, looking for suitable files.
    walkDirectory(`${getWidgetBaseDir(path)}/instances`, {
      listeners: {
        file: (root, fileStat, next) => {

          const fullPath = upath.resolve(root, fileStat.name)

          // Look for any corresponding instance content.
          if (fullPath.endsWith(fileName)) {

            // Make the instance file look like the base file.
            writeFile(fullPath, contents)
          }

          // Jump to the next file.
          next()
        }
      }
    })
  }
}

/**
 * Find the base directory for the widget from the path.
 * @param path
 * @returns {string}
 */
function getWidgetBaseDir(path) {

  const tokens = path.split("/")
  return tokens.slice(0, tokens.indexOf("widget") + 2).join("/")
}

/**
 * Get the contents of the base less file back to the server.
 * @param path
 */
function putWidgetBaseLess(path) {

  checkSyncWithInstances(path, constants.widgetLess, `${constants.widgetInstanceSubstitutionValue} {\n${readFile(path)}\n}\n`)
  return putBaseWidgetFile(path, "updateWidgetDescriptorBaseLess", "source")
}

/**
 * Get the contents of the config json back to the server.
 * @param path
 */
function putWidgetConfigJson(path) {

  return putMetadata(path, constants.widgetMetadataJson, "updateConfigMetadataForWidgetDescriptor")
}

/**
 * Get the contents of the config snippets json back to the server.
 * @param path
 */
function putWidgetConfigSnippets(path) {

  // See if endpoint exists - base endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports("updateConfigLocaleContentForWidgetDescriptor")) {
    warn("widgetContentFileCannotBeSent", {path})
    return
  }

  // Get the metadata for the widget.
  return readMetadata(path, constants.widgetMetadataJson).then(metadata => {

    if (metadata) {

      // Get the locale from the path.
      const tokens = path.split("/")
      const locale = basename(tokens[tokens.length - 1], ".json")

      return endPointTransceiver.updateConfigLocaleContentForWidgetDescriptor([metadata.repositoryId, locale],
        request().withLocale(locale).fromPathAsJSON(path, "localeData").withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results))
    }
  })
}

/**
 * Get the contents of the base snippets file back to the server.
 * @param path
 * @returns {Promise.<TResult>|*}
 */
function putWidgetBaseSnippets(path) {

  // See if endpoint exists - base endpoints are a recent innovation.
  if (!endPointTransceiver.serverSupports("updateWidgetDescriptorBaseLocaleContent")) {
    warn("widgetContentFileCannotBeSent", {path})
    return
  }

  // Get the metadata for the widget.
  return readMetadata(path, constants.widgetMetadataJson).then(metadata => {

    if (metadata) {

      // Get the locale from the path.
      const tokens = path.split("/")
      const locale = tokens[tokens.length - 2]

      // Make sure the instance content is sync'ed - if needbe.
      checkSyncWithInstances(path, `${locale}/${basename(path)}`, readFile(path))

      return endPointTransceiver.updateWidgetDescriptorBaseLocaleContent([metadata.repositoryId, locale],
        `?updateInstances=${shouldUpdateInstances()}`,
        request().withLocale(locale).fromPathAsJSON(path, "localeData").withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results))
    }
  })
}

/**
 * Web content instance templates are a bit special so we handle them here.
 * @param metadata
 * @param path
 * @returns A Bluebird promise.
 */
function putWebContentWidgetInstanceTemplate(path) {

  // Need the metadata first. Make sure template is actually there.
  return exists(path) && getWidgetAndWidgetInstanceMetadata(path).then(metadata => {

    // Get the name and notes first so we don't overwrite these.
    if (metadata) {
      return endPointTransceiver.getWidget([metadata.instance.repositoryId]).then(results => {

        // Build up the payload, using some data from the server.
        const payload = {
          widgetConfig: {
            name: results.data.name,
            notes: results.data.notes
          },
          content: readFile(path)
        }

        return endPointTransceiver.updateWidgetWebContent(
          [metadata.instance.repositoryId], request().withBody(payload).withEtag(metadata.etag)).tap(
          results => processPutResultAndEtag(path, results))
      })
    }
  })
}

/**
 * Send a widget JavaScript file back up to the server.
 * @param path
 * @returns A BlueBird promise.
 */
function putWidgetJavaScript(path) {

  // Get the base metadata for the widget.
  return readMetadata(path, constants.widgetMetadataJson).then(metadata => {

    if (metadata) {
      // Call the endpoint, passing in the widget ID and the base file name of the .js file.
      return endPointTransceiver.updateWidgetDescriptorJavascript(
        [metadata.repositoryId, basename(path)], request().fromPathAs(path, "source").withEtag(metadata.etag)).tap(
        results => processPutResultAndEtag(path, results))
    }
  })
}

/**
 * Do the needful to get the supplied widget instance less back on the server.
 * @param path
 */
function putWidgetInstanceLess(path) {

  return getWidgetAndWidgetInstanceMetadata(path).then(metadata => {
    if (metadata) {
      return putWidgetInstanceFile(metadata, path, "updateWidgetLess", true)
    }
  })
}

/**
 * Send the text snippets for the widget instance back to the server.
 * @param path
 * @returns a BlueBird promise.
 */
function putWidgetInstanceSnippets(path) {

  // Get the metadata.
  return getWidgetAndWidgetInstanceMetadata(path).then(metadata => {

    if (metadata) {

      // Get the locale from the path.
      const tokens = path.split("/")
      const locale = tokens[tokens.length - 2]
      const widgetInstanceId = metadata.instance.repositoryId

      let putSnippetsEndpoint = endPointTransceiver["updateWidgetCustomTranslations"]
      let endpointParams = [widgetInstanceId]

      // Prefer an endpoint that will lock at locale level if available.
      if (endPointTransceiver["updateWidgetCustomTranslationsForLocale"]) {
        putSnippetsEndpoint = endPointTransceiver["updateWidgetCustomTranslationsForLocale"]
        endpointParams = [widgetInstanceId, locale]
      }

      // Build up the payload. Need to chop off the enclosing key.
      const payload = {
        custom: readJsonFile(path).resources
      }

      // Make sure the user has not added any keys.
      checkForSnippetKeyMismatch(path, metadata, payload.custom)

      return putSnippetsEndpoint(endpointParams,
        request().withLocale(locale).withEtag(eTagFor(path)).withBody(payload)).tap(
        results => processPutResultAndEtag(path, results))
    }
  })
}

/**
 * Holds the boilerplate associated with getting a widget instance file back on the server.
 * @param metadata
 * @param path
 * @param endpoint
 * @param transform
 * @returns A Bluebird promise
 */
function putWidgetInstanceFile(metadata, path, endpoint, transform) {

  // Build the basic body.
  const body = request().fromPathAs(path, "source").withEtag(metadata.etag)

  // See if we need to transform the contents before sending.
  if (transform) {

    // Replace the substitution value in the file with the IDs on the target system.
    body.replacing(constants.widgetInstanceSubstitutionValue,
      `#${metadata.instance.descriptorRepositoryId}-${metadata.instance.repositoryId}`)
  }

  return endPointTransceiver[endpoint]([metadata.instance.repositoryId], `?suppressThemeCompile=${shouldSuppressThemeCompile()}`, body).tap(
    results => processPutResultAndEtag(path, results))
}

/**
 * Try to get the metadata for a widget instance - by hook or by crook.
 * @param path
 * @param widgetMetadata
 * @returns A BlueBird promise.
 */
function getWidgetInstanceMetadata(path, widgetMetadata) {

  // Load the metadata for the widget instance.
  return readMetadata(path, constants.widgetInstanceMetadataJson).then(widgetInstanceMetadata => {

    // Looks like we have metadata but check it actually exists on the server - someone could have deleted it.
    if (widgetInstanceMetadata && getCachedWidgetInstanceFromMetadata(widgetInstanceMetadata)) {

      widgetMetadata.instance = widgetInstanceMetadata
      return widgetMetadata

      // We have a widget but no instance. Create the instance, then load the metadata.
    } else {

      warn("creatingWidgetInstance", {path: path})

      return createMatchingWidgetInstance(widgetMetadata, path).then(() => {

        // Make sure instance got created. There are certain edge cases when this could fail so deal with it.
        const existingMetadata = readMetadataFromDisk(path, constants.widgetInstanceMetadataJson, true)
        if (!getCachedWidgetInstanceFromMetadata(existingMetadata)) {
          error("failedToCreateInstance", {name: existingMetadata.displayName})
          return null
        }

        // If we are not in transfer mode, need to reset the etag for the file.
        !inTransferMode() && writeDummyEtag(path)

        // Now the instance exists, can load the metadata.
        return readMetadata(path, constants.widgetInstanceMetadataJson).then(widgetInstanceMetadata => {

          widgetMetadata.instance = widgetInstanceMetadata
          return widgetMetadata
        })
      })
    }
  })
}

/**
 * Using the path to a widget instance file, find the metadata.
 * @param path
 */
function getWidgetAndWidgetInstanceMetadata(path) {

  // Load the metadata for the base widget.
  return readMetadata(path, constants.widgetMetadataJson).then(widgetMetadata => {

    if (widgetMetadata) {

      return getWidgetInstanceMetadata(path, widgetMetadata)
    } else {

      // This can happen in transfer mode.
      warn("cannotUpdateWidget", {path})
      return null
    }
  })
}

/**
 * Create a widget instance of the same name as that given in the path.
 * @param widgetMetadata
 * @param path
 */
function createMatchingWidgetInstance(widgetMetadata, path, updateCache = true) {

  // Get the metadata for the local instance.
  const localWidgetInstanceMetadata = readMetadataFromDisk(path, constants.widgetInstanceMetadataJson)

  const displayName = localWidgetInstanceMetadata.displayName
  const safeDisplayName = `${displayName} (Renamed ${new Date().toISOString()})`

  // Set up the JSON for the clone.
  const payload = {
    widgetDescriptorId: widgetMetadata.widgetType,
    displayName: displayName
  }

  // Firstly, clone an instance of the same name then update the cache so it
  // now contains info on the new widget.  By default return results but if
  // we got a status error then we want to return a 'retry promise'.  We can
  // only do the auto-fix if the server supports the endpoint so need to
  // check for that too.
  if (endPointTransceiver.serverSupports("createWidgetInstanceAtVersion")) {

    // Pull in the version we want to create which is required for the
    // new endpoint.
    payload.version = localWidgetInstanceMetadata.version

    return endPointTransceiver.createWidgetInstanceAtVersion([], request().withBody(payload))
      .then((results) => {
        if (inTransferMode() && autoFix()
          && results.response.statusCode === 400 && results.data.errorCode == '33011') {

          // Widget instance with same name already exists.. need to deal with it.
          warn('renameWidgetInstanceWarning', {name: displayName})

          // Need to find the conflicting instance by name as we'll need the
          // repo ID to call the endpoint.
          const existingInstance =
            findCachedWidgetInstanceMatchingDisplayName(localWidgetInstanceMetadata)

          const updateMetaPayload = {
            metadata: {
              displayName: safeDisplayName,
            }
          }

          if (existingInstance) {
            return endPointTransceiver.updateWidgetMetadata([existingInstance.repositoryId],
              request().withBody(updateMetaPayload))
              .tap(results => processPutResultAndEtag(path, results, syncWidgetInstanceMetadata))
              .then(() => {
                return endPointTransceiver.createWidgetInstanceAtVersion([], request().withBody(payload))
                  .then(() => updateCache && cacheWidgetInstances())
              })
          }
        }

        // Otherwise we can proceed as normal.
        if (updateCache) {
          cacheWidgetInstances()
        }

        return results
      })
  } else {

    // This is the old method were we create a widget instance of the latest
    // version. It might be the wrong thing now but we can only do the new
    // method and auto-fix if the server supports it. Retaining this code
    // for backwards compat.
    return endPointTransceiver.createWidgetInstance([], request().withBody(payload))
      .then(() => updateCache && cacheWidgetInstances())
  }
}

/**
 * This is for when the widget does not exist on the target server and so needs to be created.
 * @param path
 */
function putWidget(path) {

  // Get the metadata for the widget.
  const localWidgetMetadata = readMetadataFromDisk(path, constants.widgetMetadataJson)

  // If we grabbed a non-Oracle widget from a pre-17.6 system there will not be enough information to create it again.
  // This is an edge case but we need to do the right thing.
  if (localWidgetMetadata.source !== 101) {
    warn("insufficientInfoToCreateWidget", {widgetName: localWidgetMetadata.displayName})
    return
  }

  // Need element endpoint to - make sure it exists.
  if (!endPointTransceiver.serverSupports("getElements")) {
    warn("widgetCannotBeCreated", {path})
    return
  }

  // Need to reset the etags for the widget.
  resetEtagsFor(path)

  // Call the widget creator to do the business.
  return createWidgetInExtension(localWidgetMetadata.displayName, localWidgetMetadata.widgetType, localWidgetMetadata.global, path, false)
}

/**
 * Send a widget JavaScript file back up to the server.
 * @param path
 * @returns A BlueBird promise.
 */
function putWidgetModuleJavaScript(path) {

  return readMetadata(path, constants.widgetMetadataJson).then(metadata => {

    if (metadata) {
      if (inTransferMode()) {

        // Er.. If we're in transfer mode then things are slightly different...
        // We can't rely on the etag so we need to try and create the extension module
        // and if that fails because it already exists we'll update the existing one.
        // (A future server change will be made to streamline this API.)
        // Call the endpoint, passing in the widget ID and the base file name of the .js file.
        return endPointTransceiver.createWidgetDescriptorJavascriptExtension(
          [metadata.repositoryId, basename(path)], request().fromPathAs(path, "source").ignoring(409)).tap(
            (results) => processPutResultAndEtag(path, results))
          .then((results) => {

            if (results.response.statusCode == 409) {
              return endPointTransceiver.updateWidgetDescriptorJavascriptExtension(
                [metadata.repositoryId, basename(path)], request().fromPathAs(path, "source").withEtag(metadata.etag)).tap(
                  (results) => processPutResultAndEtag(path, results))
            } else {
              return results
            }
          })
      }

      // Get the base metadata for the widget.
      const moduleEtag = eTagFor(path)

      if (moduleEtag) {
        // Call the endpoint, passing in the widget ID and the base file name of the .js file.
        return endPointTransceiver.updateWidgetDescriptorJavascriptExtension(
          [metadata.repositoryId, basename(path)], request().fromPathAs(path, "source").withEtag(metadata.etag)).tap(
            (results) => processPutResultAndEtag(path, results))
      } else {

        // OK this is a new module, create the tracking directory and
        // call the create endpoint, passing in the widget ID and the base file name of the .js file.
        makeTrackingDirTree(path)

        return endPointTransceiver.createWidgetDescriptorJavascriptExtension(
          [metadata.repositoryId, basename(path)], request().fromPathAs(path, "source")).tap(
            (results) => processPutResultAndEtag(path, results))
      }
    }
  })
}

/**
 * Find all etags associated with the supplied path and reset them.
 * @param path
 */
function resetEtagsFor(path) {

  // Chop the directory up so we can insert the tracking dir.
  const splitDirs = splitFromBaseDir(path)
  const baseDir = splitDirs[0], subDir = splitDirs[1]

  // Walk through the tracking dir looking for etags.
  walkDirectory(`${baseDir}/${constants.trackingDir}/${subDir}`, {
    listeners: {
      file: (root, fileStat, next) => {

        const fullPath = upath.resolve(root, fileStat.name)

        // Replace any etag files with dummies.
        if (fullPath.endsWith(constants.etagSuffix)) {
          resetEtag(fullPath)
        }

        // Jump to the next file.
        next()
      }
    }
  })
}

/**
 * Look and see if the widget instance exists. If not, reset the etag files then we create the instance on the server.
 * @param path
 */
function putWidgetInstance(path) {

  // Get the metadata for the widget.
  const localWidgetInstanceMetadata = readMetadataFromDisk(path, constants.widgetInstanceMetadataJson)

  // See if it exists on the server.
  if (!getCachedWidgetInstanceFromMetadata(localWidgetInstanceMetadata)) {

    // Make sure the etags are sorted as we don't want opt lock issues later.
    resetEtagsFor(path)

    // Now create the instance on the server but don't update the cache; we will do that at the end.
    const widgetMetadata = readMetadataFromDisk(path, constants.widgetMetadataJson)

    warn("creatingWidgetInstance", {path: path})

    return createMatchingWidgetInstance(widgetMetadata, path, false)
  }
}

/**
 * Put the element instance metadata - as this is only for elementized widgets,
 * this has to be done by combining it with an update to the display template.
 * @param path
 * @return {*}
 */
function putElementInstanceMetadata(path) {

  // This will be handled by the display template update.
  return putWidgetInstanceTemplate(`${dirname(path)}/${constants.displayTemplate}`)
}

exports.putElementInstanceMetadata = putElementInstanceMetadata
exports.putWebContentWidgetInstanceTemplate = putWebContentWidgetInstanceTemplate
exports.putWidget = putWidget
exports.putWidgetBaseTemplate = putWidgetBaseTemplate
exports.putWidgetBaseLess = putWidgetBaseLess
exports.putWidgetBaseSnippets = putWidgetBaseSnippets
exports.putWidgetConfigJson = putWidgetConfigJson
exports.putWidgetConfigSnippets = putWidgetConfigSnippets
exports.putWidgetInstance = putWidgetInstance
exports.putWidgetInstanceLess = putWidgetInstanceLess
exports.putWidgetInstanceSnippets = putWidgetInstanceSnippets
exports.putWidgetInstanceTemplate = putWidgetInstanceTemplate
exports.putWidgetJavaScript = putWidgetJavaScript
exports.putWidgetModuleJavaScript = putWidgetModuleJavaScript
exports.putWidgetModifiableMetadata = putWidgetModifiableMetadata
exports.putWidgetInstanceModifiableMetadata = putWidgetInstanceModifiableMetadata
