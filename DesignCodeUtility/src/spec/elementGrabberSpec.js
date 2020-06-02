const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Element Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../utils', '../logger', '../endPointTransceiver', '../globalElementGrabber', '../widgetElementGrabber')

    self.elementGrabber = mockery.require("../elementGrabber")
  })

  afterEach(mockery.stopAll)

  it("should warn you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.elementGrabber.grabAllElements()

    expect(self.logger.warn).toHaveBeenCalledWith("elementsCannotBeGrabbed")
  })

  it("should call the grabbers if the endpoints exist", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.globalElementGrabber.grabGlobalElements.returnsPromise()
    self.widgetElementGrabber.grabWidgetElements.returnsPromise()

    self.elementGrabber.grabAllElements().then(() => {

      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(constants.elementsDir)
      expect(self.globalElementGrabber.grabGlobalElements).toHaveBeenCalled()
      expect(self.widgetElementGrabber.grabWidgetElements).toHaveBeenCalled()

      done()
    })
  })
})
