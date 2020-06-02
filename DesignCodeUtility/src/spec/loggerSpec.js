"use strict"

const mockery = require('./mockery')

describe("logger", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.i18n = mockery.mockModule('../i18n')
    self.colors = mockery.mockModule('colors/safe')

    self.i18n.t.returnsFirstArg()

    console.log = jasmine.createSpy("log")
    console.warn = jasmine.createSpy("log")
    console.error = jasmine.createSpy("log")

    self.logger = mockery.require("../logger")
  })

  afterEach(mockery.stopAll)

  it("should log info messages", () => {

    self.logger.info("someKey")

    expect(console.log).toHaveBeenCalledWith(jasmine.stringMatching(/.*someKey$/))
  })

  it("should log warning messages", () => {

    self.colors.yellow = {
      bold : mockery.addConvenienceMethods(jasmine.createSpy("bold"))
    }

    self.colors.yellow.bold.returnsFirstArg()

    self.logger.warn("anotherKey")

    expect(console.warn).toHaveBeenCalledWith(jasmine.stringMatching(/.*anotherKey$/))
    expect(self.colors.yellow.bold).toHaveBeenCalledWith(jasmine.stringMatching(/.*anotherKey$/))
  })

  it("should log error messages", () => {

    self.colors.red = {
      bold : mockery.addConvenienceMethods(jasmine.createSpy("bold"))
    }

    self.colors.red.bold.returnsFirstArg()

    self.logger.error("yetAnotherKey")

    expect(console.error).toHaveBeenCalledWith(jasmine.stringMatching(/.*yetAnotherKey$/))
    expect(self.colors.red.bold).toHaveBeenCalledWith(jasmine.stringMatching(/.*yetAnotherKey$/))
  })

  it("should log debug messages when enabled", () => {

    self.colors.gray = mockery.addConvenienceMethods(jasmine.createSpy("gray"))
    self.colors.gray.returnsFirstArg()

    self.logger.debug("yetAnotherKey")

    expect(console.log).not.toHaveBeenCalledWith(jasmine.stringMatching(/.*yetAnotherKey$/))

    self.logger.setVerboseLogging(true)

    self.logger.debug("yetAnotherKey")

    expect(console.log).toHaveBeenCalledWith(jasmine.stringMatching(/.*yetAnotherKey$/))
    expect(self.colors.gray).toHaveBeenCalledWith(jasmine.stringMatching(/.*yetAnotherKey$/))
  })

  it("should dump objects as JSON", () => {

    const object = { yo : "ho"}

    self.logger.dump(object)

    expect(console.log).toHaveBeenCalledWith(JSON.stringify(object, null, 2))
  })
})
