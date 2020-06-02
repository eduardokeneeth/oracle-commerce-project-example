"use strict"

const basename = require('path').basename
const mock = require('mock-require')
const Promise = require("bluebird")

/**
 * Using mock-require, replace the named module with a lookalike object comprised of spies.
 * @param name
 * @returns the empty object so we can add spies to it.
 */
exports.mock = function (name) {

  // Require the real module and create the replacement.
  const realModule = require(name)
  const dummyModule = this.spyMaker(name)

  // Find all the functions in the real module.
  Object.keys(realModule).forEach(key => {
      if (typeof(realModule[key]) == 'function') {
        // Create a spy in the dummy module matching the real one.
        exports.createSpy(dummyModule, key)
      }
    }
  )

  // Wire in the populated dummy Module using mock-require.
  mock(name, dummyModule)

  return dummyModule
}

/**
 * Mock a module using the supplied object directly.
 * @param name
 * @param dummyModule
 */
exports.mockAs = function (name, dummyModule) {
  mock(name, dummyModule)
}

/**
 * Tell the module what function to use to create spies.
 * @param spyMaker
 */
exports.use = function (spyMaker) {
  this.spyMaker = spyMaker
}

/**
 * Create a spy on the supplied dummy module.
 * @param module
 * @param name
 * @param fake
 */
exports.createSpy = function (module, name, fake) {
  module[name] = this.spyMaker(name)

  fake && module[name].and.callFake(fake)

  // Stick a bunch of methods on the spy.
  exports.addConvenienceMethods(module[name])
}

/**
 * Add a bunch of power tools to make it easy to mock our types of objects and make tests more readable.
 * @param spy
 */
exports.addConvenienceMethods = function (spy) {

  spy.callThrough = () => spy.and.callThrough()

  /**
   * Ensure the supplied spy will return true.
   */
  spy.returnsTrue = () => spy.and.returnValue(true)

  /**
   * Ensure the supplied spy will return false.
   */
  spy.returnsFalse = () => spy.and.returnValue(false)

  /**
   * Handle the simple cases where a function needs to return a Promise.
   * @param dataOrFunction
   * @return the dataOrFunction or Function that will be returned by the promise - this can help to keep tests short.
   */
  spy.returnsPromise = function (dataOrFunction) {

    // Construct a promise around the dataOrFunction.
    this.and.callFake(dataOrFunction instanceof Function ? Promise.method(dataOrFunction) : Promise.method(() => dataOrFunction))

    // Return the dataOrFunction in case the caller wants to use it for matching.
    return dataOrFunction
  }

  /**
   * Ensure the spy will return the supplied data.
   * @param data
   */
  spy.returns = function (data) {
    this.and.returnValue(data)

    return data
  }

  /**
   * Ensure the spy will return its first argument as the return value.
   */
  spy.returnsFirstArg = () => spy.and.callFake((arg) => arg)

  /**
   * Specialized version of returnsPromise() that mimics one of our endpoints returning an array of "things".
   */
  spy.returnsItems = function () {

    // Build up the payload. Add everything to items array in payload.
    const payload = {
      data : {
        items : []
      }
    }

    for (let index = 0; index < arguments.length; index++) {
      payload.data.items.push(arguments[index])
    }

    return this.returnsPromise(payload)
  }

  /**
   * Return a response object that looks like something that came from an endpoint. Since this is nearly always some
   * data and etag, we have created a special help function to make the tests shorter.
   */
  spy.returnsResponse = function (data, etag) {

    const payload = {
      data,
      response : {
        headers : {
          etag : etag
        }
      }
    }

    return this.returnsPromise(payload)
  }

  return spy
}

/**
 * Build a mock module and create a bunch of spies on it. This is basically to help with mocking endpointTransceiver
 * which creates a bunch of methods dynamically at runtime.
 */
exports.mockModule = function () {

  // Create a dummy module with spies matching the real module.
  const dummy = exports.mock(arguments[0])

  // Add any additional spies the caller wants added.
  for (let i = 1; i < arguments.length; i++) {
    exports.createSpy(dummy, arguments[i])
  }

  return dummy
}

/**
 * Build a series of mock modules and attach references to them to the supplied container.
 * Note that the order of arg
 * @param mockContainer
 */
exports.mockModules = function (mockContainer) {

  for (let i = 1; i < arguments.length; i++) {
    mockContainer[basename(arguments[i])] = exports.mockModule(arguments[i])
  }
}

/**
 * Stop all mocking. MUST be called via afterEach() in every test.
 */
exports.stopAll = mock.stopAll

/**
 * Require (forcing a fresh load each time) the module under test using any mock modules
 * we have set up.
 */
exports.require = mock.reRequire
