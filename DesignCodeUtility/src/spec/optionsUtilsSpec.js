"use strict"

const mockery = require('./mockery')

describe("optionsUtils", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../logger", "../utils", "../i18n", "../metadata", "../../package.json")

    self.i18n.t.returnsFirstArg()

    self["package.json"].version = "1.0"

    self.optionsUtils = mockery.require("../optionsUtils")
  })

  afterEach(() => {

    delete process.env.CC_ADMIN_PASSWORD
    delete process.env.CC_APPLICATION_KEY

    mockery.stopAll()
  })

  it("should let you add common options", () => {

    const option = jasmine.createSpy("option")
    const version = jasmine.createSpy("version")

    const program = {
      option : option.and.callFake(() => {
        return {option, version}
      }),
      version : version.and.callFake(() => {
        return {option, version}
      })
    }

    self.optionsUtils.addCommonOptions(program)

    expect(program.option).toHaveBeenCalledWith('-n, --node <node>', 'nodeOptionText')
  })

  it("should let read a password from the environment", () => {
    expect(self.optionsUtils.getPassword("password")).toEqual("password")

    process.env.CC_ADMIN_PASSWORD = "otherPassword"

    expect(self.optionsUtils.getPassword("password")).toEqual("otherPassword")
  })

  it("should let read an application key from the environment", () => {

    expect(self.optionsUtils.getApplicationKey("1234")).toEqual("1234")

    process.env.CC_APPLICATION_KEY = "5678"

    expect(self.optionsUtils.getApplicationKey("1234")).toEqual("5678")
  })

  it("should let us check version numbers are OK", () => {

    self.metadata.readMetadataFromDisk.returns({packageVersion : "1.0"})

    expect(self.optionsUtils.checkMetadata("some/path")).toBeTruthy()
  })

  it("should let us check version numbers are not OK", () => {

    self.metadata.readMetadataFromDisk.returns({packageVersion : "0.9"})

    expect(self.optionsUtils.checkMetadata("some/path")).toBeFalsy()
  })

  it("should cope with missing metadata", () => {

    expect(self.optionsUtils.checkMetadata("some/path")).toBeTruthy()
  })
})
