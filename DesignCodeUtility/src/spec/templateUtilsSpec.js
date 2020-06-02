"use strict"

const mockery = require('./mockery')

describe("templateUtils", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../utils")

    self.templateUtils = mockery.require("../templateUtils")

    self.utils.writeFile.and.callFake((path, output) => {
      self.path = path
      self.output = output
    })
  })

  afterEach(mockery.stopAll)

  it("should let us render element metadata", done => {

    const context = {
      "inline": true,
      "elementTag": "test-element-tag",
      "children": ["huey", "duey", "louey"],
      "configOptions": ["textBox"],
      "defaultText": "",
      "previewText": "",
      "type": "dynamicFragment"
    }

    self.templateUtils.renderWithTemplate("../examples/element/exampleMetadataJson", context, (err, out) => {

      const metadata = JSON.parse(out)

      expect(metadata.inline).toEqual(true)
      expect(metadata.tag).toEqual("test-element-tag")
      expect(metadata.children).toEqual(["huey", "duey", "louey"])
      expect(metadata.configOptions).toEqual(["textBox"])
      expect(metadata.type).toEqual("dynamicFragment")

      done()
    })
  })

  it("should let us render element javascript", () => {

    const context = {
      elementTag: "yoko"
    }

    self.templateUtils.createFileFromTemplate("path/to/element/js", context, "../examples/element/exampleJs")

    expect(self.path).toEqual("path/to/element/js")
    expect(self.output).toContain("yoko")
  })

  it("should let us render element templates", () => {

    const context = {
      withJavaScript: true,
      elementTag: "my-element-tag",
      textBox: true,
      elementBody: "<P>ELEMENT_BODY</P>"
    }

    self.templateUtils.createFileFromTemplate("path/to/element/template", context, "../examples/element/exampleTemplate")

    expect(self.path).toEqual("path/to/element/template")
    expect(self.output).toContain("initialized")
    expect(self.output).toContain("widgetLocaleText")
    expect(self.output).toContain("my-element-tag")
    expect(self.output).toContain("<P>ELEMENT_BODY</P>")
  })

  it("should let us render widget metadata", done => {

    const context = {
      withHelpText: true
    }

    self.templateUtils.renderWithTemplate("../examples/widget/exampleMetadataJson", context, (err, out) => {

      const metadata = JSON.parse(out)

      expect(metadata.config.exampleStringProperty).toEqual("Example String Property Value")
      expect(metadata.config.exampleOptionProperty).toEqual("option1")
      expect(metadata.config.exampleBooleanProperty).toEqual(true)

      done()
    })
  })

  it("should let us render widget config metadata", () => {

    const context = {
      widgetType: "littleLostWidget",
      withHelpText: true
    }

    self.templateUtils.createFileFromTemplate("path/to/config/metadata", context, "../examples/widget/exampleConfigMetadataJson")

    expect(self.path).toEqual("path/to/config/metadata")
    expect(self.output).toContain("littleLostWidget")
    expect(self.output).toContain("exampleOptionProperty")
  })

  it("should let us render widget config resources", () => {

    const context = {
      withHelpText: true
    }

    self.templateUtils.createFileFromTemplate("path/to/config/resources", context, "../examples/widget/exampleConfigResourcesJson")

    expect(self.path).toEqual("path/to/config/resources")
    expect(self.output).toContain("Example String Property Label")
  })

  it("should let us render widget javascript", () => {

    const context = {
      withHelpText: true,
      configurable: true,
      i18n: true
    }

    self.templateUtils.createFileFromTemplate("path/to/widget/js", context, "../examples/widget/exampleJs")

    expect(self.path).toEqual("path/to/widget/js")
    expect(self.output).toContain("is bound to")
    expect(self.output).toContain("Configuration properties")
    expect(self.output).toContain("Localized resource values")
  })

  it("should let us render widget less", () => {

    const context = {
      withHelpText: true,
      widgetType: "fester"
    }

    self.templateUtils.createFileFromTemplate("path/to/widget/less", context, "../examples/widget/exampleLess")

    expect(self.path).toEqual("path/to/widget/less")
    expect(self.output).toContain("Blank Widget Styles")
    expect(self.output).toContain("fester")
  })

  it("should let us render widget resources", () => {

    const context = {
      withHelpText: true
    }

    self.templateUtils.createFileFromTemplate("path/to/widget/resources", context, "../examples/widget/exampleResourcesJson")

    expect(self.path).toEqual("path/to/widget/resources")
    expect(self.output).toContain("Example Resource String")
  })

  it("should let us render widget templates", () => {

    const context = {
      elementized: false,
      widgetType: "Jordan",
      elementMarkup: "ELEMENT_MARKUP",
      withHelpText: true,
      i18n: true
    }

    self.templateUtils.createFileFromTemplate("path/to/widget/template", context, "../examples/widget/exampleTemplate")

    expect(self.path).toEqual("path/to/widget/template")
    expect(self.output).toContain("Localized resource values")
    expect(self.output).toContain("Jordan")

    context.elementized = true

    self.templateUtils.createFileFromTemplate("path/to/widget/template", context, "../examples/widget/exampleTemplate")

    expect(self.output).toContain("templateRegion")
    expect(self.output).toContain("ELEMENT_MARKUP")
    expect(self.output).not.toContain("loaded")
  })
})
