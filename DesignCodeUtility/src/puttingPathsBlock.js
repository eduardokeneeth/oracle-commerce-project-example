/**
 * Set up a block suitable for breaking up the putting directory.
 * @return a big data structure.
 */
function getPathsBlock() {

  return {
    otherPaths: [],
    existingThemePaths: [],
    widgetInstanceDirs: [],
    stackBasePaths: [],
    stackInstancePaths: [],
    stackInstanceDirs: [],
    widgetLessPaths: [],
    elementTemplatePaths: [],
    newElementSet: new Set(),
    newThemeSet: new Set(),
    newWidgetSet: new Set(),
    newStackSet: new Set(),
    newSiteSettingsSet: new Set()
  }
}

exports.getPathsBlock = getPathsBlock
