const Promise = require("bluebird")
const upath = require("upath")

const ELEMENT_TEMPLATE_SAFE_LIMIT = require("./concurrencySettings").ELEMENT_TEMPLATE_SAFE_LIMIT
const STACK_BASE_SAFE_LIMIT = require("./concurrencySettings").STACK_BASE_SAFE_LIMIT
const WIDGET_LESS_SAFE_LIMIT = require("./concurrencySettings").WIDGET_LESS_SAFE_LIMIT

const cacheGlobalElements = require("./metadata").cacheGlobalElements
const cacheSiteSettings = require("./metadata").cacheSiteSettings
const cacheStackDescriptors = require("./metadata").cacheStackDescriptors
const cacheStackInstances = require("./metadata").cacheStackInstances
const cacheThemes = require("./metadata").cacheThemes
const cacheWidgetDescriptors = require("./metadata").cacheWidgetDescriptors
const cacheWidgetElements = require("./metadata").cacheWidgetElements
const cacheWidgetInstances = require("./metadata").cacheWidgetInstances
const classify = require("./classifier").classify
const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const exists = require("./utils").exists
const getPuttingConcurrency = require("./concurrencySettings").getPuttingConcurrency
const getPathsBlock = require("./puttingPathsBlock").getPathsBlock
const info = require("./logger").info
const initializeMetadata = require("./metadata").initializeMetadata
const isDirectory = require("./utils").isDirectory
const inTransferMode = require("./state").inTransferMode
const normalize = require("./utils").normalize
const putGlobalSnippets = require("./textSnippetPutter").putGlobalSnippets
const readMetadata = require("./metadata").readMetadata
const putWidgetAdditionalFile = require("./widgetAdditionalFilesPutter").putWidgetAdditionalFile
const putWidgetAdditionalLessFile = require("./widgetAdditionalFilesPutter").putWidgetAdditionalLessFile
const putWidgetAdditionalTemplateFile = require("./widgetAdditionalFilesPutter").putWidgetAdditionalTemplateFile
const putApplicationJavaScript = require("./applicationJavaScriptPutter").putApplicationJavaScript
const putElementInstanceMetadata = require("./widgetPutter").putElementInstanceMetadata
const putElementJavaScript = require("./elementPutter").putElementJavaScript
const putElementMetadata = require("./elementPutter").putElementMetadata
const putElementTemplate = require("./elementPutter").putElementTemplate
const putFrameworkDirectory = require("./frameworkPutter").putFrameworkDirectory
const putFrameworkFile = require("./frameworkPutter").putFrameworkFile
const putGlobalElement = require("./elementPutter").putGlobalElement
const putGlobalElementJavaScript = require("./elementPutter").putGlobalElementJavaScript
const putGlobalElementMetadata = require("./elementPutter").putGlobalElementMetadata
const putGlobalElementTemplate = require("./elementPutter").putGlobalElementTemplate
const putStack = require("./stackPutter").putStack
const putStackBaseTemplate = require("./stackPutter").putStackBaseTemplate
const putStackBaseLess = require("./stackPutter").putStackBaseLess
const putStackBaseLessVariables = require("./stackPutter").putStackBaseLessVariables
const putStackModifiableMetadata = require("./stackPutter").putStackModifiableMetadata
const putStackInstance = require("./stackPutter").putStackInstance
const putStackInstanceLess = require("./stackPutter").putStackInstanceLess
const putStackInstanceLessVariables = require("./stackPutter").putStackInstanceLessVariables
const putStackInstanceTemplate = require("./stackPutter").putStackInstanceTemplate
const putStackInstanceModifiableMetadata = require("./stackPutter").putStackInstanceModifiableMetadata
const putSiteSettings = require("./siteSettingsPutter").putSiteSettings
const putSiteSettingsValues = require("./siteSettingsPutter").putSiteSettingsValues
const putTheme = require("./themePutter").putTheme
const putThemeAdditionalStyles = require("./themePutter").putThemeAdditionalStyles
const putThemeStyles = require("./themePutter").putThemeStyles
const putThemeVariables = require("./themePutter").putThemeVariables
const puttingDirectoryWalker = require("./puttingDirectoryWalker").puttingDirectoryWalker
const putWebContentWidgetInstanceTemplate = require("./widgetPutter").putWebContentWidgetInstanceTemplate
const putWidgetInstanceLess = require("./widgetPutter").putWidgetInstanceLess
const putWidget = require("./widgetPutter").putWidget
const putWidgetBaseTemplate = require("./widgetPutter").putWidgetBaseTemplate
const putWidgetBaseLess = require("./widgetPutter").putWidgetBaseLess
const putWidgetBaseSnippets = require("./widgetPutter").putWidgetBaseSnippets
const putWidgetConfigJson = require("./widgetPutter").putWidgetConfigJson
const putWidgetConfigSnippets = require("./widgetPutter").putWidgetConfigSnippets
const putWidgetInstance = require("./widgetPutter").putWidgetInstance
const putWidgetInstanceModifiableMetadata = require("./widgetPutter").putWidgetInstanceModifiableMetadata
const putWidgetInstanceSnippets = require("./widgetPutter").putWidgetInstanceSnippets
const putWidgetInstanceTemplate = require("./widgetPutter").putWidgetInstanceTemplate
const putWidgetJavaScript = require("./widgetPutter").putWidgetJavaScript
const putWidgetModifiableMetadata = require("./widgetPutter").putWidgetModifiableMetadata
const PuttingFileType = require("./puttingFileType").PuttingFileType
const compareElements = require("./elementSorter").compareElements
const walkDirectory = require("./utils").walkDirectory
const warn = require("./logger").warn
const widgetInstanceExistsOnTarget = require("./metadata").widgetInstanceExistsOnTarget
const putWidgetModuleJavaScript = require("./widgetPutter").putWidgetModuleJavaScript

