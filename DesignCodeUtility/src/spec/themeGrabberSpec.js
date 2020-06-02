const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Theme Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver', "getThemes", "getThemeSource")
    mockery.mockModules(self, '../utils', '../grabberUtils', '../logger')

    self.utils.sanitizeName.returnsFirstArg()

    self.themeGrabber = mockery.require("../themeGrabber")
  })

  afterEach(mockery.stopAll)

  function mockThemeResponses(additionalStyles) {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.endPointTransceiver.getThemes.returnsItems({name: "Furry Theme", repositoryId: "themeRepo0001"})
    return self.endPointTransceiver.getThemeSource.returnsResponse(
      {
        variables: {},
        styles: {},
        additionalStyles
      }, "theme etag")
  }

  it("should let you grab themes", (done) => {

    const themeSource = mockThemeResponses({})

    self.themeGrabber.grabAllThemes().then(() => {

      expect(self.endPointTransceiver.getThemes).toHaveBeenCalledWith("?type=custom")
      expect(self.endPointTransceiver.getThemeSource).toHaveBeenCalledWith(["themeRepo0001"])
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(constants.themesDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(`${constants.themesDir}/Furry Theme`)
      expect(self.logger.info).toHaveBeenCalledWith('grabbingTheme', {name: 'Furry Theme'})
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('theme/Furry Theme/variables.less', themeSource.data.variables, 'theme etag')
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('theme/Furry Theme/styles.less', themeSource.data.styles, 'theme etag')
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('theme/Furry Theme/additionalStyles.less', themeSource.data.additionalStyles, 'theme etag')
      done()
    })
  })

  it("should let you grab themes when there are no additional styles", (done) => {

    mockThemeResponses()

    self.themeGrabber.grabAllThemes().then(
      () => {

        expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('theme/Furry Theme/additionalStyles.less', "", 'theme etag')
        done()
      })
  })

  it("should let you grab a specific theme", (done) => {

    const themeSource = mockThemeResponses({})

    self.utils.splitPath.returns("Furry Theme")

    self.themeGrabber.grabSpecificTheme("theme/Furry Theme").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith('grabbingTheme', {name: 'Furry Theme'})
      done()
    })
  })
})
