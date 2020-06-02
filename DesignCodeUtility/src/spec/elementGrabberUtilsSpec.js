const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Element Grabber Utils", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../grabberUtils', '../logger', '../metadata')

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "getFragmentMetadata", "getGlobalElementMetadata")

    self.elementGrabberUtils = mockery.require("../elementGrabberUtils")
  })

  afterEach(mockery.stopAll)

  it("should tell us whether we should grab an element", () => {

    expect(self.elementGrabberUtils.isGrabbableElementType("panel")).toEqual(false)
    expect(self.elementGrabberUtils.isGrabbableElementType("fragment")).toEqual(true)
  })

  it("know if an element is global", () => {

    expect(self.elementGrabberUtils.isGlobal("jim")).toEqual(false)

    self.elementGrabberUtils.globalElementTags.add("jim")

    expect(self.elementGrabberUtils.isGlobal("jim")).toEqual(true)
  })

  it("should create metadata even if there is no endpoint", done => {

    self.elementGrabberUtils.grabElementModifiableMetadata(null,
      {
        version: 1,
        children: [
          {
            tag: "child-tag"
          }
        ]
      }, "element/Jim").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("someElementMetadataCannotBeGrabbed", {path: 'element/Jim'})

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("element/Jim/elementMetadata.json", JSON.stringify({
        "children": [
          "child-tag"
        ]
      }, null, 2), undefined)

      done()
    })
  })

  it("should create metadata for global elements", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getGlobalElementMetadata.returnsResponse({
      version: 1,
      children: [
        {
          tag: "child-tag"
        }
      ]
    }, "metadata etag")

    self.elementGrabberUtils.grabElementModifiableMetadata(null, { tag : "element-tag" }, "element/Jim").then(() => {

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("element/Jim/elementMetadata.json", JSON.stringify({
        "children": [
          "child-tag"
        ]
      }, null, 2), "metadata etag")

      done()
    })
  })

  it("should create metadata for widget elements", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getFragmentMetadata.returnsResponse({
      version: 1,
      children: [
        {
          tag: "child-tag"
        }
      ],
      previewText: null
    }, "metadata etag")

    self.elementGrabberUtils.grabElementModifiableMetadata({ descriptor : { repositoryId : "widgetRepositoryId" }}, { tag : "element-tag" }, "element/Jim").then(() => {

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("element/Jim/elementMetadata.json", JSON.stringify({
        "children": [
          "child-tag"
        ]
      }, null, 2), "metadata etag")

      done()
    })
  })

  it("should create internal metadata", () => {

    const element = {
      tag : "element-tag",
      source : 101,
      repositoryId : "elementRepoId",
      type : "fragment",
      title : "Element Title"
    }

    self.elementGrabberUtils.storeElementMetaData(element, "widgetId", 6, "element/dir")

    expect(self.metadata.writeMetadata).toHaveBeenCalledWith("element/dir/element.json", {
      tag: 'element-tag',
      source: 101,
      type: 'fragment',
      title: 'Element Title',
      widgetType: 'widgetId',
      version: 6
    })
  })
})
