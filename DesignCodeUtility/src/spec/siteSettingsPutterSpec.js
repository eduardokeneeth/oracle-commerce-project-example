const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Site Settings Putter", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "setSiteSettingConfigData")

    mockery.mockModules(self, "../utils", "../putterUtils", "../metadata", "../siteSettingsCreator")

    self.siteSettingsPutter = mockery.require("../siteSettingsPutter")
  })

  afterEach(mockery.stopAll)

  it("should let you create site settings via an extension", () => {

    self.metadata.readMetadataFromDisk.returns({
      id: "site settings id",
      displayName: "site settings display name"
    })

    self.siteSettingsPutter.putSiteSettings("siteSettings/Call Me")

    expect(self.siteSettingsCreator.createSiteSettingsInExtension).toHaveBeenCalledWith("site settings id", "site settings display name", "siteSettings/Call Me")
  })

  it("should let you update site settings values", done => {

    self.utils.readJsonFile.returns({
      "weight": "10kg"
    })

    self.metadata.readMetadata.returnsPromise({
      repositoryId: "siteSettingsRepositoryId",
      values: [
        {
          name: "weight",
          type: "text"
        },
        {
          name: "missingBoolean",
          type: "checkbox"
        },
        {
          name: "missingText",
          type: "text",
          defaultValue: "missingTextDefaultValue"
        },
        {
          name: "missingTextwithoutDefault",
          type: "text"
        },
        {
          name: "missingOption",
          type: "option",
          options: [
            {
              value: "firstOption"
            }
          ]
        }
      ],
      site: {
        repositoryId: "siteRepositoryId"
      }
    })

    self.endPointTransceiver.setSiteSettingConfigData.returnsPromise()

    self.siteSettingsPutter.putSiteSettingsValues("siteSettings/Site Settings Demo/sites/Commerce Cloud Site/siteSettingsValues.json").then(() => {

      expect(self.endPointTransceiver.setSiteSettingConfigData).urlKeysWere(["siteSettingsRepositoryId"])

      expect(self.endPointTransceiver.setSiteSettingConfigData).bodyWas({
        "weight": "10kg",
        "missingBoolean": false,
        "missingText": "missingTextDefaultValue",
        "missingTextwithoutDefault": "",
        "missingOption": "firstOption"
      })

      done()
    })
  })
})
