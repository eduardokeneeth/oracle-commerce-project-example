"use strict"

const constants = require("./constants").constants
const exists = require("./utils").exists
const invalidCharacters = require("./wizardUtils").invalidCharacters
const pose = require("./wizardUtils").pose
const stringTooLong = require("./wizardUtils").stringTooLong
const t = require("./i18n").t

const componentType = "site settings"
let alreadyExists

const questions = [
  {
    name : "siteSettingsName",
    type : "input",
    message : t("ccwEnterNamePrompt", {componentType}),
    validate : componentName => {

      if (!componentName.length) {
        return t("ccwEnterNamePrompt", {componentType})
      }

      if (stringTooLong(componentName)) {
        return t("stringTooLong")
      }

      if (invalidCharacters(componentName)) {
        return t("stringHasInvalidCharacters")
      }

      if (alreadyExists(componentName)) {
        return t("ccwAlreadyExistsWarning", {componentType, componentName})
      }

      return true
    }
  },
  {
    name : "withHelpText",
    type : "i18nConfirm",
    message : t("ccwSelectHelpTextPrompt", {componentType}),
    default : true
  },
  {
    name: "syncWithServer",
    type: "i18nConfirm",
    message : t("ccwSelectServerSyncPrompt", {componentType}),
    default : true
  }
]

/**
 * Entry point for the widget creation wizard.
 * @param clean
 */
function prompt(clean) {

  // Note that we need to clean the disk first - this will switch off validation.
  alreadyExists = clean ? () => false : value => exists(`${constants.siteSettingsDir}/${value}`)

  // Kick off the wizard, passing our list of questions.
  return pose(t("ccwCreateTitleText", {componentType}), questions)
}

exports.prompt = prompt
