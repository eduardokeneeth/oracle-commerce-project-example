const program = require("commander")

const addExitHandler = require("./exitHandler").addExitHandler
const addMinimalCommonOptions = require("./optionsUtils").addMinimalCommonOptions
const deletePageLayout = require("./pageLayoutDeleter").deletePageLayout
const endPointTransceiver = require("./endPointTransceiver")
const error = require("./logger").error
const exitDueToInvalidCall = require("./exitHandler").exitDueToInvalidCall
const getApplicationKey = require("./optionsUtils").getApplicationKey
const getHostFromUrl = require("./utils").getHostFromUrl
const getLastNode = require("./metadata").getLastNode
const getPageLayouts = require("./pageLayoutGetter").getPageLayouts
const getPassword = require("./optionsUtils").getPassword
const listLayouts = require("./pageLayoutLister").listLayouts
const t = require("./i18n").t
const sendPageLayouts = require("./pageLayoutSender").sendPageLayouts
const useBasePath = require("./utils").useBasePath

exports.main = function (argv) {

  // Force use of plsu.
  program._name = "plsu"

  addMinimalCommonOptions(program)
    .option("-l, --locale <locale>", t("localeOptionText"))
    .option("-d, --destinationNode <node>", t("destinationNodeOptionText"))
    .option("-a, --destinationApplicationKey <key>", t("destinationApplicationKeyOptionText"))
    .option("-y, --name <name>", t("layoutNameOptionText"), (name, array) => {
      array.push(name)
      return array
    }, [])
    .option("-s, --all", t("allLayoutsOptionText"))
    .option("-i, --list", t("listLayoutsOptionText"))
    .option("-m, --dump", t("dumpLayoutsOptionText"))
    .option("-e, --delete", t("deleteLayoutOptionText"))
    .option("-t, --transfer", t("transferLayoutOptionText"))
    .option("-g, --ignoreVersions", t("ignoreVersionsOptionText"))
    .parse(argv)

  // Must always be a node specified.
  if (!program.node) {
    exitDueToInvalidCall(program)
  }

  // Make sure hostname is normalized
  program.node = getHostFromUrl(program.node)

  if (program.destinationNode) {
    program.destinationNode = getHostFromUrl(program.destinationNode)
  }
  // Must have exactly one operation specified.
  const operationsCount = ["list", "dump", "delete", "transfer"]
    .reduce((total, currentValue) => total + (program[currentValue] ? 1 : 0), 0)

  if (operationsCount != 1) {
    exitDueToInvalidCall(program)
  }

  // Must be layout specifier
  if (!program.name.length && !program.all && !program.list) {
    exitDueToInvalidCall(program)
  }

  // Can't use name and all together.
  if (program.name.length && program.all) {
    exitDueToInvalidCall(program)
  }

  // Cant use all with delete - too dangerous.
  if (program.all && program.delete) {
    exitDueToInvalidCall(program)
  }

  // Must supply destination with transfer.
  if (!program.destinationNode && program.transfer) {
    exitDueToInvalidCall(program)
  }

  // Source and destination must be different.
  if (program.destinationNode == program.node) {
    exitDueToInvalidCall(program)
  }

  // Make sure we have an application key.
  const applicationKey = getApplicationKey(program.applicationKey)
  if (!applicationKey) {
    exitDueToInvalidCall(program)
  }

  // In transfer node, make sure we have a destination application key.
  const destinationApplicationKey = getApplicationKey(program.destinationApplicationKey, "CC_DESTINATION_APPLICATION_KEY")

  if (program.transfer && !destinationApplicationKey) {
    exitDueToInvalidCall(program)
  }

  // Can't ignore versions if we are not transferring.
  if (!program.transfer && program.ignoreVersions) {
    exitDueToInvalidCall(program)
  }

  // Hook up to the source system.
  return addExitHandler(endPointTransceiver.init(program.node, null, null, applicationKey, program.locale).then(() => {

    // Take a note of the source version.
    const sourceVersion = endPointTransceiver.commerceCloudVersion

    // Get the page layout info from the source instance.
    return getPageLayouts(program.name).then(pageLayoutsArray => {

      // Give up if nothing came back.
      if (!pageLayoutsArray) {
        return
      }

      // User may just want to see what layouts they have.
      if (program.list) {

        listLayouts(pageLayoutsArray)
      } else if (program.dump) {

        // ...or they may want something more low level.
        listLayouts(pageLayoutsArray, true)
      } else if (program.delete) {

        // They may even want to get rid of a layout.
        return deletePageLayout(pageLayoutsArray)
      } else {

        // Now connect to the destination instance.
        return endPointTransceiver.init(program.destinationNode, null, null, destinationApplicationKey, program.locale).then(() => {

          // Make sure we are not suppressing version checking.
          if (!program.ignoreVersions) {

            // Compare the source version with the destination version.
            const destinationVersion = endPointTransceiver.commerceCloudVersion

            if (sourceVersion != destinationVersion) {
              error("cannotSendPageLayoutsBetweenVersions", {
                sourceNode : program.node,
                destinationNode : program.destinationNode
              })
              return
            }
          }

          // Apply the desired changes from the source instance to the destination instance.
          return sendPageLayouts(pageLayoutsArray)
        })
      }
    })
  }))
}