/**
 * If we cannot handle a particular type of file, call it out to the user.
 */
const warnUnsupportedFileType = Promise.method(path => warn("unsupportedPutOrTransfer", {path}))

// Mapping between file type and putter method.
const putterMap = new Map([
  [PuttingFileType.FRAMEWORK_DIRECTORY, putFrameworkDirectory],
  [PuttingFileType.FRAMEWORK_FILE, putFrameworkFile],
  [PuttingFileType.APPLICATION_LEVEL_JAVASCRIPT, putApplicationJavaScript],
  [PuttingFileType.WIDGET_INSTANCE_TEMPLATE, putWidgetInstanceTemplate],
  [PuttingFileType.WEB_CONTENT_TEMPLATE, putWebContentWidgetInstanceTemplate],
  [PuttingFileType.WIDGET_INSTANCE_LESS, putWidgetInstanceLess],
  [PuttingFileType.WIDGET_INSTANCE_SNIPPETS, putWidgetInstanceSnippets],
  [PuttingFileType.WIDGET_JAVASCRIPT, putWidgetJavaScript],
  [PuttingFileType.WIDGET_MODULE_JAVASCRIPT, putWidgetModuleJavaScript],
  [PuttingFileType.ELEMENT_INSTANCE_METADATA, putElementInstanceMetadata],
  [PuttingFileType.ELEMENT_TEMPLATE, putElementTemplate],
  [PuttingFileType.ELEMENT_METADATA, putElementMetadata],
  [PuttingFileType.ELEMENT_JAVASCRIPT, putElementJavaScript],
  [PuttingFileType.GLOBAL_ELEMENT, putGlobalElement],
  [PuttingFileType.GLOBAL_ELEMENT_METADATA, putGlobalElementMetadata],
  [PuttingFileType.GLOBAL_ELEMENT_TEMPLATE, putGlobalElementTemplate],
  [PuttingFileType.GLOBAL_ELEMENT_JAVASCRIPT, putGlobalElementJavaScript],
  [PuttingFileType.THEME_STYLES, putThemeStyles],
  [PuttingFileType.THEME_ADDITIONAL_STYLES, putThemeAdditionalStyles],
  [PuttingFileType.THEME_VARIABLES, putThemeVariables],
  [PuttingFileType.GLOBAL_SNIPPETS, putGlobalSnippets],
  [PuttingFileType.STACK, putStack],
  [PuttingFileType.STACK_BASE_TEMPLATE, putStackBaseTemplate],
  [PuttingFileType.STACK_BASE_LESS, putStackBaseLess],
  [PuttingFileType.STACK_BASE_VARIABLES_LESS, putStackBaseLessVariables],
  [PuttingFileType.STACK_METADATA_JSON, putStackModifiableMetadata],
  [PuttingFileType.STACK_INSTANCE, putStackInstance],
  [PuttingFileType.STACK_INSTANCE_LESS, putStackInstanceLess],
  [PuttingFileType.STACK_INSTANCE_VARIABLES_LESS, putStackInstanceLessVariables],
  [PuttingFileType.STACK_INSTANCE_TEMPLATE, putStackInstanceTemplate],
  [PuttingFileType.STACK_INSTANCE_METADATA_JSON, putStackInstanceModifiableMetadata],
  [PuttingFileType.THEME, putTheme],
  [PuttingFileType.WIDGET, putWidget],
  [PuttingFileType.WIDGET_INSTANCE, putWidgetInstance],
  [PuttingFileType.WIDGET_METADATA_JSON, putWidgetModifiableMetadata],
  [PuttingFileType.WIDGET_INSTANCE_METADATA_JSON, putWidgetInstanceModifiableMetadata],
  [PuttingFileType.WIDGET_BASE_TEMPLATE, putWidgetBaseTemplate],
  [PuttingFileType.WIDGET_BASE_LESS, putWidgetBaseLess],
  [PuttingFileType.WIDGET_BASE_SNIPPETS, putWidgetBaseSnippets],
  [PuttingFileType.WIDGET_CONFIG_JSON, putWidgetConfigJson],
  [PuttingFileType.WIDGET_CONFIG_SNIPPETS, putWidgetConfigSnippets],
  [PuttingFileType.THEME_ADDITIONAL_FILE, warnUnsupportedFileType],
  [PuttingFileType.STACK_ADDITIONAL_FILE, warnUnsupportedFileType],
  [PuttingFileType.WIDGET_INSTANCE_ADDITIONAL_FILE, warnUnsupportedFileType],
  [PuttingFileType.WIDGET_ADDITIONAL_FILE, putWidgetAdditionalFile],
  [PuttingFileType.WIDGET_ADDITIONAL_LESS_FILE, putWidgetAdditionalLessFile],
  [PuttingFileType.WIDGET_ADDITIONAL_TEMPLATE_FILE, putWidgetAdditionalTemplateFile],
  [PuttingFileType.ELEMENT_ADDITIONAL_FILE, warnUnsupportedFileType],
  [PuttingFileType.SITE_SETTINGS_METADATA, warnUnsupportedFileType],
  [PuttingFileType.SITE_SETTINGS_SNIPPETS, warnUnsupportedFileType],
  [PuttingFileType.SITE_SETTINGS_VALUES, putSiteSettingsValues]
])

