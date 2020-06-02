const constants = require("../constants").constants
const matchers = require("./matchers")
const mockery = require("./mockery")

describe("Page Layout Mapper", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver",
      "getAllWidgetInstances", "listLayouts", "listAudiences", "getSites", "getAllStackDescriptors")

    mockery.mockModules(self, "../logger")

    self.endPointTransceiver.getAllWidgetInstances.returnsItems(
      {
        repositoryId: "flatFooterWidgetDesc",
        instances: [
          {
            repositoryId: "flatFooterRepoId",
            displayName: "Flat Footer",
            version: 4
          }
        ]
      })

    self.endPointTransceiver.listAudiences.returnsItems(
      {
        displayName: "Cat Lovers",
        repositoryId: "catLoversRepoId"
      }
    )
    self.endPointTransceiver.getSites.returnsItems(
      {
        name: "a",
        repositoryId: "siteArepositoryId"
      },
      {
        name: "b",
        repositoryId: "siteBrepositoryId"
      },
      {
        name: "c",
        repositoryId: "siteCrepositoryId"
      }
    )
    self.endPointTransceiver.listLayouts.returnsItems({
      pageLayouts: [
        {
          pageType: "home",
          layout: {
            displayName: "Jim"
          }
        },
        {
          pageType: "article",
          layout: {
            displayName: "Fred"
          }
        }
      ]
    })
    self.endPointTransceiver.getAllStackDescriptors.returnsItems(
      {
        stackType: "slopedStack"
      }
    )

    self.pageLayoutMapper = mockery.require("../pageLayoutMapper")
  })

  afterEach(mockery.stopAll)

  it("should let you look up page layouts by display name", done => {

    self.pageLayoutMapper.loadReferenceData().then(() => {

      expect(self.pageLayoutMapper.getPageLayoutByDisplayName("Jim").layout.displayName).toBe("Jim")
      done()
    })
  })

  it("should let you look up page layouts by page Type", done => {

    self.pageLayoutMapper.loadReferenceData().then(() => {

      expect(self.pageLayoutMapper.getPageLayoutByPageType("home").pageType).toBe("home")
      done()
    })
  })

  it("should map site repository IDs", done => {

    self.pageLayoutMapper.loadReferenceData().then(() => {

      const sourcePageLayout = {
        layout: {
          sites: ["a", "b", "c", "silly"]
        },
        siteNames: ["a", "b", "c", "silly"]
      }

      self.pageLayoutMapper.mapSiteRepositoryIds(sourcePageLayout)

      expect(sourcePageLayout.layout.sites).toEqual(["siteArepositoryId", "siteBrepositoryId", "siteCrepositoryId"])
      expect(self.logger.error).toHaveBeenCalledWith("siteNotFoundOnTarget", {name: "silly"})
      done()
    })
  })

  it("should map audience repository IDs", done => {

    const region = {
      audiences: [
        {
          displayName: "Cat Lovers"
        },
        {
          displayName: "Dog Lovers"
        }
      ]
    }

    self.pageLayoutMapper.loadReferenceData().then(() => {

      self.pageLayoutMapper.mapAudienceIdsInRegion(region)
      expect(region.audiences[0].repositoryId).toEqual("catLoversRepoId")
      expect(self.logger.error).toHaveBeenCalledWith("audienceNotFoundOnTarget", {name: "Dog Lovers"})

      done()
    })
  })

  it("should map widget repository IDs", done => {

    const region = {
      widgets: [
        {
          displayName: "Flat Footer",
          descriptor: {
            version: 4
          }
        },
        {
          displayName: "Fat Header",
          descriptor: {
            version: 2
          }
        }
      ]
    }

    self.pageLayoutMapper.loadReferenceData().then(() => {

      self.pageLayoutMapper.mapWidgetRepositoryIdsInRegion(region)

      expect(region.widgets[0].repositoryId).toEqual("flatFooterRepoId")
      expect(region.widgets[0].descriptor.repositoryId).toEqual("flatFooterWidgetDesc")
      expect(self.logger.error).toHaveBeenCalledWith("widgetInstanceNotFoundOnTarget", {name: "Fat Header"})

      done()
    })
  })

  it("should be able to determine if a page layout is transferable", done => {

    const pageLayouts = [
      {
        siteNames: ["a"],
        structure: {
          layout: {
            regions: [
              {
                widgets: [
                  {
                    displayName: "Flat Footer",
                    descriptor: {
                      version: 4
                    }
                  }
                ],
                audiences: [
                  {
                    displayName: "Dog Lovers"
                  }
                ]
              }
            ]
          }
        }
      }
    ]

    self.pageLayoutMapper.loadReferenceData().then(() => {
      expect(self.pageLayoutMapper.transferable(pageLayouts)).toBeTruthy()
      done()
    })
  })

  it("should be able to determine if a page layout is not transferable", done => {

    const pageLayouts = [
      {
        siteNames: ["d"],
        structure: {
          layout: {
            regions: [
              {
                widgets: [
                  {
                    displayName: "Green Footer",
                    descriptor: {
                      version: 4
                    }
                  }
                ],
                audiences: [
                  {
                    displayName: "Pig Lovers"
                  }
                ],
                descriptor: {
                  stackType: "fred"
                },
                displayName: "It will never work"
              }
            ]
          }
        }
      }
    ]

    self.pageLayoutMapper.loadReferenceData().then(() => {

      self.pageLayoutMapper.transferable(pageLayouts)

      expect(self.logger.error).toHaveBeenCalledWith("siteNotFoundOnTarget", {name: "d"})
      expect(self.logger.error).toHaveBeenCalledWith("widgetInstanceNotFoundOnTarget", {name: "Green Footer"})
      expect(self.logger.error).toHaveBeenCalledWith("audienceNotFoundOnTarget", {name: "Pig Lovers"})
      expect(self.logger.error).toHaveBeenCalledWith("stackNotFoundOnTarget", {name: "It will never work"})

      done()
    })
  })

  it("should be able update page layout maps", done => {

    const pageLayout = {
      pageType: "home",
      layout: {
        displayName: "Jim",
        respositoryId: "respositoryId"
      }
    }

    self.pageLayoutMapper.loadReferenceData().then(() => {

      self.pageLayoutMapper.updatePageLayoutMaps(pageLayout)

      expect(self.pageLayoutMapper.getPageLayoutByDisplayName("Jim").layout.respositoryId).toBe("respositoryId")
      expect(self.pageLayoutMapper.getPageLayoutByPageType("home").layout.respositoryId).toBe("respositoryId")
      done()
    })
  })
})
