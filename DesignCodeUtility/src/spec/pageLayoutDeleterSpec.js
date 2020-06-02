const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Page Layout Deleter", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    mockery.mockModules(self, '../logger')
    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver', "deleteLayout")

    self.pageLayoutDeleter = mockery.require("../pageLayoutDeleter")
  })

  afterEach(mockery.stopAll)

  function makeDummyPageLayoutArray(defaultPage) {
    return [
      {
        layout: {
          displayName: "My Layout",
          repositoryId: "myLayoutRepoId",
          defaultPage
        }
      }]
  }

  it("should let you delete your layouts", done => {

    self.pageLayoutDeleter.deletePageLayout(makeDummyPageLayoutArray(false)).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith('deletingPageLayout', {name: 'My Layout'})
      expect(self.endPointTransceiver.deleteLayout).urlKeysWere(["myLayoutRepoId"])
      done()
    })
  })

  it("should stop you deleting default layouts", done => {

    self.pageLayoutDeleter.deletePageLayout(makeDummyPageLayoutArray(true)).then(() => {

      expect(self.logger.error).toHaveBeenCalledWith('cantDeleteDefaultPageLayout', {name: 'My Layout'})
      done()
    })
  })
})
