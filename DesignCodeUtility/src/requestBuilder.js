"use strict"

const endPointTransceiver = require("./endPointTransceiver")
const inTransferMode = require("./state").inTransferMode
const readFile = require("./utils").readFile
const readJsonFile = require("./utils").readJsonFile

// Set up a default request config object that the users can override if they want.
let defaultRequestConfig = {
  requestConfig: {
    timeout: 5000, // request timeout in milliseconds
    noDelay: true, // Enable/disable the Nagle algorithm
    keepAlive: true, // Enable/disable keep-alive functionality idle socket to reduce the number of connection resets.
    keepAliveDelay: 5000 // and optionally set the initial delay before the first keepalive probe is sent
  }
}

// See if the user wants to override request config.
try {
  defaultRequestConfig = require("./userRequestConfig")
} catch (e) {
  // This may fail so swallow this.
}

/**
 * Historically, we always used a profile type of adminUI. Since authentication by user name and password
 * is on the way out in 17.6, we need to make the profile switchable.
 * @type {string}
 */
let defaultProfileType = "adminUI"

/**
 * Function to let module users switch the default profile type.
 * @param profileType
 */
function setProfileType(profileType) {
  defaultProfileType = profileType
}

/**
 * Class that provides a fluent interface to enable us to build REST requests
 * suitable for sending to Commerce Cloud.
 */
class RequestBuilder {

  constructor() {
    this.headers = {}
    this.locale = endPointTransceiver.locale
    this.json = false
    this.tolerant = false
  }

  /**
   * Used as a way of supplying non-default headers.
   * @param name
   * @param value
   */
  withHeader(name, value) {
    this.headers[name] = value
    return this
  }

  /**
   * Can be used to force a specific locale.
   * @param locale
   */
  withLocale(locale) {
    this.locale = locale
    return this
  }

  /**
   * Supply an Etag value. Will be only be passed if endpoint supports optimistic locking.
   * @param etag
   */
  withEtag(etag) {
    this.etag = etag
    return this
  }

  /**
   * Put the contents of the file given by the path in the given field.
   * @param path
   * @param field
   */
  fromPathAs(path, field) {
    this.path = path
    this.field = field
    return this
  }

  /**
   * Put the contents of the file given by the path in the given field as JSON.
   * @param path
   * @param field
   */
  fromPathAsJSON(path, field) {
    this.path = path
    this.field = field
    this.json = true
    return this
  }

  /**
   * Use what is supplied as the body of the request.
   * @param body
   */
  withBody(body) {
    this.body = body
    return this
  }

  /**
   * Ignore the supplied HTTP code i.e. do not treat it as an error.
   * @param httpCode
   */
  ignoring(httpCode) {
    this.httpCode = httpCode
    return this
  }

  /**
   * Use the supplied values to globally substitute in the body before sending.
   * @param from
   * @param to
   * @returns {RequestBuilder}
   */
  replacing(from, to) {
    this.from = from
    this.to = to
    return this
  }

  /**
   * Build a node rest client args object using the previously supplied information.
   * @param accessToken
   * @param endPointInformation
   * @returns {object} a node-rest-client structure ready for use
   */
  build(accessToken, endPointInformation) {

    // Build a skeleton node-rest-client config object.
    const args = defaultRequestConfig

    args.headers = this.headers

    // If the complete payload has been supplied, use it as is.
    if (this.body) {
      args.data = this.body
    }

    // Caller has given us a path to a file and a field. This may be JSON or may not.
    if (this.path) {
      args.data = {}
      args.data[this.field] = this.json ? readJsonFile(this.path) : readFile(this.path)
    }

    // See if the body needs anything done to it.
    if (this.from) {
      args.data[this.field] = args.data[this.field].replace(this.from, this.to)
    }

    // If an etag has been supplied and endpoint supports optimistic locking, pass in the etag as long as we are not
    // in transfer mode.
    if (endPointInformation && endPointInformation.useOptimisticLock && this.etag && !inTransferMode()) {
      args.headers["ETag"] = this.etag
      args.headers["If-Match"] = this.etag
    }

    // Add the default Accept header if none has been set.
    if (!args.headers.Accept) {
      args.headers.Accept = "application/json, text/javascript, */*; q=0.01"
    }

    // Set the profile type to the default if it has not been set already.
    if (!args.headers["X-CCProfileType"]) {
      args.headers["X-CCProfileType"] = defaultProfileType
    }

    // Look at endPointInformation and see if we need an asset language header - may be one already.
    if (endPointInformation) {
      if (endPointInformation.id === "listLocales") {
        delete args.headers["X-CCAsset-Language"]

      } else if (endPointInformation.localeHint === "assetLanguageRequired" ||
        endPointInformation.localeHint === "assetLanguageOptional" ||
        endPointInformation.localeHint === "browser") {

        args.headers["X-CCAsset-Language"] = this.locale
      }
    }

    // Add in the authorization stuff in every case.
    args.headers.Authorization = `Bearer ${accessToken}`

    // Force content type to be JSON.
    args.headers["Content-Type"] = "application/json"

    return args
  }

  /**
   * Used to tell if its safe to ignore an error code.
   * @param httpCode
   * @return {boolean}
   */
  shouldIgnore(httpCode) {
    return this && httpCode == this.httpCode
  }
}

/**
 * Entry point.
 * @returns {RequestBuilder}
 */
exports.request = function () {
  return new RequestBuilder()
}

exports.setProfileType = setProfileType
