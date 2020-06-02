const constants = require('../constants').constants
const mockery = require('./mockery')

const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("Metadata Handler", () => {

  const self = this

  const elementTemplatePath = "element/Company Logo/element.template"
  const widgetElementTemplatePath = "widget/Product Details/element/Add to Cart Button/element.template"
  const stackInstanceTemplatePath = "stack/Progress Tracker/instances/Progress Tracker/stack.template"
  const otherStackInstanceTemplatePath = "stack/Progress Tracker/instances/Not Progress Tracker/stack.template"
  const widgetPath = "widget/Cart Summary"
  const widgetJsPath = "widget/Cart Summary/js/something.js"
  const otherWidgetJsPath = "widget/Not Cart Summary/js/something.js"
  const widgetInstanceTemplatePath = "widget/Cart Summary/instances/Cart Summary Widget/display.template"
  const otherWidgetInstanceTemplatePath = "widget/Cart Summary/instances/Not Cart Summary Widget/display.template"
  const themeDirectoryPath = "theme/Red Theme"
  const otherThemeDirectoryPath = "theme/Green Theme"
  const siteSettingsDirectoryPath = "siteSettings/General Settings"
  const siteSettingsConfigMetadataPath = "siteSettings/General Settings/siteSettingsMetadata.json"

  const putResults = {}

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../state', '../utils', '../etags', '../logger', '../classifier')

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "getThemes", "listWidgets", "getWidget", "getElements", "getAllStackInstances", "getAllWidgetInstances",
      "getAllWidgetDescriptors", "listStacks", "getStack", "getStackDescriptor", "getAllStackDescriptors",
      "listSiteSettings", "getSites")

    self.endPointTransceiver.getThemes.returnsItems(
      {
        name: "Red Theme",
        repositoryId: "111"
      }
    )

    self.endPointTransceiver.getAllWidgetInstances.returnsItems(
      {
        instances: [
          {
            repositoryId: "wid1234",
            displayName: "Cart Summary Widget",
            version: 1
          }
        ],

        editableWidget: true,
        repositoryId: "cswiRepo0001",
        version: 1,
        currentLayout: {
          repositoryId: "clRepoId",
          widgetLayoutDescriptor: {
            repositoryId: "wldRepoId"
          }
        }
      },
      {
        instances: [
          {
            repositoryId: "widNeverUsed"
          }
        ],
        editableWidget: false,
      })

    self.endPointTransceiver.getElements.returnsPromise(global => {
      return global === "?globals=true"
        ? {
          data: {
            items: [
              {
                tag: "my-element"
              }
            ]
          }
        }
        : {
          data: {
            items: [
              {
                tag: "my-widget-element"
              }
            ]
          }
        }
    })

    self.endPointTransceiver.getAllStackDescriptors.returnsItems(
      {
        version: 1,
        displayName: "Progress Tracker",
        repositoryId: "stack-desc-repo-id",
        stackType: "progressTracker"
      }
    )

    self.endPointTransceiver.getAllStackInstances.returnsItems(
      {
        instances: [
          {
            displayName: "Progress Tracker",
            repositoryId: "stack-repo-id",
            version: 1,
            descriptor: {
              version: 1,
              displayName: "Progress Tracker",
              repositoryId: "stack-desc-repo-id",
              stackType: "progressTracker",
            }
          }
        ]
      }
    )

    self.endPointTransceiver.getAllWidgetDescriptors.returnsItems(
      {
        version: 1,
        displayName: "Cart Summary",
        repositoryId: "csRepo0001",
        widgetType: "cartSummary",
        layouts: []
      }
    )

    self.endPointTransceiver.listSiteSettings.returnsItems(
      {
        "displayName": "General Settings",
        "id": "generalSettings"
      }
    )

    self.endPointTransceiver.getSites.returnsItems(
      {
        name: "Snazzy Site",
      }
    )

    self.metadata = mockery.require("../metadata")
  })

  afterEach(mockery.stopAll)

  /**
   * Does all the boilerplate to make it look like we read something from disk.
   * @param path
   * @param contents
   */
  function mockDiskMetadataAs(path, contents) {

    self.utils.splitFromBaseDir.returns(["", path])
    self.utils.exists.returnsTrue()
    self.utils.readJsonFile.returns(contents)
  }

  it("should get Theme metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(themeDirectoryPath, {displayName: "Red Theme"})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(themeDirectoryPath, constants.themeMetadataJson).then(metadata => {

        expect(metadata.repositoryId).toBe("111")
        expect(self.logger.info).toHaveBeenCalledWith('matchingThemeFound', {name: 'Red Theme'})

        done()
      }))
  })

  it("should be able to detect when a theme exists on the target server", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(themeDirectoryPath, {displayName: "Red Theme"})

    self.metadata.initializeMetadata().then(() => {

      expect(self.metadata.themeExistsOnTarget(themeDirectoryPath)).toBeTruthy()
      done()
    })
  })

  it("should tell you when it cannot get Theme metadata from the target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(otherThemeDirectoryPath, {displayName: "Green Theme"})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(otherThemeDirectoryPath, constants.themeMetadataJson).then(metadata => {

        expect(metadata).toBe(null)
        expect(self.logger.warn).toHaveBeenCalledWith('noMatchingThemeFound', {name: 'Green Theme'})

        done()
      }))
  })

  it("should get Global Element metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()
    self.endPointTransceiver.serverSupports.returnsTrue()

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_TEMPLATE)

    mockDiskMetadataAs(elementTemplatePath, {tag: "my-element"})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(elementTemplatePath, constants.elementMetadataJson).then(metadata => {

        expect(metadata.tag).toBe("my-element")
        expect(self.logger.info).toHaveBeenCalledWith('matchingElementFound', {path: elementTemplatePath})
        done()
      }))
  })

  it("should tell you when it cannot get Global Element metadata from the target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_TEMPLATE)

    mockDiskMetadataAs(elementTemplatePath, {tag: "not-my-element", displayName: "Company Logo", version: 1})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(elementTemplatePath, constants.elementMetadataJson).then(metadata => {

        expect(metadata).toBe(null)
        expect(self.logger.warn).toHaveBeenCalledWith('noMatchingElementFound', {path: elementTemplatePath})

        done()
      }))
  })

  it("should get Widget Element metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(widgetElementTemplatePath, {
      tag: "my-widget-element",
      widgetType: "cartSummary",
      version: 1
    })

    self.classifier.classify.returns(PuttingFileType.ELEMENT_TEMPLATE)

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(widgetElementTemplatePath, constants.elementMetadataJson).then(metadata => {

        expect(metadata.tag).toBe("my-widget-element")
        expect(metadata.etag).toBe(undefined)
        expect(self.logger.info).toHaveBeenCalledWith('matchingElementFound', {path: widgetElementTemplatePath})
        done()
      }))
  })

  it("should get Widget Element metadata and etag from target server when not in transfer mode", (done) => {

    self.state.inTransferMode.returnsFalse()

    mockDiskMetadataAs(widgetElementTemplatePath, {
      tag: "my-widget-element",
      widgetType: "cartSummary",
      version: 1
    })

    self.classifier.classify.returns(PuttingFileType.ELEMENT_TEMPLATE)
    self.etags.eTagFor.returns(`${widgetElementTemplatePath}_etag`)

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(widgetElementTemplatePath, constants.elementMetadataJson).then(metadata => {

        expect(metadata.etag).toBe(`${widgetElementTemplatePath}_etag`)
        expect(self.logger.info).not.toHaveBeenCalledWith('matchingElementFound', {path: widgetElementTemplatePath})
        done()
      }))
  })

  it("should tell you when you cannot get Widget Element metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(widgetElementTemplatePath, {tag: "not-my-widget-element", displayName: "Should Not Matter"})

    self.classifier.classify.returns(PuttingFileType.ELEMENT_TEMPLATE)

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(widgetElementTemplatePath, constants.elementMetadataJson).then(metadata => {

        expect(metadata).toBe(null)
        expect(self.logger.warn).toHaveBeenCalledWith('noMatchingElementFound', {path: widgetElementTemplatePath})

        done()
      }))
  })

  it("should get Stack Instance metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(stackInstanceTemplatePath, {displayName: "Progress Tracker", version: 1})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(stackInstanceTemplatePath, constants.stackInstanceMetadataJson).then(metadata => {

        expect(metadata.repositoryId).toBe("stack-repo-id")
        expect(self.logger.info).toHaveBeenCalledWith('matchingStackInstanceFound', {path: stackInstanceTemplatePath})

        done()
      }))
  })

  it("should tell you when you cannot get Stack Instance metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(otherStackInstanceTemplatePath, {})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(otherStackInstanceTemplatePath, constants.stackInstanceMetadataJson).then(metadata => {

        expect(metadata).toBe(null)
        expect(self.logger.warn).toHaveBeenCalledWith('noMatchingStackInstanceFound', {path: otherStackInstanceTemplatePath})

        done()
      }))
  })

  it("should get Widget metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(widgetJsPath, {displayName: "Cart Summary", version: 1})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(widgetJsPath, constants.widgetMetadataJson).then(metadata => {

        expect(metadata.repositoryId).toBe("csRepo0001")
        expect(self.logger.info).toHaveBeenCalledWith('matchingWidgetFound', {path: widgetJsPath})

        done()
      }))
  })

  it("should tell you when it cannot get Widget metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(otherWidgetJsPath, {displayName: "Not Cart Summary", version: 1})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(otherWidgetJsPath, constants.widgetMetadataJson).then(metadata => {

        expect(metadata).toBeNull()
        expect(self.logger.warn).toHaveBeenCalledWith('noMatchingWidgetFound', {path: otherWidgetJsPath})

        done()
      }))
  })

  it("should be able to detect when a widget exists on the target server", (done) => {

    mockDiskMetadataAs(widgetJsPath, {version: 1, widgetType: "cartSummary"})

    self.metadata.initializeMetadata().then(() => {

      expect(self.metadata.widgetExistsOnTarget(widgetJsPath)).toBeTruthy()
      done()
    })
  })

  it("should get Widget instance metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(widgetInstanceTemplatePath, {displayName: "Cart Summary Widget", version: 1})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(widgetInstanceTemplatePath, constants.widgetInstanceMetadataJson).then(metadata => {

        expect(metadata.repositoryId).toBe("wid1234")
        expect(metadata.descriptorRepositoryId).toBe("cswiRepo0001")
        expect(self.logger.info).toHaveBeenCalledWith('matchingWidgetInstanceFound', {path: widgetInstanceTemplatePath})

        done()
      }))
  })

  it("should tell you when it cannot get Widget instance metadata from target server in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(otherWidgetInstanceTemplatePath, {displayName: "Not Cart Summary Widget", version: 1})

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(otherWidgetInstanceTemplatePath, constants.widgetInstanceMetadataJson).then(metadata => {

        expect(metadata).toBeNull()
        expect(self.logger.warn).toHaveBeenCalledWith('noMatchingWidgetInstanceFound', {path: otherWidgetInstanceTemplatePath})

        done()
      }))
  })

  it("should tell you when it cannot get Widget instance metadata from target server in transfer mode", (done) => {

    self.utils.splitFromBaseDir.returns(["", otherWidgetInstanceTemplatePath])

    self.metadata.initializeMetadata().then(() => {

      const metadata = self.metadata.readMetadataFromDisk(otherWidgetInstanceTemplatePath, constants.widgetInstanceMetadataJson)
      expect(metadata).toBeNull()

      done()
    })
  })

  it("should return config metadata from disk in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()

    mockDiskMetadataAs(otherWidgetInstanceTemplatePath, {
      "node": "http://localhost:9080",
      "commerceCloudVersion": "SNAPSHOT-RELEASE",
      "packageVersion": "1.0.1"
    })

    self.metadata.initializeMetadata().then(() =>
      self.metadata.readMetadata(otherWidgetInstanceTemplatePath, constants.configMetadataJson)).then(metadata => {

      expect(metadata.commerceCloudVersion).toEqual("SNAPSHOT-RELEASE")

      done()
    })
  })

  it("should detect if a widget type is already used in the metadata", () => {

    const widgetType = "cartSummaryWidget"

    self.utils.readJsonFile.returns({widgetType})

    self.utils.walkDirectory.and.callFake((path, config) => {
      expect(path).toEqual(".ccc/widget")
      config.listeners.file(".ccc/widget/Cart Summary Widget", {name: constants.widgetMetadataJson}, () => {
      })
    })

    expect(self.metadata.widgetTypeExists(widgetType)).toBeTruthy()
  })

  it("should detect if a site settings type is already used in the metadata", () => {

    const siteSettingsType = "general"

    self.utils.readJsonFile.returns({id: siteSettingsType})

    self.utils.walkDirectory.and.callFake((path, config) => {
      expect(path).toEqual(".ccc/siteSettings")
      config.listeners.file(".ccc/siteSettings/General Settings", {name: constants.siteSettingsMetadataJson}, () => {
      })
    })

    expect(self.metadata.siteSettingsTypeExists(siteSettingsType)).toBeTruthy()
  })

  it("should let us update existing metadata", () => {

    mockDiskMetadataAs(widgetJsPath, {displayName: "Cart Summary", version: 1})

    self.metadata.updateMetadata(widgetJsPath, constants.widgetMetadataJson, {displayName: "Old Cart Summary"})

    expect(self.utils.writeFile).toHaveBeenCalledWith("/.ccc/widget/Cart Summary/widget.json", '{\n  "displayName": "Old Cart Summary",\n  "version": 1\n}')
  })

  it("should let us update existing metadata for widgets", () => {

    mockDiskMetadataAs(widgetPath, {displayName: "Cart Summary", version: 1})

    self.metadata.updateMetadata(widgetPath, constants.widgetMetadataJson, {displayName: "Old Cart Summary"})

    expect(self.utils.writeFile).toHaveBeenCalledWith("/.ccc/widget/Cart Summary/widget.json", '{\n  "displayName": "Old Cart Summary",\n  "version": 1\n}')
  })

  it("should let us get elements by tag", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.metadata.initializeMetadata().then(() => {

      expect(self.metadata.getElementByTag("my-element")).toEqual({tag: "my-element"})
      expect(self.metadata.getElementByTag("my-widget-element")).toEqual({tag: "my-widget-element"})

      done()
    })
  })

  it("should know if the element exists on the target system", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    mockDiskMetadataAs(elementTemplatePath, {tag: "my-element"})

    self.metadata.initializeMetadata().then(() => {

      expect(self.metadata.elementExistsOnTarget(elementTemplatePath)).toBeTruthy()
      done()
    })
  })

  it("should know if a widget is elementized", done => {

    mockDiskMetadataAs(elementTemplatePath, {tag: "my-element", elementized: true})

    self.metadata.initializeMetadata().then(() => {

      expect(self.metadata.widgetIsElementized(elementTemplatePath)).toBeTruthy()
      done()
    })
  })

  it("should know if an element tag exists", () => {

    self.utils.walkDirectory.and.callFake((path, callbacks) => {
      callbacks.listeners.file("dir", {name: `not ${constants.elementMetadataJson}`}, () => {
      })
      callbacks.listeners.file("dir", {name: constants.elementMetadataJson}, () => {
      })
    })

    self.utils.readJsonFile.returns({tag: "little-tag"})

    expect(self.metadata.elementTagExists("little-tag")).toBeTruthy()
  })

  it("should know if site settings exist on target", done => {

    mockDiskMetadataAs(siteSettingsDirectoryPath, {displayName: "General Settings"})

    self.metadata.initializeMetadata().then(() => {

      expect(self.metadata.siteSettingsExistOnTarget("siteSettings/General Settings/siteSettingsConfigMetadata.json")).toBeTruthy()
      done()
    })
  })

  it("should get Site Settings metadata from target server", done => {

    mockDiskMetadataAs(siteSettingsDirectoryPath, {displayName: "General Settings", siteName: "Snazzy Site"})

    return self.metadata.initializeMetadata().then(() => {

        return self.metadata.readMetadata(siteSettingsConfigMetadataPath, constants.siteSettingsValuesMetadataJson).then(metadata => {

          expect(metadata.displayName).toBe("General Settings")
          expect(metadata.id).toBe("generalSettings")
          expect(metadata.site.name).toBe("Snazzy Site")

          done()
        })
      }
    )
  })

  it("should warn you if you try to get Site Settings metadata for a non-existent site", done => {

    mockDiskMetadataAs(siteSettingsDirectoryPath, {displayName: "General Settings", siteName: "Imaginary Site"})

    return self.metadata.initializeMetadata().then(() => {

        return self.metadata.readMetadata(siteSettingsConfigMetadataPath, constants.siteSettingsValuesMetadataJson).then(metadata => {

          expect(self.logger.warn).toHaveBeenCalledWith("noMatchingSiteFound",
            { path: 'siteSettings/General Settings/siteSettingsMetadata.json' })

          expect(metadata).toBeNull()

          done()
        })
      }
    )
  })

  it("should warn you when you cant get Site Settings metadata from target server", done => {

    mockDiskMetadataAs(siteSettingsDirectoryPath, {displayName: "Silly Settings", siteName: "Snazzy Site"})

    return self.metadata.initializeMetadata().then(() => {

        return self.metadata.readMetadata(siteSettingsConfigMetadataPath, constants.siteSettingsValuesMetadataJson).then(metadata => {

          expect(self.logger.warn).toHaveBeenCalledWith("noMatchingSiteSettingsFound",
            { path: 'siteSettings/General Settings/siteSettingsMetadata.json' })

          expect(metadata).toBeNull()

          done()
        })
      }
    )
  })
})
