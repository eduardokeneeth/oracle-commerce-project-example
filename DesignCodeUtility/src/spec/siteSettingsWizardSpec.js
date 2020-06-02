"use strict"

const mockery = require('./mockery')


describe("siteSettingsWizard", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../logger", "../utils", "../i18n")

    self.i18n.t.returnsFirstArg()

    // Only mock pose(). Leave the others as is.
    const wizardUtils = require('../wizardUtils')
    wizardUtils.pose = jasmine.createSpy("pose").and.callFake((name, questions) => {
      self.name = name
      self.questions = questions
    })

    self.siteSettingsWizard = mockery.require("../siteSettingsWizard")
  })

  afterEach(mockery.stopAll)

  it("should validate site settings name", () => {

    self.siteSettingsWizard.prompt(false)

    expect(self.name).toEqual("ccwCreateTitleText")

    expect(self.questions[0].validate("")).toEqual("ccwEnterNamePrompt")
    expect(self.questions[0].validate('#'.repeat(241))).toEqual("stringTooLong")
    expect(self.questions[0].validate("/")).toEqual("stringHasInvalidCharacters")
    expect(self.questions[0].validate("Valid Site Settings Name")).toEqual(true)

    self.utils.exists.returnsTrue()
    expect(self.questions[0].validate("ok")).toEqual("ccwAlreadyExistsWarning")

    self.siteSettingsWizard.prompt(true)
    expect(self.questions[0].validate("ok")).toEqual(true)
  })
})
