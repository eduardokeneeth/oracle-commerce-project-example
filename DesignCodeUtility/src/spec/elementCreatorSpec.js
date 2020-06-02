"use strict"

const constants = require("../constants").constants
const mockery = require("./mockery")
const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("elementCreator", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../state", "../utils", "../i18n", "../logger", "../classifier", "../templateUtils",
      "../metadata", "../endPointTransceiver", "../extensionBuilder", "../extensionSender", "../elementWizard", "../elementUtils")

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "getElements")

    self.elementCreator = mockery.require("../elementCreator")
  })

  afterEach(mockery.stopAll)

  it("should let us create rich global elements with example code", done => {

    self.elementWizard.prompt.returnsPromise({
      elementName: "New Element",
      type: "fragment",
      i18n: true,
      withJavaScript: true,
      withSubElements: true,
      configOptions: ["available"],
      inline: false,
      withHelpText: true,
      syncWithServer: false
    })

    self.templateUtils.renderWithTemplate.and.callFake((path, context, callback) => {
      callback(null, "{}")
    })

    self.endPointTransceiver.locales = [{name: "en"}, {name: "de"}]
    self.endPointTransceiver.locale = "en"

    self.elementCreator.create(true, "", null, null).then(() => {

      expect(self.templateUtils.createFileFromTemplate.calls.all()[0].args[0]).toEqual("element/New Element/element.js")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[1].args[0]).toEqual("element/New Element Example Static Element/element.js")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[2].args[0]).toEqual("element/New Element Example Static Element/element.template")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[3].args[0]).toEqual("element/New Element Example Dynamic Element/element.js")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[4].args[0]).toEqual("element/New Element Example Dynamic Element/element.template")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[5].args[0]).toEqual("element/New Element Example Sub Element/element.js")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[6].args[0]).toEqual("element/New Element Example Sub Element/element.template")

      expect(self.utils.writeFile.calls.all()[0].args[0]).toEqual("element/New Element Example Static Element/elementMetadata.json")
      expect(self.utils.writeFile.calls.all()[1].args[0]).toEqual("element/New Element Example Dynamic Element/elementMetadata.json")
      expect(self.utils.writeFile.calls.all()[2].args[0]).toEqual("element/New Element Example Sub Element/elementMetadata.json")
      expect(self.utils.writeFile.calls.all()[3].args[0]).toEqual("element/New Element Example Container Element/elementMetadata.json")
      expect(self.utils.writeFile.calls.all()[4].args[0]).toEqual("element/New Element/elementMetadata.json")

      expect(self.metadata.writeMetadata.calls.all()[0].args[0]).toEqual("element/New Element Example Static Element/element.json")
      expect(self.metadata.writeMetadata.calls.all()[1].args[0]).toEqual("element/New Element Example Dynamic Element/element.json")
      expect(self.metadata.writeMetadata.calls.all()[2].args[0]).toEqual("element/New Element Example Sub Element/element.json")
      expect(self.metadata.writeMetadata.calls.all()[3].args[0]).toEqual("element/New Element Example Container Element/element.json")
      expect(self.metadata.writeMetadata.calls.all()[4].args[0]).toEqual("element/New Element/element.json")

      done()
    })
  })

  it("should let us create simple global elements and sync with server", done => {

    self.elementWizard.prompt.returnsPromise({
      elementName: "New Simple Element",
      type: "fragment",
      i18n: false,
      withJavaScript: true,
      withSubElements: false,
      configOptions: ["available"],
      inline: false,
      withHelpText: false,
      syncWithServer: true
    })

    self.templateUtils.renderWithTemplate.and.callFake((path, context, callback) => {
      callback(null, "{}")
    })

    self.endPointTransceiver.locales = [{name: "en"}, {name: "de"}]
    self.endPointTransceiver.locale = "en"

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, elementTag, elementDir, extensionPathFor, extensionContentsFor, callback) => {
      callback("extension")
    })

    self.extensionSender.sendExtension.and.callFake((name, extension, callback) => {
      callback({data: {success: true}})
    })

    self.endPointTransceiver.getElements.returnsResponse({items: [{tag: "new-simple-element"}]})

    self.elementCreator.create(true, "", null, null).then(() => {

      done()
    })
  })

  it("should stop us creating elements under an existing widget", done => {

    self.metadata.initializeMetadata.returnsPromise()
    self.metadata.widgetExistsOnTarget.returnsTrue()

    self.elementCreator.create(true, "widget/My Widget", PuttingFileType.WIDGET, null).then(() => {

      expect(self.logger.error).toHaveBeenCalledWith("cantCreateElementUnderExistingWidget", {widgetDir: "widget/My Widget"})

      done()
    })
  })

  it("should stop us creating elements under a widget element when the widget already exists on the server", done => {

    self.metadata.initializeMetadata.returnsPromise()
    self.metadata.widgetExistsOnTarget.returnsTrue()

    self.elementCreator.create(true, "widget/My Widget/element/Some Element", PuttingFileType.WIDGET_ELEMENT, null).then(() => {

      expect(self.logger.error).toHaveBeenCalledWith("cantCreateElementUnderExistingWidget", {widgetDir: "widget/My Widget/element/Some Element"})

      done()
    })
  })

  it("should let us create elements under an existing widget", done => {

    self.metadata.initializeMetadata.returnsPromise()

    self.elementWizard.prompt.returnsPromise({
      elementName: "New Simple Element",
      type: "fragment",
      i18n: false,
      withJavaScript: true,
      withSubElements: false,
      configOptions: ["textBox"],
      inline: false,
      withHelpText: false,
      syncWithServer: true
    })

    self.metadata.readMetadataFromDisk.returns({ version : 5 })

    self.elementCreator.create(true, "widget/My Widget", PuttingFileType.WIDGET, null).then(() => {

      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith("widget/My Widget/element/New Simple Element/element.js", {
        elementTag: "new-simple-element",
        elementName: "New Simple Element",
        type: "fragment",
        i18n: false,
        withJavaScript: true,
        withSubElements: false,
        configOptions: ["textBox"],
        inline: false,
        withHelpText: false,
        syncWithServer: true,
        textBox: true
      }, "element/exampleJs")

      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith("widget/My Widget/element/New Simple Element/element.template", {
        elementTag: "new-simple-element",
        elementName: "New Simple Element",
        type: "fragment",
        i18n: false,
        withJavaScript: true,
        withSubElements: false,
        configOptions: ["textBox"],
        inline: false,
        withHelpText: false,
        syncWithServer: true,
        textBox: true
      }, "element/exampleTemplate")

      done()
    })
  })

  it("should update the parent element external metadata", done => {

    self.metadata.initializeMetadata.returnsPromise()

    self.elementWizard.prompt.returnsPromise({
      elementName: "New Simple Element",
      type: "fragment",
      i18n: false,
      withJavaScript: true,
      withSubElements: false,
      configOptions: ["textBox"],
      inline: false,
      withHelpText: false,
      syncWithServer: true
    })

    self.utils.readJsonFile.returns({})

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, elementTag, elementDir, extensionPathFor, extensionContentsFor, callback) => {

      self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_TEMPLATE)
      expect(extensionPathFor("element-tag", "element/New Simple Element/element.template")).toEqual("element/element-tag/templates/template.txt")

      self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_JAVASCRIPT)
      expect(extensionPathFor("element-tag", "element/New Simple Element/element.js")).toEqual("element/element-tag/js/element.js")

      self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_METADATA)
      expect(extensionPathFor("element-tag", "element/New Simple Element/elementMetadata.json")).toEqual("element/element-tag/element.json")

      self.elementUtils.spliceElementMetadata.returns({ tag : "spliced-metadata"})
      expect(extensionContentsFor("element/New Simple Element/elementMetadata.json")).toEqual({ tag: "spliced-metadata" })

      self.utils.readFile.returns("something else")
      expect(extensionContentsFor("element/New Simple Element/element.js")).toEqual("something else")

      callback("extension")
    })

    self.elementCreator.create(true, "element/Parent Element", PuttingFileType.GLOBAL_ELEMENT, null).then(() => {

      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith("element/New Simple Element/element.js", {
        elementTag: "new-simple-element",
        elementName: "New Simple Element",
        type: "fragment",
        i18n: false,
        withJavaScript: true,
        withSubElements: false,
        configOptions: ["textBox"],
        inline: false,
        withHelpText: false,
        syncWithServer: true,
        textBox: true
      }, "element/exampleJs")

      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith("element/New Simple Element/element.template", {
        elementTag: "new-simple-element",
        elementName: "New Simple Element",
        type: "fragment",
        i18n: false,
        withJavaScript: true,
        withSubElements: false,
        configOptions: ["textBox"],
        inline: false,
        withHelpText: false,
        syncWithServer: true,
        textBox: true
      }, "element/exampleTemplate")

      done()
    })
  })

  it("should let us generate an example widget element", () => {

    self.elementCreator.generateExampleWidgetElement({ widgetName : "Bernard", i18n : true }, "widget/Bernard")

    const parameters = [
      [
        "widget/Bernard/element/Bernard Widget Element/element.js",
        {
          elementTag: "bernard-widget-element",
          elementName: "Bernard Widget Element",
          type: "fragment",
          i18n: true,
          withJavaScript: true,
          withSubElements: true,
          withHelpText: true,
          configOptions: [ "available" ],
          textBox: false,
          children: [ "bernard-widget-element-example-container-element" ]
        },
        "element/exampleJs"
      ],
      [
        "widget/Bernard/element/Bernard Widget Element Example Static Element/element.js",
        {
          elementTag: "bernard-widget-element-example-static-element", 
          elementName: "Bernard Widget Element Example Static Element", 
          type: "staticFragment", 
          i18n: true, 
          withJavaScript: true, 
          withSubElements: true, 
          withHelpText: true, 
          configOptions: [  ], 
          textBox: false, 
          elementBody: "<P>Static Element Contents</P>"
        },
        "element/exampleJs"
      ]
    ]

    parameters.forEach(row => {
      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith(row[0], row[1], row[2])
    })
  })

  it("should handle upload failures", done => {

    self.elementWizard.prompt.returnsPromise({
      elementName: "New Simple Element",
      type: "fragment",
      i18n: false,
      withJavaScript: true,
      withSubElements: false,
      configOptions: ["available"],
      inline: false,
      withHelpText: false,
      syncWithServer: true
    })

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, elementTag, elementDir, extensionPathFor, extensionContentsFor, callback) => {
      callback("extension")
    })

    self.extensionSender.sendExtension.and.callFake((name, extension, callback) => {
      callback({data: {success: false}})
    })

    self.endPointTransceiver.getElements.returnsResponse({items: [{tag: "new-simple-element"}]})

    self.elementCreator.create(true, "", null, null).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("templateMarkupReminder")
      expect(self.logger.info).toHaveBeenCalledWith("elementUploadFailure", { elementName: "New Simple Element" })
      done()
    })
  })

  it("should let us create elements under an existing widget element", done => {

    self.metadata.initializeMetadata.returnsPromise()

    self.elementWizard.prompt.returnsPromise({
      elementName: "New Widget Element",
      type: "fragment",
      i18n: false,
      withJavaScript: true,
      withSubElements: false,
      configOptions: ["textBox"],
      inline: false,
      withHelpText: false,
      syncWithServer: true
    })

    self.metadata.readMetadataFromDisk.returns({ version : 5 })

    self.utils.readJsonFile.returns({})

    self.elementCreator.create(true, "widget/My Widget/element/Fred", PuttingFileType.WIDGET_ELEMENT, null).then(() => {

      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith("widget/My Widget/element/New Widget Element/element.js", {
        elementTag: "new-widget-element",
        elementName: "New Widget Element",
        type: "fragment",
        i18n: false,
        withJavaScript: true,
        withSubElements: false,
        configOptions: ["textBox"],
        inline: false,
        withHelpText: false,
        syncWithServer: true,
        textBox: true
      }, "element/exampleJs")

      expect(self.templateUtils.createFileFromTemplate).toHaveBeenCalledWith("widget/My Widget/element/New Widget Element/element.template", {
        elementTag: "new-widget-element",
        elementName: "New Widget Element",
        type: "fragment",
        i18n: false,
        withJavaScript: true,
        withSubElements: false,
        configOptions: ["textBox"],
        inline: false,
        withHelpText: false,
        syncWithServer: true,
        textBox: true
      }, "element/exampleTemplate")

      done()
    })
  })
})
