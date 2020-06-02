const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Page Layout Lister", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    mockery.mockModules(self, '../logger')

    self.pageLayoutLister = mockery.require("../pageLayoutLister")
  })

  afterEach(mockery.stopAll)

  it("should let you list your layouts", () => {

    self.pageLayoutLister.listLayouts([{layout: {displayName: "My Layout"}}], false)

    expect(self.logger.logInfo).toHaveBeenCalledWith("My Layout")
  })

  it("should let you dump your layout details", () => {

    const myLayout = {layout: {displayName: "My Layout"}}
    self.pageLayoutLister.listLayouts([myLayout], true)

    expect(self.logger.logInfo).toHaveBeenCalledWith(JSON.stringify(myLayout, null, 2))
  })
})
