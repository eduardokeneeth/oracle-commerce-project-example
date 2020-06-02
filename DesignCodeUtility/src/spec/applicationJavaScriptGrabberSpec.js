const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Application JavaScript Grabber", () => {

  const self = this

  const javaScriptFileName = "a.js"
  const javaScriptSource = "alert('yo');"
  const etag = "XXXXX"

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../logger')

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver', "listAllApplicationJavaScript", "getApplicationJavaScript")

    mockery.mockModules(self, '../utils', '../grabberUtils')

    self.applicationJavaScriptGrabber = mockery.require("../applicationJavaScriptGrabber")
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.applicationJavaScriptGrabber.grabAllApplicationJavaScript()

    expect(self.logger.warn).toHaveBeenCalledWith("applicationJavaScriptCannotBeGrabbed")
  })

  it("should let you grab all Application JavaScript", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.listAllApplicationJavaScript.returnsResponse({items : { "a.js" : []}})
    self.endPointTransceiver.getApplicationJavaScript.returnsResponse({source : javaScriptSource}, etag)

    self.applicationJavaScriptGrabber.grabAllApplicationJavaScript().then(
      () => {

        expect(self.endPointTransceiver.getApplicationJavaScript).toHaveBeenCalledWith([javaScriptFileName], '?ignoreSite=true')
        expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(constants.globalDir)
        expect(self.logger.info).toHaveBeenCalledWith('grabbingApplicationJavaScript', {name : javaScriptFileName})
        expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith('global/a.js', javaScriptSource, etag)

        done()
      }
    )
  })
})
