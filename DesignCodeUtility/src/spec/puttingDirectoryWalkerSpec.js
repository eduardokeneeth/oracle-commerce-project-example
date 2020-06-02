"use strict"

const constants = require("../constants").constants
const mockery = require("./mockery")
const PuttingFileType = require("../puttingFileType").PuttingFileType
const getPathsBlock = require("../puttingPathsBlock").getPathsBlock

const emptyFunction = () => {}

describe("Putting Directory Walker", () => {

  const self = this

  beforeEach(done => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../state", "../utils", "../logger", "../classifier", "../metadata")

    self.puttingDirectoryWalker = mockery.require("../puttingDirectoryWalker")

    self.pathTypeMap = new Map()
    self.paths = getPathsBlock()
    self.listeners = self.puttingDirectoryWalker.puttingDirectoryWalker(self.pathTypeMap, self.paths).listeners

    setTimeout(() => {
      done()
    }, 1)
  })

  afterEach(mockery.stopAll)

  it("should ignore hidden and tracked files", () => {

    self.listeners.file("/Users/bmorrow/.ccc/theme/Mono Theme", {name: "theme.json"}, emptyFunction)
    self.listeners.file("/Users/bmorrow", {name: ".profile"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(0)
    expect(self.classifier.classify).not.toHaveBeenCalled()
  })

  it("should handle theme files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.THEME_STYLES)
    self.listeners.file("/Users/bmorrow/theme/Dark Theme", {name: "styles.less"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.THEME_ADDITIONAL_STYLES)
    self.listeners.file("/Users/bmorrow/theme/Light Theme", {name: "additionalStyles.less"}, emptyFunction)

    self.metadata.themeExistsOnTarget.returns(true)
    self.classifier.classify.returns(PuttingFileType.THEME_VARIABLES)
    self.listeners.file("/Users/bmorrow/theme/White Theme", {name: "variables.less"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(3)
    expect(self.classifier.classify).toHaveBeenCalled()

    expect(self.paths.newThemeSet.size).toEqual(2)
    expect(self.paths.existingThemePaths.length).toEqual(1)

  })

  it("should handle global element files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_METADATA)

    self.listeners.file("/Users/bmorrow/element/Edge", {name: "elementMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_JAVASCRIPT)
    self.listeners.file("/Users/bmorrow/element/Edge", {name: "element.js"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_TEMPLATE)
    self.listeners.file("/Users/bmorrow/element/Edge", {name: "element.template"}, emptyFunction)

    self.metadata.elementExistsOnTarget.returns(true)

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_TEMPLATE)
    self.listeners.file("/Users/bmorrow/element/Gauge", {name: "element.template"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_METADATA)
    self.listeners.file("/Users/bmorrow/element/Sledge", {name: "elementMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_JAVASCRIPT)
    self.listeners.file("/Users/bmorrow/element/Sledge", {name: "element.js"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.GLOBAL_ELEMENT_TEMPLATE)
    self.listeners.file("/Users/bmorrow/element/Sledge", {name: "element.template"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.ELEMENT_TEMPLATE)
    self.listeners.file("/Users/bmorrow/widget/Goon/element/Fred", {name: "element.template"}, emptyFunction)

    self.metadata.widgetExistsOnTarget.returns(true)

    self.classifier.classify.returns(PuttingFileType.ELEMENT_TEMPLATE)
    self.listeners.file("/Users/bmorrow/widget/Goon/element/Jim", {name: "element.template"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(9)
    expect(self.classifier.classify).toHaveBeenCalled()

    expect(self.paths.newWidgetSet.size).toEqual(1)
    expect(self.paths.newElementSet.size).toEqual(1)
    expect(self.paths.otherPaths.length).toEqual(2)
    expect(self.paths.elementTemplatePaths.length).toEqual(3)
  })

  it("should handle base widget files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.WIDGET_BASE_TEMPLATE)
    self.listeners.file("/Users/bmorrow/widget/Jupiter", {name: "widget.template"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.WIDGET_BASE_LESS)
    self.listeners.file("/Users/bmorrow/widget/Jupiter", {name: "widget.less"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.WIDGET_BASE_SNIPPETS)
    self.listeners.file("/Users/bmorrow/widget/Jupiter/locales/en", {name: "ns.duey.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.WIDGET_JAVASCRIPT)
    self.listeners.file("/Users/bmorrow/widget/Jupiter/js", {name: "duey.js"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.WIDGET_MODULE_JAVASCRIPT)
    self.listeners.file("/Users/bmorrow/widget/Jupiter/module/js", {name: "ext.js"}, emptyFunction)

    self.metadata.widgetExistsOnTarget.returns(true)

    self.classifier.classify.returns(PuttingFileType.WIDGET_METADATA_JSON)
    self.listeners.file("/Users/bmorrow/widget/Duey", {name: "widgetMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.WIDGET_CONFIG_SNIPPETS)
    self.listeners.file("/Users/bmorrow/widget/Duey/config/locales", {name: "en.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.WIDGET_CONFIG_JSON)
    self.listeners.file("/Users/bmorrow/widget/Duey/config", {name: "configMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.ELEMENT_METADATA)
    self.listeners.file("/Users/bmorrow/widget/Duey/element/Cletus", {name: "elementMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.ELEMENT_JAVASCRIPT)
    self.listeners.file("/Users/bmorrow/widget/Duey/element/Cletus", {name: "element.js"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(10)
    expect(self.classifier.classify).toHaveBeenCalled()

    expect(self.paths.newWidgetSet.size).toEqual(1)
    expect(self.paths.otherPaths.length).toEqual(5)
  })


  it("should handle widget instance templates correctly", () => {

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE_TEMPLATE)
    self.listeners.file("/Users/bmorrow/widget/Footer/instances/Footer Widget", {name: "display.template"}, emptyFunction)

    self.metadata.widgetIsElementized.returns(true)

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE_TEMPLATE)
    self.listeners.file("/Users/bmorrow/widget/Footer/instances/Header Widget", {name: "display.template"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(2)
    expect(self.paths.otherPaths.length).toEqual(1)
  })

  it("should handle widget instance less files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE_LESS)
    self.listeners.file("/Users/bmorrow/widget/Footer/instances/Footer Widget", {name: "widget.less"}, emptyFunction)

    self.metadata.widgetExistsOnTarget.returns(true)

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE_LESS)
    self.listeners.file("/Users/bmorrow/widget/Footer/instances/Header Widget", {name: "widget.less"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(2)
    expect(self.paths.widgetLessPaths.length).toEqual(1)
    expect(self.paths.newWidgetSet.size).toEqual(1)
  })

  it("should handle misc files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.APPLICATION_LEVEL_JAVASCRIPT)
    self.listeners.file("/Users/bmorrow/global", {name: "pageCount.js"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(1)
    expect(self.paths.otherPaths.length).toEqual(1)
  })

  it("should handle stack instance dirs and widget instance dirs correctly", () => {

    self.classifier.classify.returns(PuttingFileType.WIDGET_INSTANCE)
    self.listeners.directory("/Users/bmorrow/widget/Breadcrumb/instances", {name: "Category Breadcrumb"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.STACK_INSTANCE)
    self.listeners.directory("/Users/bmorrow/stack/Vertical Tabs/instances", {name: "My Account Stack"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(0)
    expect(self.paths.widgetInstanceDirs.length).toEqual(1)
    expect(self.paths.stackInstanceDirs.length).toEqual(1)
  })

  it("should handle stack instance files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.STACK_INSTANCE_METADATA_JSON)
    self.listeners.file("/Users/bmorrow/stack/Vertical Tabs/instances/My Account Stack", {name: "stackInstanceMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.STACK_INSTANCE_LESS)
    self.listeners.file("/Users/bmorrow/stack/Vertical Tabs/instances/My Account Stack", {name: "stack.less"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.STACK_INSTANCE_VARIABLES_LESS)
    self.listeners.file("/Users/bmorrow/stack/Vertical Tabs/instances/My Account Stack", {name: "stack-variables.less"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.STACK_INSTANCE_TEMPLATE)
    self.listeners.file("/Users/bmorrow/stack/Vertical Tabs/instances/My Account Stack", {name: "stack.template"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(4)
    expect(self.paths.stackInstancePaths.length).toEqual(4)
  })

  it("should handle stack base files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.STACK_METADATA_JSON)
    self.listeners.file("/Users/bmorrow/stack/large", {name: "stackMetadata.json"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.STACK_BASE_LESS)
    self.listeners.file("/Users/bmorrow/stack/large", {name: "stack.less"}, emptyFunction)

    self.metadata.stackExistsOnTarget.returnsTrue()

    self.classifier.classify.returns(PuttingFileType.STACK_BASE_VARIABLES_LESS)
    self.listeners.file("/Users/bmorrow/stack/large", {name: "stack-variables.less"}, emptyFunction)

    self.classifier.classify.returns(PuttingFileType.STACK_BASE_TEMPLATE)
    self.listeners.file("/Users/bmorrow/stack/large", {name: "stack.template"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(4)
    expect(self.paths.otherPaths.length).toEqual(0)
    expect(self.paths.stackBasePaths.length).toEqual(2)
    expect(self.paths.newStackSet.size).toEqual(1)
  })

  it("should handle site settings files correctly", () => {

    self.classifier.classify.returns(PuttingFileType.SITE_SETTINGS_METADATA)
    self.listeners.file("/Users/bmorrow/siteSettings/Site Settings Demo",
      {name: "siteSettingsConfigMetadata.json"}, emptyFunction)

    self.metadata.siteSettingsExistOnTarget.returns(true)

    self.classifier.classify.returns(PuttingFileType.SITE_SETTINGS_SNIPPETS)
    self.listeners.file("/Users/bmorrow/siteSettings/Site Settings Demo/sites/Commerce Cloud Site",
      {name: "siteSettingsValues.json"}, emptyFunction)

    expect(self.pathTypeMap.size).toEqual(2)
    expect(self.paths.otherPaths.length).toEqual(1)
    expect(self.paths.newSiteSettingsSet.size).toEqual(1)
  })
})
