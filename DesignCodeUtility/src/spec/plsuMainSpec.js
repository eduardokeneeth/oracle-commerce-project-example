const mockery = require('./mockery')
const mockCommander = require('./commanderMockery').mockCommander

describe("plsu main", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.commander = mockCommander(jasmine)

    mockery.mockModules(self,
      '../endPointTransceiver', '../metadata', '../i18n', '../utils',
      '../optionsUtils', '../exitHandler', '../logger', '../pageLayoutDeleter',
      '../pageLayoutGetter', '../pageLayoutLister', '../pageLayoutSender', '../../package.json')

    self.optionsUtils.addMinimalCommonOptions.returnsFirstArg()
    self.optionsUtils.getApplicationKey.returnsFirstArg()

    self.utils.getHostFromUrl.returnsFirstArg()
    self.endPointTransceiver.init.returnsPromise()

    self.exitHandler.addExitHandler.returnsFirstArg()

    self.pageLayouts = [{}]
    self.pageLayoutGetter.getPageLayouts.returnsPromise(self.pageLayouts)

    self.mainModule = mockery.require("../plsuMain")
  })

  afterEach(mockery.stopAll)

  it("should let you list layouts on instance", done => {

    self.commander.list = true
    self.commander.all = true
    self.commander.name = []
    self.commander.applicationKey = "validApplicationKey"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith('http://somehost:8090', null, null, 'validApplicationKey', undefined)
      expect(self.pageLayoutGetter.getPageLayouts).toHaveBeenCalledWith(self.commander.name)
      expect(self.pageLayoutLister.listLayouts).toHaveBeenCalledWith(self.pageLayouts)
      done()
    })
  })

  it("should let you delete layouts on instance", done => {

    self.commander.delete = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith('http://somehost:8090', null, null, 'validApplicationKey', undefined)
      expect(self.pageLayoutGetter.getPageLayouts).toHaveBeenCalledWith(self.commander.name)
      expect(self.pageLayoutDeleter.deletePageLayout).toHaveBeenCalledWith(self.pageLayouts)
      done()
    })
  })

  it("should let you dump layouts on instance", done => {

    self.commander.dump = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith('http://somehost:8090', null, null, 'validApplicationKey', undefined)
      expect(self.pageLayoutGetter.getPageLayouts).toHaveBeenCalledWith(self.commander.name)
      expect(self.pageLayoutLister.listLayouts).toHaveBeenCalledWith(self.pageLayouts, true)
      done()
    })
  })

  it("should let you transfer layouts between instances", done => {

    self.commander.transfer = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"
    self.commander.destinationApplicationKey = "anotherValidApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith('http://somehost:8090', null, null, 'validApplicationKey', undefined)
      expect(self.endPointTransceiver.init).toHaveBeenCalledWith(self.commander.destinationNode, null, null, 'anotherValidApplicationKey', undefined)
      expect(self.pageLayoutGetter.getPageLayouts).toHaveBeenCalledWith(self.commander.name)
      expect(self.pageLayoutSender.sendPageLayouts).toHaveBeenCalledWith(self.pageLayouts)
      done()
    })
  })

  it("should stop you specifying all and name", () => {

    self.commander.transfer = true
    self.commander.name = ["Home"]
    self.commander.all = true
    self.commander.applicationKey = "validApplicationKey"
    self.commander.destinationApplicationKey = "anotherValidApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should stop you call it with no application key", () => {

    self.commander.transfer = true
    self.commander.name = ["Home"]
    self.commander.destinationApplicationKey = "anotherValidApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should stop you call it with no destination application key", () => {

    self.commander.transfer = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should stop you calling it with no options", () => {

    delete self.commander.node

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should stop you calling it with no operation", () => {

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should stop you calling it with no specifier", () => {

    self.commander.transfer = true
    self.commander.name = []

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should stop you trying to delete everything", () => {

    self.commander.delete = true
    self.commander.all = true

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should ensure you supply a destination on transfer", () => {

    self.commander.transfer = true
    self.commander.all = true

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should ensure the source and destination do not match", () => {

    self.commander.transfer = true
    self.commander.all = true
    self.commander.destinationNode = self.commander.node

    self.mainModule.main()
    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should not transfer anything if there are not matching layouts", () => {

    self.commander.transfer = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"
    self.commander.destinationApplicationKey = "anotherValidApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.pageLayoutGetter.getPageLayouts.returnsPromise(null)

    self.mainModule.main()

    expect(self.endPointTransceiver.init).not.toHaveBeenCalledWith(self.commander.destinationNode, null, null, 'anotherValidApplicationKey', undefined)
  })

  it("should detect server version mismatches", (done) => {

    self.commander.transfer = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"
    self.commander.destinationApplicationKey = "anotherValidApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.endPointTransceiver.commerceCloudVersion = "versionA"

    // After page layouts gets called, make it look like the destination version is different.
    self.pageLayoutGetter.getPageLayouts.returnsPromise(() => {
      self.endPointTransceiver.commerceCloudVersion = "versionB"
      return self.pageLayouts
    })

    self.mainModule.main().then(() => {

      expect(self.logger.error).toHaveBeenCalledWith('cannotSendPageLayoutsBetweenVersions', {
        sourceNode: self.commander.node,
        destinationNode: self.commander.destinationNode
      })

      done()
    })
  })

  it("should be able to ignore server version mismatches", (done) => {

    self.commander.transfer = true
    self.commander.ignoreVersions = true
    self.commander.name = ["Home"]
    self.commander.applicationKey = "validApplicationKey"
    self.commander.destinationApplicationKey = "anotherValidApplicationKey"
    self.commander.destinationNode = "http://destinationHost:9080"

    self.endPointTransceiver.commerceCloudVersion = "versionA"

    // After page layouts gets called, make it look like the destination version is different.
    self.pageLayoutGetter.getPageLayouts.returnsPromise(() => {
      self.endPointTransceiver.commerceCloudVersion = "versionB"
      return self.pageLayouts
    })

    self.mainModule.main().then(() => {

      expect(self.logger.error).not.toHaveBeenCalledWith('cannotSendPageLayoutsBetweenVersions', {
        sourceNode: self.commander.node,
        destinationNode: self.commander.destinationNode
      })

      done()
    })
  })
})
