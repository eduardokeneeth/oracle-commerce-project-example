const constants = require('../constants').constants
const matchers = require('./matchers')
const mockery = require('./mockery')

describe("Page Layout Getter", () => {

  const self = this

  const pageLayoutStructure = {
    layout: {
      regions: [
        {
          repositoryId: "shouldBeDeleted",
          widgets: [{repositoryId: "widgetInstanceRepoId", descriptor: {}}],
          descriptor: {
            slotType: "notAnExperiment",
            repositoryId: "shouldAlsoBeDeleted"
          }
        },
        {
          descriptor: {
            stackType: "crookedStack"
          },
          widgets: []
        }
      ]
    }
  }

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "listWidgets", "listLayouts", "getLayoutStructure",
      "getStackSourceCode", "getStackLessVars", "getStackLess")
    mockery.mockModules(self, '../logger')

    self.endPointTransceiver.listWidgets.returnsItems({
      repositoryId: "widgetInstanceRepoId",
      descriptor: {
        version: 6
      }
    })

    self.endPointTransceiver.listLayouts.returnsItems({
      pageLayouts: [
        {
          layout: {
            displayName: "Jim"
          }
        },
        {
          layout: {
            displayName: "Fred"
          }
        }
      ]
    })

    self.endPointTransceiver.getLayoutStructure.returnsResponse(pageLayoutStructure)

    self.endPointTransceiver.getStackSourceCode.returnsResponse({source: "stack source code"})
    self.endPointTransceiver.getStackLessVars.returnsResponse({source: "stack less vars"})
    self.endPointTransceiver.getStackLess.returnsResponse({source: "stack less"})

    self.pageLayoutGetter = mockery.require("../pageLayoutGetter")
  })

  afterEach(mockery.stopAll)

  it("should let you get info on your layouts", done => {

    self.pageLayoutGetter.getPageLayouts(["Jim"]).then(layouts => {

      expect(self.logger.error).not.toHaveBeenCalledWith("matchingLayoutNotFound", {name: "Jim"})

      expect(layouts.length).toBe(1)
      expect(layouts[0].structure.layout.regions[0].widgets[0].descriptor.version).toBe(6)
      expect(layouts[0].structure.layout.regions[0].repositoryId).toBeUndefined()
      expect(layouts[0].structure.layout.regions[0].descriptor.repositoryId).toBeUndefined()
      done()
    })
  })

  it("should error out if it cant find your layouts", done => {

    self.pageLayoutGetter.getPageLayouts(["Not Jim"]).then(layouts => {
      expect(self.logger.error).toHaveBeenCalledWith("matchingLayoutNotFound", {name: "Not Jim"})
      done()
    })
  })

  it("should warn that it can't transfer experiments", done => {

    pageLayoutStructure.layout.regions[0].descriptor.slotType = "experimentSlot"
    pageLayoutStructure.layout.regions[0].displayName = "My Science Project"

    self.pageLayoutGetter.getPageLayouts(["Fred"]).then(layouts => {

      expect(self.logger.warn).toHaveBeenCalledWith("experimentNotTransferred", {name: "My Science Project"})
      done()
    })
  })

  it("should let you get info on all layouts", done => {

    self.pageLayoutGetter.getPageLayouts([]).then(layouts => {

      expect(self.logger.error).not.toHaveBeenCalledWith("matchingLayoutNotFound", {name: "Jim"})

      expect(layouts.length).toBe(2)
      expect(layouts[0].structure.layout.regions[0].widgets[0].descriptor.version).toBe(6)
      expect(layouts[0].structure.layout.regions[0].repositoryId).toBeUndefined()
      expect(layouts[0].structure.layout.regions[0].descriptor.repositoryId).toBeUndefined()

      expect(layouts[0].structure.layout.regions[1].sourceCode).toEqual({
        template: 'stack source code',
        lessVars: 'stack less vars',
        less: 'stack less'
      })
      done()
    })
  })
})
