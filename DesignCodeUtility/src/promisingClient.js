const Promise = require("bluebird")
const Client = require("node-rest-client").Client

const debug = require("./logger").debug
const warn = require("./logger").warn
const logDebug = require("./logger").logDebug

// Set the default client configuration in case the users want to override it.
let defaultClientConfig

// See if the user wants to override request config.
try {
  defaultClientConfig = require("./userClientConfig")
} catch (e) {
  // This may fail so swallow this.
}

/**
 * Boilerplate for calling the node-rest-client
 * @param client
 * @param methodName
 * @param url
 * @param args
 * @param resolve
 * @returns {*} Forwarded Http response. Refer Content-Type header.
 */
function makeRequest(client, methodName, url, args, resolve, responseBuilder) {

  // Keep track of how long things take.
  const start = Date.now()

  return client[methodName](url, args, (data, response) => {

    // Note the duration for debug purposes.
    debug("endpointCallTook", {methodName, url, duration : Date.now() - start})

    // Log anything that looks like an error.
    recordAnyErrors(url, data, response, responseBuilder, client)

    // If get in here, it looks like the call has worked, treat self as success for
    // promise purposes.
    resolve({data, response})
  })
}

/**
 * Create the node-rest-client instance and augment it to work with Bluebird promises.
 */
exports.makePromisingClient = function () {

  // Create an instance of the basic node-rest-client first.
  const client = new Client(defaultClientConfig)

  // Walk through each of the HTTP verb methods.
  const methodNames = ["post", "get", "put", "delete"]
  methodNames.forEach(methodName => {

    // Create another version of the current function with returns a promise.
    client[methodName + "AndPromise"] = (url, args, responseBuilder) => {

      return new Promise((resolve, reject) => {

        try {
          // Call the node-rest-client function which needs a callback.
          makeRequest(client, methodName, url, args, resolve, responseBuilder).on('error',
            error => handleError(error, reject, client, methodName, url, args, resolve))
        } catch (error) {
          handleError(error, reject, client, methodName, url, args, resolve)
        }
      })
    }
  })

  return client
}

/**
 * Handle a node-reset-client error with the possibility of a retry.
 * @param err
 * @param reject
 * @param client
 * @param methodName
 * @param url
 * @param args
 * @param resolve
 * @param shouldIgnore
 */
function handleError(err, reject, client, methodName, url, args, resolve) {

  // node-rest-client has reported an error but all may not be lost. For connection
  // resets, warn the user and try again. For DNS resolution failures or timeout where
  // we have previously connected successfully, try again.
  if (err.code === "ECONNRESET" || err.code === "EPIPE" ||
    ((err.code === "ENOTFOUND" || err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED" || err.code === "ENETDOWN" ||
      err.code === "EACCES") && client.madeConnection)) {

    warn("connectionResetAndRetrying")
    makeRequest(client, methodName, url, args, resolve).on('error',
      err => handleError(err, reject, client, methodName, url, args, resolve))
  } else {

    // Not recoverable it seems, treat this as a failure.
    reject(err)
  }
}

/**
 * Boilerplate for logging errors.
 * @param url
 * @param response
 * @param data
 */
function logAsWarning(url, response, data) {

  warn("unexpectedErrorSending",
    {
      path: url,
      statusCode: response.statusCode,
      errorCode: data.errorCode,
      message: data.message
    })
}

/**
 * Look at the response and data and log anything that looks funny.
 * @param url
 * @param data
 * @param response
 */

function recordAnyErrors(url, data, response, responseBuilder, client) {

  // Ignore any optimistic locks or not founds. CCDS-7843
  if (response.statusCode !== 412 && response.statusCode !== 404) {

    // Check out the HTTP error code.
    if (response.statusCode < 200 || response.statusCode > 299) {

      // Some HTTP error codes are an occupational hazard and can be swallowed.
      if ((responseBuilder && !responseBuilder.shouldIgnore(response.statusCode)) || !responseBuilder) {
        logAsWarning(url, response, data)
      }
    } else if (data && data.errorCode) {

      // HTTP code may be OK but call could still have gone wrong.
      logAsWarning(url, response, data)
    } else {

      // If we haven't previously connected, note that we did. CCDS-7843
      if (!client.madeConnection) {
        client.madeConnection = true
      }
    }
  } else {

    // If we haven't previously connected, note that we did. CCDS-7843
    if (!client.madeConnection) {
      client.madeConnection = true
    }
  }
}
