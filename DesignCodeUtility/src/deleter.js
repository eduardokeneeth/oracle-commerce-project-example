const PuttingFileType = require("./puttingFileType").PuttingFileType
const deleteFrameworkContent = require("./frameworkDeleter").deleteFrameworkContent
const deleteWidgetInstance = require("./widgetInstanceDeleter").deleteWidgetInstance
const normalize = require("./utils").normalize
const exists = require("./utils").exists
const error = require("./logger").error
const initializeMetadata = require("./metadata").initializeMetadata
const readMetadata = require("./metadata").readMetadata
const constants = require("./constants").constants
const inTransferMode = require("./state").inTransferMode
const info = require("./logger").info
const classify = require("./classifier").classify
const warn = require("./logger").warn
const t = require("./i18n").t
const pose = require("./dcuUtils").pose


// Mapping between file type and deleter method
const deleterMap = new Map([
    [PuttingFileType.FRAMEWORK_DIRECTORY, deleteFrameworkContent],
    [PuttingFileType.FRAMEWORK_FILE, deleteFrameworkContent],
    [PuttingFileType.WIDGET_INSTANCE, deleteWidgetInstance]
])

/**
 * Entry point. Deletes the asset associated with the path from the server
 */
exports.delete = function(rawPath, node) {
  // Normalize the path in case it is in windows format
  const path = normalize(rawPath)

  // Make sure that the file actually exists
  if (!exists(path)) {
      error("pathDoesNotExist", {path})
      return
  }

  // Initialize the metadata first
  return initializeMetadata().then(() => {
    return readMetadata(path, constants.configMetadataJson).then(configMetadata => {
        
        // Ensure that we are deleting on same system we grabbed from
        if (configMetadata.node !== node && !inTransferMode()) {
            error("cannotDeleteOnDifferentNode", {path, node, configMetadataNode: configMetadata.node})
            return
        }

        // Check that we have a deleter for the file type
        const deleterFunction = deleterMap.get(classify(path))
        if (!deleterFunction) {
          warn("fileIsNotRecognized", {name: path})
          return
        }

        // Prompt user to confirm deletion before deleting the file type
        const confirmationQuestion = [
          {
            name: "confirmed",
            type: "i18nConfirm",
            message: t("confirmDeletePath", {path, node}),
            default: false
          }
        ]
       return pose(confirmationQuestion).then(responses => {
         if (responses.confirmed) {
           return deleterFunction(path, node);

         }
       })
    })
  })

}
