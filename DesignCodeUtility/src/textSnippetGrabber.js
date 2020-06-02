"use strict"

const Promise = require("bluebird")

const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const getGrabbingConcurrency = require("./concurrencySettings").getGrabbingConcurrency
const getFallBackName = require("./localeUtils").getFallBackName
const getInitialMatchName = require("./localeUtils").getInitialMatchName
const hasFallBack = require("./localeUtils").hasFallBack
const info = require("./logger").info
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const request = require("./requestBuilder").request
const splitPath = require("./utils").splitPath
const warn = require("./logger").warn
const writeFileAndETag = require("./grabberUtils").writeFileAndETag

/**
 * Given a locale directory (which may not exist) grab the associated snippets.
 * @param path
 * @return a BlueBird promise
 */
function grabTextSnippetsForLocaleDirectory(path) {

  // Make sure the server has the endpoint we need.
  if (!endPointTransceiver.serverSupports("getResourceStrings")) {
    warn("textSnippetsCannotBeGrabbed")
    return
  }

  // Fake up a locale object and call the method to do the grab.
  return grabTextSnippetsForLocale({name : splitPath(path)})
}

/**
 * Sort out the endpoint parameters based on the available endpoints.
 * @param localeName
 */
function getEndpointParams(localeName) {

  let endpointParams = ["ns.common"]

  if (endPointTransceiver["getResourceStringsForLocale"]) {
    endpointParams = ["ns.common", localeName]
  }

  return endpointParams
}

/**
 * Boilerplate to pull down the text snippets for a specified locale.
 * Note that this can be called directly if user is doing a selective grab.
 * @param locale
 * @returns {*}
 */
function grabTextSnippetsForLocale(locale) {

  // If the name is aliased, try that first.
  let localeName = getInitialMatchName(locale)

  // Use the best endpoint available.
  let textSnippetEndpoint = endPointTransceiver["getResourceStrings"]
  if (endPointTransceiver["getResourceStringsForLocale"]) {
    textSnippetEndpoint = endPointTransceiver["getResourceStringsForLocale"]
  }

  return textSnippetEndpoint(getEndpointParams(localeName), request().withLocale(localeName)).tap(results => {

    // Only write out something if there something to write.
    if (results.data.resources) {

      writeTextSnippetsForLocale(localeName, results)

    } else if (hasFallBack(locale)) {

      // No snippets found but there is a fallback - try that.
      localeName = getFallBackName(locale)

      return textSnippetEndpoint(getEndpointParams(localeName), request().withLocale(localeName)).tap(results => {

        if (results.data.resources) {
          writeTextSnippetsForLocale(localeName, results)
        } else {
          warn("noMatchFound", {name : localeName})
        }
      })

    } else {
      warn("noMatchFound", {name : localeName})
    }
  })
}

/**
 * Suck down the common text snippets.
 */
function grabCommonTextSnippets() {

  // Make sure the server has the endpoint we need.
  if (!endPointTransceiver.serverSupports("getResourceStrings")) {
    warn("textSnippetsCannotBeGrabbed")
    return
  }

  // Create a directory to bung it all in and one for each locale.
  makeTrackedDirectory(constants.textSnippetsDir)

  // Get these for each language one by one to avoid running out of connections.
  return Promise.map(endPointTransceiver.locales, grabTextSnippetsForLocale, getGrabbingConcurrency())
}

/**
 * Does the work of getting the text snippet information from the response to disk.
 * @param localeName
 * @param results
 */
function writeTextSnippetsForLocale(localeName, results) {

  // Let the user know something is happening...
  info("grabbingTextSnippets", {name : localeName})

  // Create a directory for the locale and stick the contents in it.
  const textSnippetsLocaleDir = `${constants.textSnippetsDir}/${localeName}`
  makeTrackedDirectory(textSnippetsLocaleDir)

  // Walk through any custom keys using them to override the base values.
  results.data.custom && Object.keys(results.data.resources).forEach(outerKey => {
    Object.keys(results.data.resources[outerKey]).forEach(innerKey => {
      if (results.data.custom[innerKey]) {
        results.data.resources[outerKey][innerKey] = results.data.custom[innerKey]
      }
    })
  })

  // Write the massaged data out to disk.
  writeFileAndETag(`${textSnippetsLocaleDir}/${constants.snippetsJson}`,
    JSON.stringify(results.data.resources, null, 2), results.response.headers.etag)
}

exports.grabTextSnippetsForLocaleDirectory = grabTextSnippetsForLocaleDirectory
exports.grabCommonTextSnippets = grabCommonTextSnippets
