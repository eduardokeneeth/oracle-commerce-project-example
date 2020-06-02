"use strict"

const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Promising Client", () => {

  const self = this

  let clientInstance

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.nodeRestClient = mockery.mockModule("node-rest-client")

    self.nodeRestClient.Client = function () {

      clientInstance = this

      clientInstance.on = jasmine.createSpy("on")

      clientInstance.get = jasmine.createSpy("get").and.callFake((url, args, callback) => {

        callback("some data", "some response")

        return clientInstance
      })
    }

    mockery.mockModules(self, "../logger")

    self.promisingClient = mockery.require("../promisingClient").makePromisingClient()
  })

  afterEach(mockery.stopAll)

  it("should create methods on the client", () => {

    expect(self.promisingClient.getAndPromise).toBeTruthy()
    expect(self.promisingClient.putAndPromise).toBeTruthy()
    expect(self.promisingClient.postAndPromise).toBeTruthy()
    expect(self.promisingClient.deleteAndPromise).toBeTruthy()
  })

  it("should wrap node-rest-client calls in promises", (done) => {

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(clientInstance.get.calls.mostRecent().args[0]).toEqual("some url")
      expect(clientInstance.get.calls.mostRecent().args[1]).toEqual("some params")
      expect(self.logger.debug).toHaveBeenCalled()

      done()
    })
  })

  it("should warn when we get an error code", (done) => {

    clientInstance.get.and.callFake((url, args, callback) => {

      callback({errorCode: 1234, message: "Things do not feel right"}, {statusCode: 200})

      return clientInstance
    })

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("unexpectedErrorSending", {
        path : 'some url',
        statusCode : 200,
        errorCode : 1234,
        message : 'Things do not feel right'
      })

      done()
    })
  })

  it("should warn us when the response code looks bad", (done) => {

    clientInstance.get.and.callFake((url, args, callback) => {

      callback({message: "I shall pretend you didn't ask me that."}, {statusCode: 500})

      return clientInstance
    })

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("unexpectedErrorSending", { 
        path: "some url", 
        statusCode: 500, 
        errorCode: undefined, 
        message: "I shall pretend you didn\'t ask me that."
      })

      done()
    })
  })

  function fakeNetworkError(code = "ECONNRESET") {

    let called = false

    clientInstance.on.and.callFake((event, callback) => {
      if (!called) {
        called = true
        callback({code})
      }
    })
  }

  function fakeClientGet() {

    clientInstance.get.and.callFake((url, args, callback) => {

      callback({}, {})

      return clientInstance
    })
  }

  it("should retry in the case of a connection reset", (done) => {

    fakeNetworkError()
    fakeClientGet()

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("connectionResetAndRetrying")

      done()
    })
  })

  it("should retry in the case of an EPIPE", (done) => {

    fakeNetworkError("EPIPE")
    fakeClientGet()

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("connectionResetAndRetrying")

      done()
    })
  })

  it("should retry in the case of an EACCES", (done) => {

    fakeNetworkError("EACCES")
    fakeClientGet()

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("connectionResetAndRetrying")

      done()
    })
  })

  it("should retry in the case of an ECONNREFUSED", (done) => {

    fakeNetworkError("ECONNREFUSED")
    fakeClientGet()

    self.promisingClient.getAndPromise("some url", "some params").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("connectionResetAndRetrying")

      done()
    })
  })

  it("should warn us if the request throws an exception", (done) => {

    clientInstance.on = null

    clientInstance.get = jasmine.createSpy("get").and.callFake((url, args, callback) => clientInstance)

    self.promisingClient.getAndPromise("some url", "some params").catch(() => {

      done()
    })
  })
})
