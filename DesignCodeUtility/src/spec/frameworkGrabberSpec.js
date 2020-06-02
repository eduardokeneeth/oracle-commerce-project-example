const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Framework Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../utils', '../grabberUtils', '../logger', '../concurrencySettings', '../frameworkPaths')
    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver', "get", "getFiles", "getUploadTypes")

    self.utils.sanitizeName.returnsFirstArg()

    self.frameworkGrabber = mockery.require("../frameworkGrabber")

    self.endPointTransceiver.getFiles.returnsItems({
      type : "file",
      path : "vfs/path",
      url : "vfs/path/url"
    })

    self.endPointTransceiver.get.returnsResponse("vfs path contents", "vfs path etag")

    self.frameworkPaths.getBaseVfsPath.returns("thirdparty\/client")
    self.frameworkPaths.toOutputDir.returns("framework\/vfs\/path")
    self.frameworkPaths.toVfsDir.returns("thirdparty\/client\/my\/silly.js")
  })

  afterEach(mockery.stopAll)

  it("should you grab the framework files", (done) => {

    self.endPointTransceiver.getUploadTypes.returnsItems({name : "staticFile"})

    self.frameworkGrabber.grabFramework().then(() => {

      expect(self.endPointTransceiver.getFiles).toHaveBeenCalledWith("?folder=thirdparty/client&assetType=all")

      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("framework/vfs")

      expect(self.logger.info).toHaveBeenCalledWith('grabbingFrameworkFile', {name: 'vfs/path', url: 'vfs/path/url'})

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('framework/vfs/path', "vfs path contents", 'vfs path etag')

      done()
    })
  })

  it("should you grab a specific framework file", (done) => {

    self.frameworkGrabber.grabFrameworkDirectory("framework/my/silly.js").then(() => {

      expect(self.endPointTransceiver.getFiles).toHaveBeenCalledWith("?folder=thirdparty/client/my/silly.js&assetType=all")

      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("framework/vfs")

      expect(self.logger.info).toHaveBeenCalledWith('grabbingFrameworkFile', {name: 'vfs/path', url: 'vfs/path/url'})

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('framework/vfs/path', "vfs path contents", 'vfs path etag')

      done()
    })
  })

  it("should warn you when the server cannot cope", (done) => {

    self.endPointTransceiver.getUploadTypes.returnsItems({name : "someOtherFile"})

    self.frameworkGrabber.grabFramework().then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith('staticFilesCannotBeGrabbed')

      done()
    })
  })

  it("should cope with the upload types endpoint returning a null response", (done) => {

    self.endPointTransceiver.getUploadTypes.returnsPromise(null)

    self.frameworkGrabber.grabFramework().then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith('staticFilesCannotBeGrabbed')

      done()
    })
  })

  it("should cope with the upload types endpoint returning no items", (done) => {

    self.endPointTransceiver.getUploadTypes.returnsPromise({})

    self.frameworkGrabber.grabFramework().then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith('staticFilesCannotBeGrabbed')

      done()
    })
  })
})
