"use strict"

const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Widget Grabber", () => {

  const baseWidgetDir = "widget"

  const myLittleWidgetName = "My Little Widget"
  const myLittleWidgetDir = `${baseWidgetDir}/${myLittleWidgetName}`
  const myLittleWidgetJsDir = `${myLittleWidgetDir}/js`
  const myLittleWidgetInstancesDir = `${myLittleWidgetDir}/instances`
  const myLittleWidgetJsFile = `${myLittleWidgetJsDir}/myLittle.js`
  const myLittleWidgetMetadata = `${myLittleWidgetDir}/widget.json`
  const myLittleWidgetVersionsDir = `${myLittleWidgetDir}/versions`
  const myLittleWidgetVersionOneDir = `${myLittleWidgetVersionsDir}/1`

  const myHomeMadeWidgetDir = "widget/My Home Made Widget"
  const myHomeMadeWidgetUserMetadata = `${myHomeMadeWidgetDir}/widgetMetadata.json`
  const myUserWidgetConfigMetadata = `${myHomeMadeWidgetDir}/config/configMetadata.json`
  const myHomeMadeWidgetJsFile = `${myHomeMadeWidgetDir}/js/myLittle.js`
  const myHomeMadeWidgetConfigLocaleLocaleEn = `${myHomeMadeWidgetDir}/config/locales/en.json`
  const myHomeMadeWidgetBaseLocaleEnFile = `${myHomeMadeWidgetDir}/locales/en/ns.myhomemadewidgettype.json`
  const myHomeMadeWidgetBaseDisplayTemplate = `${myHomeMadeWidgetDir}/display.template`
  const myHomeMadeWidgetBaseLess = `${myHomeMadeWidgetDir}/widget.less`

  const myLittleWebContentWidgetName = "My Little Web Content Widget"
  const myLittleWebContentInstanceName = `${myLittleWebContentWidgetName} Instance`
  const myLittleWebContentWidgetDir = `widget/${myLittleWebContentWidgetName}`
  const myLittleWebContentWidgetJsDir = `${myLittleWebContentWidgetDir}/js`
  const myLittleWebContentWidgetMetadata = `${myLittleWebContentWidgetDir}/widget.json`

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver",
      "getAllWidgetInstances", "getWidgetDescriptorJavascriptInfoById", "getWidgetLocaleContent",
      "getWidgetDescriptorMetadata", "getConfigMetadataForWidgetDescriptor", "getConfigLocaleContentForWidgetDescriptor",
      "getWidgetDescriptorBaseLocaleContent", "getWidgetMetadata", "getWidgetDescriptorJavascriptExtensionInfoById")

    self.endPointTransceiver.locales = [{name: "en"}]

    mockery.mockModules(self, "../utils", "../grabberUtils", "../etags", "../metadata", "../logger", "../widgetInstanceGrabber")

    self.utils.sanitizeName.returnsFirstArg()

    self.widgetInstanceGrabber.widgetTypeToDirectoryMap  = new Map()

    self.widgetGrabber = mockery.require("../widgetGrabber")

    self.grabberUtils.copyFieldContentsToFile.returnsPromise()

    self.endPointTransceiver.getWidgetDescriptorJavascriptInfoById.returnsResponse(
      {
        jsFiles: [
          {
            name: "myLittle.js"
          },
          {
            name: "myLittle.js",
            extension: "true"
          }
        ]
      })

    self.endPointTransceiver.get.returnsResponse("some widget js source", "get js etag")
    self.endPointTransceiver.getWidgetDescriptorMetadata.returnsResponse({metadata: {}}, "get metadata etag")
    self.endPointTransceiver.getConfigMetadataForWidgetDescriptor.returnsResponse({metadata: {metadataKey: "metadataValue"}}, "config metadata etag")
    self.endPointTransceiver.getConfigLocaleContentForWidgetDescriptor.returnsResponse({localeData: {localeKey: "localeValue"}}, "config locale etag")
    self.endPointTransceiver.getWidgetDescriptorBaseLocaleContent.returnsResponse({localeData: {resources: {localeKey: "localeValue"}}}, "base locale etag")
  })

  afterEach(mockery.stopAll)

  const resources = {
    "buttonEditCartSummary": "Edit",
    "cartSummaryItemLimitText": "Showing initial __noOfItems__ cart items",
    "colorText": "Color: ",
    "overrideKey": "Should not see this"
  }

  function mockValidInstances() {

    self.endPointTransceiver.getAllWidgetInstances.returnsItems(
      {
        displayName: myLittleWidgetName,
        widgetType: "myLittleWidgetType",
        editableWidget: true,
        jsEditable: true,
        repositoryId: "rep0001",
        id: "rep0001",
        version: 1,
        instances: [],
        layouts: []
      },
      {
        displayName: "My Home Made Widget",
        widgetType: "myHomeMadeWidgetType",
        editableWidget: true,
        jsEditable: true,
        repositoryId: "rep0010",
        id: "rep0010",
        version: 1,
        instances: [],
        source: 101,
        configurable: true,
        i18nresources: "myhomemadewidgettype",
        layouts: []
      }
    )
  }

  it("should let you grab all Widgets", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.widgetGrabber.grabAllWidgets(true).then(() => {

      expect(self.endPointTransceiver.getAllWidgetInstances).toHaveBeenCalledWith("?source=100")
      expect(self.endPointTransceiver.getAllWidgetInstances).toHaveBeenCalledWith("?source=101")

      expect(self.endPointTransceiver.getWidgetDescriptorJavascriptInfoById).toHaveBeenCalledWith(["rep0001"])

      const paths = [baseWidgetDir, myLittleWidgetInstancesDir, myLittleWidgetDir, myLittleWidgetJsDir]
      paths.forEach(path => expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(path))

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(myLittleWidgetJsFile, "some widget js source", "get js etag")

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(myLittleWidgetMetadata,
        {
          widgetType: "myLittleWidgetType",
          version: 1,
          displayName: myLittleWidgetName,
          elementized: false
        })

      expect(self.logger.info).toHaveBeenCalledWith("grabbingWidget", {name: myLittleWidgetName})

      // See if the directory map is right. Simple case - latest widget.
      expect(self.widgetGrabber.getDirectoryForWidget("myLittleWidgetType", 3, true)).toEqual(myLittleWidgetDir)

      // More complex case - not latest version. Make sure dirs got created.
      expect(self.widgetGrabber.getDirectoryForWidget("myLittleWidgetType", 1, false)).toEqual(myLittleWidgetVersionOneDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(myLittleWidgetVersionsDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(myLittleWidgetVersionOneDir)

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(myHomeMadeWidgetUserMetadata, '{}', 'get metadata etag')
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(myUserWidgetConfigMetadata, '{\n  "metadataKey": "metadataValue"\n}', 'config metadata etag')
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(myHomeMadeWidgetJsFile, 'some widget js source', 'get js etag')
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(myHomeMadeWidgetConfigLocaleLocaleEn, '{\n  "localeKey": "localeValue"\n}', 'config locale etag')

      expect(self.utils.writeFile).toHaveBeenCalledWith(myHomeMadeWidgetBaseLocaleEnFile, JSON.stringify(
        {
          "resources": {
            "localeKey": "localeValue"
          }
        }, null, 2))
      expect(self.etags.writeEtag).toHaveBeenCalledWith(myHomeMadeWidgetBaseLocaleEnFile, "base locale etag")

      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith('getWidgetDescriptorBaseTemplate', 'rep0010', 'source', myHomeMadeWidgetBaseDisplayTemplate)
      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith('getWidgetDescriptorBaseLess', 'rep0010', 'source', myHomeMadeWidgetBaseLess)

      done()
    })
  })

  it("should handle aliased locales", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.endPointTransceiver.locales = [
      {
        name: "chinese",
        aliases : ["new chinese alias", "old chinese alias"]
      }]

    self.endPointTransceiver.getWidgetLocaleContent.returnsResponse({}, "widget locale content etag")
    self.endPointTransceiver.getConfigLocaleContentForWidgetDescriptor.returnsResponse({}, "config locale etag")
    self.endPointTransceiver.getWidgetDescriptorBaseLocaleContent.returnsResponse({}, "base locale etag")

    self.widgetGrabber.grabAllWidgets(true).then(() => {

      expect(self.grabberUtils.writeFileAndETag).not.toHaveBeenCalledWith(myHomeMadeWidgetConfigLocaleLocaleEn, '{\n  "localeKey": "localeValue"\n}', 'config locale etag')
      expect(self.utils.writeFile).not.toHaveBeenCalled()
      done()
    })
  })

  it("should let you grab Web Content Widgets", done => {

    self.endPointTransceiver.getWidgetDescriptorJavascriptExtensionInfoById.returnsResponse(
      {
        jsFiles : [
          {
            url : "module js url",
            extension : "true",
            name : "extension.js"
          }
        ]
      },
    "module etag")

    self.endPointTransceiver.getAllWidgetInstances.returnsItems(
      {
        displayName: myLittleWebContentWidgetName,
        widgetType: "webContent",
        editableWidget: true,
        jsEditable: false,
        repositoryId: "rep0001",
        version: 3,
        javascriptExtension: true,
        instances: [
          {
            displayName: myLittleWebContentInstanceName,
            repositoryId: "rep0002",
            id: "rep0002",
            version: 3
          }
        ],
        layouts: []
      })

    self.widgetGrabber.grabAllWidgets(true).then(() => {

      expect(self.endPointTransceiver.getAllWidgetInstances).toHaveBeenCalledWith("?source=100")
      expect(self.endPointTransceiver.getAllWidgetInstances).toHaveBeenCalledWith("?source=101")

      const paths = [baseWidgetDir, myLittleWebContentWidgetDir]
      paths.forEach(path => expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(path))

      expect(self.utils.makeTrackedDirectory).not.toHaveBeenCalledWith(myLittleWebContentWidgetJsDir)

      expect(self.grabberUtils.writeFileAndETag).not.toHaveBeenCalledWith(myLittleWidgetJsFile, "some widget js source", "get js etag")

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(myLittleWebContentWidgetMetadata,
        {
          widgetType: "webContent",
          version: 3,
          displayName: myLittleWebContentWidgetName,
          elementized: false
        })

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("widget/My Little Web Content Widget/module/js/extension.js", "some widget js source", "get js etag")

      expect(self.widgetInstanceGrabber.widgetTypeToDirectoryMap.get("webContent")).toEqual("widget/My Little Web Content Widget")

      done()
    })
  })

  it("should warn when endpoints are not available", done => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    mockValidInstances()

    self.widgetGrabber.grabAllWidgets(true).then(() => {
      expect(self.logger.warn).toHaveBeenCalledWith("widgetDescriptorMetadataCannotBeGrabbed")
      expect(self.logger.warn).toHaveBeenCalledWith("baseWidgetContentCannotBeGrabbed")
      expect(self.logger.warn).toHaveBeenCalledWith("widgetDescriptorMetadataCannotBeGrabbed")
      expect(self.logger.warn).toHaveBeenCalledWith("baseWidgetContentCannotBeGrabbed")
      done()
    })
  })

  it("should let you grab a specific widget", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.utils.splitPath.returns("My Home Made Widget")

    self.widgetGrabber.grabSpecificWidget("widget/My Home Made Widget").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("grabbingWidget", {name: "My Home Made Widget"})

      done()
    })
  })


  it("should not let you grab a silly widget", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.utils.splitPath.returns("My Imaginary Widget")

    return self.widgetGrabber.grabSpecificWidget("widget/My Imaginary Widget").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("noMatchFound", { name: "My Imaginary Widget" })
      done()
    })
  })
})
