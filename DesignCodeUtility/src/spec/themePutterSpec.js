const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Theme Putter", () => {

  const self = this

  const themeAdditionalStylesPath = "theme/Even Darker Theme/additionalStyles.less"
  const themeStylesPath = "theme/Mono Theme/styles.less"
  const themeVariablesPath = "theme/Mono Theme/variables.less"
  const additionalStylesPathForMissingTheme = "theme/Missing Theme/additionalStyles.less"

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver",
      "updateThemeSource", "getThemes", "cloneTheme")

    mockery.mockModules(self, "../state", "../putterUtils", "../utils", "../etags", "../metadata", "../logger")

    self.themePutter = mockery.require("../themePutter")
  })

  afterEach(mockery.stopAll)

  it("should let you send theme additional styles back", (done) => {

    const results = self.endPointTransceiver.updateThemeSource.returnsResponse({}, "theme source etag")
    self.metadata.readMetadata.returnsPromise({"repositoryId": "monoTheme", etag: "THEME_ETAG"})
    self.putterUtils.processPutResult.returnsTrue()

    self.themePutter.putThemeAdditionalStyles(themeAdditionalStylesPath).then(() => {

      expect(self.endPointTransceiver.updateThemeSource).urlKeysWere(["monoTheme"])
      expect(self.endPointTransceiver.updateThemeSource).pathWas(themeAdditionalStylesPath)
      expect(self.endPointTransceiver.updateThemeSource).fieldWas("additionalStyles")
      expect(self.endPointTransceiver.updateThemeSource).etagWas("THEME_ETAG")

      expect(self.putterUtils.processPutResult).toHaveBeenCalledWith(themeAdditionalStylesPath, results)
      expect(self.etags.writeEtag).toHaveBeenCalledWith("theme/Even Darker Theme/variables.less", "theme source etag")
      expect(self.etags.writeEtag).toHaveBeenCalledWith("theme/Even Darker Theme/styles.less", "theme source etag")
      expect(self.etags.writeEtag).toHaveBeenCalledWith("theme/Even Darker Theme/additionalStyles.less", "theme source etag")

      done()
    })
  })

  it("should let you send theme additional styles back", (done) => {

    const results = self.endPointTransceiver.updateThemeSource.returnsResponse({}, "theme source etag")
    self.metadata.readMetadata.returnsPromise({"repositoryId": "monoTheme", etag: "THEME_ETAG"})
    self.putterUtils.processPutResult.returnsTrue()

    self.themePutter.putThemeStyles(themeStylesPath).then(() => {
      expect(self.putterUtils.processPutResult).toHaveBeenCalledWith(themeStylesPath, results)
      done()
    })
  })

  it("should let you send theme variables back", (done) => {

    const results = self.endPointTransceiver.updateThemeSource.returnsResponse({}, "theme source etag")
    self.metadata.readMetadata.returnsPromise({"repositoryId": "monoTheme", etag: "THEME_ETAG"})
    self.putterUtils.processPutResult.returnsTrue()

    self.themePutter.putThemeVariables(themeVariablesPath).then(() => {
      expect(self.putterUtils.processPutResult).toHaveBeenCalledWith(themeVariablesPath, results)
      done()
    })
  })

  it("should warn you when you try to send back a non-existent theme", (done) => {

    self.metadata.readMetadata.returnsPromise(null)

    self.themePutter.putThemeStyles(additionalStylesPathForMissingTheme).then(() => {
      expect(self.logger.warn).toHaveBeenCalledWith("cannotUpdateTheme", {path: additionalStylesPathForMissingTheme})
      done()
    })
  })

  it("should let you send back an entire theme", (done) => {

    self.metadata.readMetadata.returnsPromise({
      "repositoryId": "veryPurpleTheme",
      "etag": "old theme source etag"
    })
    const results = self.endPointTransceiver.updateThemeSource.returnsResponse({}, "theme source etag")
    self.putterUtils.processPutResult.returnsTrue()
    self.utils.readFile.returns("some theme code")

    self.themePutter.putTheme("theme/Very Purple Theme").then(() => {

      expect(self.endPointTransceiver.updateThemeSource).urlKeysWere(["veryPurpleTheme"])
      expect(self.endPointTransceiver.updateThemeSource).etagWas("old theme source etag")
      expect(self.endPointTransceiver.updateThemeSource).bodyWas({
        styles: "some theme code",
        additionalStyles: "some theme code",
        variables: "some theme code"
      })

      expect(self.putterUtils.processPutResult).toHaveBeenCalledWith("theme/Very Purple Theme", results)
      expect(self.etags.writeEtag).toHaveBeenCalledWith("theme/Very Purple Theme/styles.less", "theme source etag")
      expect(self.etags.writeEtag).toHaveBeenCalledWith("theme/Very Purple Theme/additionalStyles.less", "theme source etag")
      expect(self.etags.writeEtag).toHaveBeenCalledWith("theme/Very Purple Theme/variables.less", "theme source etag")
      done()
    })
  })

  it("should let you create a Theme in transfer mode", (done) => {

    self.state.inTransferMode.returnsTrue()
    self.metadata.readMetadata.returnsPromise(null)
    self.endPointTransceiver.getThemes.returnsItems({repositoryId: "themeToBeClonedRepoId"})
    self.endPointTransceiver.cloneTheme.returnsResponse({repositoryId: "newThemeRepoId"})
    const results = self.endPointTransceiver.updateThemeSource.returnsResponse({}, "theme source etag")
    self.putterUtils.processPutResult.returnsTrue()
    self.utils.readFile.returns("some theme code")

    self.themePutter.putTheme("theme/New Purple Theme").then(() => {

      expect(self.endPointTransceiver.updateThemeSource).urlKeysWere(["newThemeRepoId"])
      expect(self.endPointTransceiver.updateThemeSource).etagWas(undefined)
      expect(self.endPointTransceiver.updateThemeSource).bodyWas(
        {styles: "some theme code", additionalStyles: "some theme code", variables: "some theme code"})

      expect(self.etags.writeEtag).not.toHaveBeenCalled()
      done()
    })
  })

  it("should stop you creating a Theme when there is no metadata and not in transfer mode", (done) => {

    self.metadata.readMetadata.returnsPromise(null)

    self.themePutter.putTheme("theme/Very New Theme").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("cannotUpdateTheme", {path: "theme/Very New Theme"})
      done()
    })
  })
})
