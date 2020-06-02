"use strict"

const mockery = require("./mockery")

describe("extensionBuilder", () => {


  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "createApplicationID")

    mockery.mockModules(self, "dateformat", "os", "upath", "username", "fs", "node-zip",
      "../endPointTransceiver", "../requestBuilder", "../utils", "../i18n", "../etags")

    self.zipInstance = {
      file : jasmine.createSpy("file"),
      generate : jasmine.createSpy("generate")
    }
    self["node-zip"].and.returnValue(self.zipInstance)

    self.requestBuilder.request = () => {
      return {
        withBody : jasmine.createSpy("withBody")
      }
    }

    self.extensionBuilder = mockery.require("../extensionBuilder")
  })

  afterEach(mockery.stopAll)

  it("should build extensions", done => {

    self.endPointTransceiver.createApplicationID.returnsPromise({
      data : {
        id : "new id"
      }
    })

    self.utils.walkDirectory.and.callFake((path, config) => {
      config.listeners.file("widget/Cart Shipping", {name : "display.template"}, () => {})
    })

    self.upath.resolve.returns("widget/Cart Shipping/display.template")

    const extensionPathFor = jasmine.createSpy("extensionPathFor").and.returnValue("widget/cartShipping/display.template")
    const extensionContentsFor = jasmine.createSpy("extensionContentsFor").and.returnValue("template contents")
    const onCompleteCallBack = jasmine.createSpy("onCompleteCallBack").and.callFake((extension) => {
      self.extensionBuilder.dumpExtensionTo(extension, "my/extension/path")
    })

    self.extensionBuilder.buildExtension("idRequestText", "manifestNameText", "cartShipping", "sourceDir", extensionPathFor, extensionContentsFor, onCompleteCallBack).then(() => {

      expect(extensionPathFor).toHaveBeenCalledWith("cartShipping", "widget/Cart Shipping/display.template")
      expect(extensionContentsFor).toHaveBeenCalledWith("widget/Cart Shipping/display.template")
      expect(onCompleteCallBack).toHaveBeenCalledWith(self.zipInstance)

      expect(self.zipInstance.file).toHaveBeenCalledWith("ext.json",
        '{\n  "extensionID": "new id",\n  "name": "manifestNameText",\n  "version": 1\n}')

      expect(self.zipInstance.file).toHaveBeenCalledWith("widget/cartShipping/display.template", "template contents")
      expect(self.zipInstance.generate).toHaveBeenCalledWith({ base64: false, compression: "DEFLATE" })

      expect(self.fs.writeFileSync).toHaveBeenCalled()
      done()
    })
  })
})
