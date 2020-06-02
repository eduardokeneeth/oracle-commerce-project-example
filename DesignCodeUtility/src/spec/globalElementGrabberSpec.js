const constants = require("../constants").constants
const matchers = require("./matchers")
const mockery = require("./mockery")

describe("Global Element Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver",
      "getElements", "getGlobalElementJavaScript", "getGlobalElementTemplate")

    mockery.mockModules(self, "../utils", "../metadata", "../grabberUtils", "../logger", "../elementGrabberUtils")

    self.elementGrabberUtils.globalElementTags = new Set()

    self.globalElementGrabber = mockery.require("../globalElementGrabber")

    self.endPointTransceiver.getElements.returnsItems(
      {
        tag: "fred",
        type: "elementType",
        title: "Fred",
        children: [],
        source: 101,
        repositoryId: "fredElementRepoId"
      }
    )

    mockCodeResponse(self.endPointTransceiver.getGlobalElementJavaScript, "javascript", "some global javascript")
    mockCodeResponse(self.endPointTransceiver.getGlobalElementTemplate, "template", "some global template")

    self.utils.sanitizeName.returnsFirstArg()

    self.elementGrabberUtils.isGrabbableElementType.returnsTrue()

  })

  afterEach(mockery.stopAll)

  it("should warn you if the server does not support the right endpoints", () => {

    self.globalElementGrabber.grabGlobalElements()

    expect(self.logger.warn).toHaveBeenCalledWith("globalElementsCannotBeGrabbed")
  })

  /**
   * About four of the endpoints have very similar responses so this function is used to reduce boilerplate.
   * @param spy
   * @param field
   * @param text
   */
  function mockCodeResponse(spy, field, text) {

    var data = {
      code: {}
    }

    data.code[field] = text

    spy.returnsResponse(data, `${text} etag`)
  }

  it("should let you grab all Elements", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.globalElementGrabber.grabGlobalElements().then(() => {

      expect(self.endPointTransceiver.getElements).toHaveBeenCalledWith("?globals=true")
      expect(self.endPointTransceiver.getGlobalElementJavaScript).urlKeysWere(["fred"])
      expect(self.endPointTransceiver.getGlobalElementTemplate).urlKeysWere(["fred"])

      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(constants.elementsDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith("element/Fred")

      expect(self.logger.info).toHaveBeenCalledWith("grabbingElement", {name: "Fred"})

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("element/Fred/element.js", "some global javascript", "some global javascript etag")
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("element/Fred/element.template", "some global template", "some global template etag")

      expect(self.elementGrabberUtils.storeElementMetaData).toHaveBeenCalledWith(
        {
          tag: "fred",
          type: "elementType",
          title: "Fred",
          children: [],
          source: 101,
          repositoryId: "fredElementRepoId"
        }, null, null, "element/Fred")

      expect(self.elementGrabberUtils.grabElementModifiableMetadata).toHaveBeenCalledWith(null,
        {
          tag: "fred",
          type: "elementType",
          title: "Fred",
          children: [],
          source: 101,
          repositoryId: "fredElementRepoId"
        }, "element/Fred")

      done()
    })
  })

  it("should let you grab a specific global element", (done) => {

    self.utils.splitPath.returns("Fred")

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.globalElementGrabber.grabGlobalElement("element/Fred").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("grabbingElement", {name: "Fred"})

      done()
    })
  })  
  
  it("should warn you if you try to grab a non-existent global element", (done) => {

    self.utils.splitPath.returns("Bonkers")

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.globalElementGrabber.grabGlobalElement("element/Bonkers").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("noMatchFound", { name : "Bonkers" })

      done()
    })
  })

  it("should not grab a global element when it is the wrong type", (done) => {

    self.elementGrabberUtils.isGrabbableElementType.returnsFalse()

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.globalElementGrabber.grabGlobalElement("element/Fred").then(() => {

      expect(self.logger.info).not.toHaveBeenCalledWith("grabbingElement", {name: "Fred"})

      done()
    })
  })

  it("should not grab a global element when it has already been grabbed", (done) => {

    self.elementGrabberUtils.globalElementTags.add("fred")

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.globalElementGrabber.grabGlobalElement("element/Fred").then(() => {

      expect(self.logger.info).not.toHaveBeenCalledWith("grabbingElement", {name: "Fred"})

      done()
    })
  })
})
