"use strict"

const mockery = require('./mockery')

describe("extensionSender", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../logger", "dateformat", "../requestBuilder")

    self.dummyRequestBuilderInstance = {}
    self.dummyRequestBuilderInstance.withBody = jasmine.createSpy("withBody").and.returnValue(self.dummyRequestBuilderInstance)
    self.requestBuilder.request.returns(self.dummyRequestBuilderInstance)

    self.endPointTransceiver =
      mockery.mockModule("../endPointTransceiver", "startFileUpload", "doFileSegmentUpload", "createExtension")

    self.endPointTransceiver.startFileUpload.returnsPromise({data : {token: "upload token"}})
    self.endPointTransceiver.doFileSegmentUpload.returnsPromise({})
    self.endPointTransceiver.createExtension.returnsPromise({})

    self.extensionSender = mockery.require("../extensionSender")
  })

  afterEach(mockery.stopAll)

  it("should send extensions to the server", done => {

    const extension = {
      generate : jasmine.createSpy("generate")
    }

    const resultHandler = jasmine.createSpy("resultHandler")

    self.extensionSender.sendExtension("vfsBase", extension, resultHandler).then(() => {

      expect(self.endPointTransceiver.startFileUpload).toHaveBeenCalledWith(self.dummyRequestBuilderInstance)
      expect(self.dummyRequestBuilderInstance.withBody).toHaveBeenCalledWith({ filename: '/extensions/undefined_ccw_vfsBase.zip', segments: 1 })

      expect(self.endPointTransceiver.doFileSegmentUpload).toHaveBeenCalledWith(
        [ 'upload token' ], '?changeContext=designStudio', self.dummyRequestBuilderInstance)
      expect(self.endPointTransceiver.createExtension).toHaveBeenCalledWith(self.dummyRequestBuilderInstance)
      expect(resultHandler).toHaveBeenCalled()

      done()
    })
  })

  it("should report warnings and errors", () => {

    self.extensionSender.reportErrors(["This is really bad."])

    expect(self.logger.logInfo).toHaveBeenCalledWith("This is really bad.")

    self.extensionSender.reportWarnings(["This is not quite as bad."])

    expect(self.logger.logInfo).toHaveBeenCalledWith("This is not quite as bad.")
    expect(self.logger.info).toHaveBeenCalledWith("uploadWarningsFound")
  })
})
