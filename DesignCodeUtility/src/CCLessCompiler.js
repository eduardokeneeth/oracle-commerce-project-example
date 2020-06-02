"use strict"

const endPointTransceiver = require("./endPointTransceiver")
const constants = require("./constants").constants
const exists = require("./utils").exists
const glob = require("./utils").glob
const writeFile = require("./utils").writeFile
const readFile = require("./utils").readFile
const request = require("./requestBuilder").request
const initializeMetadata = require("./metadata").initializeMetadata
const readMetadata = require("./metadata").readMetadataFromDisk
const getCachedInstanceMetadata = require("./metadata").getCachedWidgetInstanceFromMetadata
const info = require("./logger").info
const error = require("./logger").error

/**
 * Compile our local Less file changes and include standard Cloud Commerce
 * boilerplate styles/variable and theme source if necessary. Output will
 * be written to ${themeDir}/storefront.css
 *
 * @returns Compile CSS for Storefront including local modifications.
 */
function doCompile (siteName) {
  return initializeMetadata().then(() => {
    return endPointTransceiver.getSites().then((result) => {
      const sites = result.data.items

      const site = sites.find((el) => {

        // Substring match of production URL is a user request.
        if (el.productionURL && el.productionURL.indexOf(siteName) > -1) {
          info("foundMatchingSiteText", {name: el.name, url: el.productionURL})
          return true
        }

        // Substring match of Site Name.
        if (el.name && el.name.indexOf(siteName) > -1) {
          info("foundMatchingSiteText", {name: el.name, url: el.productionURL})
          return true
        }

        // Allow matching by repo-id as a fall-back (User may not actually
        // know this, but we might do it for troubleshooting.)
        return el.repositoryId === siteName
      })

      if (!site) {
        error("noSiteFoundError", {name: siteName})
        return
      }

      endPointTransceiver.getActiveTheme("?site=" + site.repositoryId).then((result) => {
        const theme = result.data

        // Older versions of CCAdminUI API might not support the less compilation
        // endpoint.
        if (!endPointTransceiver.compileLess) {
          error("lessCompilationUnsupportedError", {node: endPointTransceiver.instance})
          return
        }

        if (theme) {
          const name = theme.name
          info("activeThemeText", { name })

          // Collect our local less files for components and theme then compile.
          const payload = {
            siteId: site.repositoryId,
            src: getAllComponentLess(),
            themeSrc: getAllThemeLess(name)
          }

          if (payload.src && payload.themeSrc) {
            info("compilingComponentAndThemeLess", {theme: name})
          } else {
            info("compilingComponentLess")
          }

          const requestBuilder = request().withBody(payload)
          endPointTransceiver.compileLess([], requestBuilder).tap((result) => {
            writeFile(`${constants.trackingDir}/${constants.themesDir}/${constants.storefrontCss}`, result.data.src)
            info("allDone")
          })
        }
      })

    })
  })
}

/**
 * Collect all the component less source under widget, element, and stack
 * directories as a single concatenated string.
 *
 * @returns {string} All non-compiled component less code.
 */
function getAllComponentLess () {
  let componentLess = ""

  // Get a big string of widget + element + stack Less.
  glob("widget/*/instances/*/widget.less").forEach((path) => {
    const widgetMD = readMetadata(path, constants.widgetInstanceMetadataJson)
    const instanceMD = getCachedInstanceMetadata(widgetMD)

    // If we're missing any instance related metadata, it means the widget is
    // not used on storefront and we can skip it.
    if (instanceMD && instanceMD.descriptor) {
      // Need to do a bit of tinkering to replace the #<widget>-<instance> CSS
      // selector... (This does a similar thing to widgetPutter.js)
      const classWrapper = `#${instanceMD.descriptor.repositoryId}-${instanceMD.repositoryId}`
      const less = readFile(path).replace(
        constants.widgetInstanceSubstitutionValue, classWrapper)

      componentLess += less + "\n"
    }
  })

  // Ensure that variables are scooped up first - We only want active instances
  glob("stack/*/instances/*/stack-variables.less").forEach((path) => {
    componentLess += readFile(path) + "\n"
  })
  glob("stack/*/instances/*/stack.less").forEach((path) => {
    componentLess += readFile(path) + "\n"
  })

  // DEBUG:
  // writeFile("/tmp/combined_components.less", componentLess)

  return componentLess
}

/**
 * Collect the theme less for theme `name', or empty string if the theme
 * directory doesn't exist.
 *
 * @param name Name of Theme
 * @returns {string} Uncompiled Less code.
 */
function getAllThemeLess (name) {
  let themeLess = ""

  // If we have the active theme locally, get a big string of theme Less.
  const themeDir = `${constants.themesDir}/${name}`
  if (exists(themeDir)) {
    // This is the order we include these on the server.
    themeLess += readFile(`${themeDir}/styles.less`) + "\n"
    themeLess += readFile(`${themeDir}/variables.less`) + "\n"
    themeLess += readFile(`${themeDir}/additionalStyles.less`) + "\n"
  }

  // DEBUG:
  // writeFile("/tmp/combined_theme.less", themeLess)

  return themeLess
}

exports.compileOnce = doCompile
