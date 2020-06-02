"use strict"

const mockery = require('./mockery')


describe("widgetWizard", () => {

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

    self.widgetWizard = mockery.require("../widgetWizard")
  })

  afterEach(mockery.stopAll)

  it("should validate widget name", () => {

    self.widgetWizard.prompt(false)

    expect(self.name).toEqual("ccwCreateTitleText")

    expect(self.questions[0].validate("")).toEqual("ccwEnterNamePrompt")
    expect(self.questions[0].validate('#'.repeat(241))).toEqual("stringTooLong")
    expect(self.questions[0].validate("/")).toEqual("stringHasInvalidCharacters")
    expect(self.questions[0].validate("Valid Widget Name")).toEqual(true)

    self.utils.exists.returnsTrue()
    expect(self.questions[0].validate("ok")).toEqual("ccwAlreadyExistsWarning")

    self.widgetWizard.prompt(true)
    expect(self.questions[0].validate("ok")).toEqual(true)
  })

  it("should not sync elementized widgets with the server", () => {

    self.widgetWizard.prompt(false)

    expect(self.questions[6].when({ elementized : true })).toBe(false)
  })
})
