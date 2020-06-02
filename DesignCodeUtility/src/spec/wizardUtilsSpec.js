"use strict"

const mockery = require('./mockery')

describe("widgetUtils", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "chalk", "clear", "figlet", "inquirer", "../logger", "../i18n")

    self.i18n.t.returnsFirstArg()
    self.figlet.textSync.returnsFirstArg()
    self.chalk.cyan = jasmine.createSpy("chalk.cyan").and.callFake((text) => text)

    self.widgetUtils = mockery.require("../wizardUtils")
  })

  afterEach(mockery.stopAll)

  it("should validate widget name", () => {

    self.inquirer.registerPrompt.and.callFake((name, i18nConfirm) => {
      self.name = name
      self.i18nConfirm = i18nConfirm
    })

    const questions = {}

    self.widgetUtils.pose("My Banner", questions)

    expect(self.logger.logInfo).toHaveBeenCalledWith('My Banner')
    expect(self.clear).toHaveBeenCalled()
    expect(self.inquirer.prompt).toHaveBeenCalledWith(questions)

    const rl = {}
    const question = {default : "Y"}
    const answers = {}

    self.inquirer.prompt.prompts = {}
    self.inquirer.prompt.prompts.confirm = jasmine.createSpy("inquirer.prompt.prompts.confirm").and.callFake(function() {
      self.inquirerIntance = this
      this.opt = {}
      this.opt.default = {}
      this.screen = {}
      this.screen.render = jasmine.createSpy("screen.render")
      this.getQuestion = jasmine.createSpy("getQuestion").and.returnValue("question text")
      this.run = jasmine.createSpy("run")
    })

    const i18nConfirmObject = new self.i18nConfirm(question, rl, answers)

    expect(self.inquirerIntance.opt.default).toEqual("defaultIsYesText")
    expect(self.inquirerIntance.opt.filter("")).toEqual("Y")
    expect(self.inquirerIntance.opt.filter("shortYesText")).toEqual(true)
    expect(self.inquirerIntance.opt.filter("shortyestext")).toEqual(true)
    expect(self.inquirerIntance.opt.filter("Nah")).toEqual(false)

    expect(self.inquirerIntance.render(true)).toEqual(self.inquirerIntance)
    expect(self.inquirerIntance.screen.render).toHaveBeenCalledWith("question textyesText")
    expect(self.chalk.cyan).toHaveBeenCalledWith("yesText")

    i18nConfirmObject.run()

    expect(self.inquirerIntance.run).toHaveBeenCalled()
  })
})