/**
 * Given a set of new themes, create them concurrently.
 * @param newThemeSet
 * @param node
 * @return {*}
 */
function createNewThemes(newThemeSet, node) {

  // Ony want to refresh the cache if something actually changed.
  let dirty = false

  return Promise.map(newThemeSet, newTheme => {

    dirty = true

    info("sendingPath", {path: newTheme, node})
    return putTheme(newTheme)
  }, getPuttingConcurrency()).then(() => dirty && cacheThemes())
}

/**
 * This function is called to call the putter for the previously classified supplied path in an concurrent way.
 * @param paths
 * @param node
 * @param pathTypeMap
 * @param concurrency - allow caller to override the concurrency.
 * @return {*}
 */
function updatePaths(paths, node, pathTypeMap, concurrency) {

  return Promise.map(paths, path => {

    info("sendingPath", {path, node})

    // We have already classified the path so use it to get the putter from the map.
    const putterFunction = putterMap.get(pathTypeMap.get(path))
    return putterFunction(path)
  }, getPuttingConcurrency(concurrency))
}

/**
 * Do new global elements as a group as these will be later needed by widgets.
 * @param newElementSet
 * @param node
 * @return {*}
 */
function createNewGlobalElements(newElementSet, node) {

  // Only want to refresh the cache if something actually changed.
  let dirty = false

  // Need to sort these as elements can refer to each other - this also means that they can't be sent in parallel!
  return Promise.each(Array.from(newElementSet).sort(compareElements), newElementPath => {

    dirty = true

    info("sendingPath", {path: newElementPath, node})
    return putGlobalElement(newElementPath)
  }).then(() => dirty && cacheGlobalElements())
}

