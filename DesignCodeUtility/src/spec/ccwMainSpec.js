const mockery = require('./mockery')
const mockCommander = require('./commanderMockery').mockCommander

const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("main", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.commander = mockCommander(jasmine)

    mockery.mockModules(self, "../utils", "../i18n", "../logger", "../exitHandler", "../metadata", "../etags", "../requestBuilder", "../promisingClient",
      "../endPointTransceiver", "../optionsUtils", "../classifier", "../elementCreator", "../elementMarkupGenerator", "../widgetCreator", '../../package.json')

    self.endPointTransceiver.init.returnsPromise()

    self.optionsUtils.addCommonOptions.returnsFirstArg()
    self.optionsUtils.getPassword.returns("admin")
    self.optionsUtils.getApplicationKey.returnsFirstArg()

    self.utils.exists.returnsTrue()
    self.utils.getHostFromUrl.returnsFirstArg()

    self.exitHandler.addExitHandler.returnsFirstArg()

    self.mainModule = mockery.require("../ccwMain")
  })

  afterEach(mockery.stopAll)

  it("should let you create new widgets", done => {

    self.commander.createWidget = true

    self.mainModule.main().then(() => {

      expect(self.endPointTransceiver.init).toHaveBeenCalledWith("http://somehost:8090", "admin", "admin", undefined, undefined, true)
      expect(self.widgetCreator.create).toHaveBeenCalledWith(false)
      done()
    })
  })

  it("should stop you calling it with no arguments", () => {

    self.mainModule.main()

    expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalledWith(self.commander)
  })

  it("should use the last node if none was supplied", () => {

    delete self.commander.node
    self.commander.createWidget = true

    self.mainModule.main()

    expect(self.metadata.getLastNode).toHaveBeenCalled()
  })

  it("should let you generate element markup", done => {

    self.commander.generateMarkup = "element/Target"

    self.mainModule.main().then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("elementMarkupPreamble")
      expect(self.elementMarkupGenerator.generate).toHaveBeenCalledWith("element/Target")
      done()
    })
  })

  it("should let you create global elements", done => {

    self.commander.createElement = true
    self.commander.clean = true

    self.mainModule.main().then(() => {

      expect(self.elementCreator.create).toHaveBeenCalledWith(true, null, null, undefined)
      done()
    })
  })

  it("should let prevent you generating element markup on a silly directory", done => {

    self.commander.generateMarkup = "stack/directory"
    self.classifier.classify.returns(PuttingFileType.STACK)

    self.mainModule.main().then(() => {

      expect(self.logger.error).toHaveBeenCalledWith("invalidMarkupGenerationTargetDirectory", { elementDir: 'stack/directory' })
      expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
      done()
    })
  })

  it("should let you create elements against a directory", done => {

    self.commander.createElement = "widget/Jim"
    self.classifier.classify.returns(PuttingFileType.WIDGET)

    self.mainModule.main().then(() => {

      expect(self.elementCreator.create).toHaveBeenCalledWith(false, "widget/Jim", PuttingFileType.WIDGET, undefined)
      done()
    })
  })

  it("should stop you creating elements against a silly directory", done => {

    self.commander.createElement = "widget/Jim"
    self.classifier.classify.returns(PuttingFileType.STACK)

    self.mainModule.main().then(() => {

      expect(self.logger.error).toHaveBeenCalledWith("invalidParentElementType", { elementDir: 'widget/Jim' })
      expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
      done()
    })
  })

  it("should stop you creating elements with bad parents", done => {

    self.commander.createElement = "element/Bad"
    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT)
    self.metadata.readMetadataFromDisk.returns({ type : "dynamicFragment" })

    self.mainModule.main().then(() => {

      expect(self.logger.error).toHaveBeenCalledWith("parentElementShouldBeChildless", { elementDir: 'element/Bad' })
      expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
      done()
    })
  })

  it("should stop you creating elements under Oracle elements", done => {

    self.commander.createElement = "element/Oracle"
    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT)
    self.metadata.readMetadataFromDisk.returns({ type : "fragment", source : 100 })

    self.mainModule.main().then(() => {

      expect(self.logger.error).toHaveBeenCalledWith("parentElementIsOracleSupplied", { elementDir: 'element/Oracle' })
      expect(self.exitHandler.exitDueToInvalidCall).toHaveBeenCalled()
      done()
    })
  })
})
