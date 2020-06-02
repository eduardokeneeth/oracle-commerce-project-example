const mockery = require('./mockery')
const mockCommander = require('./commanderMockery').mockCommander

describe("main", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.commander = mockCommander(jasmine)

    mockery.mockModules(self,
      '../state', '../endPointTransceiver', '../metadata', '../grabber', '../widgetPutter', '../putter', '../putterUtils',
      '../i18n', '../utils', '../optionsUtils', '../CCLessCompiler', '../exitHandler', '../../package.json', "../deleter")

    self.endPointTransceiver.init.returnsPromise()

    self.optionsUtils.checkMetadata.returnsTrue()
    self.optionsUtils.addCommonOptions.returnsFirstArg()
    self.optionsUtils.getPassword.returns("admin")

    self.utils.getHostFromUrl.returnsFirstArg()

    self.putter.put.returnsPromise()
    self.putter.putAll.returnsPromise()
    self.grabber.grab.returnsPromise()
    self.grabber.refresh.returnsPromise()
    self.deleter.delete.returnsPromise()

    self.exitHandler.addExitHandler.returnsFirstArg()

    self.mainModule = mockery.require("../dcuMain")
  })

  afterEach(mockery.stopAll)

  it("should let you grab stuff", done => {

    self.commander.clean = true
    self.commander.grab = true

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.grabber.grab).toHaveBeenCalledWith("http://somehost:8090", true, null)
      done()
    })
  })

  it("should let you put files back", done => {

    self.commander.put = "widget/Cart Shipping/instances/Cart Shipping/display.template"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances/Cart Shipping/display.template", "http://somehost:8090", false)

      done()
    })
  })

  it("should let you put multiple files back", done => {

    self.commander.putAll = "widget/Cart Shipping/instances"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances", "http://somehost:8090", true)

      done()
    })
  })

  it("should let you transfer files", done => {

    self.commander.transferAll = "widget/Cart Shipping/instances"

    self.mainModule.main().then(() => {

      expect(self.state.inTransferMode).toHaveBeenCalledWith(true)
      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances", "http://somehost:8090", true)

      done()
    })
  })

  it("should let you transfer an individual file", done => {

    self.commander.transfer = "widget/Account Addresses/instances/Account Addresses Widget/display.template"

    self.mainModule.main().then(() => {

      expect(self.state.inTransferMode).toHaveBeenCalledWith(true)
      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Account Addresses/instances/Account Addresses Widget/display.template", "http://somehost:8090", false)

      done()
    })
  })

  it("should ensure you specify a node", () => {

    self.commander.node = undefined

    self.mainModule.main()

    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
  })

  it("should ensure you specify sensible command line combinations", () => {

    self.commander.transferAll = "widget/Cart Shipping/instances"
    self.commander.allLocales = true

    self.mainModule.main()

    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
  })

  it("should ensure you do not specify multiple operations", () => {

    self.commander.transferAll = "widget/Cart Shipping/instances"
    self.commander.grab = true

    self.mainModule.main()

    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
  })

  it("should be able to get last node from disk if you don't supply it on the command line", done => {

    self.commander.transferAll = "widget/Cart Shipping/instances"

    self.metadata.getLastNode.returns("http://somehost:8090")

    self.commander.transferAll = "widget/Cart Shipping/instances"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances", "http://somehost:8090", true)
      done()
    })
  })

  it("should let us specify a base directory", done => {

    self.commander.put = "widget/Cart Shipping/instances/Cart Shipping/display.template"
    self.commander.base = "some/base/dir"

    self.mainModule.main().then(() => {

      expect(self.utils.useBasePath).toHaveBeenCalledWith("some/base/dir")
      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances/Cart Shipping/display.template", "http://somehost:8090", false)
      done()
    })
  })

  it("should let us specify a user name and password", done => {

    self.optionsUtils.getPassword.returns("fred$password")

    self.commander.put = "widget/Cart Shipping/instances/Cart Shipping/display.template"
    self.commander.base = "some/base/dir"
    self.commander.username = "fred"
    self.commander.password = "fred$password"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "fred", "fred$password", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances/Cart Shipping/display.template", "http://somehost:8090", false)
      done()
    })
  })

  it("should let us specify a password in the environment", done => {

    self.commander.put = "widget/Cart Shipping/instances/Cart Shipping/display.template"
    self.optionsUtils.getPassword.returns("fred$password")

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "fred$password", undefined, undefined, undefined)
      expect(self.putter.put).toHaveBeenCalledWith("widget/Cart Shipping/instances/Cart Shipping/display.template", "http://somehost:8090", false)
      done()
    })
  })

  it("should let you grab stuff for all locales", done => {

    self.commander.grab = true
    self.commander.clean = true
    self.commander.allLocales = true

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, true)
      expect(self.grabber.grab).toHaveBeenCalledWith("http://somehost:8090", true, null)
      done()
    })
  })

  it("should let you grab stuff for a specific locale", done => {

    self.commander.grab = true
    self.commander.clean = true
    self.commander.locale = "de"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, "de", undefined)
      expect(self.grabber.grab).toHaveBeenCalledWith("http://somehost:8090", true, null)
      done()
    })
  })

  it("should let you kick off an automatic less compile", done => {

    self.commander.compileLess = "auto"

    self.CCLessCompiler.compileOnce.returnsPromise()

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      done()
    })
  })

  it("should let you kick off a one off less compile", done => {

    self.commander.compileLess = true

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      done()
    })
  })

  it("should let you update instances and suppress config update", done => {

    self.commander.updateInstances = true
    self.commander.noInstanceConfigUpdate = true
    self.commander.putAll = "widget/Cart Shipping/instances"

    self.mainModule.main().then(() => {

      expect(self.putterUtils.enableUpdateInstances).toHaveBeenCalled()
      expect(self.putterUtils.suppressConfigUpdate).toHaveBeenCalled()
      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      done()
    })
  })

  it("should let you refresh parts of the grabbed source code", done => {

    self.commander.refresh = "widget"

    self.mainModule.main().then(() => {

      expect(self.grabber.refresh).toHaveBeenCalledWith("widget")
      done()
    })
  })

  it("should let you delete a path", done => {
    
    self.commander.delete = "widget/Test Widget/instances/Test Widget Instance"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, undefined)
      expect(self.deleter.delete).toHaveBeenCalledWith("widget/Test Widget/instances/Test Widget Instance", "http://somehost:8090")

      done()
    })
  })

  it("should let you supply a path with a grab", done => {

    self.commander.grab = "path/to/something"
    self.commander.clean = true
    self.commander.locale = "de"

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, "de", undefined)
      expect(self.grabber.grab).toHaveBeenCalledWith("http://somehost:8090", true, "path/to/something")
      done()
    })
  })

  it("should stop you grabbing over two different versions", done => {

    self.commander.grab = "path/to/something"
    self.commander.clean = false
    self.commander.locale = "de"

    self.optionsUtils.checkMetadata.returnsFalse()

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, "de", undefined)
      expect(self.grabber.grab).not.toHaveBeenCalled()
      done()
    })
  })
})
