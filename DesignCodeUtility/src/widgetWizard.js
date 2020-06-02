"use strict"

const constants = require("./constants").constants
const exists = require("./utils").exists
const invalidCharacters = require("./wizardUtils").invalidCharacters
const pose = require("./wizardUtils").pose
const stringTooLong = require("./wizardUtils").stringTooLong
const t = require("./i18n").t

const componentType = "widget"
let alreadyExists

const questions = [
  {
    name : "widgetName",
    type : "input",
    message : t("ccwEnterNamePrompt", {componentType}),
    validate : widgetName => {

      if (!widgetName.length) {
        return t("ccwEnterNamePrompt", {componentType})
      }

      if (stringTooLong(widgetName)) {
        return t("stringTooLong")
      }

      if (invalidCharacters(widgetName)) {
        return t("stringHasInvalidCharacters")
      }

      if (alreadyExists(widgetName)) {
        return t("ccwAlreadyExistsWarning", {componentType, widgetName})
      }

      return true
    }
  },
  {
    name : "global",
    type : "i18nConfirm",
    message : t("ccwSelectGlobalPrompt", {componentType}),
    default : false
  },
  {
    name : "i18n",
    type : "i18nConfirm",
    message : t("ccwSelectI18nPrompt", {componentType}),
    default : false
  },
  {
    name : "configurable",
    type : "i18nConfirm",
    message : t("ccwSelectConfigurablePrompt", {componentType}),
    default : false
  },
  {
    name : "withHelpText",
    type : "i18nConfirm",
    message : t("ccwSelectHelpTextPrompt", {componentType}),
    default : true
  },
  {
    name : "elementized",
    type : "i18nConfirm",
    message : t("selectElementized"),
    default : false
  },
  {
    name: "syncWithServer",
    type: "i18nConfirm",
    message : t("ccwSelectServerSyncPrompt", {componentType}),
    default : true,
    when: hash => !hash.elementized
  }
]

/**
 * Entry point for the widget creation wizard.
 * @param clean
 */
function prompt(clean) {

  // Note that we need to clean the disk first - this will switch off validation.
  alreadyExists = clean ? () => false : value => exists(`${constants.widgetsDir}/${value}`)

  // Kick off the wizard, passing our list of questions.
  return pose(t("ccwCreateTitleText", {componentType}), questions)
}

exports.prompt = prompt
