"use strict"

const Promise = require("bluebird")

const constants = require("../constants").constants
const mockery = require("./mockery")

describe("Widget Instance Deleter", () => {
  const self = this

  const widgetDescriptorId = "wd1111"
  const widgetInstanceId = "wi2222"
  const widgetInstanceName = "Test Widget Instance"
  const etagValue = "etag value"
  const widgetInstancePath = "widget/Test Widget/instances/Test Widget Instance"
  const nodeAddress = "http://somehost:9080"

  /**
   * Setup before each test case
   */
  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    // Setup the endpoint recei ver
    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "deleteWidgetInstance")

    // Set up module mocks
    mockery.mockModules(self,
      "../putterUtils",
      "../state", 
      "../utils", 
      "../deleterUtils", 
      "../metadata", 
      "../logger", 
      "../etags"
    )


    // Mock the call to metadata.readMetadata for wiget instance metadata
    self.metadata.readMetadata.and.callFake(Promise.method(function(path, type) {
      return {
        repositoryId: widgetInstanceId,
        descriptorRepositoryId: widgetDescriptorId,
        etag: etagValue,
        displayName: widgetInstanceName,
        version: 1
      }
    }))

    // Mock the call to metadata.getCachedWidgetInstanceFromMetadata
    self.metadata.getCachedWidgetInstanceFromMetadata.returns({
      descriptor: {
        repositoryId: widgetDescriptorId
      },
      repositoryId: widgetInstanceId
    })

    // Force reload of deleter utils as it can be left with old spies
    self.deleterUtils = mockery.require("../deleterUtils")
    self.deleterUtils.processDeleteResult.returnsTrue()

    // Force reload of putter utils
    self.putterUtils = mockery.require("../putterUtils")
    self.putterUtils.shouldSuppressThemeCompile.returnsFalse()

    // What we need to test
    self.widgetInstanceDeleter = mockery.require("../widgetInstanceDeleter")

    // Set up the delete endpoint
    self.endPointTransceiver.deleteWidgetInstance.returnsPromise(null)
  
  })

  /**
   * Teardown after each test case
   */
  afterEach(mockery.stopAll)

  it("should not let you delete widget instance if there is no instance metadata on server", done => {
    // Reconfigure the mocked method
    self.metadata.readMetadata.returnsPromise(null)

    // Try to delete the widget instance
    self.widgetInstanceDeleter.deleteWidgetInstance(widgetInstancePath, nodeAddress).then(() => {
      // Verify the mocks
      expect(self.logger.info).toHaveBeenCalledWith("deletingPath", {
        path : widgetInstancePath,
        node : nodeAddress
      })
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.widgetInstanceMetadataJson)
      expect(self.metadata.getCachedWidgetInstanceFromMetadata).not.toHaveBeenCalled()
      expect(self.logger.info).not.toHaveBeenCalledWith("deletingWidgetInstance", {name: widgetInstanceName})
      expect(self.endPointTransceiver.deleteWidgetInstance).not.toHaveBeenCalled()

      done()
    })

   })

  it("should not let you delete widget instance if there is no instance metadata on disk", done => {
    // Reconfigure the mocked method
    self.metadata.getCachedWidgetInstanceFromMetadata.returns(null)

    // Try to delete the widget instance
    self.widgetInstanceDeleter.deleteWidgetInstance(widgetInstancePath, nodeAddress).then(() => {

      // Verify the mocks
      expect(self.logger.info).toHaveBeenCalledWith("deletingPath", {
        path : widgetInstancePath,
        node : nodeAddress
      })
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.widgetInstanceMetadataJson)
      expect(self.metadata.getCachedWidgetInstanceFromMetadata).toHaveBeenCalled()
      expect(self.logger.info).not.toHaveBeenCalledWith("deletingWidgetInstance", {name: widgetInstanceName})
      expect(self.endPointTransceiver.deleteWidgetInstance).not.toHaveBeenCalled()

      done()
    })

   })

  it("should not let you delete widget instance if endpoint not supported", done => {

    // Set up the endpoint check to fail
    self.endPointTransceiver.serverSupports.returnsFalse()

    // Try to delete the widget instance
    self.widgetInstanceDeleter.deleteWidgetInstance(widgetInstancePath, nodeAddress).then(() => {

      // Verify the mocks
      expect(self.logger.info).toHaveBeenCalledWith("deletingPath", {
        path : widgetInstancePath,
        node : nodeAddress
      })
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.widgetInstanceMetadataJson)
      expect(self.metadata.getCachedWidgetInstanceFromMetadata).toHaveBeenCalled()
      expect(self.logger.warn).toHaveBeenCalledWith("widgetInstanceCannotBeDeleted", {name: widgetInstanceName})
      expect(self.logger.info).not.toHaveBeenCalledWith("deletingWidgetInstance", {name: widgetInstanceName})
      expect(self.endPointTransceiver.deleteWidgetInstance).not.toHaveBeenCalled()

      done()

    })

  })

  it("should let you delete widget instance if endpoint is supported", done => {

    // Outcome of checking whether the endpoint is supported
    self.endPointTransceiver.serverSupports.returnsTrue()

    // Try to delete the widget instance
    self.widgetInstanceDeleter.deleteWidgetInstance(widgetInstancePath, nodeAddress).then(() => {

      // Verify the mocks
      expect(self.logger.info).toHaveBeenCalledWith("deletingPath", {
        path : widgetInstancePath,
        node : nodeAddress
      })
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.widgetInstanceMetadataJson)
      expect(self.metadata.getCachedWidgetInstanceFromMetadata).toHaveBeenCalled()
      // TODO: fails at this point because serverSupports still returns false even though it is mocked to return true
      expect(self.logger.warn).not.toHaveBeenCalled()
      expect(self.logger.info).toHaveBeenCalledWith("deletingWidgetInstance", {name: widgetInstanceName})
      expect(self.endPointTransceiver.deleteWidgetInstance).toHaveBeenCalledWith([widgetInstanceId], '?suppressThemeCompile=false')

      done()
    })

  })

  it("suppress theme compilation when deleting widget instance", done => {

    // Outcome of checking whether the endpoint is supported
    self.endPointTransceiver.serverSupports.returnsTrue()

    // theme compilation is suppressed
    self.putterUtils.shouldSuppressThemeCompile.returnsTrue()

    // Try to delete the widget instance
    self.widgetInstanceDeleter.deleteWidgetInstance(widgetInstancePath, nodeAddress).then(() => {

      // Verify the mocks
      expect(self.logger.info).toHaveBeenCalledWith("deletingPath", {
        path : widgetInstancePath,
        node : nodeAddress
      })
      expect(self.metadata.readMetadata).toHaveBeenCalledWith(widgetInstancePath, constants.widgetInstanceMetadataJson)
      expect(self.metadata.getCachedWidgetInstanceFromMetadata).toHaveBeenCalled()
      // TODO: fails at this point because serverSupports still returns false even though it is mocked to return true
      expect(self.logger.warn).not.toHaveBeenCalled()
      expect(self.logger.info).toHaveBeenCalledWith("deletingWidgetInstance", {name: widgetInstanceName})
      expect(self.endPointTransceiver.deleteWidgetInstance).toHaveBeenCalledWith([widgetInstanceId], '?suppressThemeCompile=true')

      done()
    })

  })

})
