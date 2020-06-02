"use strict"

const constants = require("../constants").constants
const mockery = require("./mockery")
const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("widgetCreator", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../state", "../utils", "../i18n", "../logger", "../classifier", "../templateUtils",
      "../metadata", "../extensionBuilder", "../extensionSender", "../elementMarkupGenerator", "../widgetWizard", "../elementUtils", "../elementCreator")

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "getAllWidgetDescriptors", "getElements")

    self.endPointTransceiver.getElements.returnsResponse({
      items: [
        {
          tag: "element-tag",
          repositoryId : "elementRepositoryId"
        }
      ]
    })

    self.utils.exists.returnsTrue()

    self.classifier.classify.and.callFake(path => {

      switch (true) {
        case path == "widget/CCW Test Widget/display.template":
          return PuttingFileType.WIDGET_BASE_TEMPLATE
        case path == "widget/CCW Test Widget/widget.less":
          return PuttingFileType.WIDGET_BASE_LESS
        case path == "widget/CCW Test Widget/locales/en/ns.ccwtestwidget.json":
          return PuttingFileType.WIDGET_BASE_SNIPPETS
        case path == "widget/CCW Test Widget/js/ccwtestwidget.js":
          return PuttingFileType.WIDGET_JAVASCRIPT
        case path == "widget/CCW Test Widget/config/locales/en.json":
          return PuttingFileType.WIDGET_CONFIG_SNIPPETS
        case path == "widget/CCW Test Widget/config/configMetadata.json":
          return PuttingFileType.WIDGET_CONFIG_JSON
        case path == "widget/CCW Test Widget/widgetMetadata.json":
          return PuttingFileType.WIDGET_METADATA_JSON
        case path == "widget/CCW Test Widget/element/Company Logo/element.template":
          return PuttingFileType.ELEMENT_TEMPLATE
        case path == "widget/CCW Test Widget/element/Company Logo/element.js":
          return PuttingFileType.ELEMENT_JAVASCRIPT
        case path == "widget/CCW Test Widget/element/Company Logo/elementMetadata.json":
          return PuttingFileType.ELEMENT_METADATA
      }
    })

    self.templateUtils.renderWithTemplate.and.callFake((name, context, renderHandler) => {
      renderHandler(null, '{ "exampleStringProperty" : "Example String Value" }')
    })

    self.extension = jasmine.createSpy("extension")

    self.widgetCreator = mockery.require("../widgetCreator")

    self.widgetWizard.prompt.returnsPromise({
      widgetName: "New Widget Name",
      i18n: true,
      configurable: true,
      withHelpText: true,
      syncWithServer: true,
      elementized: true
    })

    self.endPointTransceiver.locales = [{name: "en"}]
  })

  afterEach(mockery.stopAll)

  it("should send extensions to the server", done => {

    self.endPointTransceiver.getAllWidgetDescriptors.returnsResponse({
      items: [
        {
          displayName: "New Widget Name",
          repositoryId: "rep909"
        }
      ]
    })

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) => {

      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/display.template")).toEqual(["widget/widgetType/templates/display.template", "widget/widgetType/layouts/defaultLayout/widget.template"])
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/widget.less")).toEqual("widget/widgetType/less/widget.less")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/locales/en/ns.ccwtestwidget.json")).toEqual("widget/widgetType/locales/en/ns.ccwtestwidget.json")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/js/ccwtestwidget.js")).toEqual("widget/widgetType/js/ccwtestwidget.js")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/config/locales/en.json")).toEqual("widget/widgetType/config/locales/en.json")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/config/configMetadata.json")).toEqual("widget/widgetType/config/config.json")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/widgetMetadata.json")).toEqual("widget/widgetType/widget.json")

      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/element/Company Logo/element.template")).toEqual("widget/widgetType/element/element-tag/templates/template.txt")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/element/Company Logo/element.js")).toEqual("widget/widgetType/element/element-tag/js/element.js")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/element/Company Logo/elementMetadata.json")).toEqual("widget/widgetType/element/element-tag/element.json")
      expect(extensionPathFor("widgetType", "widget/CCW Test Widget/file.silly")).toEqual("widget/widgetType/file.silly")

      expect(extensionContentsFor("widget/CCW Test Widget/widgetMetadata.json")).toEqual(
        '{"imports":[],"javascript":"ccwtestwidget","widgetType":"ccwtestwidget","global":false,"i18nresources":"ccwtestwidget"}')
      expect(extensionContentsFor("widget/CCW Test Widget/display.template")).toEqual("template contents")

      self.elementUtils.spliceElementMetadata.returns("element metadata")
      expect(extensionContentsFor("widget/CCW Test Widget/element/Company Logo/elementMetadata.json")).toEqual("element metadata")

      onCompleteCallBack(self.extension)
    })

    self.extensionSender.sendExtension.and.callFake((vfsBase, extension, resultHandler) => {
      resultHandler({data: {warnings: ["Widget looked a bit green"], errors: [], success: true}})
    })

    self.metadata.readMetadataFromDisk.and.callFake((path, type) => {
      return type == constants.elementMetadataJson ?
        {
          tag: "element-tag"
        } : {
          javascript: "ccwtestwidget",
          widgetType: "ccwtestwidget",
          global: false,
          i18nresources: "ccwtestwidget",
          elementized: true
        }
    })

    self.utils.readJsonFile.returns({
      "imports": []
    })

    self.utils.splitFromBaseDir.returns([])

    self.utils.readFile.returns("template contents")

    self.utils.walkDirectory.and.callFake((dir, config) => {

      config.listeners.directory("widget/CCW Test Widget/element", { name: "Company Logo" }, () => null)

      expect(self.metadata.updateMetadata).toHaveBeenCalledWith("widget/New Widget Name/element/Company Logo", "element.json",
        {
          widgetId: "rep909",
          repositoryId: "elementRepositoryId"
        })
    })

    self.widgetCreator.create(true).then(() => {

      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("widget/New Widget Name")
      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("widget/New Widget Name/js")
      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("widget/New Widget Name/instances")
      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("widget/New Widget Name/locales")
      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("widget/New Widget Name/locales/en")
      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith("widget/New Widget Name/config/locales")

      expect(self.templateUtils.createFileFromTemplate.calls.all()[0].args[0]).toEqual("widget/New Widget Name/js/newwidgetname.js")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[1].args[0]).toEqual("widget/New Widget Name/locales/en/ns.newwidgetname.json")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[2].args[0]).toEqual("widget/New Widget Name/config/configMetadata.json")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[3].args[0]).toEqual("widget/New Widget Name/config/locales/en.json")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[4].args[0]).toEqual("widget/New Widget Name/display.template")
      expect(self.templateUtils.createFileFromTemplate.calls.all()[5].args[0]).toEqual("widget/New Widget Name/widget.less")

      expect(self.templateUtils.renderWithTemplate.calls.all()[0].args[0]).toEqual("widget/exampleMetadataJson")

      expect(self.utils.writeFile.calls.all()[0].args[1]).toContain("exampleStringProperty")

      expect(self.extensionSender.reportWarnings).toHaveBeenCalled()

      expect(self.metadata.initializeMetadata).toHaveBeenCalled()

      done()
    })
  })

  it("should report back when the extension upload fails", done => {

    self.endPointTransceiver.locale = "en"

    const warnings = ["Widget looked a bit green"]

    self.extensionSender.sendExtension.and.callFake((vfsBase, extension, resultHandler) => {

      resultHandler({
        data: {
          warnings,
          errors: ["you've got to be kidding"],
          success: false
        }
      })
    })

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) => {
      onCompleteCallBack()
    })

    let called = 1

    self.metadata.widgetTypeExists.and.callFake(() => {
      return called--
    })

    self.widgetCreator.create(false).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("widgetUploadFailure", {widgetName: 'New Widget Name'})
      expect(self.extensionSender.reportWarnings).toHaveBeenCalledWith(warnings)
      done()
    })
  })

  it("should not update metadata in transfer mode", done => {

    self.state.inTransferMode.returnsTrue()

    self.widgetWizard.prompt.returnsPromise({
      widgetName: "New Widget Name",
      i18n: false,
      configurable: true,
      withHelpText: true,
      syncWithServer: true
    })

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) => {
      onCompleteCallBack()
    })

    self.extensionSender.sendExtension.and.callFake((vfsBase, extension, resultHandler) => {
      resultHandler({data: {warnings: [], errors: [], success: true}})
    })

    self.endPointTransceiver.locale = "en"

    self.widgetCreator.create(true).then(() => {

      expect(self.metadata.updateMetadata).not.toHaveBeenCalled()
      expect(self.metadata.initializeMetadata).toHaveBeenCalled()
      expect(self.templateUtils.createFileFromTemplate.calls.all()[2].args[0]).toEqual("widget/New Widget Name/config/locales/en.json")
      done()
    })
  })

  it("should detect when global widgets require special handling", done => {

    self.state.inTransferMode.returnsTrue()

    self.widgetWizard.prompt.returnsPromise({
      widgetName: "New Widget Name",
      i18n: false,
      global: true,
      configurable: true,
      withHelpText: true,
      syncWithServer: true
    })

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.extensionBuilder.buildExtension.and.callFake((idRequestText, manifestNameText, shortName, sourceDir, extensionPathFor, extensionContentsFor, onCompleteCallBack) => {

      expect(JSON.parse(extensionContentsFor(`/${constants.userWidgetMetadata}`)).name).toEqual("CCW Test Widget")
      onCompleteCallBack()
    })

    self.extensionSender.sendExtension.and.callFake((vfsBase, extension, resultHandler) => {
      resultHandler({data: {warnings: [], errors: [], success: true}})
    })

    self.metadata.readMetadataFromDisk.returns({
      javascript: "ccwtestwidget",
      widgetType: "ccwtestwidget",
      global: true,
      displayName: "CCW Test Widget"
    })

    self.utils.readJsonFile.returns({
      translations: {}
    })

    self.widgetCreator.create(true).then(() => {
      done()
    })
  })
})