/**
 * Given a set of new widgets, create them concurrently.
 * @param newWidgetSet
 * @param node
 * @return {*}
 */
function createNewWidgets(newWidgetSet, node) {

  // Only want to refresh the cache if something actually changed.
  let dirty = false

  return Promise.map(newWidgetSet, newWidget => {

    dirty = true

    info("sendingPath", {path: newWidget, node})
    return putWidget(newWidget)
  }, getPuttingConcurrency()).then(() => {

    if (dirty) {
      return cacheWidgetDescriptors().then(() => cacheWidgetElements())
    }
  })
}

/**
 * Given a set of new site settings, create them concurrently.
 * @param newSiteSettingsSet
 * @param node
 * @return {*}
 */
function createNewSiteSettings(newSiteSettingsSet, node) {

  // Only want to refresh the cache if something actually changed.
  let dirty = false

  return Promise.map(newSiteSettingsSet, newSiteSettings => {

    dirty = true

    info("sendingPath", {path: newSiteSettings, node})
    return putSiteSettings(newSiteSettings)
  }, getPuttingConcurrency()).then(() => {

    if (dirty) {
      return cacheSiteSettings()
    }
  })
}

/**
 * Given a set of widget instances, create any missing ones concurrently.
 * @param widgetInstancePaths
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function checkForNewWidgetInstances(widgetInstancePaths) {

  // Only want to refresh the cache if something actually changed.
  let dirty = false

  return Promise.map(widgetInstancePaths, widgetInstancePath => {

    dirty = true

    return putWidgetInstance(widgetInstancePath)
  }, getPuttingConcurrency()).then(() => dirty && cacheWidgetInstances())
}

/**
 * Given a set of new stacks, create them concurrently.
 * @param newThemeSet
 * @param node
 * @return {*}
 */
function createNewStacks(newStackSet, node) {

  // Only want to refresh cache if we need to.
  let dirty = false

  return Promise.map(newStackSet, newStack => {

    dirty = true

    info("sendingPath", {path: newStack, node})
    return putStack(newStack)
  }, getPuttingConcurrency()).then(() => dirty && cacheStackDescriptors())
}

/**
 * Walk through all the stack instance dirs doing some housekeeping.
 * @param stackInstanceDirs
 * @return {undefined}
 */
function checkForNewStackInstances(stackInstanceDirs) {

  // Only want to refresh cache if we need to.
  let dirty = false

  return Promise.map(stackInstanceDirs, stackInstancePath => {

    dirty = true

    return putStackInstance(stackInstancePath)
  }, getPuttingConcurrency()).then(() => dirty && cacheStackInstances())
}

/**
 * Break the target directory up into smaller pieces so we can send it in a suitable order.
 * @param path
 * @return a path type map to stop us running classify() again and a block of paths.
 */
function shredTargetDirectory(path) {

  // Keep a track of all the found paths. In some cases, we want to keep items of the same type together.
  const paths = getPathsBlock(),
    pathTypeMap = new Map()

  // Need to intercept widget instance directories.
  classify(path) === PuttingFileType.WIDGET_INSTANCE && paths.widgetInstanceDirs.push(upath.resolve(path))

  // Same for stack instance directories.
  classify(path) === PuttingFileType.STACK_INSTANCE && paths.stackInstanceDirs.push(upath.resolve(path))

  // Walk through the supplied directory, looking at all the files.
  walkDirectory(path, puttingDirectoryWalker(pathTypeMap, paths))

  return {paths, pathTypeMap}
}

