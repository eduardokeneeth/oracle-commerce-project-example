const program = require("commander")

const addCommonOptions = require("./optionsUtils").addCommonOptions
const addExitHandler = require("./exitHandler").addExitHandler
const checkMetadata = require("./optionsUtils").checkMetadata
const enableUpdateInstances = require('./putterUtils').enableUpdateInstances
const endPointTransceiver = require("./endPointTransceiver")
const exitDueToInvalidCall = require("./exitHandler").exitDueToInvalidCall
const getApplicationKey = require("./optionsUtils").getApplicationKey
const getHostFromUrl = require("./utils").getHostFromUrl
const getLastNode = require("./metadata").getLastNode
const getPassword = require("./optionsUtils").getPassword
const grabber = require("./grabber")
const info = require("./logger").info
const inTransferMode = require("./state").inTransferMode
const lessCompiler = require("./CCLessCompiler")
const putter = require("./putter")
const t = require("./i18n").t
const useBasePath = require("./utils").useBasePath
const setVerboseLogging = require("./logger").setVerboseLogging
const suppressConfigUpdate = require('./putterUtils').suppressConfigUpdate
const suppressThemeCompile = require('./putterUtils').suppressThemeCompile
const enableAutoFix = require('./putterUtils').enableAutoFix
const deleter = require('./deleter')

/**
 * Output how long an operation took.
 * @param promise
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function withTimeTaken(promise) {
  // Keep track of how long things take.
  const start = Date.now()

  return promise.then(() => info("secondsElapsed", {seconds: Math.floor((Date.now() - start) / 1000)}))
}

exports.main = function (argv) {

  // Force use of dcu rather than the actual file name of dcu.js.
  program._name = "dcu"

  addCommonOptions(program)
    .option("-v, --verbose", t("verboseOptionText"))
    .option("-l, --locale <locale>", t("localeOptionText"))
    .option("-a, --allLocales", t("allLocalesOptionText"))
    .option("-c, --clean", t("cleanOptionText"))
    .option("-s, --site <siteName>", t("siteNameOptionText"), false)
    .option("-i, --updateInstances", t("updateInstancesOptionText"), false)
    .option("-o, --noInstanceConfigUpdate", t("noInstanceConfigUpdateText"), false)
    .option("-N, --noThemeCompile", t("noThemeCompileText"), false)

    // "Advanced" options
    .option("-A, --autofix", t("autoFixOptionText"), false)

    // Operations
    .option("-e, --refresh <directory>", t("refreshOptionText"), false)
    .option("-g, --grab [directory]", t("grabOptionText"), false)
    .option("-t, --put <file>", t("putOptionText"))
    .option("-m, --putAll <directory>", t("putAllOptionText"), false)
    .option("-r, --transfer <file>", t("transferOptionText"), false)
    .option("-x, --transferAll <directory>", t("transferAllOptionText"), false)
    .option("-C, --compileLess", t("compileLessOptionText"), false)
    .option("-d, --delete <path>", t("deleteOptionText"), false)
    .parse(argv)

  // Switch on verbose flag first.
  setVerboseLogging(program.verbose)

  // Set whether to automatically fix known problems.
  if (program.autofix) {
    enableAutoFix()
  }

  // Pass on the base path if it was set.
  program.base && useBasePath(program.base)

  // Must have exactly one operation - no more and no less.
  const operationsCount = ["grab", "put", "putAll", "transfer", "transferAll", "compileLess", "refresh", "delete"]
    .reduce((total, currentValue) => total + (program[currentValue] ? 1 : 0), 0)

  // Some operations are only OK with a grab.
  const needsAGrab = (program.clean || program.allLocales) && !program.grab && !program.refresh

  const needsASite = (program.compileLess) && !program.site

  // Make sure we know which server we are working with. If the user did not supply a node, try to use the last one.
  if (!program.node) {
    program.node = getLastNode(program.put || program.putAll || program.transferAll || program.refresh || program.transfer)
  }

  // Something is not quite right - tell the user.
  if (operationsCount !== 1 || needsAGrab || !program.node) {
    exitDueToInvalidCall(program)
  }

  // Make sure hostname is normalized
  program.node = getHostFromUrl(program.node)

  if (needsASite) {
    program.site = "siteUS"
  }

  // Update instances only makes sense with put or transfer.
  if (program.updateInstances && !program.put && !program.transfer) {
    exitDueToInvalidCall(program)
  }

  // Pass on the update instances flag if set.
  program.updateInstances && enableUpdateInstances()

  // Similarly, tell the putter not to send widget instance config stuff.
  program.noInstanceConfigUpdate && suppressConfigUpdate()

  // Same for theme compilation.
  program.noThemeCompile && suppressThemeCompile()

  // Sort out our endpoints first.
  return addExitHandler(endPointTransceiver.init(
    program.node,
    program.username, getPassword(program.password),
    getApplicationKey(program.applicationKey),
    program.locale, program.allLocales).then(() => {

    // For put/putAll or transferAll, make sure the metadata is OK.
    switch (true) {
      case !!program.grab:

        // If we are doing an incremental grab without the clean option,
        // do a metadata check and stop if it fails to prevent a mix of directories of different dcu versions.
        if (typeof program.grab === "string" && !program.clean && !checkMetadata(program.grab)) {
          return
        }

        return withTimeTaken(grabber.grab(program.node, program.clean,
          typeof program.grab === "string" ? program.grab : null))
      case !!(program.refresh):
        return withTimeTaken(grabber.refresh(program.refresh))
      case !!(program.transfer && checkMetadata(program.transfer)):
        inTransferMode(true)
        return withTimeTaken(putter.put(program.transfer, program.node, false))
      case !!(program.put && checkMetadata(program.put)):
        return withTimeTaken(putter.put(program.put, program.node, false))
      case !!(program.putAll && checkMetadata(program.putAll)):
        return withTimeTaken(putter.put(program.putAll, program.node, true))
      case !!(program.transferAll && checkMetadata(program.transferAll)):
        inTransferMode(true)
        return withTimeTaken(putter.put(program.transferAll, program.node, true))
      case !!(program.compileLess):
        return lessCompiler.compileOnce(program.site)
      case !!program.delete:
        return deleter.delete(program.delete, program.node)
    }
  }))
}
