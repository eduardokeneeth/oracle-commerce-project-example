"use strict"

const mockery = require('./mockery')

describe("Site Handler", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver', "getSites")

    self.siteHandler = mockery.require("../siteHandler")

    self.endPointTransceiver.getSites.returnsItems(
      {
        defaultSite: false
      },
      {
        defaultSite: true,
        repositoryId : "siteRepositoryId"
      })
  })

  afterEach(mockery.stopAll)

  it("should return the default site ID",  done => {

    return self.siteHandler.getDefaultSiteId().then(defaultSiteId => {

      expect(defaultSiteId).toEqual("siteRepositoryId")

      self.endPointTransceiver.getSites.returnsItems({}) // Should not be called again as value is cached.

      return self.siteHandler.getDefaultSiteId().then(defaultSiteId => {

        expect(defaultSiteId).toEqual("siteRepositoryId")
        done()
      })
    })
  })
})
