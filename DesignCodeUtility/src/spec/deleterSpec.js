"use strict"

const constants = require("../constants").constants
const mockery = require("./mockery")
const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("Deleter", () => {
  const self = this

  const nodeAddress = "http://somehost:9080"
  const widgetInstancePath = "widget/Test Widget/instances/Test Widget Instance"
  const frameworkFile = "static/index.ftl"
  const frameworkDir = "static"

  beforeEach(done => {
    mockery.use(jasmine.createSpy)

    // Set up mock modules
    mockery.mockModules(self,
      "../state",
      "../utils",
      "../logger",
      "../classifier",
      "../metadata",
      "../endPointTransceiver",
      "../widgetInstanceDeleter",
      "../frameworkDeleter",
      "../i18n",
      "../dcuUtils"
    )

    self.i18n.t.returnsFirstArg()
  
    // Mock metadata function calls
    self.metadata.readMetadata.returnsPromise(
      {
        node : nodeAddress
      })
  
    self.metadata.initializeMetadata.returnsPromise()
  
    // Mock utils function calls
    self.utils.normalize.returnsFirstArg()
    self.utils.exists.returnsTrue()

    // Set up the confirmation prompt response
    self.dcuUtils.pose.returnsPromise(
      {
        confirmed: true
      }
    )
  
    self.deleter = mockery.require("../deleter")
  
    setTimeout(() => {
      done()
    }, 1)

  })

  afterEach(mockery.stopAll)


  it("should detect non-existent files", () => {

    // Set up for this test
    self.utils.exists.returnsFalse()

    // Run the test
    self.deleter.delete(widgetInstancePath, nodeAddress)

    // Verify calls made
    expect(self.utils.exists).toHaveBeenCalledWith(widgetInstancePath)
    expect(self.logger.error).toHaveBeenCalledWith("pathDoesNotExist", {path : widgetInstancePath})
  })

  it("should detect server mismatches", done => {

    const otherNodeAddress = "http://someOtherServer:8080"

    self.metadata.readMetadata.returnsPromise(
      {
        node : nodeAddress
      })

    self.deleter.delete(widgetInstancePath, otherNodeAddress).then(() => {

      expect(self.utils.exists).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.configMetadataJson)
      expect(self.logger.error).toHaveBeenCalledWith("cannotDeleteOnDifferentNode", {
        path: widgetInstancePath,
        node: otherNodeAddress,
        configMetadataNode: nodeAddress
      })
      expect(self.widgetInstanceDeleter.deleteWidgetInstance).not.toHaveBeenCalledWith(widgetInstancePath, nodeAddress)
      done()
    })
  })

  it("should warn you when you try and send a silly file", done => {

    self.classifier.classify.returns(null)

    self.deleter.delete(widgetInstancePath, nodeAddress).then(() => {

      expect(self.utils.exists).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.configMetadataJson)
      expect(self.classifier.classify).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.logger.warn).toHaveBeenCalledWith('fileIsNotRecognized', {name : widgetInstancePath})
      expect(self.widgetInstanceDeleter.deleteWidgetInstance).not.toHaveBeenCalledWith(widgetInstancePath, nodeAddress)
      done()
    })
  })

  it("should let you delete a widget instance on the server", done => {

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE)

    self.deleter.delete(widgetInstancePath, nodeAddress).then(() => {

      expect(self.utils.exists).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.configMetadataJson)
      expect(self.classifier.classify).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.dcuUtils.pose).toHaveBeenCalledWith([
        {
          name: "confirmed",
          type: "i18nConfirm",
          message: "confirmDeletePath",
          default: false
        }
      ])

      expect(self.widgetInstanceDeleter.deleteWidgetInstance).toHaveBeenCalledWith(widgetInstancePath, nodeAddress)

      done()
    })
  })

  it("should let you delete a framework file on the server", done => {

    self.classifier.classify.returns(PuttingFileType.FRAMEWORK_FILE)
    self.deleter.delete(frameworkFile, nodeAddress).then(() => {

      expect(self.utils.exists).toHaveBeenCalledWith(frameworkFile)
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(frameworkFile, constants.configMetadataJson)
      expect(self.classifier.classify).toHaveBeenCalledWith(frameworkFile)
      expect(self.dcuUtils.pose).toHaveBeenCalledWith([
        {
          name: "confirmed",
          type: "i18nConfirm",
          message: "confirmDeletePath",
          default: false
        }
      ])

      expect(self.frameworkDeleter.deleteFrameworkContent).toHaveBeenCalledWith(frameworkFile, nodeAddress)

      done()
    })
  })

  it("should let you delete a framework directory on the server", done => {

    self.classifier.classify.returns(PuttingFileType.FRAMEWORK_DIRECTORY)
    self.deleter.delete(frameworkDir, nodeAddress).then(() => {

      expect(self.utils.exists).toHaveBeenCalledWith(frameworkDir)
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(frameworkDir, constants.configMetadataJson)
      expect(self.classifier.classify).toHaveBeenCalledWith(frameworkDir)
      expect(self.dcuUtils.pose).toHaveBeenCalledWith([
        {
          name: "confirmed",
          type: "i18nConfirm",
          message: "confirmDeletePath",
          default: false
        }
      ])

      expect(self.frameworkDeleter.deleteFrameworkContent).toHaveBeenCalledWith(frameworkDir, nodeAddress)

      done()
    })
  })

  it("should not let you delete a path on the server when user rejects confirmation", done => {

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE)

    self.dcuUtils.pose.returnsPromise(
      {
        confirmed: false
      }
    )

    self.deleter.delete(widgetInstancePath, nodeAddress).then(() => {

      expect(self.utils.exists).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.configMetadataJson)
      expect(self.classifier.classify).toHaveBeenCalledWith(widgetInstancePath)
      expect(self.dcuUtils.pose).toHaveBeenCalledWith([
        {
          name: "confirmed",
          type: "i18nConfirm",
          message: "confirmDeletePath",
          default: false
        }
      ])
      expect(self.widgetInstanceDeleter.deleteWidgetInstance).not.toHaveBeenCalledWith(widgetInstancePath, nodeAddress)

      done()
    })
  })

  
})
