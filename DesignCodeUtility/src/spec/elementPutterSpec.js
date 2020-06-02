const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Element Putter", () => {

  const self = this

  const elementJsPath = "element/Contact Login (for Managed Accounts)/element.js"
  const elementTemplatePath = "element/Contact Login (for Managed Accounts)/element.template"
  const widgetElementJsPath = "widget/Cart Shipping/element/Shipping Address/element.js"
  const widgetElementTemplatePath = "widget/Cart Shipping/element/Shipping Address/element.template"

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "updateGlobalElementTemplate", "updateGlobalElementJavaScript",
      "updateFragmentTemplate", "updateFragmentJavaScript",
      "updateFragmentMetadata", "updateGlobalElementMetadata")

    mockery.mockModules(self, '../utils', '../metadata', '../putterUtils', '../logger', '../elementCreator')

    self.elementPutter = mockery.require("../elementPutter")
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.elementPutter.putGlobalElementJavaScript(elementJsPath)

    expect(self.logger.warn).toHaveBeenCalledWith('elementsCannotBeSent', {path: elementJsPath})
  })

  /**
   * Put the boilerplate in one place.
   */
  function fakeMetadataAndEndpointSupport() {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.metadata.readMetadata.returnsPromise(
      {
        tag: "my-element-tag",
        etag: "BIG_ELEMENT_ETAG"
      })
  }

  it("should let you put global element JavaScript on the server", (done) => {

    fakeMetadataAndEndpointSupport()
    self.utils.readFile.returns("some javascript")
    const response = self.endPointTransceiver.updateGlobalElementJavaScript.returnsPromise({})

    self.elementPutter.putGlobalElementJavaScript(elementJsPath).then(() => {

      expect(self.endPointTransceiver.updateGlobalElementJavaScript).urlKeysWere(["my-element-tag"])
      expect(self.endPointTransceiver.updateGlobalElementJavaScript).etagWas("BIG_ELEMENT_ETAG")
      expect(self.endPointTransceiver.updateGlobalElementJavaScript).bodyWas({code: {javascript: 'some javascript'}})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(elementJsPath, response)
      done()
    })
  })

  it("should let you put global element templates on the server", (done) => {

    fakeMetadataAndEndpointSupport()
    self.utils.readFile.returns("some template")
    const response = self.endPointTransceiver.updateGlobalElementTemplate.returnsPromise({})

    self.elementPutter.putGlobalElementTemplate(elementTemplatePath).then(() => {

      expect(self.endPointTransceiver.updateGlobalElementTemplate).urlKeysWere(["my-element-tag"])
      expect(self.endPointTransceiver.updateGlobalElementTemplate).etagWas("BIG_ELEMENT_ETAG")
      expect(self.endPointTransceiver.updateGlobalElementTemplate).bodyWas({code: {template: 'some template'}})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(elementTemplatePath, response)
      done()
    })
  })

  it("should tell you when it cant put global element templates on the server as there is no metadata", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.metadata.readMetadata.returnsPromise(null)

    self.elementPutter.putGlobalElementTemplate(elementTemplatePath).then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith('cannotUpdateElement', {path: elementTemplatePath})
      done()
    })
  })

  it("should let you put widget element templates on the server", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.metadata.readMetadata.returnsPromise(
      {
        tag: "my-element-tag",
        etag: "BIG_ELEMENT_ETAG",
        widgetId: "my-widget-id"
      })

    self.utils.readFile.returns("some javascript")

    const response = self.endPointTransceiver.updateFragmentJavaScript.returnsPromise({})

    self.elementPutter.putElementJavaScript(widgetElementJsPath).then(() => {

      expect(self.endPointTransceiver.updateFragmentJavaScript).urlKeysWere(["my-widget-id", "my-element-tag"])
      expect(self.endPointTransceiver.updateFragmentJavaScript).etagWas("BIG_ELEMENT_ETAG")
      expect(self.endPointTransceiver.updateFragmentJavaScript).bodyWas({code: {javascript: 'some javascript'}})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetElementJsPath, response)
      done()
    })
  })

  it("should let you put widget element javascript on the server", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.metadata.readMetadata.returnsPromise(
      {
        tag: "my-element-tag",
        etag: "BIG_ELEMENT_ETAG",
        widgetId: "my-widget-id"
      })

    self.utils.readFile.returns("some template")

    const response = self.endPointTransceiver.updateFragmentTemplate.returnsPromise({})

    self.elementPutter.putElementTemplate(widgetElementTemplatePath).then(() => {

      expect(self.endPointTransceiver.updateFragmentTemplate).urlKeysWere(["my-widget-id", "my-element-tag"])
      expect(self.endPointTransceiver.updateFragmentTemplate).etagWas("BIG_ELEMENT_ETAG")
      expect(self.endPointTransceiver.updateFragmentTemplate).bodyWas({code: {template: 'some template'}})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(widgetElementTemplatePath, response)
      done()
    })
  })

  it("should stop you creating global elements when there is no endpoint", () => {

    self.elementPutter.putGlobalElement("element/Unsupported")

    expect(self.logger.warn).toHaveBeenCalledWith("elementsCannotBeCreated", { path: 'element/Unsupported' })
  })

  it("should let you create global elements where they do not exist", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.metadata.readMetadataFromDisk.returns({title : "Element Title", tag : "element-tag", type : "fragment"})
    self.elementCreator.createElementInExtension.returnsPromise()

    self.elementPutter.putGlobalElement("element/Supported").then(() => {

      expect(self.elementCreator.createElementInExtension).toHaveBeenCalledWith("Element Title", "element-tag", "fragment", "element/Supported")
      done()
    })
  })

  it("should stop you putting element metadata when there is no endpoint", () => {

    self.elementPutter.putElementMetadata("element/Unsupported")

    expect(self.logger.warn).toHaveBeenCalledWith("elementsCannotBeSent", { path: 'element/Unsupported' })
  })

  it("should let you put element metadata", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.endPointTransceiver.updateGlobalElementMetadata.returnsPromise()
    self.metadata.readMetadata.returnsPromise({title : "Element Title", tag : "element-tag", type : "fragment", etag : "BIG_ELEMENT_ETAG" })
    self.utils.readJsonFile.returns({
      children : [],
      translations : [
        {
        "description": "",
        "language": "th",
        "title": "Tickle Widget Element [th]"
      }
      ]
    })
    self.endPointTransceiver.locale = "th"
    self.putterUtils.processPutResultAndEtag.and.callFake((path, results, syncElementMetadata) => {
      syncElementMetadata(path)
    })

    self.elementPutter.putGlobalElementMetadata ("element/Supported").then(() => {

      expect(self.endPointTransceiver.updateGlobalElementMetadata).urlKeysWere(["element-tag"])
      expect(self.endPointTransceiver.updateGlobalElementMetadata).etagWas("BIG_ELEMENT_ETAG")
      expect(self.endPointTransceiver.updateGlobalElementMetadata).bodyWas({
        children : [],
        translations : [
          {
            "description": "",
            "language": "th",
            "title": "Tickle Widget Element [th]"
          }
        ]
      })

      expect(self.metadata.updateMetadata).toHaveBeenCalledWith('element/Supported', 'element.json', { title: 'Tickle Widget Element [th]' })

      done()
    })
  })
})
