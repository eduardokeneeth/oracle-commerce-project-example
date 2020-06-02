"use strict"

const mockery = require('./mockery')

describe("Deleter Utils", () => {

  const self = this

  const path = "/some/path";

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.deleterUtils = mockery.require("../deleterUtils")
  })

  afterEach(mockery.stopAll)

  it("should return true for 200 status code", done => {
    // Set up the HTTP response
    const results = {
      response: { statusCode: 200 }
    }

    // Run test
    const outcome = self.deleterUtils.processDeleteResult(path, results)
    expect(outcome).toBeTruthy()
    done()
  })


  it("should return false for 199 status code", done => {
    // Set up the HTTP response
    const results = {
      response: { statusCode: 199 }
    }

    // Run test
    const outcome = self.deleterUtils.processDeleteResult(path, results)
    expect(outcome).toBeFalsy()
    done()
  })

  it("should return true for 299 status code", done => {
    // Set up the HTTP response
    const results = {
      response: { statusCode: 299 }
    }

    // Run test
    const outcome = self.deleterUtils.processDeleteResult(path, results)
    expect(outcome).toBeTruthy()
    done()
  })


  it("should return false for 300 status code", done => {
    // Set up the HTTP response
    const results = {
      response: { statusCode: 300 }
    }

    // Run test
    const outcome = self.deleterUtils.processDeleteResult(path, results)
    expect(outcome).toBeFalsy()
    done()
  })

})
