describe("i18n", () => {

  const self = this

  beforeEach(() => {

    console.log = jasmine.createSpy("log")

    self.i18n = require("../i18n")
  })

  it("should return translations for valid keys under the default locale", () => {

    expect(self.i18n.t("notAdministrationInterface", {name : "Fred"})).toEqual("Fred does not access a Commerce Cloud administration interface")
  })

  it("should return translations for valid keys under a specified locale", () => {

    // Force a specific locale.
    self.i18n.init("en")

    expect(self.i18n.t("allDone")).toEqual("all done...")
  })

  it("should tell you when a translation cannot be found", () => {

    expect(self.i18n.t("sillyKey")).toEqual("No text found for sillyKey !")
  })

  it("should fall back when you ask for a mildly silly locale", () => {

    self.i18n.init("de_SILLY")

    expect(console.log).not.toHaveBeenCalledWith("No strings found for de_SILLY !")

    expect(self.i18n.t("allDone")).toEqual("Fertig...")
  })

  it("should tell you when you ask for a silly locale", () => {

    self.i18n.init("silly")

    expect(console.log).toHaveBeenCalledWith("No strings found for silly !")
  })
})
