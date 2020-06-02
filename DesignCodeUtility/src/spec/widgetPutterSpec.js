"use strict"

const Promise = require("bluebird")

const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Widget Putter", () => {

  const self = this

  const widgetInstanceTemplatePath = "widget/Gift Card/instances/Gift Card Widget/display.template"
  const webContentTemplatePath = "widget/Web Content/instances/About Us Web Content Widget/content.template"
  const widgetJsPath = "widget/VCS QUOTE widget with - dashes test/js/quote-tester.js"
  const widgetLessPath = "widget/Cart Summary/instances/Cart Summary Widget/widget.less"
  const widgetSnippetsPath = "widget/Cart Shipping/instances/Cart Shipping/locales/de/ns.cartshippingdetails.json"
  const widgetModifiableMetadataPath = "widget/Cart Shipping/widgetMetadata.json"
  const widgetBaseTemplatePath = "widget/Cart Shipping/display.template"
  const widgetBaseLessPath = "widget/Cart Shipping/widget.less"
  const widgetBaseSnippetsPath = "widget/Cart Shipping/locales/en/ns.cartshippingdetails.json"
  const widgetConfigJsonPath = "widget/Cart Shipping/config/configMetadata.json"
  const widgetConfigSnippetsPath = "widget/Cart Shipping/config/locales/en.json"
  const widgetPath = "widget/Cart Shipping"
  const widgetInstanceMetadataPath = "widget/Gift Card/instances/Gift Card Widget/widgetInstanceMetadata.json"
  const widgetInstancePath = "widget/Gift Card/instances/Gift Card Widget"
  const widgetJsModulePath = "widget/helga/module/js/jim.js"
  const elementInstanceMetadataPath = "widget/Product Details/instances/Product Details Widget/elementInstancesMetadata.json"

  const putResults = {}

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver",
      "getWidget", "updateWidgetWebContent", "updateWidgetDescriptorJavascript",
      "updateWidgetCustomTranslations", "updateWidgetSourceCode", "updateWidgetLess",
      "createWidgetInstance", "updateWidgetDescriptorMetadata", "updateWidgetDescriptorBaseTemplate",
      "updateWidgetDescriptorBaseLess", "updateWidgetDescriptorBaseLocaleContent",
      "updateConfigMetadataForWidgetDescriptor", "updateConfigLocaleContentForWidgetDescriptor",
      "updateWidgetMetadata", "updateWidgetDescriptorJavascriptExtension", "createWidgetDescriptorJavascriptExtension",
      "updateWidget", "startFileUpload", "doFileSegmentUpload", "getFileURI", "createFragmentInstance")

    mockery.mockModules(self, "../state", "upath", "../utils", "../putterUtils", "../metadata", "../logger", "../etags", "../elementUtils", "../widgetCreator", "../snippetKeyTracker")

    // Force a reload of request builder as it can be left with old spies as we do not normally mock it.
    mockery.require("../requestBuilder")

    // Need to call this before we mock out Bluebird.
    self.metadata.readMetadata.and.callFake(Promise.method(function (path, type) {

      if (type === constants.widgetMetadataJson) {

        return {
          repositoryId: "rep1234",
          etag: "etag value"
        }
      } else {

        return {
          repositoryId: "rep5678",
          descriptorRepositoryId: "rep1234",
          etag: "etag value",
          displayName: "Instance To Create",
          version: 1
        }
      }
    }))

    self.metadata.readMetadataFromDisk.and.callFake((path, type) => {

      return {
        repositoryId: "rep5678",
        descriptorRepositoryId: "rep1234",
        etag: "etag value",
        displayName: "Instance To Create",
        version: 1,
        widgetType: "cartShipping",
        global: false
      }
    })

    self.metadata.getCachedWidgetInstanceFromMetadata.returns({
      descriptor: {
        repositoryId: "rep1234"
      },
      repositoryId: "rep5678"
    })

    self.utils.readFile.returns("#WIDGET_ID-WIDGET_INSTANCE_ID {}")

    self.putterUtils = mockery.require("../putterUtils")
    self.widgetPutter = mockery.require("../widgetPutter")

    self.endPointTransceiver.updateWidgetSourceCode.returnsPromise(putResults)
    self.endPointTransceiver.getWidget.returnsResponse({
      name: "a name",
      notes: "some notes"
    })
    self.endPointTransceiver.updateWidgetWebContent.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetDescriptorJavascript.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetLess.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetCustomTranslations.returnsPromise(putResults)
    self.endPointTransceiver.createWidgetInstance.returnsPromise()
    self.endPointTransceiver.updateWidgetDescriptorMetadata.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetDescriptorBaseTemplate.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetDescriptorBaseLess.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetDescriptorBaseLocaleContent.returnsPromise(putResults)
    self.endPointTransceiver.updateConfigMetadataForWidgetDescriptor.returnsPromise(putResults)
    self.endPointTransceiver.updateConfigLocaleContentForWidgetDescriptor.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetMetadata.returnsPromise(putResults)
    self.endPointTransceiver.updateWidgetDescriptorJavascriptExtension.returnsPromise(putResults)
    self.endPointTransceiver.createWidgetDescriptorJavascriptExtension.returnsPromise(putResults)
    self.endPointTransceiver.updateWidget.returnsPromise(putResults)
    self.endPointTransceiver.startFileUpload.returnsResponse({ token : "uploadToken" })
    self.endPointTransceiver.doFileSegmentUpload.returnsResponse({ success : true })
    self.endPointTransceiver.getFileURI.returnsResponse({ uri : "nice/big/uri" })
    self.endPointTransceiver.createFragmentInstance.returnsResponse({ uri : "nice/big/uri" })

    self.widgetCreator.createWidgetInExtension.returnsPromise({})
  })

  afterEach(mockery.stopAll)

  it("should let you put widget templates on the server", done => {

    self.utils.exists.returnsTrue()

    self.widgetPutter.putWidgetInstanceTemplate(widgetInstanceTemplatePath).then(() => {

      expect(self.endPointTransceiver.updateWidgetSourceCode).urlKeysWere(["rep5678"])
      expect(self.endPointTransceiver.updateWidgetSourceCode).pathWas(widgetInstanceTemplatePath)
      expect(self.endPointTransceiver.updateWidgetSourceCode).fieldWas("source")
      expect(self.endPointTransceiver.updateWidgetSourceCode).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetInstanceTemplatePath, putResults)

      done()
    })
  })

  it("should let you put web content widget templates on the server", done => {

    self.utils.readFile.returns("some web content markup")
    self.utils.exists.returnsTrue()

    self.widgetPutter.putWebContentWidgetInstanceTemplate(webContentTemplatePath).then(() => {

      expect(self.endPointTransceiver.updateWidgetWebContent).urlKeysWere(["rep5678"])
      expect(self.endPointTransceiver.updateWidgetWebContent).bodyWas(
        {
          "widgetConfig": {
            "name": "a name",
            "notes": "some notes"
          },
          "content": "some web content markup"
        })
      expect(self.endPointTransceiver.updateWidgetWebContent).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(webContentTemplatePath, putResults)

      done()
    })
  })

  it("should let you put widget JavaScript on the server", done => {

    self.widgetPutter.putWidgetJavaScript(widgetJsPath).then(() => {

      expect(self.endPointTransceiver.updateWidgetDescriptorJavascript).urlKeysWere(["rep1234", "quote-tester.js"])
      expect(self.endPointTransceiver.updateWidgetDescriptorJavascript).pathWas(widgetJsPath)
      expect(self.endPointTransceiver.updateWidgetDescriptorJavascript).fieldWas("source")
      expect(self.endPointTransceiver.updateWidgetDescriptorJavascript).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetJsPath, putResults)
      done()
    })
  })

  it("should process widget less files correctly", done => {

    self.putterUtils.shouldSuppressThemeCompile.returnsTrue()

    self.widgetPutter.putWidgetInstanceLess(widgetLessPath, true).then(() => {

      expect(self.endPointTransceiver.updateWidgetLess).urlKeysWere(["rep5678"])
      expect(self.endPointTransceiver.updateWidgetLess).pathWas(widgetLessPath)
      expect(self.endPointTransceiver.updateWidgetLess).fieldWas("source")
      expect(self.endPointTransceiver.updateWidgetLess).etagWas("etag value")
      expect(self.endPointTransceiver.updateWidgetLess.calls.mostRecent().args[1]).toEqual("?suppressThemeCompile=true")
      expect(self.endPointTransceiver.updateWidgetLess.calls.mostRecent().args[2].build().data.source).toEqual("#rep1234-rep5678 {}")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetLessPath, putResults)
      done()
    })
  })

  it("should process locale files correctly", done => {

    self.utils.readJsonFile.returns({resources: {}})

    self.widgetPutter.putWidgetInstanceSnippets(widgetSnippetsPath, true).then(() => {

      expect(self.endPointTransceiver.updateWidgetCustomTranslations).urlKeysWere(["rep5678"])
      expect(self.endPointTransceiver.updateWidgetCustomTranslations).bodyWas({custom: {}})
      expect(self.endPointTransceiver.updateWidgetCustomTranslations).localeWas("de")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetSnippetsPath, putResults)
      done()
    })
  })

  it("should use the optimistic lock capable endpoint if available", done => {

    self.utils.readJsonFile.returns({resources: {}})

    self.endPointTransceiver.updateWidgetCustomTranslationsForLocale = mockery.addConvenienceMethods(jasmine.createSpy("updateWidgetCustomTranslationsForLocale"))
    self.endPointTransceiver.updateWidgetCustomTranslationsForLocale.returnsPromise({})

    self.widgetPutter.putWidgetInstanceSnippets(widgetSnippetsPath, true).then(() => {

      expect(self.endPointTransceiver.updateWidgetCustomTranslationsForLocale).urlKeysWere(["rep5678", "de"])
      done()
    })
  })

  it("should create a widget instance where one does not exist in transfer mode", done => {

    self.state.inTransferMode.returnsTrue()

    let instanceCreated = false

    self.metadata.readMetadata.and.callFake(Promise.method(function (path, type) {

      if (type === constants.widgetMetadataJson) {
        return {
          repositoryId: "rep1234",
          widgetType: "cuteWidgetType",
          etag: "etag value"
        }
      } else {
        // Only return metadata for widget instances after the instance has been "created".
        return instanceCreated ? {repositoryId: "rep9012"} : null
      }
    }))
    self.metadata.readMetadataFromDisk.returns({displayName: "Instance To Create"})
    self.endPointTransceiver.createWidgetInstance.and.callFake(Promise.method(function (path, type) {

      // Create has been called. Set a flag so readMetadata() can now return something.
      instanceCreated = true
      return {}
    }))

    self.utils.readJsonFile.returns({resources: {}})

    self.widgetPutter.putWidgetInstanceSnippets(widgetSnippetsPath, true).then(() => {

      expect(self.endPointTransceiver.createWidgetInstance).urlKeysWere([])
      expect(self.endPointTransceiver.createWidgetInstance).bodyWas(
        {
          "widgetDescriptorId": "cuteWidgetType",
          "displayName": "Instance To Create"
        })

      expect(self.endPointTransceiver.updateWidgetCustomTranslations).urlKeysWere(["rep9012"])
      expect(self.endPointTransceiver.updateWidgetCustomTranslations).bodyWas({custom: {}})

      expect(self.logger.warn).toHaveBeenCalledWith("creatingWidgetInstance", {path: widgetSnippetsPath})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetSnippetsPath, putResults)
      done()
    })
  })

  it("should create a widget instance where one does not exist outside of transfer mode", done => {

    let instanceCreated = false

    self.metadata.readMetadata.and.callFake(Promise.method(function (path, type) {

      if (type == constants.widgetMetadataJson) {
        return {
          repositoryId: "rep1234",
          widgetType: "cuteWidgetType",
          etag: "etag value"
        }
      } else {
        // Only return metadata for widget instances after the instance has been "created".
        return instanceCreated ? {repositoryId: "rep9012"} : null
      }
    }))
    self.metadata.readMetadataFromDisk.returns({displayName: "Instance To Create"})
    self.endPointTransceiver.createWidgetInstance.and.callFake(Promise.method(function (path, type) {

      // Create has been called. Set a flag so readMetadata() can now return something.
      instanceCreated = true
      return {}
    }))

    self.utils.readJsonFile.returns({resources: {}})

    self.widgetPutter.putWidgetInstanceSnippets(widgetSnippetsPath, true).then(() => {

      expect(self.endPointTransceiver.createWidgetInstance).urlKeysWere([])
      expect(self.endPointTransceiver.createWidgetInstance).bodyWas(
        {
          "widgetDescriptorId": "cuteWidgetType",
          "displayName": "Instance To Create"
        })

      expect(self.endPointTransceiver.updateWidgetCustomTranslations).urlKeysWere(["rep9012"])
      expect(self.endPointTransceiver.updateWidgetCustomTranslations).bodyWas({custom: {}})

      expect(self.logger.warn).toHaveBeenCalledWith("creatingWidgetInstance", {path: widgetSnippetsPath})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetSnippetsPath, putResults)

      expect(self.metadata.updateMetadata).not.toHaveBeenCalledWith(widgetSnippetsPath, "widgetInstance.json",
        {displayName: "Instance To Create", descriptorRepositoryId: "rep1234", repositoryId: "rep5678"})
      expect(self.etags.writeDummyEtag).toHaveBeenCalledWith(widgetSnippetsPath)
      done()
    })
  })

  it("should handle not being able to find widget metadata", done => {

    self.metadata.readMetadata.returnsPromise(null)

    self.widgetPutter.putWidgetJavaScript(widgetJsPath).then(() => {

      expect(self.endPointTransceiver.updateWidgetDescriptorJavascript).not.toHaveBeenCalled()
      done()
    })
  })

  it("should handle not being able to find widget metadata when trying to update an instance and not in transfer mode", done => {

    self.metadata.readMetadata.returnsPromise(null)

    self.widgetPutter.putWidgetInstanceSnippets(widgetSnippetsPath, true).then(() => {

      expect(self.endPointTransceiver.updateWidgetCustomTranslations).not.toHaveBeenCalled()
      expect(self.logger.warn).toHaveBeenCalledWith("cannotUpdateWidget", {path: widgetSnippetsPath})
      done()
    })
  })

  it("should create a widget instance where one does not exist outside of transfer mode", done => {

    self.metadata.readMetadataFromDisk.returns({displayName: "Instance To Create"})

    self.utils.readJsonFile.returns({resources: {}})

    self.widgetPutter.putWidgetInstanceSnippets(widgetSnippetsPath, true).then(() => {

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetSnippetsPath, putResults)
      done()
    })
  })

  it("should process widget metadata correctly", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.locale = "en"

    self.utils.readJsonFile.returns({translations: [{language: "en", name: "My Widget"}]})

    self.putterUtils.processPutResultAndEtag.and.callFake((path, results, successCallback) => {
      successCallback && successCallback(path)
    })

    self.widgetPutter.putWidgetModifiableMetadata(widgetModifiableMetadataPath).then(() => {

      expect(self.endPointTransceiver.updateWidgetDescriptorMetadata).urlKeysWere(["rep1234"])
      expect(self.endPointTransceiver.updateWidgetDescriptorMetadata).pathWas(widgetModifiableMetadataPath)
      expect(self.endPointTransceiver.updateWidgetDescriptorMetadata).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalled()

      expect(self.metadata.updateMetadata).toHaveBeenCalledWith(widgetModifiableMetadataPath, "widget.json", {displayName: "My Widget"})
      done()
    })
  })

  it("should process widget base templates correctly", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.putterUtils.enableUpdateInstances()
    self.putterUtils.shouldUpdateInstances.returnsTrue()

    self.upath.resolve.returns(widgetInstanceTemplatePath)

    self.utils.readFile.returns("template markup")

    self.utils.walkDirectory.and.callFake((path, config) => {
      config.listeners.file("widget/Gift Card/instances/Gift Card Widget", {name: "display.template"}, () => {
      })
    })

    self.widgetPutter.putWidgetBaseTemplate(widgetBaseTemplatePath).then(() => {

      expect(self.endPointTransceiver.updateWidgetDescriptorBaseTemplate).urlKeysWere(["rep1234"])
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseTemplate).queryStringWas("?updateInstances=true")
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseTemplate).pathWas(widgetBaseTemplatePath)
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseTemplate).fieldWas("source")
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseTemplate).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetBaseTemplatePath, putResults)

      expect(self.utils.writeFile).toHaveBeenCalledWith("widget/Gift Card/instances/Gift Card Widget/display.template", "template markup")

      done()
    })
  })

  it("should process widget base less correctly", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.putterUtils.shouldUpdateInstances.returnsFalse()

    self.widgetPutter.putWidgetBaseLess(widgetBaseLessPath).then(() => {

      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLess).urlKeysWere(["rep1234"])
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLess).queryStringWas("?updateInstances=false")
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLess).pathWas(widgetBaseLessPath)
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLess).fieldWas("source")
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLess).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetBaseLessPath, putResults)

      done()
    })
  })

  it("should process widget base snippets correctly", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.putterUtils.shouldUpdateInstances.returnsFalse()

    self.widgetPutter.putWidgetBaseSnippets(widgetBaseSnippetsPath).then(() => {

      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLocaleContent).urlKeysWere(["rep1234", "en"])
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLocaleContent).queryStringWas("?updateInstances=false")
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLocaleContent).wasJsony()
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLocaleContent).pathWas("widget/Cart Shipping/locales/en/ns.cartshippingdetails.json")
      expect(self.endPointTransceiver.updateWidgetDescriptorBaseLocaleContent).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetBaseSnippetsPath, putResults)

      done()
    })
  })

  it("should process widget config JSON correctly", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.widgetPutter.putWidgetConfigJson(widgetConfigJsonPath).then(() => {

      expect(self.endPointTransceiver.updateConfigMetadataForWidgetDescriptor).urlKeysWere(["rep1234"])
      expect(self.endPointTransceiver.updateConfigMetadataForWidgetDescriptor).pathWas(widgetConfigJsonPath)
      expect(self.endPointTransceiver.updateConfigMetadataForWidgetDescriptor).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalled()

      done()
    })
  })

  it("should process widget config snippets correctly", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.widgetPutter.putWidgetConfigSnippets(widgetConfigSnippetsPath).then(() => {

      expect(self.endPointTransceiver.updateConfigLocaleContentForWidgetDescriptor).urlKeysWere(["rep1234", "en"])
      expect(self.endPointTransceiver.updateConfigLocaleContentForWidgetDescriptor).pathWas(widgetConfigSnippetsPath)
      expect(self.endPointTransceiver.updateConfigLocaleContentForWidgetDescriptor).etagWas("etag value")

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalled()

      done()
    })
  })

  it("should create widgets correctly", done => {

    self.metadata.readMetadataFromDisk.returns({
      source: 101,
      displayName: "Cart Shipping",
      widgetType: "cartShipping",
      global: false
    })

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.utils.splitFromBaseDir.returns([".","widget/Cart Shipping"])

    self.widgetPutter.putWidget(widgetPath).then(() => {

      expect(self.widgetCreator.createWidgetInExtension).toHaveBeenCalledWith("Cart Shipping", "cartShipping", false, "widget/Cart Shipping", false)
      done()
    })
  })

  it("should not create widgets where there is insufficient info", () => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.utils.exists.returnsFalse()

    self.widgetPutter.putWidget(widgetPath)

    expect(self.logger.warn).toHaveBeenCalledWith("insufficientInfoToCreateWidget", {widgetName: "Instance To Create"})
  })

  it("should let us modify widget instance metadata", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.putterUtils.enableUpdateInstances()
    self.putterUtils.shouldUpdateInstances.returnsTrue()
    self.putterUtils.shouldSendInstanceConfig.returnsTrue()

    self.utils.readJsonFile.returns({displayName: "Updated Widget Instance"})

    self.putterUtils.processPutResultAndEtag.and.callFake((path, results, successCallback) => {
      successCallback(path)
    })

    self.widgetPutter.putWidgetInstanceModifiableMetadata(widgetInstanceMetadataPath).then(() => {

      expect(self.endPointTransceiver.updateWidgetMetadata).urlKeysWere(["rep5678"])
      expect(self.endPointTransceiver.updateWidgetMetadata).pathWas(widgetInstanceMetadataPath)
      expect(self.endPointTransceiver.updateWidgetMetadata).etagWas("etag value")

      expect(self.metadata.updateMetadata).toHaveBeenCalledWith(widgetInstanceMetadataPath, "widgetInstance.json", {displayName: "Updated Widget Instance"})

      done()
    })
  })

  it("should report non modification of widget instance metadata where endpoints do not exist", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()
    self.putterUtils.shouldSendInstanceConfig.returnsTrue()

    self.widgetPutter.putWidgetInstanceModifiableMetadata(widgetInstanceMetadataPath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetInstanceMetadataPath})
  })

  it("should report non modification of widget instance metadata where user wants it suppressed", () => {

    self.putterUtils.suppressConfigUpdate(true)
    self.putterUtils.shouldSendInstanceConfig.returnsFalse()

    self.widgetPutter.putWidgetInstanceModifiableMetadata(widgetInstanceMetadataPath)

    expect(self.endPointTransceiver.updateWidgetMetadata).not.toHaveBeenCalled()
  })

  it("should process widget instance directories correctly", () => {

    self.metadata.getCachedWidgetInstanceFromMetadata.returns(null)

    self.utils.splitFromBaseDir.returns([".", "widget/Gift Card/instances/Gift Card Widget"])

    self.utils.walkDirectory.and.callFake((path, config) => {
      config.listeners.file(".ccc/widget/Gift Card/instances/Gift Card Widget", {name: "display.template.etag"}, () => {
      })
    })

    self.upath.resolve.returns("/root/.ccc/widget/Gift Card/instances/Gift Card Widget/display.template.etag")

    self.widgetPutter.putWidgetInstance(widgetInstancePath)

    expect(self.etags.resetEtag).toHaveBeenCalledWith("/root/.ccc/widget/Gift Card/instances/Gift Card Widget/display.template.etag")
  })

  it("should report non modification of widget metadata where endpoints do not exist", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetPutter.putWidgetModifiableMetadata(widgetModifiableMetadataPath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetModifiableMetadataPath})
  })

  it("should report non modification of widget config snippets where endpoints do not exist", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetPutter.putWidgetConfigSnippets(widgetConfigSnippetsPath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetConfigSnippetsPath})
  })

  it("should report non modification of widget config where endpoints do not exist", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetPutter.putWidgetConfigSnippets(widgetConfigJsonPath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetConfigJsonPath})
  })

  it("should report non modification of base snippets where endpoints do not exist", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetPutter.putWidgetBaseSnippets(widgetBaseSnippetsPath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetBaseSnippetsPath})
  })

  it("should process widget base snippets correctly", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetPutter.putWidgetBaseSnippets(widgetBaseSnippetsPath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetBaseSnippetsPath})
  })

  it("should process widget base template correctly", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.widgetPutter.putWidgetBaseTemplate(widgetBaseTemplatePath)

    expect(self.logger.warn).toHaveBeenCalledWith("widgetContentFileCannotBeSent", {path: widgetBaseTemplatePath})
  })

  it("should update extension js correctly", done => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.etags.eTagFor.returns("module etag")

    self.widgetPutter.putWidgetModuleJavaScript(widgetJsModulePath).then(() => {

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith("widget/helga/module/js/jim.js", {})

      done()
    })
  })

  function mockElementInstance() {
    self.endPointTransceiver.serverSupports.returnsFalse()

    self.metadata.readMetadata.and.callFake(Promise.method(function (path, type) {

      if (type == constants.widgetMetadataJson) {

        return {
          repositoryId: "rep1234",
          etag: "etag value",
          elementized : true
        }
      } else {

        return {
          repositoryId: "rep5678",
          descriptorRepositoryId: "rep1234",
          etag: "etag value",
          displayName: "Instance To Create",
          version: 1
        }
      }
    }))

    self.utils.readJsonFile.returns({
      elementInstances : [
        {
          imageConfig : {
            fileName : "elementInstanceImage.jpg"
          },
          tag : "my-tag@200001"
        }
      ]
    })

    self.utils.exists.returnsTrue()

    self.metadata.getElementByTag.returns({
      configOptions : []
    })

    self.elementUtils.getBaseElementTag.returns("my-tag")

    self.utils.readFile.returns("<!-- ko setContextVariable: {name: 'elementConfig', value: { '200001': {'id': '200001'} --><!-- /ko --><div class='row'>200001")

    self.state.inTransferMode.returnsTrue()

    self.endPointTransceiver.getWidget.returnsResponse({fragments : []})

    self.elementUtils.getElementTagRepoId.returns("200001")
  }

  it("should create extension js correctly", done => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.etags.eTagFor.returns("")

    self.widgetPutter.putWidgetModuleJavaScript(widgetJsModulePath).then(() => {

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith("widget/helga/module/js/jim.js", {})

      done()
    })
  })

  it("should update element instance metadata correctly", done => {

    mockElementInstance()

    self.widgetPutter.putElementInstanceMetadata(elementInstanceMetadataPath).then(() => {

      expect(self.endPointTransceiver.updateWidget).urlKeysWere(["rep5678"])
      expect(self.endPointTransceiver.createFragmentInstance).urlKeysWere(["rep5678", "my-tag"])

      done()
    })
  })

  it("should warn you when it cant find the image", done => {

    mockElementInstance()

    let called = false

    self.utils.exists.and.callFake(() => {

      if (called) {
        return false
      } else {
        called = true
        return true
      }
    })

    self.widgetPutter.putElementInstanceMetadata(elementInstanceMetadataPath).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("elementImageNotFound",
        { imagePath : "widget/Product Details/instances/Product Details Widget/images/elementInstanceImage.jpg" })

      done()
    })
  })

  it("should warn you when elements cannot be created", () => {

    self.metadata.readMetadataFromDisk.returns({ source : 101 })

    self.widgetPutter.putWidget("widget/Path")

    expect(self.logger.warn).toHaveBeenCalledWith("widgetCannotBeCreated", { path: "widget/Path" })
  })
})

