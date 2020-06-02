const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Framework Putter", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "startFileUpload", "doFileSegmentUpload")

    mockery.mockModules(self, "../state", "../utils", "../logger", "../frameworkPaths", "../concurrencySettings")

    self.frameworkPutter = mockery.require("../frameworkPutter")

    self.endPointTransceiver.startFileUpload.returnsResponse({token: "file upload token"}, "startFileUpload etag")
    self.endPointTransceiver.doFileSegmentUpload.returnsResponse({
      result : {
        hadSuccess : true,
        fileResults : [
          {
            destination : "some/vfs/path"
          }
        ]
      }
    }, "doFileSegmentUpload etag")
  })

  afterEach(mockery.stopAll)

  it("should you put framework files", (done) => {

    self.frameworkPutter.putFrameworkFile("framework/some/other.js").then(() => {

      expect(self.endPointTransceiver.startFileUpload).toHaveBeenCalled()
      expect(self.endPointTransceiver.doFileSegmentUpload).toHaveBeenCalled()

      done()
    })
  })

  it("should you put framework directories", (done) => {

    self.utils.walkDirectory.and.callFake((path, listeners) => {
      listeners.listeners.file("/framework/some/dir", {name : "myLittle.js"}, () => {
      })
    })

    self.frameworkPutter.putFrameworkDirectory("framework/some/dir").then(() => {

      expect(self.endPointTransceiver.startFileUpload).toHaveBeenCalled()
      expect(self.endPointTransceiver.doFileSegmentUpload).toHaveBeenCalled()

      expect(self.logger.info).toHaveBeenCalledWith("frameworkFileSavedAt", {destination: 'some/vfs/path'})

      done()
    })
  })
})
