/**
 * Module that knows how to talk to Commerce Cloud endpoints.
 */
"use strict"

const Promise = require("bluebird")

const i18n = require("./i18n")
const makePromisingClient = require("./promisingClient").makePromisingClient
const osLanguage = require('./utils').shortLocale
const osLocale = require('./utils').osLocale
const request = require("./requestBuilder").request
const setNodeName = require("./etags").setNodeName
const setProfileType = require("./requestBuilder").setProfileType
const stripProtocol = require("./utils").stripProtocol
const warn = require("./logger").warn

const self = this

/**
 * Set up the module.
 *
 * @param instance e.g. http://localhost:9080
 * @param userName
 * @param password
 * @param applicationKey
 * @param overrideLocale defaults to server locale if none is provided.
 * @param allLocales Flag to include all locales.
 * @return a Bluebird promise that fires when the initialization has happened.
 */
function init(instance, userName, password, applicationKey, overrideLocale, allLocales) {

  // Save off the parameters.
  exports.instance = self.instance = instance
  self.userName = userName
  self.password = password
  self.applicationKey = applicationKey
  self.loginData = null

  // Tell the etags module about the node name. Remove any colons.
  setNodeName(stripProtocol(instance).split(":").join(""))

  // Set up an augmented version of node-rest-client.
  self.client = makePromisingClient()

  // Do the necessary server related set up.
  return setUpFromMetaData(overrideLocale, allLocales)
}

/**
 * This method can be used when you have a fully qualified URL such as a URL
 * that was returned in a previous response.
 * @param url
 */
function get(url) {

  return self.client.getAndPromise(url, request().build(self.loginData.data.access_token))
}

// Make this available to caller in case they need to fashion their own URLs.
exports.urlBase = "/ccadminui/v1/"

/**
 * Used to determine if the server supports all the supplied operations.
 *
 * @param operations Variable list of operation names
 * @return {boolean} true if server supports all supplied operations; false otherwise.
 */
function serverSupports(...operations) {

  return operations.every(operation => exports[operation])
}

/**
 * Does the locale setup dance. Will export the locales symbol as a list of
 * supported locales in this invocation, and will export the locale symbol as
 * the current locale in this invocation.
 *
 * @param localeData Locale data from server response.
 * @param overrideLocale If set, attempt to match this locale in the server
 *                       response.
 * @param allLocales If true, just includes all items from localeData.
 */
function processLocaleInformation(localeData, overrideLocale, allLocales) {

  // Make sure call actually worked. If this call failed, we can't go any further.
  if (localeData.errorCode) {

    throw new Error(i18n.t("endPointCallFailed", localeData))
  }

  if (allLocales) {
    // Keep all available locales if we are trying for them all.
    exports.locales = localeData.items

  } else if (overrideLocale) {
    // See if we want a specific locale - find it in the response data.

    // Look for a match in the supported locales.
    const match = localeData.items.find(locale => locale.name === overrideLocale)

    if (match) {
      exports.locales = [match]
    } else {
      const localeIsNotRecognized = i18n.t("localeIsNotRecognized", {name: overrideLocale})
      throw new Error(localeIsNotRecognized)
    }

  } else {

    // This is the default case. Use the server locale unless its en_US (which is supported but has no snippets).
    if (localeData.defaultLocale.name !== "en_US") {

      exports.locales = [localeData.defaultLocale]
    } else {

      // Fall back to the 2 letter code (en).
      const shortLocale = osLanguage(localeData.defaultLocale.name)

      // Find the match locale in supported locales.
      const shortMatch = localeData.items.find(locale => locale.name === shortLocale)

      // Save off the matching locale.
      exports.locales = [shortMatch]
    }
  }

  // Save off the server default locale for later use unless we have a default locale selected somehow.
  exports.locale = exports.locales.length === 1 ? exports.locales[0].name : localeData.defaultLocale.name

  // Now we are decided on locale, tell the i18n module.
  i18n.init(exports.locale)
}

/**
 * After doing a sanity check, get the the supported locales from the server.
 * @returns A Bluebird promise.
 */
function getLocales() {

  if (exports.listLocales) {

    // Next find out what locales we have.
    return exports.listLocales("?withAliases=true")
  } else {

    throw i18n.t("notAdministrationInterface", {name: self.instance})
  }
}

/**
 * Using the registry information, create a convenience function for each supported endpoint.
 * @param results
 */
function createEndPointFunctions(results) {

  for (let endpointName in results.data.endpointMap) {
    exports[endpointName] =
      (parameter1, parameter2, parameter3) => callEndPoint(results.data.endpointMap[endpointName], parameter1, parameter2, parameter3)
  }
}

/**
 * Turn the registry information into useful functions that return a promise.
 * @param overrideLocale supplied if we dont want to use the server locale.
 * @param allLocales set to true if we want to pull everything down for every locale.
 * @returns a promise so we know when the registry data has arrived.
 */
function setUpFromMetaData(overrideLocale, allLocales) {

  // Set a temporary locale for now.
  exports.locale = osLocale()

  return login().then(() => {
    return self.client.getAndPromise(pathFor(`${exports.urlBase}registry`))
  }).then(results => {

    // Create methods to match each of the available endpoints.
    createEndPointFunctions(results)

    // Take a note of the CC version for later.
    exports.commerceCloudVersion = results.response.headers["oraclecommercecloud-version"]

    // Make sure we are not pointing at a store server by mistake.
    return getLocales()

    // There is a bunch of setup around locales depending on what the user wants to do.
  }).tap(results => processLocaleInformation(results.data, overrideLocale, allLocales))
}

