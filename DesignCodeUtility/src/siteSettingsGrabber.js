const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const request = require("./requestBuilder").request
const sanitizeName = require("./utils").sanitizeName
const writeFile = require("./utils").writeFile
const writeMetadata = require("./metadata").writeMetadata

/**
 * Regenerate the locale strings associated with this settings block.
 * @param settings
 * @param settingsDir
 * @return {*}
 */
function grabLocaleStrings(settings, settingsDir) {

  // For each locale we are interested in.
  return Promise.each(endPointTransceiver.locales, locale => {

    // Get the strings for current locale. We do this by repeatedly calling the
    // getCustomSiteSettings() with different locale codes and reverse engineering it from the response.
    return endPointTransceiver.getCustomSiteSettings([settings.repositoryId],
      request().withLocale(locale.name).ignoring(400)).then(results => {

      // The config block is only bit we care about.
      const config = results.data.config

      // Start by building up the title and description - this is fairly simple.
      const localeStrings = {
        "title": config.displayName,
        "description": config.description
      }

      // For each value in the setting block.
      config.values.forEach(value => {

        // Write out a help text and label string for each property.
        localeStrings[buildHelpTextResourceId(value)] = value.helpText
        localeStrings[buildLabelResourceId(value)] = value.label

        // Do the same for each possible option value.
        value.options.forEach(option => {
          localeStrings[buildOptionLabelResourceId(value, option)] = option.label
        })
      })

      // Write the strings out to an appropriately named file.
      writeFile(`${settingsDir}/${constants.siteSettingsLocalesDir}/${locale.name}.json`,
        JSON.stringify({resources: localeStrings}, null, 2))
    })
  })
}

/**
 * Different sites can have different values for the same setting hence we need to capture them.
 * @param settings
 * @param settingsDir
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function grabValuesForAllSites(settings, settingsDir) {

  // Create the sites directory.
  makeTrackedDirectory(`${settingsDir}/${constants.sitesSettingsSitesDir}`)

  // For all sites...
  return endPointTransceiver.getSites("?type=touchpoint&limit=250").then(results => {

    return Promise.map(results.data.items, site => {

      // Create a directory for the current site.
      const siteDir = `${settingsDir}/${constants.sitesSettingsSitesDir}/${sanitizeName(site.name)}`
      makeTrackedDirectory(siteDir)

      // Get the site settings values for the current site.
      return endPointTransceiver.getCustomSiteSettings([settings.repositoryId],
        request().withHeader(constants.siteHeader, site.repositoryId)).then(results => {

        // Write out the site settings values as they came down from the endpoint.
        writeFile(`${siteDir}/${constants.siteSettingsValuesFile}`,
          JSON.stringify(results.data.data, null, 2))

        // Create the internal metadata while we are at it. We store the un-sanitised values for later matching.
        writeMetadata(`${siteDir}/${constants.siteSettingsValuesMetadataJson}`,
          {
            displayName: settings.displayName,
            siteName: site.name
          })
      })

    }, getGrabbingConcurrency())
  })
}

/**
 * As the resource id key has to be built in more than one place, define how we build it once.
 * @param value
 * @return {string}
 */
function buildHelpTextResourceId(value) {
  return `${value.name}HelpText`
}

/**
 * As the resource id key has to be built in more than one place, define how we build it once.
 * @param value
 * @return {string}
 */
function buildLabelResourceId(value) {
  return `${value.name}Label`
}

/**
 * As the resource id key has to be built in more than one place, define how we build it once.
 * @param value
 * @param option
 * @return {string}
 */
function buildOptionLabelResourceId(value, option) {
  return `${value.name}${option.label}Label`
}

/**
 * Regenerate what the extension config file would have looked like from the endpoint data.
 * @param settings
 * @param settingsDir
 */
function regenerateConfigMetadata(settings, settingsDir) {

  // Generate the basic metadata file for this settings block.
  const configJson = {
    "titleResourceId": "title",
    "descriptionResourceId": "description",
    "properties": [],
    "enableSiteSpecific": settings.enableSiteSpecific
  }

  // For each property in the settings block.
  settings.values.forEach(value => {

    const property = {}

    // For each key value in the property.
    Object.keys(value).forEach(key => {

      // Some fields require special treatment.
      switch (key) {

        // Set the name and id properties to be the same value.
        case "name" :
          property.name = property.id = value.name
          break

        // Don't need these ones.
        case "repositoryId" :
        case "noOfColumns" :
          break

        // Turn label and help text into resource keys.
        case "helpText" :
          property[`helpTextResourceId`] = buildHelpTextResourceId(value)
          break

        case "label" :
          property[`labelResourceId`] = buildLabelResourceId(value)
          break

        // Walk through the options array - make sure it actually has a value though.
        case "options" :
          value.options && value.options.forEach(option => {

            // If there not an option block on the target property structure, make one.
            !property.options && (property.options = [])

            // These may not match what was in the original extension but they will map to the properties files.
            property.options.push({
              value: option.value,
              id: `${value.name}${option.label}`,
              labelResourceId: buildOptionLabelResourceId(value, option)
            })
          })
          break

        // Need to map the type values back.
        case "type":
          switch (value.type) {
            case "checkbox":
              property.type = "booleanType"
              break
            case "option":
              property.type = "optionType"
              break
            case "text":
              property.type = "stringType"
              break
          }
          break

        // No max length with boolean nor option types.
        case "maxLength":

          if (value.type !== "checkbox" && value.type !== "option") {
            property.maxLength = value.maxLength
          }
          break

        // Convert boolean default values to actual booleans so as not to trip validation.
        case "defaultValue":

          if (value.type === "checkbox") {

            property.defaultValue = (value.defaultValue == "true")
          } else if (value.defaultValue) {

            // Only put a value in when there actually is one.
            property.defaultValue = value.defaultValue
          }
          break

        // Any other value is just passed straight through.
        default:
          value[key] && (property[key] = value[key])
      }
    })

    configJson.properties.push(property)
  })

  // Save the newly regenerated file to disk.
  writeFile(`${settingsDir}/${constants.siteSettingsConfigMetadataFile}`, JSON.stringify(configJson, null, 2))
}

/**
 * Help ourselves to all the site settings stuff that we can derive from the endpoints.
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function grabAllSiteSettings() {

  // Make the site settings directory.
  makeTrackedDirectory(constants.siteSettingsDir)

  // Get a list of all the site settings on the system.
  return endPointTransceiver.listSiteSettings().then(results => {

    // Some settings are built in and we want to avoid them. Here, we are just following the UI code.
    const filteredSettings = results.data.items.filter(settings =>
      settings.repositoryId !== constants.caseInsensitiveUrls &&
      settings.repositoryId !== constants.abandonedCart)

    return Promise.each(filteredSettings, settings => {

      // Let the user know we are not letting the grass grow under our feet.
      info("grabbingSiteSettings", {name: settings.displayName})

      // Make a directory for current settings block.
      const settingsDir = `${constants.siteSettingsDir}/${sanitizeName(settings.displayName)}`
      makeTrackedDirectory(settingsDir)

      // Regenerate the config metadata file for this settings block.
      regenerateConfigMetadata(settings, settingsDir)

      // Create the internal metadata while we are at it.
      writeMetadata(`${settingsDir}/${constants.siteSettingsMetadataJson}`,
        {
          displayName: settings.displayName,
          id: settings.id
        })

      // Generate the values file for each site and the locale strings.
      return grabValuesForAllSites(settings, settingsDir).then(grabLocaleStrings(settings, settingsDir))
    })
  })
}

exports.grabAllSiteSettings = grabAllSiteSettings
