const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Widget Additional Files Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "listWidgetDescriptorFiles", "checkOutWidgetDescriptorFile")

    mockery.mockModules(self, "../utils", "../etags")

    self.widgetAdditionalFilesGrabber = mockery.require("../widgetAdditionalFilesGrabber")
  })

  afterEach(mockery.stopAll)

  it("should grab non standard files and stick them in the right place", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.endPointTransceiver.listWidgetDescriptorFiles.returnsResponse({
      files: {
        "additional.txt" : "big long url",
        "less/additional.less" : "big long url for less",
        "additional.template" : "big long url for template"
      }
    })

    self.endPointTransceiver.checkOutWidgetDescriptorFile.returnsPromise({
      response : {
        headers : {
          etag : "check out etag value"
        }
      }
    })

    self.endPointTransceiver.get.returnsResponse("file contents from server")

    self.widgetAdditionalFilesGrabber.grabNonStandardFiles({"id": "widget ID"}, "widget/Fred").then(() => {

      expect(self.utils.writeFile).toHaveBeenCalledWith('widget/Fred/additional.template', 'file contents from server')
      expect(self.utils.writeFile).toHaveBeenCalledWith('widget/Fred/additional.less', 'file contents from server')
      expect(self.utils.writeFile).toHaveBeenCalledWith('widget/Fred/additional.txt', 'file contents from server')

      expect(self.etags.writeEtag).toHaveBeenCalledWith('widget/Fred/additional.template', 'check out etag value')
      expect(self.etags.writeEtag).toHaveBeenCalledWith('widget/Fred/additional.txt', 'check out etag value')
      expect(self.etags.writeEtag).toHaveBeenCalledWith('widget/Fred/additional.less', 'check out etag value')

      done()
    })
  })
})
