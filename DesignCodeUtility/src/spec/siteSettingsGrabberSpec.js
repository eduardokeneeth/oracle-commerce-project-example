const constants = require('../constants').constants
const mockery = require('./mockery')

describe("Site Settings Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    self.endPointTransceiver = mockery.mockModule('../endPointTransceiver',
      "getCustomSiteSettings", "getSites", "listSiteSettings")

    mockery.mockModules(self, '../logger', '../utils', '../metadata')

    self.siteSettingsGrabber = mockery.require("../siteSettingsGrabber")

    self.endPointTransceiver.locales = [{ name: "en"}]

    self.utils.sanitizeName.returnsFirstArg()
  })

  afterEach(mockery.stopAll)

  it("should let you grab all Site Settings", (done) => {

    self.endPointTransceiver.listSiteSettings.returnsItems(
      {
        repositoryId: "case-insensitive-urls"
      },
      {
        repositoryId: "abandoned-cart"
      },
      {
        repositoryId: "custom-site-settings",
        id: "custom-site-settings",
        values: [
          {
            name : "color",
            repositoryId : "colorRepositoryId",
            noOfColumns : "10",
            helpText : "Color Help Text",
            label : "Color Label",
            options : [],
            type : "text",
            maxLength : "30",
            defaultValue : "Green",
            otherKey : "otherValue"
          }, 
          {
            name : "smell",
            repositoryId : "smellRepositoryId",
            noOfColumns : "10",
            helpText : "Smell Help Text",
            label : "Smell Label",
            options : [],
            type : "checkbox",
            maxLength : "30",
            defaultValue : "true",
            otherKey : "otherValue"
          }, 
          {
            name : "height",
            repositoryId : "heightRepositoryId",
            noOfColumns : "10",
            helpText : "Height Help Text",
            label : "Height Label",
            options : [
              {
                label : "option 1 Label",
                value : "small"
              }
            ],
            type : "option",
            maxLength : "30",
            defaultValue : "true",
            otherKey : "otherValue"
          }
        ],
        displayName: "Custom Site Settings"
      })

    self.endPointTransceiver.getSites.returnsItems(
      {
        repositoryId: "siteRepositoryId",
        name: "Cute Site"
      }
    )

    self.endPointTransceiver.getCustomSiteSettings.returnsResponse(
      {
        data: {
          repositoryId: "siteRepositoryId",
          name: "Cute Site"
        },
        config : {
          values : [
            {
              name : "first",
              helpText : "firstHelpText",
              label : "firstLabel",
              options : []
            },
            {
              name : "second",
              helpText : "secondHelpText",
              label : "secondLabel",
              options : []
            },
            {
              name : "third",
              helpText : "thirdHelpText",
              label : "thirdLabel",
              options : [
                {
                  label : "firstOptionLabel"
                }
              ]
            }
          ]
        }
      }
    )

    self.siteSettingsGrabber.grabAllSiteSettings().then(() => {

      expect(self.utils.writeFile).toHaveBeenCalledWith("siteSettings/Custom Site Settings/locales/en.json",
        JSON.stringify({
          "resources": {
            "firstHelpText": "firstHelpText",
            "firstLabel": "firstLabel",
            "secondHelpText": "secondHelpText",
            "secondLabel": "secondLabel",
            "thirdHelpText": "thirdHelpText",
            "thirdLabel": "thirdLabel",
            "thirdfirstOptionLabelLabel": "firstOptionLabel"
          }
        }, null, 2))

      expect(self.utils.writeFile).toHaveBeenCalledWith("siteSettings/Custom Site Settings/siteSettingsConfigMetadata.json",
        JSON.stringify({
          "titleResourceId": "title",
          "descriptionResourceId": "description",
          "properties": [
            {
              "id": "color",
              "name": "color",
              "helpTextResourceId": "colorHelpText",
              "labelResourceId": "colorLabel",
              "type": "stringType",
              "maxLength": "30",
              "defaultValue": "Green",
              "otherKey": "otherValue"
            },
            {
              "id": "smell",
              "name": "smell",
              "helpTextResourceId": "smellHelpText",
              "labelResourceId": "smellLabel",
              "type": "booleanType",
              "defaultValue": true,
              "otherKey": "otherValue"
            },
            {
              "id": "height",
              "name": "height",
              "helpTextResourceId": "heightHelpText",
              "labelResourceId": "heightLabel",
              "options": [
                {
                  "value": "small",
                  "id": "heightoption 1 Label",
                  "labelResourceId": "heightoption 1 LabelLabel"
                }
              ],
              "type": "optionType",
              "defaultValue": "true",
              "otherKey": "otherValue"
            }
          ]
        }, null, 2))

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(
        'siteSettings/Custom Site Settings/sites/Cute Site/siteSettingsValuesMetadata.json',
        {
          displayName: 'Custom Site Settings',
          siteName: 'Cute Site'
        })

      expect(self.metadata.writeMetadata).toHaveBeenCalledWith(
        'siteSettings/Custom Site Settings/siteSettingsMetadata.json',
        {
          displayName: 'Custom Site Settings',
          id: 'custom-site-settings'
        })

      done()
    })
  })
})
