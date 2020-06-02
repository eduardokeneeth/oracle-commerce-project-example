"use strict"

const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Widget Instance Grabber", () => {

  const baseWidgetDir = "widget"

  const myLittleWidgetName = "My Little Widget"
  const myLittleWidgetDir = `${baseWidgetDir}/${myLittleWidgetName}`
  const myLittleWidgetInstancesDir = `${myLittleWidgetDir}/instances`
  const myLittleWidgetInstanceName = "My Little Widget Instance"
  const myLittleWidgetInstanceDir = `${myLittleWidgetInstancesDir}/${myLittleWidgetInstanceName}`
  const myLittleWidgetInstanceLocalesDir = `${myLittleWidgetInstanceDir}/locales`
  const myLittleWidgetInstanceLocalesEnDir = `${myLittleWidgetInstanceLocalesDir}/en`
  const myLittleWidgetInstanceLocaleEnFile = `${myLittleWidgetInstanceLocalesEnDir}/ns.mylittlewidgettype.json`
  const myLittleWidgetInstanceMetadata = `${myLittleWidgetInstanceDir}/widgetInstance.json`
  const myLittleWidgetInstanceDisplayTemplate = `${myLittleWidgetInstanceDir}/display.template`
  const myLittleWidgetInstanceLess = `${myLittleWidgetInstanceDir}/widget.less`
  const myLittleWidgetVersionsDir = `${myLittleWidgetDir}/versions`

  const myHomeMadeWidgetDir = "widget/My Home Made Widget"
  const myHomeMadeWidgetInstanceMetadata = `${myHomeMadeWidgetDir}/instances/My Home Made Instance/widgetInstanceMetadata.json`

  const myLittleWebContentWidgetName = "My Little Web Content Widget"
  const myLittleWebContentInstanceName = `${myLittleWebContentWidgetName} Instance`
  const myLittleWebContentWidgetDir = `widget/${myLittleWebContentWidgetName}`
  const myLittleWebContentWidgetInstancesDir = `${myLittleWebContentWidgetDir}/instances`
  const myLittleWebContentWidgetInstanceDir = `${myLittleWebContentWidgetInstancesDir}/My Little Web Content Widget Instance`
  const myLittleWebContentWidgetInstanceLocalesDir = `${myLittleWebContentWidgetInstanceDir}/locales`
  const myLittleWebContentWidgetInstanceLocalesEnDir = `${myLittleWebContentWidgetInstanceLocalesDir}/en`
  const myLittleWebContentWidgetInstanceLocalesEnFile = `${myLittleWebContentWidgetInstanceLocalesEnDir}/ns.webcontent.json`
  const myLittleWebContentWidgetInstanceMetadata = `${myLittleWebContentWidgetInstanceDir}/widgetInstance.json`
  const myLittleWebContentWidgetInstanceDisplayTemplate = `${myLittleWebContentWidgetInstanceDir}/display.template`
  const myLittleWebContentWidgetInstanceContentTemplate = `${myLittleWebContentWidgetInstanceDir}/content.template`
  const myLittleWebContentWidgetInstanceLess = `${myLittleWebContentWidgetInstanceDir}/widget.less`

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "getWidgetLocaleContent", "listWidgets", "getWidgetMetadata")

    self.endPointTransceiver.locales = [{name: "en"}]

    mockery.mockModules(self, "../utils", "../grabberUtils", "../etags", "../metadata", "../logger", "../localeUtils", "../snippetKeyTracker")

    self.utils.sanitizeName.returnsFirstArg()

    self.widgetInstanceGrabber = mockery.require("../widgetInstanceGrabber")

    self.endPointTransceiver.getWidgetLocaleContent.returnsResponse(
      {
        localeData: {
          resources,
          custom: {
            "overrideKey": "Should see this"
          }
        }
      }, "widget locale content etag")

    self.grabberUtils.copyFieldContentsToFile.returnsPromise()

    self.endPointTransceiver.getWidgetMetadata.returnsResponse({metadata: {metadataKey: "metadataValue"}}, "instance metadata etag")

    self.widgetInstanceGrabber.widgetTypeToDirectoryMap.set("myHomeMadeWidgetType", myHomeMadeWidgetDir)
    self.widgetInstanceGrabber.widgetTypeToDirectoryMap.set("myLittleWidgetType", myLittleWidgetDir)
    self.widgetInstanceGrabber.widgetTypeToDirectoryMap.set("webContent", myLittleWebContentWidgetDir)

    self.localeUtils.getInitialMatchName.returns("en")
  })

  afterEach(mockery.stopAll)

  const resources = {
    "buttonEditCartSummary": "Edit",
    "cartSummaryItemLimitText": "Showing initial __noOfItems__ cart items",
    "colorText": "Color: ",
    "overrideKey": "Should not see this"
  }

  function mockValidInstances() {

    self.endPointTransceiver.listWidgets.returnsItems(
      {
        displayName: myLittleWidgetInstanceName,
        repositoryId: "rep0002",
        id: "rep0002",
        descriptor: {
          widgetType: "myLittleWidgetType",
          repositoryId: "rep0001",
          version: 3,
          i18nresources : "mylittlewidgettype"
        },
        layouts: []
      },
      {
        displayName: myLittleWidgetInstanceName,
        repositoryId: "rep0003",
        id: "rep0003",
        descriptor: {
          widgetType: "myLittleWidgetType",
          repositoryId: "rep0001",
          version: 2,
          i18nresources : "mylittlewidgettype"
        },
        layouts: []
      },
      {
        displayName: "My Home Made Instance",
        repositoryId: "rep0020",
        id: "rep0020",
        descriptor: {
          widgetType: "myHomeMadeWidgetType",
          repositoryId: "rep0010",
          version: 4,
          source: 101,
          i18nresources : "mylittlewidgettype"
        },
        layouts: []
      }
    )

    // First call to exists must return false. All later calls must return true.
    let calls = 0
    self.utils.exists.and.callFake(() => {
      return calls++
    })

    self.metadata.readMetadataFromDisk.and.callFake(() => {
      return {
        version: 3
      }
    })
  }

  it("should let you grab all Widgets", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.widgetInstanceGrabber.grabWidgetInstances().then(() => {

      expect(self.endPointTransceiver.listWidgets).toHaveBeenCalled()

      expect(self.endPointTransceiver.getWidgetLocaleContent).urlKeysWere(["rep0020"])
      expect(self.endPointTransceiver.getWidgetLocaleContent).localeWas("en")

      const paths = [ myLittleWidgetInstanceLocalesDir, myLittleWidgetInstanceLocalesEnDir]
      paths.forEach(path => expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(path))

      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith(myLittleWidgetInstanceDir)

      expect(self.utils.writeFile).toHaveBeenCalledWith(myLittleWidgetInstanceLocaleEnFile, JSON.stringify(
        {
          "resources": {
            "buttonEditCartSummary": "Edit",
            "cartSummaryItemLimitText": "Showing initial __noOfItems__ cart items",
            "colorText": "Color: ",
            "overrideKey": "Should see this"
          }
        }, null, 2))

      expect(self.etags.writeEtag).toHaveBeenCalledWith(myLittleWidgetInstanceLocaleEnFile, "widget locale content etag")

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(myLittleWidgetInstanceMetadata,
        {
          version: 3,
          displayName: myLittleWidgetInstanceName
        })

      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getWidgetSourceCode", "rep0002", "source", myLittleWidgetInstanceDisplayTemplate)
      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getWidgetLess", "rep0002", "source", myLittleWidgetInstanceLess, constants.lessFileSubstitutionReqExp, "#WIDGET_ID-WIDGET_INSTANCE_ID")

      expect(self.logger.info).toHaveBeenCalledWith("grabbingWidgetInstance", {name: myLittleWidgetInstanceName})

      // More complex case - not latest version. Make sure dirs got created.
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(myHomeMadeWidgetInstanceMetadata, '{\n  "metadataKey": "metadataValue"\n}', 'instance metadata etag')

      done()
    })
  })

  it("should let you grab Web Content Widgets", done => {

    self.endPointTransceiver.listWidgets.returnsItems(
      {
        displayName: myLittleWebContentInstanceName,
        repositoryId: "rep0002",
        id: "rep0002",
        descriptor: {
          widgetType: "webContent",
          repositoryId: "rep0001",
          version: 3,
          i18nresources: "webcontent"
        }
      })

    self.widgetInstanceGrabber.grabWidgetInstances().then(() => {

      expect(self.endPointTransceiver.listWidgets).toHaveBeenCalled()

      const paths = [ myLittleWebContentWidgetInstanceLocalesDir]
      paths.forEach(path => expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(path))

      expect(self.utils.makeTrackedTree).toHaveBeenCalledWith(myLittleWebContentWidgetInstanceDir)

      expect(self.utils.writeFile).not.toHaveBeenCalledWith(myLittleWebContentWidgetInstanceLocalesEnFile, JSON.stringify({resources}, null, 2))
      expect(self.etags.writeEtag).not.toHaveBeenCalledWith(myLittleWebContentWidgetInstanceLocalesEnFile, "widget locale content etag")

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(myLittleWebContentWidgetInstanceMetadata,
        {
          version: 3,
          displayName: myLittleWebContentInstanceName
        })

      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getWidgetSourceCode", "rep0002", "source", myLittleWebContentWidgetInstanceDisplayTemplate)
      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getWidgetWebContent", "rep0002", "content", myLittleWebContentWidgetInstanceContentTemplate)
      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getWidgetLess", "rep0002", "source", myLittleWebContentWidgetInstanceLess, constants.lessFileSubstitutionReqExp, "#WIDGET_ID-WIDGET_INSTANCE_ID")

      done()
    })
  })

  it("should warn when endpoints are not available", done => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    mockValidInstances()

    self.widgetInstanceGrabber.grabWidgetInstances().then(() => {
      expect(self.logger.warn).toHaveBeenCalledWith("widgetInstanceMetadataCannotBeGrabbed")
      done()
    })
  })

  it("should warn when there are no text snippets for a locale after a fallback", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.endPointTransceiver.getWidgetLocaleContent.returnsResponse({}, "widget locale content etag")

    self.localeUtils.hasFallBack.returnsTrue()
    self.localeUtils.getFallBackName.returns('Izzy')

    self.widgetInstanceGrabber.grabWidgetInstances().then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith('localeInstanceDataNotFound', {
        displayName: 'My Home Made Instance',
        localeName: 'Izzy'
      })

      done()
    })
  })

  it("should warn when there are no text snippets for a locale", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockValidInstances()

    self.endPointTransceiver.getWidgetLocaleContent.returnsResponse({}, "widget locale content etag")

    self.widgetInstanceGrabber.grabWidgetInstances().then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith('localeInstanceDataNotFound', {
        displayName: 'My Home Made Instance',
        localeName: 'en'
      })

      done()
    })
  })
})
