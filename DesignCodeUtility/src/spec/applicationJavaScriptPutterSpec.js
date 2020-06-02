const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Application JavaScript Putter", () => {

  const self = this

  const javaScriptPath = "global/myLittle.js"

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver', "updateApplicationJavaScript")
    mockery.mockModules(self, '../utils', '../etags', '../logger', '../putterUtils', '../siteHandler')

    self.applicationJavaScriptPutter = mockery.require("../applicationJavaScriptPutter")

    self.siteHandler.getDefaultSiteId.returnsPromise()
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.applicationJavaScriptPutter.putApplicationJavaScript(javaScriptPath)

    expect(self.logger.warn).toHaveBeenCalledWith("applicationJavaScriptCannotBeSent")
  })

  it("should let you update Application JavaScript", (done) => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.etags.eTagFor.returns("etag value")
    const results = self.endPointTransceiver.updateApplicationJavaScript.returnsPromise({})

    self.applicationJavaScriptPutter.putApplicationJavaScript(javaScriptPath).then(() => {

      expect(self.endPointTransceiver.updateApplicationJavaScript).urlKeysWere(["myLittle.js"])
      expect(self.endPointTransceiver.updateApplicationJavaScript).fieldWas("source")
      expect(self.endPointTransceiver.updateApplicationJavaScript).pathWas(javaScriptPath)
      expect(self.endPointTransceiver.updateApplicationJavaScript).etagWas("etag value")

      expect(self.etags.eTagFor).toHaveBeenCalledWith(javaScriptPath)

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(javaScriptPath, results)

      done()
    })
  })
})
