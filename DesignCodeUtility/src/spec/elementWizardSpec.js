"use strict"

const mockery = require('./mockery')

const PuttingFileType = require("../puttingFileType").PuttingFileType

describe("elementWizard", () => {

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

    self.elementWizard = mockery.require("../elementWizard")
  })

  afterEach(mockery.stopAll)

  it("should validate element name", () => {

    self.elementWizard.prompt(false, null, null, null)

    expect(self.name).toEqual("createElementText")

    expect(self.questions[0].validate("")).toEqual("enterElementNameText")
    expect(self.questions[0].validate('#'.repeat(241))).toEqual("stringTooLong")
    expect(self.questions[0].validate("/")).toEqual("stringHasInvalidCharacters")
    expect(self.questions[0].validate("Valid Element Name")).toEqual(true)

    self.utils.exists.returnsTrue()
    expect(self.questions[0].validate("ok")).toEqual("elementAlreadyExists")

    self.elementWizard.prompt(true)
    expect(self.questions[0].validate("ok")).toEqual(true)
  })

  it("should be sensitive to the parent element type", () => {

    self.elementWizard.prompt(false, "element/Top Level Element", PuttingFileType.GLOBAL_ELEMENT, { type : "container" })
    expect(self.questions[1].choices().length).toEqual(3)
    expect(self.questions[1].default()).toEqual("dynamicFragment")

    self.elementWizard.prompt(false, null, null, null)
    expect(self.questions[1].choices().length).toEqual(5)
    expect(self.questions[1].when({})).toEqual(true)

    self.elementWizard.prompt(false, "element/Top Level Element", PuttingFileType.GLOBAL_ELEMENT, { type : "fragment" })
    expect(self.questions[1].default()).toEqual("fragment")
    const hash = {}
    expect(self.questions[1].when(hash)).toEqual(false)
    expect(hash.type).toEqual("container")
  })

  it("should only ask about subelements when it makes sense", () => {

    self.elementWizard.prompt(false, null, null, null)
    expect(self.questions[4].when({type : "fragment"})).toEqual(true)
    expect(self.questions[4].when({type : "container"})).toEqual(false)
  })

  it("should display configOptions based on fragment type", () => {

    self.elementWizard.prompt(false, null, null, null)

    expect(flatten(self.questions[5].choices({type : "fragment"}))).toEqual(
      "fontPicker,textBox,image,preview,available,actual,currentConfig,wrapperTag,richText,padding,border,horizontalAlignment,elementName,collectionPicker")

    expect(flatten(self.questions[5].choices({type : "container"}))).toEqual("actual,available,currentConfig,preview")

    expect(flatten(self.questions[5].choices({type : "dynamicFragment"}))).toEqual(
      "border,collectionPicker,elementName,fontPicker,horizontalAlignment,image,padding,richText,textBox,wrapperTag")
  })

  function flatten(checkBoxArray) {
    return checkBoxArray.map(e => e.name).join(",")
  }

  it("should suppress configOptions in certain scenarios", () => {

    self.elementWizard.prompt(false, null, null, null)

    const responses = { withSubElements : true }
    expect(self.questions[5].when(responses)).toEqual(false)
    expect(responses.configOptions).toEqual(["available"])

    delete responses.configOptions
    delete responses.withSubElements
    responses.type = "staticFragment"
    expect(self.questions[5].when(responses)).toEqual(false)

    responses.type = "dynamicFragment"
    expect(self.questions[5].when(responses)).toEqual(true)
  })

  it("should validate configOptions in certain scenarios", () => {

    self.elementWizard.prompt(false, null, null, null)

    expect(self.questions[5].validate({type : "fragment", configOptions : ["available", "textBox"]})).toEqual("availableMustBeOnlyOption")
    expect(self.questions[5].validate({type : "fragment", configOptions : ["available"]})).toEqual(true)
  })

  it("should suppress the inline question if element has no template", () => {

    self.elementWizard.prompt(false, null, null, null)

    expect(self.questions[6].when({type : "container"})).toEqual(false)
    expect(self.questions[6].when({type : "fragment", configOptions : ["available"]})).toEqual(false)
    expect(self.questions[6].when({type : "fragment", withSubElements : true})).toEqual(false)
    expect(self.questions[6].when({type : "fragment"})).toEqual(true)
  })

  it("should suppress the sync with server question if the user likely has other stuff to do", () => {

    self.elementWizard.prompt(false, null, null, null)
    expect(self.questions[8].when({withSubElements : true})).toEqual(false)

    self.elementWizard.prompt(false, null, PuttingFileType.WIDGET_ELEMENT, null)
    expect(self.questions[8].when({})).toEqual(false)

    self.elementWizard.prompt(false, null, PuttingFileType.GLOBAL_ELEMENT, null)
    expect(self.questions[8].when({})).toEqual(false)

    self.elementWizard.prompt(false, null, PuttingFileType.WIDGET, null)
    expect(self.questions[8].when({})).toEqual(false)

    self.elementWizard.prompt(false, null, null, null)
    expect(self.questions[8].when({withSubElements : false})).toEqual(true)
  })
})