/**
 * Figure out what sorts of parameters we got.
 * @param p1 Can either be a URL (with optional query string), a query string,
 *               an array of keys or a RequestBuilder object or not supplied.
 * @param p2 Can be a URL (with optional query string), a RequestBuilder object
 *               or not supplied.
 * @param p3 Can be a RequestBuilder object or not supplied.
 * @returns {object} a structure containing the identified values.
 */
function unpack(p1, p2, p3) {

  const parameterMap = {}

  if (p1) {
    parameterMap.pathParams = (p1 instanceof Array) ? p1 : null
    parameterMap.urlAndOrQueryString = (typeof p1 === 'string') ? p1 : null
    parameterMap.responseBuilder = (p1.build) ? p1 : null
  }

  if (p2) {
    if (typeof p2 === 'string')
      parameterMap.urlAndOrQueryString = p2

    if (p2.build)
      parameterMap.responseBuilder = p2
  }

  if (p3) {
    parameterMap.responseBuilder = p3
  }

  // If no RequestBuilder was used, set up a default one.
  if (!parameterMap.responseBuilder) {
    parameterMap.responseBuilder = request() // New RequestBuilder.
  }

  return parameterMap
}

/**
 * Used internally to call the endpoint.
 * @param endPointInformation - taken from the registry call
 * @param params Additional endpoint parameters to be unpacked.
 * @returns {Promise} a promise of Bluebirds...
 */
function callEndPoint(endPointInformation, ...params) {

  // Unpack the parameters (if any).
  const parameters = unpack.apply(null, params)

  // Find the match method on the node-rest-client instance.
  const methodToCall = self.client[`${endPointInformation.method.toLowerCase()}AndPromise`]
  const endpointPath = pathFor(endPointInformation.url, parameters.pathParams, parameters.urlAndOrQueryString)

  // Now login and call the method returning a promise that we pass back to the caller.
  return login().then(results =>
    methodToCall(endpointPath,
      parameters.responseBuilder.build(results.data.access_token, endPointInformation), parameters.responseBuilder)).then(results => {
        if (results.response.statusCode == 401) {
          // If we got a 401 then the request has been hanging long enough for
          // the admin session to timeout. Retry with login.
          warn("timeoutRetryWithLoginWarning", {url: endPointInformation.url})
          return login().then(results =>
            methodToCall(endpointPath,
              parameters.responseBuilder.build(results.data.access_token, endPointInformation), parameters.responseBuilder))
        } else {
          return results
        }
      })
}

/**
 * Turn the relative path into a fully qualified URL.
 * @param urlTemplate which was returned from the registry.
 * @param pathParams and optional array of params to be substituted into the URL template.
 * @param urlAndOrQueryString
 * @returns {string} The full URL e.g.http://localhost:9080/ccadminui/v1/login/
 */
function pathFor(urlTemplate, pathParams, urlAndOrQueryString) {

  // See if its a full URL - which trumps everything.
  if (urlAndOrQueryString && !urlAndOrQueryString.startsWith("?")) {

    // Just prepend the server and return.
    return `${self.instance}${urlAndOrQueryString}`
  }

  // Start work on the template.
  let finalUrl = urlTemplate

  // Add in any substitution parameters.
  if (pathParams) {
    pathParams.forEach(param => {
      finalUrl = finalUrl.replace("{}", param)
    })
  }

  // See if there is a query string to go on the end.
  if (urlAndOrQueryString && urlAndOrQueryString.startsWith("?")) {
    finalUrl += urlAndOrQueryString
  }

  return `${self.instance}${finalUrl}`
}

/**
 * Log into the server, passing the response via a promise - unless we are already logged in.
 * @return a Bluebird promise.
 */
const login = Promise.method(function () {

  // See if we have logged in before.
  if (self.loginData) {

    // See if the login data is getting a bit old.
    if (self.lastLogin && (Date.now() - self.lastLogin > 180000)) {

      return getAndStoreLoginData()
    } else {

      // Already logged in.
      return self.loginData
    }
  } else {
    // First time - need to log in.
    return getAndStoreLoginData()
  }
})

/**
 * Log in and save off the access token.
 * @returns A BlueBird promise
 */
function getAndStoreLoginData() {

  // Keep track of the time we logged in.
  self.lastLogin = Date.now()

  // See if we are using an application key.
  if (self.applicationKey) {

    // Change over the URL base and profile as we are not pretending to be the GUI.
    exports.urlBase = "/ccadmin/v1/"
    setProfileType("applicationAccess")

    return self.client.postAndPromise(pathFor(`${exports.urlBase}login/`),
      {
        data: "grant_type=client_credentials",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Authorization": `Bearer ${self.applicationKey}`
        }
      }).tap(loginData => self.loginData = loginData)
  } else {

    // Using the (deprecated) user name and password. Cache the login response for later reuse.
    return self.client.postAndPromise(pathFor(`${exports.urlBase}login/`),
      {
        data: `grant_type=password&username=${self.userName}&password=${self.password}`,
        headers: {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}
      }).tap(loginData => self.loginData = loginData)
  }
}

/**
 * Return true if it looks like the previous call worked.
 * @param results
 */
function checkCallSucceeded(results) {

  return results.data.errorCode ? false : true
}

exports.checkCallSucceeded = checkCallSucceeded
exports.get = get
exports.init = init
exports.serverSupports = serverSupports
