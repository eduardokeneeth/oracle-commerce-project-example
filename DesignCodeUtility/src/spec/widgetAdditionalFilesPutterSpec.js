const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Widget Additional Files Putter", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    mockery.mockModules(self, '../utils', '../logger', '../etags', '../metadata', '../putterUtils')
    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "checkInWidgetDescriptorFile", "startFileUpload", "doFileSegmentUpload")

    self.utils.splitFromBaseDir.returns(["", "widget/Fred"])

    self.widgetAdditionalFilesPutter = mockery.require("../widgetAdditionalFilesPutter")
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", (done) => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetAdditionalFilesPutter.putWidgetAdditionalFile("widget/Fred/someFile.txt").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("additionalWidgetFileCannotBeSent",
        {path: 'widget/Fred/someFile.txt'})
      done()
    })
  })

  it("should let you update additional widget less files", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.etags.eTagFor.returns("etag value")
    const checkInResults = self.endPointTransceiver.checkInWidgetDescriptorFile.returnsPromise(
      {
        response: {
          headers: {
            etag: "check in etag value"
          }
        }
      })
    const startFileUploadResults = self.endPointTransceiver.startFileUpload.returnsPromise(
      {
        data : {
          token : "upload token value"
        }
      })
    const doFileSegmentUploadResults = self.endPointTransceiver.doFileSegmentUpload.returnsPromise({})

    self.metadata.readMetadata.returnsPromise({})
    self.putterUtils.processPutResult.returnsTrue()

    self.widgetAdditionalFilesPutter.putWidgetAdditionalLessFile("widget/Fred/additional.less").then(() => {

      expect(self.etags.writeEtag).toHaveBeenCalledWith('widget/Fred/additional.less', 'check in etag value')
      done()
    })
  })

  it("should let you update additional widget templates", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.etags.eTagFor.returns("etag value")
    const checkInResults = self.endPointTransceiver.checkInWidgetDescriptorFile.returnsPromise(
      {
        response: {
          headers: {
            etag: "check in etag value"
          }
        }
      })
    const startFileUploadResults = self.endPointTransceiver.startFileUpload.returnsPromise(
      {
        data : {
          token : "upload token value"
        }
      })
    const doFileSegmentUploadResults = self.endPointTransceiver.doFileSegmentUpload.returnsPromise({})

    self.metadata.readMetadata.returnsPromise({})
    self.putterUtils.processPutResult.returnsTrue()

    self.widgetAdditionalFilesPutter.putWidgetAdditionalTemplateFile("widget/Fred/additional.template").then(() => {

      expect(self.etags.writeEtag).toHaveBeenCalledWith('widget/Fred/additional.template', 'check in etag value')
      done()
    })
  })
})
