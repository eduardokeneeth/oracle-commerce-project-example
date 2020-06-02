"use strict"

const chalk = require("chalk")
const clear = require("clear")
const figlet = require("figlet")
const inquirer = require("inquirer")

const logInfo = require("./logger").logInfo
const t = require("./i18n").t

const MAX_STRING_LENGTH = 240

exports.stringTooLong = value => value.length > MAX_STRING_LENGTH

const INVALID_CHARACTERS =
  `/\0\\:\`*<>?|\u{0000}\u{0001}\u{0002}\u{0003}\u{0004}\u{0005}\u{0006}\u{0007}\u{0008}\u{0009}\n\r` +
  `\u{000B}\u{000C}\u{000E}\u{000F}\u{0010}\u{0011}\u{0012}\u{0013}\u{0014}\u{0015}\u{0016}\u{0017}` +
  `\u{0018}\u{0019}\u{001A}\u{001B}\u{001C}\u{001D}\u{001E}\u{001F}\u{007F}\u{0080}\u{0081}\u{0082}` +
  `\u{0083}\u{0084}\u{0085}\u{0086}\u{0087}\u{0088}\u{0089}\u{008A}\u{008B}\u{008C}\u{008D}\u{008E}` +
  `\u{008F}\u{0090}\u{0091}\u{0092}\u{0093}\u{0094}\u{0095}\u{0096}\u{0097}\u{0098}\u{0099}\u{009A}` +
  `\u{009B}\u{009C}\u{009D}\u{009E}\u{009F}\u{00A0}\u{00B6}`

exports.invalidCharacters = value => value.split("").some(c => INVALID_CHARACTERS.indexOf(c) !== -1)

/**
 * Holds the boilerplate for kicking off a wizard.
 * @param banner
 * @param questions
 */
exports.pose = function (banner, questions) {

  // Clear the screen first.
  clear()

  // Add in our custom prompt.
  inquirer.registerPrompt("i18nConfirm", getI18nConfirmPrompt())

  // Display a heading to let the user know what they have got themselves into.
  logInfo(figlet.textSync(banner))

  // Finally kick off inquirer which will return a non-Bluebird promise.
  return inquirer.prompt(questions)
}

/**
 * Return a constructor for an i18n-savvy version of the confirmation prompt.
 */
function getI18nConfirmPrompt() {

  const i18nConfirm = function (question, rl, answers) {

    // Store a reference to "real" confirm module that will do most of the work.
    this.confirm = new inquirer.prompt.prompts.confirm(question, rl, answers)

    // Take a note of the default value for later use.
    const suppliedDefault = question.default

    // Hotwire the default text so it is now pulling from the i18n bundle.
    this.confirm.opt.default = this.confirm.opt.default === "y/N" ? t("defaultIsNoText") : t("defaultIsYesText")

    // Need to tweak filter to handle national language text.
    this.confirm.opt.filter = function (input) {

      // If no value entered, use the default.
      if (!input.length) {
        return suppliedDefault
      }

      // Since this is nls text, compare on the yes (allowing for different cases) and take everything else as no.
      return input.toUpperCase() === t("shortYesText").toUpperCase()
    }

    // Will need to tweak the render function as well.
    this.confirm.render = function (answer) {

      const answerText = typeof answer === 'boolean' ? this.mapAnswer(answer) : this.rl.line

      this.screen.render(`${this.getQuestion()}${answerText}`)

      return this
    }

    // Boilerplate to turn a boolean into language text and display it in a nice colour.
    this.confirm.mapAnswer = function (answer) {
      return chalk.cyan(answer ? t("yesText") : t("noText"))
    }
  }

  // Ensure the run delegates to the underlying confirm prompt.
  i18nConfirm.prototype.run = function () {
    return this.confirm.run.apply(this.confirm, arguments)
  }

  return i18nConfirm
}
