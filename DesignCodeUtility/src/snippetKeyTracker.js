const constants = require("./constants").constants
const normalize = require("./utils").normalize
const readJsonFile = require("./utils").readJsonFile
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const updateMetadata = require("./metadata").updateMetadata
const warn = require("./logger").warn

// For performance reasons at grab time, need to avoid processing the same set of keys over and over again at grab time.
const grabbedWidgets = new Set()

// Also for performance reasons, need to avoid gathering up information we already have at put/transfer time.
const userCreatedWidgetExpectedKeyCountMap = new Map()
const oracleSuppliedWidgetExpectedKeyCountMap = new Map()

/**
 * At grab time, for an Oracle supplied instance, record information about the text snippet keys,
 * if we have not already done so. This can be used to detect later user errors.
 * @param path
 */
function saveTrackingInformation(widgetInstanceDir, widgetInstance, snippetKeys) {

  // If we have already processed this widget, we can stop here.
  if (grabbedWidgets.has(widgetInstance.repositoryId)) {
    return
  }

  // Store the key count in the tracking directory for later use.
  updateMetadata(widgetInstanceDir, constants.widgetInstanceMetadataJson,
    {
      snippetKeyCount: snippetKeys.length,
      source: widgetInstance.descriptor.source
    })

  // Remember that we have processed this.
  grabbedWidgets.add(widgetInstance.repositoryId)
}

/**
 * Given a path to snippet instance file, find the base file.
 * @param path
 * @return {number}
 */
function determineBaseKeyCount(path) {

  // Path will be something like widget/Incomplete/instances/Incomplete Instance/locales/el/ns.incomplete.json.
  // Want to turn it into widget/Incomplete/instances/Incomplete Instance/../../locales/el/ns.incomplete.json
  // so we replace the last occurrence of locales with ../../locales.
  // Normalize the path so we can guarantee what it looks like.
  const normalizedPath = normalize(path)
  const locales = "locales";
  const lastIndex = normalizedPath.lastIndexOf(locales)
  const baseJsonSnippets = readJsonFile(
      `${normalizedPath.substring(0, lastIndex)}../../locales${normalizedPath.substring(lastIndex + locales.length)}`)

  return Object.keys(baseJsonSnippets.resources).length
}

/**
 * At put time, when we are sending up text snippets, make sure the user has not added any snippet keys that
 * are not in the base set as the endpoint will ignore these.
 * @param path
 * @param metadata
 * @param snippets
 */
function checkForSnippetKeyMismatch(path, metadata, snippets) {

  // See if the snippets counts match.
  const expectedKeyCount = getExpectedKeyCount(path, metadata)
  if (Object.keys(snippets).length > expectedKeyCount) {

    // Put out a different message for Oracle supplied widgets vs user created widgets.
    warn("widgetInstanceSnippetKeyCountMismatch",
      {
        path,
        expectedKeyCount: expectedKeyCount,
        actualKeyCount: Object.keys(snippets).length
      })
  }
}

/**
 * Figure out what number of keys we would expect a widget instance text snippets file to contain.
 * For Oracle supplied widgets, this cannot change but for user created widgets this can change any time.
 * @param path
 * @param metadata
 * @return the expected number of text snippet keys.
 */
function getExpectedKeyCount(path, metadata) {

  // Firstly, see if the expected key count is to hand. Try user created widgets first.
  if (userCreatedWidgetExpectedKeyCountMap.has(metadata.repositoryId)) {

    return userCreatedWidgetExpectedKeyCountMap.get(metadata.repositoryId)

    // No luck with user created widget. Try instances of Oracle supplied widgets.
  } else if (oracleSuppliedWidgetExpectedKeyCountMap.has(metadata.instance.repositoryId)) {

    return oracleSuppliedWidgetExpectedKeyCountMap.get(metadata.instance.repositoryId)
  } else {

    // We haven't seen this widget instance or its base before. Load the disk metadata to see what kind of widget it is.
    const diskMetadata = readMetadataFromDisk(path, constants.widgetInstanceMetadataJson, true)

    // See if widget is Oracle supplied. If so, the snippet key count should be in the disk metadata as it was saved
    // previously on the grab.
    if (diskMetadata.source === 100) {

      // Save the value in the map so we don't have to do all this again and return the value to the caller.
      oracleSuppliedWidgetExpectedKeyCountMap.set(metadata.instance.repositoryId, diskMetadata.snippetKeyCount)
      return diskMetadata.snippetKeyCount
    } else {

      // Widget is user created. Need the snippet key count for the base widget.
      const baseKeyCount = determineBaseKeyCount(path)

      // Save the value in the map so we don't have to do this again and return the value to the caller.
      userCreatedWidgetExpectedKeyCountMap.set(metadata.repositoryId, baseKeyCount)
      return baseKeyCount
    }
  }
}

exports.checkForSnippetKeyMismatch = checkForSnippetKeyMismatch
exports.saveTrackingInformation = saveTrackingInformation