/**
 * Send the contents of all the files found beneath the given directory
 * to the appropriate place on the server.
 * @param path
 * @param node
 */
exports.putAll = function (path, node) {

  // Break the directory up into manageable chunks.
  const {paths, pathTypeMap} = shredTargetDirectory(path)

  // Send stuff in a controlled order.
  return createNewThemes(paths.newThemeSet, node)
    .then(() => createNewSiteSettings(paths.newSiteSettingsSet, node))
    .then(() => updatePaths(paths.existingThemePaths, node, pathTypeMap, 1)) // Need to update themes singly as etags are shared.
    .then(() => createNewStacks(paths.newStackSet, node))
    .then(() => checkForNewStackInstances(paths.stackInstanceDirs))
    .then(() => updatePaths(paths.stackInstancePaths, node, pathTypeMap))
    .then(() => createNewGlobalElements(paths.newElementSet, node))
    .then(() => createNewWidgets(paths.newWidgetSet, node))
    .then(() => checkForNewWidgetInstances(paths.widgetInstanceDirs))
    .then(() => Promise.all([
      updatePaths(paths.otherPaths, node, pathTypeMap, 1),
      // Widget less/element templates/stack base updated singly for now.
      updatePaths(paths.widgetLessPaths, node, pathTypeMap, WIDGET_LESS_SAFE_LIMIT),
      updatePaths(paths.elementTemplatePaths, node, pathTypeMap, ELEMENT_TEMPLATE_SAFE_LIMIT),
      updatePaths(paths.stackBasePaths, node, pathTypeMap, STACK_BASE_SAFE_LIMIT)
    ]))
}

/**
 * Send the file given by path to the server using the appropriate putter.
 * @param path
 * @param node
 * @returns A Bluebird promise or undefined.
 */
function send(path, node) {

  info("sendingPath", {path, node})

  // Find a putter for the file type.
  const putterFunction = putterMap.get(classify(path))

  // There should always be a putter but make sure.
  if (putterFunction) {
    return putterFunction(path)
  } else {
    warn("fileIsNotRecognized", {name: path})
  }
}

/**
 * Entry point. Send the contents of the file or files given by path to the appropriate
 * place on the server.
 * @param rawPath
 * @param node
 * @param all
 */
exports.put = function (rawPath, node, all) {

  // Normalize the path in case its in windows format.
  const path = normalize(rawPath)

  // Make sure file actually exists.
  if (!exists(path)) {
    error("pathDoesNotExist", {path})
    return
  }

  // If we are doing a putAll or transferAll, path must be a directory.
  if (all && !isDirectory(path)) {
    error("pathIsNotDirectory", {path})
    return
  }

  // Initialize the metadata first.
  return initializeMetadata().then(() => {
    return readMetadata(path, constants.configMetadataJson).then(configMetadata => {

      // Check config.json and make sure we are putting to the same system we grabbed from.
      if (configMetadata.node !== node && !inTransferMode()) {
        error("cannotSendToDifferentNode", {
          path,
          node,
          configMetadataNode: configMetadata.node
        }, "Invalid Operation")
        return
      }

      // We are transferring between different servers. Need to do a few extra checks.
      if (inTransferMode()) {

        // Servers must be at the same version.
        if (configMetadata.commerceCloudVersion !== endPointTransceiver.commerceCloudVersion) {
          error("cannotSendToDifferentVersion", {
            path,
            node,
            configMetadataNode: configMetadata.node,
            configMetadataVersion: configMetadata.commerceCloudVersion,
            targetVersion: endPointTransceiver.commerceCloudVersion
          })

          return
        }

        // Servers must be different.
        if (configMetadata.node === node) {

          error("cannotSendToSameNode", {path, node})
          return
        }
      }

      // See if we are sending one file or a whole lot.
      if (all) {
        return exports.putAll(path, node)
      } else {
        return send(path, node)
      }
    })
  })
}
