const constants = require("./constants").constants
const exists = require("./utils").exists
const invalidCharacters = require("./wizardUtils").invalidCharacters
const pose = require("./wizardUtils").pose
const PuttingFileType = require("./puttingFileType").PuttingFileType
const stringTooLong = require("./wizardUtils").stringTooLong
const t = require("./i18n").t

let alreadyExists

let parentElementType
let targetDirectoryType

/**
 * Turn the supplied arguments into array we can pass to inquirer checkbox function.
 * @return {Array}
 */
function checkBoxArray() {

  return Array.from(arguments).map(argument => ({name: argument}))
}

const questions = [
  {
    name: "elementName",
    type: "input",
    message: t("enterElementNameText"),
    validate: elementName => {

      if (!elementName.length) {
        return t("enterElementNameText")
      }

      if (stringTooLong(elementName)) {
        return t("stringTooLong")
      }

      if (invalidCharacters(elementName)) {
        return t("stringHasInvalidCharacters")
      }

      if (alreadyExists(elementName)) {
        return t("elementAlreadyExists", {elementName})
      }

      return true
    }
  },
  {
    name: "type",
    type: "list",
    message: t("selectElementTypeText"),
    choices: () => {

      // If your parent type is container, there are three valid possibilities.
      if (parentElementType == "container") {

        return ["dynamicFragment", "staticFragment", "subFragment"]
      } else {

        // No parent element - anything goes.
        return ["container", "dynamicFragment", "fragment", "staticFragment", "subFragment"]
      }
    },
    default: () => {

      // If your parent type is container, assume dynamicFragment.
      if (parentElementType == "container") {

        return "dynamicFragment"
      } else {
        // No parent element - could be anything but assume fragment.
        return "fragment"
      }
    },
    when: responses => {

      // If we are adding elements under a widget, they should only be type fragment.
      if (targetDirectoryType == PuttingFileType.WIDGET) {
        responses.type = "fragment"

        // No need to ask the question.
        return false
      }

      // If the parent type is fragment, then we must be a container.
      if (parentElementType && parentElementType == "fragment") {
        responses.type = "container"

        // No need to ask the question.
        return false
      }

      // Not necessarily a container.
      return true
    }
  },
  {
    name: "i18n",
    type: "i18nConfirm",
    message: t("selectI18nElement"),
    default: false
  },
  {
    name: "withJavaScript",
    type: "i18nConfirm",
    message: t("elementWithJavaScript"),
    default: false
  },
  {
    name: "withSubElements",
    type: "i18nConfirm",
    message: t("withSubElements"),
    default: false,
    when: responses => responses.type == "fragment"
  },
  {
    type: 'checkbox',
    message: t("selectElementConfigOptionsText"),
    name: 'configOptions',
    choices: responses => {

      if (responses.type == "fragment") {

        // Its type fragment, all options are open.
        return checkBoxArray("fontPicker", "textBox", "image", "preview", "available", "actual", "currentConfig", "wrapperTag", "richText", "padding", "border", "horizontalAlignment", "elementName", "collectionPicker")
      } else if (responses.type == "container") {

        // Containers have more limited options.
        return checkBoxArray("actual", "available", "currentConfig", "preview")
      } else {

        // Must be dynamicFragment/staticFragment/subFragment.
        return checkBoxArray("border", "collectionPicker", "elementName", "fontPicker", "horizontalAlignment", "image", "padding", "richText", "textBox", "wrapperTag")
      }
    },
    when: responses => {

      // If the user answered yes to the sub-element question, we can default the config options and not ask the question.
      if (responses.withSubElements) {

        responses.configOptions = ["available"]
        return false
      }

      // Dont need this for static elements.
      if (responses.type == "staticFragment") {
        return false
      }

      // Can't guess the config options so need to ask to question.
      return true
    },
    validate: responses => {

      // Watch out for bad combinations.
      if (responses.type == "fragment" && responses.configOptions.includes("available") && responses.configOptions.length > 1) {
        return t("availableMustBeOnlyOption")
      } else {
        return true
      }
    }
  },
  {
    name: "inline",
    type: "i18nConfirm",
    message: t("selectInline"),
    default: false,
    // Don't need this question if element has no template.
    when: responses => responses.type != "container" &&
      !(responses.type == "fragment" &&
        ((responses.configOptions && responses.configOptions.includes("available")) || responses.withSubElements))
  },
  {
    name: "withHelpText",
    type: "i18nConfirm",
    message: t("elementWithHelpText"),
    default: true
  },
  {
    name: "syncWithServer",
    type: "i18nConfirm",
    message: t("syncElementWithServer"),
    default: true,
    // Don't sync if we are adding to another element or a widget.
    when: responses => !(targetDirectoryType == PuttingFileType.WIDGET_ELEMENT ||
      targetDirectoryType == PuttingFileType.GLOBAL_ELEMENT ||
      targetDirectoryType == PuttingFileType.WIDGET ||
      responses.withSubElements)
  }
]

/**
 * Entry point for the element creation wizard.
 * @param clean
 * @param directory
 */
function prompt(clean, directory, directoryType, parentElementMetadata) {

  // Save off the directoryType for further use.
  targetDirectoryType = directoryType

  // Note that we need to clean the disk first - this will switch off validation.
  if (clean) {
    alreadyExists = () => false
  } else {

    // Element is to be created under a widget - need to change path.
    if (directoryType == PuttingFileType.WIDGET_ELEMENT) {
      alreadyExists = value => exists(`${directory}/${value}`)
    } else if (directoryType == PuttingFileType.WIDGET) {
      alreadyExists = value => exists(`${directory}/${constants.elementsDir}/${value}`)
    } else {

      // A global element.
      alreadyExists = value => exists(`${constants.elementsDir}/${value}`)
    }

    // See if we are adding to a parent element if so, make parent type available.
    if (parentElementMetadata) {
      parentElementType = parentElementMetadata.type
    } else {
      parentElementType = null
    }
  }

  // Kick off the wizard, passing our list of questions.
  return pose(t("createElementText"), questions)
}

exports.prompt = prompt
