const constants = require("../constants").constants
const matchers = require("./matchers")
const mockery = require("./mockery")

describe("Widget Element Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver",
      "getFragmentTemplate", "getFragmentJavaScript", "getElements", "listWidgets", "getWidget")

    mockery.mockModules(self, "../utils", "../metadata", "../logger", "../grabberUtils", "../widgetInstanceGrabber", "../widgetGrabber", "../elementGrabberUtils", "../elementInstanceGrabber")

    self.elementGrabberUtils.globalElementTags = new Set()

    self.widgetElementGrabber = mockery.require("../widgetElementGrabber")
  })

  afterEach(mockery.stopAll)

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

  /**
   * The boilerplate for widget elements is used in more than one place hence its inclusion here.
   */
  function mockWidgetElementResponses(editableWidget = true) {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.listWidgets.returnsItems(
      {
        repositoryId: "repo0002",
        descriptor: {
          displayName: "My Widget",
          jsEditable: true,
          editableWidget,
          repositoryId: "repo0001",
          version: 1,
          layouts: [],
          widgetType: "MyWidget"
        }
      },
      {
        repositoryId: "repo0003",
        descriptor: {
          displayName: "My Widget",
          jsEditable: true,
          editableWidget,
          repositoryId: "repo0001",
          version: 1,
          layouts: [{}],
          widgetType: "MyWidget"
        }
      })

    self.endPointTransceiver.getWidget.returnsResponse(
      {
        fragments: [
          {
            tag: "jim",
            type: "elementType",
            title: "Jim",
            children: [],
            source: 101,
            repositoryId: "jimElementRepoId",
            version : 1
          }
        ]
      })

    mockCodeResponse(self.endPointTransceiver.getFragmentJavaScript, "javascript", "some widget fragment javascript")
    mockCodeResponse(self.endPointTransceiver.getFragmentTemplate, "template", "some widget fragment template")

    self.utils.sanitizeName.returnsFirstArg()

    self.widgetGrabber.getDirectoryForWidget.returns("widget/My Widget")

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

    self.elementGrabberUtils.isGrabbableElementType.returnsTrue()
  }

  it("should let you grab widget Elements", (done) => {

    mockWidgetElementResponses()

    self.widgetElementGrabber.grabWidgetElements().then(() => {

      expect(self.endPointTransceiver.getFragmentTemplate).urlKeysWere(["repo0001", "jim"])
      expect(self.endPointTransceiver.getFragmentJavaScript).urlKeysWere(["repo0001", "jim"])
      expect(self.endPointTransceiver.getElements).toHaveBeenCalledWith("?globals=true")
      expect(self.endPointTransceiver.getWidget).urlKeysWere(["repo0003"])

      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith("widget/My Widget/element")
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith("widget/My Widget/element/Jim")

      expect(self.logger.info).toHaveBeenCalledWith("grabbingElement", {name: "Jim"})

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("widget/My Widget/element/Jim/element.template", "some widget fragment template", "some widget fragment template etag")
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("widget/My Widget/element/Jim/element.js", "some widget fragment javascript", "some widget fragment javascript etag")

      expect(self.elementGrabberUtils.grabElementModifiableMetadata).toHaveBeenCalledWith(
        {
          repositoryId: "repo0002",
          descriptor: {
            displayName: "My Widget",
            jsEditable: true,
            editableWidget: true,
            repositoryId: "repo0001",
            version: 1,
            layouts: [],
            widgetType: "MyWidget"
          }
        },
        {
          tag: "jim",
          type: "elementType",
          title: "Jim",
          children: [],
          source: 101,
          repositoryId: "jimElementRepoId",
          version: 1
        }, "widget/My Widget/element/Jim")

      expect(self.elementGrabberUtils.storeElementMetaData).toHaveBeenCalledWith(
        {
          tag: "jim",
          type: "elementType",
          title: "Jim",
          children: [],
          source: 101,
          repositoryId: "jimElementRepoId",
          version: 1
        }, "MyWidget", 1, "widget/My Widget/element/Jim")

      done()
    })
  })

  it("should let you grab a specific widget element", (done) => {

    mockWidgetElementResponses()

    self.utils.splitPath.returns("My Widget")

    self.widgetElementGrabber.grabWidgetElements("widget/My Widget").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith('grabbingElement', {name: 'Jim'})

      done()
    })
  })

  it("should not grab a specific widget element when a more up to date widget instance is already there", (done) => {

    mockWidgetElementResponses()

    self.utils.exists.returnsTrue()
    self.metadata.readMetadataFromDisk.returns({ version : 15})

    self.widgetElementGrabber.grabWidgetElements("widget/My Widget").then(() => {

      expect(self.elementInstanceGrabber.processElementInstances).not.toHaveBeenCalled()
      done()
    })
  })

  it("should not grab a specific widget element when it does not exist", (done) => {

    mockWidgetElementResponses()

    self.utils.splitPath.returns("Stupid Widget")

    self.widgetElementGrabber.grabWidgetElements("widget/Stupid Widget").then(() => {

      expect(self.endPointTransceiver.getWidget).not.toHaveBeenCalled()
      done()
    })
  })

  it("should grab widget elements when global tags have already been loaded", (done) => {

    mockWidgetElementResponses()

    self.utils.splitPath.returns("My Widget")

    self.elementGrabberUtils.globalElementTags.add("little-tag")

    self.widgetElementGrabber.grabWidgetElements("widget/My Widget").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith('grabbingElement', {name: 'Jim'})
      done()
    })
  })
})
