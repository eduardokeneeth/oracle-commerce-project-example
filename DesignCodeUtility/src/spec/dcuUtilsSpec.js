"use strict"

const mockery = require('./mockery')

describe("DCU Utils", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "chalk", "clear", "figlet", "inquirer", "../logger", "../i18n")

    self.i18n.t.returnsFirstArg()
    self.figlet.textSync.returnsFirstArg()
    self.chalk.cyan = jasmine.createSpy("chalk.cyan").and.callFake((text) => text)

    self.dcuUtils = mockery.require("../dcuUtils")
  })

  afterEach(mockery.stopAll)

  it("should invoke pose method",  () => {

    // Mock the registerPrompt call
    self.inquirer.registerPrompt.and.callFake((name, i18nConfirm) => {
      self.name = name
      self.i18nConfirm = i18nConfirm
    })

    const questions = {}
    self.dcuUtils.pose(questions)

    expect(self.inquirer.prompt).toHaveBeenCalledWith(questions)
  })

})
