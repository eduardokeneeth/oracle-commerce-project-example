const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("Framework Deleter", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "deleteFile")
    
    mockery.mockModules(self, "../state", "../utils", "../logger", "../frameworkPaths", "../concurrencySettings", "../classifier")

    self.frameworkDeleter = mockery.require("../frameworkDeleter")

    self.endPointTransceiver.deleteFile.returnsPromise()
  })

  afterEach(mockery.stopAll)

  it("should you delete framework files", (done) => {

    self.frameworkDeleter.deleteFrameworkContent("framework/some/other.js", "node name").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("deletingPath",
        { path: "framework/some/other.js", node: "node name"  })
      expect(self.endPointTransceiver.deleteFile).toHaveBeenCalled()

      done()
    })
  })

  it("should you delete all the framework directory contents", (done) => {

    self.classifier.classify.returns(PuttingFileType.FRAMEWORK_DIRECTORY)

    self.utils.walkDirectory.and.callFake((path, listeners) => {
      listeners.listeners.file && listeners.listeners.file("/framework/some", {name : "other.js"}, () => {})
      listeners.listeners.directory && listeners.listeners.directory("/framework", {name : "some"}, () => {})
    })

    self.frameworkDeleter.deleteFrameworkContent("framework", "node name").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("deletingPath",
        { path: "C:/framework/some/other.js", node: "node name" })
      expect(self.endPointTransceiver.deleteFile).toHaveBeenCalled()
      expect(self.utils.removeTrackedTree).toHaveBeenCalledWith("C:/framework/some/other.js")
      expect(self.utils.removeTrackedTree).toHaveBeenCalledWith("C:/framework/some")

      done()
    })
  })
})
