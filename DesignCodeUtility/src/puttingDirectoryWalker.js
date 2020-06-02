const dirname = require('path').dirname
const upath = require("upath")

const elementExistsOnTarget = require("./metadata").elementExistsOnTarget
const constants = require("./constants").constants
const classify = require("./classifier").classify
const getPathsBlock = require("./puttingPathsBlock").getPathsBlock
const PuttingFileType = require("./puttingFileType").PuttingFileType
const siteSettingsExistOnTarget = require("./metadata").siteSettingsExistOnTarget
const stackExistsOnTarget = require("./metadata").stackExistsOnTarget
const themeExistsOnTarget = require("./metadata").themeExistsOnTarget
const widgetExistsOnTarget = require("./metadata").widgetExistsOnTarget
const widgetIsElementized = require("./metadata").widgetIsElementized

/**
 * Handy function to filter out hidden files.
 * @param fileStat
 * @returns {boolean}
 */
function hidden(fileStat) {
  return fileStat.name.startsWith(".")
}

/**
 * Determine if file is under the tracking directory.
 * @param fullPath
 * @returns {boolean}
 */
function isTrackedFile(fullPath) {
  return fullPath.includes(`/${constants.trackingDir}/`)
}

/**
 * Figure out the base widget directory from a full path to a widget file.
 * @param path
 */
function getWidgetDir(path) {

  const tokens = path.split("/")
  return tokens.slice(0, tokens.indexOf("widget") + 2).join("/")
}

/**
 * Figure out the base element directory from a full path to a element file.
 * @param path
 */
function getElementDir(path) {

  const tokens = path.split("/")
  return tokens.slice(0, tokens.indexOf("element") + 2).join("/")
}

/**
 * Figure out the base widget directory from a full path to a widget file.
 * @param path
 */
function getStackDir(path) {

  const tokens = path.split("/")
  return tokens.slice(0, tokens.indexOf("stack") + 2).join("/")
}

/**
 * Figure out the base site settings directory from a full path to a site settings file.
 * @param path
 */
function getSiteSettingsDir(path) {

  const tokens = path.split("/")
  return tokens.slice(0, tokens.indexOf("siteSettings") + 2).join("/")
}

/**
 * Return an object suitable for passing to the file walker for chopping up the source directory.
 * @param pathTypeMap
 * @param paths
 * @return {{listeners: {file: listeners.file, directory: listeners.directory}}}
 */
