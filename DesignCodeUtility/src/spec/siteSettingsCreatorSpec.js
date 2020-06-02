"use strict"

const constants = require("../constants").constants
const mockery = require("./mockery")
const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("siteSettingsCreator", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../state", "../utils", "../i18n", "../logger", "../classifier", "../templateUtils",
      "../metadata", "../extensionBuilder", "../extensionSender", "../siteSettingsWizard")

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "ho", "hum")

    self.classifier.classify.and.callFake(path => {

      switch (true) {
        case path == "siteSettings/Site Settings Demo/siteSettingsConfigMetadata.json":
          return PuttingFileType.SITE_SETTINGS_METADATA
        case path == "siteSettings/Site Settings Demo/locales/en.json":
          return PuttingFileType.SITE_SETTINGS_SNIPPETS
      }
    })

    self.siteSettingsCreator = mockery.require("../siteSettingsCreator")

    self.siteSettingsWizard.prompt.returnsPromise({
      siteSettingsName: "New Settings Name",
      withHelpText: true,
      syncWithServer: true
    })

    self.endPointTransceiver.locales = [{name: "en"}]

    self.extension = jasmine.createSpy("extension")
  })

  afterEach(mockery.stopAll)

  it("should send extensions to the server", done => {

    self.utils.readFile.returns("locale file contents")

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) => {

      expect(extensionPathFor("siteSettingsType", "siteSettings/Site Settings Demo/siteSettingsConfigMetadata.json")).toEqual("config/siteSettingsType/config.json")
      expect(extensionPathFor("siteSettingsType", "siteSettings/Site Settings Demo/locales/en.json")).toEqual("config/siteSettingsType/locales/en.json")

      expect(extensionContentsFor("siteSettings/Site Settings Demo/locales/en.json")).toEqual("locale file contents")

      onCompleteCallBack(self.extension)
    })

    self.extensionSender.sendExtension.and.callFake((vfsBase, extension, resultHandler) => {
      resultHandler({data: {warnings: ["Great Settings!"], errors: [], success: true}})
    })

    self.siteSettingsCreator.create(true).then(() => {

      expect(self.utils.removeTrackedTree).toHaveBeenCalledWith("siteSettings/New Settings Name")

      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("siteSettings/New Settings Name")

      expect(self.logger.info).toHaveBeenCalledWith("siteSettingsUploadSuccess", { siteSettingsName: 'New Settings Name' })

      done()
    })
  })

  it("should handle failed uploads", done => {

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) => {

      onCompleteCallBack(self.extension)
    })

    self.extensionSender.sendExtension.and.callFake((vfsBase, extension, resultHandler) => {
      resultHandler({data: {warnings: ["Smells funny!"], errors: ["Naughty!"], success: false}})
    })

    self.siteSettingsCreator.create(true).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("siteSettingsUploadFailure", { siteSettingsName: 'New Settings Name' })

      expect(self.extensionSender.reportWarnings).toHaveBeenCalled()
      expect(self.extensionSender.reportErrors).toHaveBeenCalled()

      done()
    })
  })
})
