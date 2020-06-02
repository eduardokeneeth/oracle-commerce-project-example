const constants = require("../constants").constants
const mockery = require("./mockery")

describe("Stack Grabber", () => {

  const self = this

  const stackDir = `${constants.stacksDir}/My Big Stack`
  const stackInstancesDir = `${stackDir}/instances`
  const myBigStackDisplayName = 'My Big Stack Instance Display Name'
  const myBigStackInstanceDir = `${stackInstancesDir}/${myBigStackDisplayName}`

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "getAllStackInstances")
    self.stackUtils = mockery.mockModule("../stackUtils")

    mockery.mockModules(self, "../utils", "../grabberUtils", "../metadata", "../logger")

    self.utils.sanitizeName.returnsFirstArg()

    self.stackGrabber = mockery.require("../stackGrabber")
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.stackGrabber.grabAllStacks()

    expect(self.logger.warn).toHaveBeenCalledWith("stacksCannotBeGrabbed")
  })

  it("should let you grab all Stacks", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.stackUtils.friendlyStackInstanceName.returns(myBigStackDisplayName)
    self.stackUtils.deriveStackInstanceDir.returns(myBigStackDisplayName)

    self.endPointTransceiver.getAllStackInstances.returnsItems(
      {
        displayName: "My Big Stack",
        repositoryId: "myBigBaseStackId",
        stackType: "bigStack",
        "regions": [
          {
            "repositoryId": "bigStackSectionOne",
            "name": "One"
          },
          {
            "repositoryId": "bigStackSectionTwo",
            "name": "Two"
          },
          {
            "repositoryId": "bigStackSectionThree",
            "name": "Three"
          }
        ],
        version: 2,
        maxVariants: 10,
        canEditSubRegion: true,
        instances: [
          {
            displayName : "My Big Stack Instance Display Name",
            id : "myBigStackId",
            descriptor: {
              version: 2
            },
            name : "My Big Stack Instance Display Name"
          }
        ]
      })

    self.stackGrabber.grabAllStacks().then(() => {

      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(constants.stacksDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(stackDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(stackInstancesDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(myBigStackInstanceDir)

      expect(self.logger.info).toHaveBeenCalledWith("grabbingStack", {name: "My Big Stack"})

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(`${myBigStackInstanceDir}/stackInstance.json`,
        {version: 2, displayName : "My Big Stack Instance Display Name", name : "My Big Stack Instance Display Name"})

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(`${stackDir}/stack.json`,
        {stackType: "bigStack", regions: [{"repositoryId": "bigStackSectionOne", "name": "One"}, {"repositoryId": "bigStackSectionTwo", "name": "Two"}, {"repositoryId": "bigStackSectionThree", "name": "Three"}], version: 2, displayName: "My Big Stack", maxVariants: 10, canEditSubRegion: true})

      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getStackSourceCode", "myBigStackId", "source", `${myBigStackInstanceDir}/stack.template`)
      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getStackLessVars", "myBigStackId", "source", `${myBigStackInstanceDir}/stack-variables.less`)
      expect(self.grabberUtils.copyFieldContentsToFile).toHaveBeenCalledWith("getStackLess", "myBigStackId", "source", `${myBigStackInstanceDir}/stack.less`)
      done()
    })
  })

  it("should should ignore old stacks", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getAllStackInstances.returnsItems(
      {
        displayName: "Multiple Version Stack",
        repositoryId: "multipleVersionBaseStackId",
        stackType: "multipleVersionStack",
        version: 2,
        instances: [
          {
            displayName: "Multiple Version Stack Instance Display Name",
            id: "multipleVersionInstanceStackId",
            descriptor: {
              version: 1
            }
          }
        ]
      })

    self.utils.exists.returnsTrue()

    self.metadata.readMetadataFromDisk.returns({version: 2})

    self.stackGrabber.grabAllStacks().then(() => {

      expect(self.metadata.writeMetadata).not.toHaveBeenCalledWith(`${myBigStackInstanceDir}/stackInstance.json`,
        {repositoryId: "multipleVersionInstanceStackId", displayName: "Multiple Version Stack Instance Display Name"})

      expect(self.grabberUtils.copyFieldContentsToFile).not.toHaveBeenCalled()

      done()
    })
  })

  it("should let you grab a specific stack", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getAllStackInstances.returnsItems(
      {
        displayName: "My Big Stack",
        repositoryId: "myBigBaseStackId",
        stackType: "bigStack",
        version: 2,
        instances: [
          {
            displayName: "My Big Stack Instance Display Name",
            id: "myBigStackId",
            descriptor: {
              version: 2
            }
          }
        ]
      })

    self.stackGrabber.grabSpecificStack("stack/My Big Stack").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("grabbingStack", {name: "My Big Stack"})
      done()
    })
  })

  it("should let you grab a specific stack instance", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getAllStackInstances.returnsItems(
      {
        displayName: "My Big Stack",
        repositoryId: "myBigBaseStackId",
        stackType: "bigStack",
        version: 2,
        instances: [
          {
            displayName: "My Big Stack Instance Display Name",
            id: "myBigStackId",
            descriptor: {
              version: 2
            }
          }
        ]
      })

    self.stackGrabber.grabSpecificStackInstance("stack/My Big Stack/instances/My Big Stack Instance Display Name").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("grabbingStack", {name: "My Big Stack"})
      done()
    })
  })

  it("should let you grab all instances of a specific stack", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getAllStackInstances.returnsItems(
      {
        displayName: "My Big Stack",
        repositoryId: "myBigBaseStackId",
        stackType: "bigStack",
        version: 2,
        instances: [
          {
            displayName: "My Big Stack Instance Display Name",
            id: "myBigStackId",
            descriptor: {
              version: 2
            }
          }
        ]
      })

    self.stackGrabber.grabStackInstances("stack/My Big Stack/instances").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith("grabbingStack", {name: "My Big Stack"})
      done()
    })
  })
})