function puttingDirectoryWalker(pathTypeMap, paths) {

  return {
    listeners: {
      file: (root, fileStat, next) => {

        // Build the full file name and keep a note of it but not if under the tracking directory or hidden.
        const fullPath = upath.resolve(root, fileStat.name)

        // Knock out files in the .ccc dir or that are hidden.
        if (!isTrackedFile(fullPath) && !hidden(fileStat)) {

          // See if we recognize the file.
          const fileType = classify(fullPath)

          // If the file looks OK, save the type against the path for later.
          fileType && pathTypeMap.set(fullPath, fileType)

          switch (fileType) {

            // We want to create new themes first and then update any existing ones just after.
            case PuttingFileType.THEME_STYLES:
            case PuttingFileType.THEME_ADDITIONAL_STYLES:
            case PuttingFileType.THEME_VARIABLES:

              if (themeExistsOnTarget(fullPath)) {
                // Keep existing themes together so we can do them early on.
                paths.existingThemePaths.push(fullPath)
              } else {
                // Add our theme base path to the group of new themes to create.
                paths.newThemeSet.add(dirname(fullPath))
              }
              break

            // We want to create global elements fairly early on in the process. Existing ones can be updated later.
            case PuttingFileType.GLOBAL_ELEMENT_JAVASCRIPT:
            case PuttingFileType.GLOBAL_ELEMENT_METADATA:

              if (elementExistsOnTarget(fullPath)) {
                paths.otherPaths.push(fullPath)
              } else {
                paths.newElementSet.add(getElementDir(fullPath))
              }
              break

            // New widgets have to be created before their instances. Existing widgets can be updated later.
            case PuttingFileType.WIDGET_BASE_TEMPLATE:
            case PuttingFileType.WIDGET_BASE_LESS:
            case PuttingFileType.WIDGET_BASE_SNIPPETS:
            case PuttingFileType.WIDGET_JAVASCRIPT:
            case PuttingFileType.WIDGET_MODULE_JAVASCRIPT:
            case PuttingFileType.WIDGET_METADATA_JSON:
            case PuttingFileType.WIDGET_CONFIG_SNIPPETS:
            case PuttingFileType.WIDGET_CONFIG_JSON:
            case PuttingFileType.WIDGET_ADDITIONAL_FILE:
            case PuttingFileType.WIDGET_ADDITIONAL_LESS_FILE:
            case PuttingFileType.WIDGET_ADDITIONAL_TEMPLATE_FILE:
            case PuttingFileType.ELEMENT_METADATA:
            case PuttingFileType.ELEMENT_JAVASCRIPT:

              if (widgetExistsOnTarget(fullPath)) {
                paths.otherPaths.push(fullPath)
              } else {
                paths.newWidgetSet.add(getWidgetDir(fullPath))
              }
              break

            // If doing a putAll/transferAll on elementized widget, template will be sent with element instance json.
            case PuttingFileType.WIDGET_INSTANCE_TEMPLATE:

              if (!widgetIsElementized(fullPath)) {
                paths.otherPaths.push(fullPath)
              }
              break

            // We want to create new stacks fairly early on. Existing ones can be dealt with later.
            case PuttingFileType.STACK_METADATA_JSON:
            case PuttingFileType.STACK_BASE_LESS:
            case PuttingFileType.STACK_BASE_VARIABLES_LESS:
            case PuttingFileType.STACK_BASE_TEMPLATE:
            case PuttingFileType.STACK_BASE_SNIPPETS:
            case PuttingFileType.STACK_CONFIG_SNIPPETS:
            case PuttingFileType.STACK_CONFIG_JSON:

              if (stackExistsOnTarget(fullPath)) {
                paths.stackBasePaths.push(fullPath)
              } else {
                paths.newStackSet.add(getStackDir(fullPath))
              }
              break

            // Update stack instances separately before widgets.
            case PuttingFileType.STACK_INSTANCE_METADATA_JSON:
            case PuttingFileType.STACK_INSTANCE_LESS:
            case PuttingFileType.STACK_INSTANCE_VARIABLES_LESS:
            case PuttingFileType.STACK_INSTANCE_TEMPLATE:

              paths.stackInstancePaths.push(fullPath)
              break

            // We need to drip feed widget instance less to stop the server being swamped by theme compiles.
            // We do have an option the suppress theme compilation which speeds things up but the server may not support it.
            case PuttingFileType.WIDGET_INSTANCE_LESS:

              if (widgetExistsOnTarget(fullPath)) {
                paths.widgetLessPaths.push(fullPath)
              } else {
                paths.newWidgetSet.add(getWidgetDir(fullPath))
              }

              break

            // Element template compilation processing is not thread safe on many older versions of CC.
            // Be cautious and drip feed template updates.
            case PuttingFileType.ELEMENT_TEMPLATE:

              if (widgetExistsOnTarget(fullPath)) {
                paths.elementTemplatePaths.push(fullPath)
              } else {
                paths.newWidgetSet.add(getWidgetDir(fullPath))
              }
              break

            // Element template compilation processing is not thread safe on many older versions of CC.
            // Be cautious and drip feed template updates.
            case PuttingFileType.GLOBAL_ELEMENT_TEMPLATE:

              if (elementExistsOnTarget(fullPath)) {
                paths.elementTemplatePaths.push(fullPath)
              } else {
                paths.newElementSet.add(getElementDir(fullPath))
              }
              break

            // New site settings have to be created before the values can be sent. Existing settings are updated later.
            case PuttingFileType.SITE_SETTINGS_METADATA:
            case PuttingFileType.SITE_SETTINGS_SNIPPETS:

              if (siteSettingsExistOnTarget(fullPath)) {
                paths.otherPaths.push(fullPath)
              } else {
                paths.newSiteSettingsSet.add(getSiteSettingsDir(fullPath))
              }
              break

            // Anything we don't recognize gets ignored. If we get in here, the file gets processed at the end.
            default:
              if (fileType) {
                paths.otherPaths.push(fullPath)
              }
          }
        }

        next()
      },
      directory: (root, fileStat, next) => {

        const fullPath = upath.resolve(root, fileStat.name)
        if (!isTrackedFile(fullPath) && !hidden(fileStat)) {

          // Need to intercept widget instance directories.
          classify(fullPath) === PuttingFileType.WIDGET_INSTANCE &&
          paths.widgetInstanceDirs.push(fullPath)

          // Same for stack instance directories.
          classify(fullPath) === PuttingFileType.STACK_INSTANCE &&
          paths.stackInstanceDirs.push(fullPath)
        }
      }
    }
  }
}

exports.puttingDirectoryWalker = puttingDirectoryWalker
