const constants = require("./constants").constants
const createSiteSettingsInExtension = require("./siteSettingsCreator").createSiteSettingsInExtension
const endPointTransceiver = require("./endPointTransceiver")
const processPutResult = require("./putterUtils").processPutResult
const readJsonFile = require("./utils").readJsonFile
const readMetadata = require("./metadata").readMetadata
const readMetadataFromDisk = require("./metadata").readMetadataFromDisk
const request = require("./requestBuilder").request

/**
 * Send all the site settings stuff (not the values - see below) up in an extension.
 * @param path
 */
function putSiteSettings(path) {

  // Get the metadata for the widget.
  const localSiteSettingsMetadata = readMetadataFromDisk(path, constants.siteSettingsMetadataJson)

  // Call the widget creator to do the business.
  return createSiteSettingsInExtension(localSiteSettingsMetadata.id, localSiteSettingsMetadata.displayName, path)
}

/**
 * Send the values for the site settings up to the server.
 * @param path
 */
function putSiteSettingsValues(path) {

  return readMetadata(path, constants.siteSettingsValuesMetadataJson).then(metadata => {

    if (metadata) {

      return endPointTransceiver.setSiteSettingConfigData([metadata.repositoryId],
        request().withBody(ensureDefaultValues(metadata, readJsonFile(path)))
          .withHeader(constants.siteHeader, metadata.site.repositoryId)).tap(
        results => processPutResult(path, results))
    }
  })
}

/**
 * This is to try to stop the endpoint choking if a field is not supplied.
 *
 * @param settings
 * @param settingsValues
 * @return a suitably massaged set of values.
 */
function ensureDefaultValues(settings, settingsValues) {

  // For each property defined in the metadata...
  settings.values.forEach(value => {

    // Ensure there is at least a value in the values block.
    if (!settingsValues[value.name]) {

      // If there's a default value, use that.
      if (value.defaultValue) {

        settingsValues[value.name] = value.defaultValue

      } else {

        // Otherwise try to put in something sensible based on the type.
        switch (value.type) {

          // Make booleans false.
          case "checkbox" :
            settingsValues[value.name] = false
            break

          // Empty string for strings.
          case "text" :
            settingsValues[value.name] = ""
            break

          // For option types, default to the first value.
          // Make sure there is a value there although there should be.
          case "option" :
            value.options.length && (settingsValues[value.name] = value.options[0].value)
            break
        }
      }
    }
  })

  return settingsValues
}
exports.putSiteSettings = putSiteSettings
exports.putSiteSettingsValues = putSiteSettingsValues
