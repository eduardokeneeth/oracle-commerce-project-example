/**
 * Holds program-wide constants.
 */
exports.constants = {

  // Region Types.
  flatStructure: 100,
  stackStructure: 101,
  slotStructure: 102,

  lessFileSubstitutionReqExp: /^[ ]*#[^{ ]*/,

  // Tracking Files and directories.
  etagSuffix : ".etag",
  trackingDir : ".ccc",
  globalDir : "global",
  instanceDir: "instances",
  versionDir : "versions",
  configMetadataJson : "config.json",

  // Content Files and directories.
  themesDir : "theme",
  themeVariables : "variables.less",
  themeAdditionalStyles : "additionalStyles.less",
  themeStyles : "styles.less",
  themeMetadataJson : "theme.json",

  widgetsDir : "widget",
  displayTemplate : "display.template",
  widgetTemplate : "widget.template",
  widgetMetadataJson : "widget.json",
  widgetInstanceMetadataJson : "widgetInstance.json",
  widgetInstanceSubstitutionValue : "#WIDGET_ID-WIDGET_INSTANCE_ID",
  widgetLess : "widget.less",
  webContent : "webContent",
  webContentTemplate : "content.template",
  elementInstancesImagesDir : "images",

  elementsDir : "element",
  elementTemplate : "element.template",
  elementJavaScript : "element.js",
  elementMetadataJson : "element.json",
  userElementMetadata : "elementMetadata.json",

  stacksDir : "stack",
  stackVariablesLess : "stack-variables.less",
  stackTemplate : "stack.template",
  stackLess : "stack.less",
  stackMetadataJson: "stack.json",
  stackInstanceMetadataJson : "stackInstance.json",
  stackLessVariables : "stack-variables.less",
  userStackMetadata: "stackMetadata.json",
  userStackInstanceMetadata: "stackInstanceMetadata.json",

  textSnippetsDir : "snippets",
  snippetsJson : "snippets.json",

  storefrontCss: "storefront.css",

  frameworkDir: "static",

  userWidgetMetadata : "widgetMetadata.json",
  userWidgetInstanceMetadata : "widgetInstanceMetadata.json",
  userConfigMetadataJson : "configMetadata.json",
  userElementInstancesMetadataJson : "elementInstancesMetadata.json",

  siteHeader : "x-ccsite",

  siteSettingsDir : "siteSettings",
  caseInsensitiveUrls : "case-insensitive-urls",
  abandonedCart : "abandoned-cart",
  siteSettingsConfigMetadataFile : "siteSettingsConfigMetadata.json",
  siteSettingsLocalesDir : "locales",
  sitesSettingsSitesDir : "sites",
  siteSettingsValuesFile : "siteSettingsValues.json",
  siteSettingsMetadataJson : "siteSettingsMetadata.json",
  siteSettingsValuesMetadataJson : "siteSettingsValuesMetadata.json"
}
