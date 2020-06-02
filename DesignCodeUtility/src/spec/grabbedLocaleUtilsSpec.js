"use strict"

const mockery = require('./mockery')

const constants = require('../constants').constants
const PuttingFileType = require("../puttingFileType").PuttingFileType


const widgetInstanceTemplatePath = "widget/Test Wudget/instances/Test Widget One/display.template"

// Snippet paths for the en locale
const widgetBaseSnippetsPathEn = "widget/Test Widget/locales/en/ns.testWidget.json"
const widgetConfigSnippetsPathEn = "widget/Test Widget/config/locales/en/config.json"
const widgetInstanceSnippetsPathEn = "widget/Test Widget/instances/Test Widget One/locales/en/ns.instance.json"
const stackBaseSnippetsPathEn = "stack/Test Stack/locales/en/ns.testWidget.json"
const stackConfigSnippetsPathEn = "stack/Test Stack/config/locales/en/config.json"

// Snippet paths for the de locale
const widgetBaseSnippetsPathDe = "widget/Test Widget/locales/de/ns.testWidget.json"
const widgetConfigSnippetsPathDe = "widget/Test Widget/config/locales/de/config.json"
const widgetInstanceSnippetsPathDe = "widget/Test Widget/instances/Test Widget One/locales/de/ns.instance.json"
const stackBaseSnippetsPathDe = "stack/Test Stack/locales/de/ns.testWidget.json"
const stackConfigSnippetsPathDe = "stack/Test Stack/config/locales/en/config.json"


describe("GrabbedLocaleUtils", () => {

  const self = this

  beforeEach(() => {
    mockery.use(jasmine.createSpy)

    mockery.mockModules(self,
      '../endPointTransceiver', '../utils', '../optionsUtils', '../logger', '../metadata', '../classifier', "upath" 
    )

    self.grabbedLocaleUtils = mockery.require("../grabbedLocaleUtils")

  
  })

  afterEach(mockery.stopAll)

  it("should allow grab as given locale matches saved locale", done => {
  
    // Set up locales
    self.endPointTransceiver.locale = 'en'
    self.metadata.readMetadataFromDisk.returns({grabLocale: "en"})

    // Run test
    self.grabbedLocaleUtils.isOkToGrabWithLocale() === true

    // Verify use of mocks
    expect(self.metadata.readMetadataFromDisk).toHaveBeenCalled()
    expect(self.utils.walkDirectory).not.toHaveBeenCalled()
    
    done()

  })

  it("should not allow grab as given locale does not match saved locale", done => {
    
    // Set up locales
    self.endPointTransceiver.locale = 'en'
    self.metadata.readMetadataFromDisk.returns({grabLocale: "de"})

    // Run test
    self.grabbedLocaleUtils.isOkToGrabWithLocale() === false

    // Verify use of mocks
    expect(self.metadata.readMetadataFromDisk).toHaveBeenCalled()
    expect(self.utils.walkDirectory).not.toHaveBeenCalled()

    done()
  })

  it("should allow grab as no gathered locales", done => {
    
    // Set up locales
    self.endPointTransceiver.locale = 'en'

    // Set up walk to find locales
    self.upath.resolve.returns(widgetInstanceTemplatePath)
    self.utils.walkDirectory.and.callFake((path, config) => {
      config.listeners.file("widget/Test Widget/instances/Test Widget One", {name: "display.template"}, () => {
      })
    })

    // Run test
    self.grabbedLocaleUtils.isOkToGrabWithLocale() === true

    // Verify use of mocks
    expect(self.metadata.readMetadataFromDisk).toHaveBeenCalled()
    expect(self.upath.resolve).toHaveBeenCalled()
    expect(self.utils.walkDirectory).toHaveBeenCalled()

    done()
  })

  it("should allow grab as locale in gathered locales", done => {
    
    // Set up locales
    self.endPointTransceiver.locale = 'en'

    // Set up walk to find locales
    self.upath.resolve.returns(widgetConfigSnippetsPathEn)
    self.utils.walkDirectory.and.callFake((path, config) => {
      config.listeners.file("widget/Test Widget/config/locales/en", {name: "config.json"}, () => {
      })
    })

    // Run test
    self.grabbedLocaleUtils.isOkToGrabWithLocale() === true

    // Verify use of mocks
    expect(self.metadata.readMetadataFromDisk).toHaveBeenCalled()
    expect(self.upath.resolve).toHaveBeenCalled()
    expect(self.utils.walkDirectory).toHaveBeenCalled()

    done()
  })

  it("should allow grab as locale not in gathered locales", done => {
    
    // Set up locales
    self.endPointTransceiver.locale = 'en'

    // Set up walk to find locales
    self.upath.resolve.returns(widgetConfigSnippetsPathDe)
    self.utils.walkDirectory.and.callFake((path, config) => {
      config.listeners.file("widget/Test Widget/config/locales/de", {name: "config.json"}, () => {
      })
    })

    // Run test
    self.grabbedLocaleUtils.isOkToGrabWithLocale() === false

    // Verify use of mocks
    expect(self.metadata.readMetadataFromDisk).toHaveBeenCalled()
    expect(self.upath.resolve).toHaveBeenCalled()
    expect(self.utils.walkDirectory).toHaveBeenCalled()

    done()
  })

})
