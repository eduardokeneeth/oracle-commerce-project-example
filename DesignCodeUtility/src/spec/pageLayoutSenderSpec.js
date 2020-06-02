const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Page Layout Sender", () => {

  const self = this

  const sourcePageLayout = {
    layout: {
      displayName: "William",
      notes: ""
    },
    structure: {
      layout: {
        regions: [
          {
            audiences: [],
            regions: [
              {
                regions: [
                  {
                    widgets: [{}, {}, {}]
                  }
                ]
              },
              {
                descriptor : {
                  stackType : "smokeStack"
                },
                sourceCode : {
                  less : "less code",
                  lessVars : "less vars",
                  template : "template code"
                }
              }
            ]
          }
        ]
      }
    }
  }

  const sourcePageLayouts = [
    sourcePageLayout
  ]

  const structureBeforeUpdate = {
    links: [],
    widgetPages: [],
    layout: {
      displayName: "",
      repositoryId: "",
      name: "",
      regions: [
        {
          widgets: [{}]
        },
        {
        }
      ]
    }
  }

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "updateLayout", "getLayoutStructure", "saveLayoutStructure", "cloneLayout",
      "updateStackLess", "updateStackLessVars", "updateStackSourceCode")

    mockery.mockModules(self, "../utils", "../i18n", "../logger", "../pageLayoutMapper")

    self.i18n.t.returnsFirstArg()
    self.pageLayoutMapper.loadReferenceData.returnsPromise()
    self.pageLayoutMapper.transferable.returnsTrue()
    self.pageLayoutMapper.getPageLayoutByDisplayName.returns({
      layout: {
        repositoryId: "williamPageLayoutRepoId"
      }
    })

    self.endPointTransceiver.checkCallSucceeded.returnsTrue()
    self.endPointTransceiver.updateLayout.returnsPromise()
    self.endPointTransceiver.getLayoutStructure.returnsResponse(structureBeforeUpdate)
    self.endPointTransceiver.saveLayoutStructure.returnsResponse(
      {
        layout: {
          repositoryId: "destinationPageLayoutRepoId",
          regions : [
            {
              descriptor : {
                stackType : "smokeStack"
              }
            }
          ]
        }
      })

    self.pageLayoutMapper.getPageLayoutByPageType.returns({
      layout: {
        repositoryId: "pageLayoutRepoIdToBeCloned"
      }
    })

    self.endPointTransceiver.cloneLayout.returnsResponse({})

    self.endPointTransceiver.updateStackLess.returnsResponse()
    self.endPointTransceiver.updateStackLessVars.returnsResponse()
    self.endPointTransceiver.updateStackSourceCode.returnsResponse()

    self.pageLayoutSender = mockery.require("../pageLayoutSender")
  })

  afterEach(mockery.stopAll)

  it("should let you put your layouts about", done => {

    self.pageLayoutSender.sendPageLayouts(sourcePageLayouts).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("copyingPageLayout", {name: "William"})
      expect(self.pageLayoutMapper.mapSiteRepositoryIds).toHaveBeenCalled()
      expect(structureBeforeUpdate.links).toBeUndefined()
      expect(self.endPointTransceiver.updateLayout).urlKeysWere(["williamPageLayoutRepoId"])
      expect(self.endPointTransceiver.updateLayout).bodyWas({
        "properties": {
          "displayName": "William",
          "notes": "updatedByPlsuText"
        }
      })
      expect(structureBeforeUpdate.layout.regions[0].widgets.length).toBe(0)

      expect(self.endPointTransceiver.saveLayoutStructure).urlKeysWere(["destinationPageLayoutRepoId"])
      expect(self.endPointTransceiver.saveLayoutStructure).bodyWas({
        "layout": {
          "repositoryId": "destinationPageLayoutRepoId",
          "regions": [
            {
              audiences: [],
              "regions": [
                {
                  "regions": [
                    {
                      "widgets": [
                        {},
                        {},
                        {}
                      ]
                    }
                  ]
                },
                {
                  descriptor : {
                    stackType : "smokeStack"
                  },
                  sourceCode : {
                    less : "less code",
                    lessVars : "less vars",
                    template : "template code"
                  }
                }
              ]
            }
          ]
        }
      })

      expect(self.pageLayoutMapper.mapWidgetRepositoryIdsInRegion).toHaveBeenCalled()
      expect(self.pageLayoutMapper.mapAudienceIdsInRegion).toHaveBeenCalled()

      done()
    })
  })

  it("should create layouts if they don't exist", done => {

    let called = false

    self.pageLayoutMapper.getPageLayoutByDisplayName.and.callFake((displayName) => {

      if (called) {
        return {
          layout: {
            repositoryId: "newPageLayoutRepositoryId"
          }
        }
      } else {
        called = true
        return false
      }
    })

    self.pageLayoutSender.sendPageLayouts(sourcePageLayouts).then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("creatingPageLayout", {name: "William"})
      expect(self.pageLayoutMapper.updatePageLayoutMaps).toHaveBeenCalledWith({})

      expect(self.endPointTransceiver.cloneLayout).urlKeysWere(["pageLayoutRepoIdToBeCloned"])
      expect(self.endPointTransceiver.cloneLayout).bodyWas({
        "properties": {
          "displayName": "William",
          "notes": "updatedByPlsuTextcreatedByPlsuText"
        }
      })

      expect(self.endPointTransceiver.saveLayoutStructure).urlKeysWere(["destinationPageLayoutRepoId"])

      expect(self.endPointTransceiver.updateStackLess).bodyWas({
        "source": "less code"
      })
      expect(self.endPointTransceiver.updateStackLessVars).bodyWas({
        "source": "less vars"
      } )
      expect(self.endPointTransceiver.updateStackSourceCode).bodyWas({
        "source": "template code"
      })

      done()
    })
  })
})
