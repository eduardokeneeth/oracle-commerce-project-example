const mockery = require('./mockery')

describe("Element Utils", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../utils', '../metadata')

    self.elementUtils = mockery.require("../elementUtils")

    self.metadata.readMetadataFromDisk.and.callFake(path => ({ type : path.split("/")[1] }))
  })

  afterEach(mockery.stopAll)

  it("should let you split element tags", () => {

    expect(self.elementUtils.getBaseElementTag("fred@1234")).toBe("fred")
    expect(self.elementUtils.getElementTagRepoId("fred@1234")).toBe("1234")
  })

  it("should override external Element Metadata using the internal metadata when the external values are empty", () => {

    self.metadata.readMetadataFromDisk.returns({
      "tag": "add-to-purchase-list",
      "type": "fragment",
      "title": "Add To Purchase List"
    })

    self.utils.readJsonFile.returns({})

    expect(self.elementUtils.spliceElementMetadata("fred@1234")).toBe('{"type":"fragment","tag":"add-to-purchase-list","title":"Add To Purchase List","availableToAllWidgets":true}')
  })

  it("should not override external Element Metadata using the internal metadata when the external values are supplied", () => {

    self.metadata.readMetadataFromDisk.returns({
      "tag": "add-to-purchase-list",
      "type": "fragment",
      "title": "Add To Purchase List"
    })

    self.utils.readJsonFile.returns({
      translations : [],
      supportedWidgetType : ["any"]
    })

    expect(self.elementUtils.spliceElementMetadata("fred@1234")).toBe('{"translations":[],"supportedWidgetType":["any"],"type":"fragment","tag":"add-to-purchase-list"}')
  })
})
