const mockery = require('./mockery')

const constants = require("../constants").constants

describe("Element Markup Generator", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../utils', '../logger', '../metadata', '../classifier')

    self.elementMarkupGenerator = mockery.require("../elementMarkupGenerator")
  })

  afterEach(mockery.stopAll)

  it("should stop you generating markup for Oracle elements", () => {

    self.elementMarkupGenerator.generate("elementDir")

    expect(self.logger.error).toHaveBeenCalledWith("parentElementIsOracleSupplied", {elementDir: 'elementDir'})
  })

  it("should stop you generating markup for fragments of the wrong type", () => {

    self.utils.exists.returnsTrue()
    self.utils.readJsonFile.returns({})
    self.metadata.readMetadataFromDisk.and.callFake((directory) => ({
      type: "notFragment"
    }))

    self.elementMarkupGenerator.generate("elementDir")

    expect(self.logger.error).toHaveBeenCalledWith("elementTypeShouldBeFragment", {elementDir: 'elementDir'})
  })

  it("should generate markup for simple fragments", () => {

    self.utils.exists.returnsTrue()
    self.utils.readJsonFile.returns({})
    self.metadata.readMetadataFromDisk.and.callFake((directory) => ({
      type: "fragment",
      tag: "simple-fragment"
    }))

    expect(self.elementMarkupGenerator.generate("elementDir")).toBe(
      "<!-- oc section: simple-fragment -->\n  <div data-bind=\"element: 'simple-fragment'\"></div>\n<!-- /oc -->\n")
  })

  function mockUserElementMetadata(self) {

    self.utils.readJsonFile.and.callFake(path => {

      switch (true) {
        case path == "element/Top Level Element/elementMetadata.json":
          return {
            tag: "top-level-element",
            children: ["container-element"]
          }
        case path == "element/Container Element/elementMetadata.json":
          return {
            tag: "container-element",
            children: ["leaf-element"]
          }
        case path == "element/Leaf Element/elementMetadata.json":
          return {
            tag: "leaf-element",
            children: []
          }
      }
    })

    self.utils.walkDirectory.and.callFake((path, callbacks) => {
      callbacks.listeners.file("element/Top Level Element", {name: constants.userElementMetadata}, () => null)
      callbacks.listeners.file("element/Container Element", {name: constants.userElementMetadata}, () => null)
      callbacks.listeners.file("element/Leaf Element", {name: constants.userElementMetadata}, () => null)
    })
  }

  it("should tell you when the containing element is the wrong type", () => {

    self.utils.exists.returnsTrue()

    mockUserElementMetadata(self);

    self.metadata.readMetadataFromDisk.and.callFake(path => {

      switch (true) {
        case path == "element/Top Level Element":
          return {
            type: "fragment",
            tag: "top-level-element",
            children: ["container-element"]
          }
        case path == "element/Container Element":
          return {
            type: "fragment"
          }
        case path == "element/Leaf Element/elementMetadata.json":
          return {
          }
      }
    })

    self.elementMarkupGenerator.generate("element/Top Level Element")

    expect(self.logger.error).toHaveBeenCalledWith("elementTypeShouldBeContainerOrHidden", {elementDir: "element/Container Element"})
  })

  it("should tell you when the leaf element is the wrong type", () => {

    self.utils.exists.returnsTrue()

    mockUserElementMetadata(self);

    self.metadata.readMetadataFromDisk.and.callFake(path => {

      switch (true) {
        case path == "element/Top Level Element":
          return {
            type: "fragment",
            tag: "top-level-element",
            children: ["container-element"]
          }
        case path == "element/Container Element":
          return {
            type: "container"
          }
        case path == "element/Leaf Element":
          return {
            type : "fragment"
          }
      }
    })

    self.elementMarkupGenerator.generate("element/Top Level Element")

    expect(self.logger.error).toHaveBeenCalledWith("elementTypeShouldBeStaticDynamicOrSub", {elementDir: "element/Leaf Element"})
  })

  it("should generate markup for rich elements", () => {

    self.utils.exists.returnsTrue()

    mockUserElementMetadata(self)

    self.metadata.readMetadataFromDisk.and.callFake(path => {

      switch (true) {
        case path == "element/Top Level Element":
          return {
            type: "fragment",
            tag: "top-level-element",
            children: ["container-element"]
          }
        case path == "element/Container Element":
          return {
            type: "container",
            tag : "container-element",
            children: ["leaf-element"]
          }
        case path == "element/Leaf Element":
          return {
            type : "staticFragment",
            tag : "leaf-element"
          }
      }
    })

    expect(self.elementMarkupGenerator.generate("element/Top Level Element")).toBe(
      "<!-- oc section: top-level-element -->\n" +
      "  <div data-oc-id=\"container-element\">\n" +
      "    <div data-bind=\"element: 'leaf-element'\"></div>\n" +
      "  </div>\n" +
      "<!-- /oc -->\n")
  })
})
