"use strict"

const constants         = require("./constants").constants
const t                 = require("./i18n").t
const exists            = require("./utils").exists
const invalidCharacters = require("./wizardUtils").invalidCharacters
const pose              = require("./wizardUtils").pose
const stringTooLong     = require("./wizardUtils").stringTooLong

const componentType = "stack"
let alreadyExists             /**< alreadyExists will be bound to a function. */

const questions = [
  {
    name : "stackName",
    type : "input",
    message : t("ccwEnterNamePrompt", {componentType}),
    validate : stackName => {

      if (!stackName.length) {
        return t("enterStackNameText")
      }

      if (stringTooLong(stackName)) {
        return t("stringTooLong")
      }

      if (invalidCharacters(stackName)) {
        return t("stringHasInvalidCharacters")
      }

      if (alreadyExists(stackName)) {
        return t("stackAlreadyExists", {stackName})
      }

      return true
    }
  },
  {
    name : "maxVariants",
    type : "input",
    message : "What is the max number of variants for this stack?",
    default : 10,
    validate : n => !isNaN(parseFloat(n)) || "Max variants should be a numeric value."
  },
  {
    name : "defaultVariants",
    type : "input",
    message : "How many default variants should an instance of this stack have?",
    default : 3,
    validate : n => !isNaN(parseFloat(n)) || "Default variants should be a numeric value."
  },
  {
    name : "withHelpText",
    type : "i18nConfirm",
    message : t("ccwSelectHelpTextPrompt", {componentType}),
    default : true
  },
  {
    name : "syncWithServer",
    type : "i18nConfirm",
    message : t("ccwSelectServerSyncPrompt", {componentType}),
    default : true
  }
]

/**
 * Entry point for the stack creation wizard.
 * @param clean
 */
exports.prompt = function (clean) {

  // Note that we need to clean the disk first - this will switch off validation.
  alreadyExists = clean ? value => false : value => exists(`${constants.stacksDir}/${value}`)

  // Kick off the wizard, passing our list of questions.
  return pose(t("ccwCreateTitleText", {componentType}), questions)
}
