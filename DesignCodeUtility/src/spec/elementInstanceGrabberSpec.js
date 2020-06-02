const constants = require("../constants").constants
const matchers = require("./matchers")
const mockery = require("./mockery")

describe("Element Instance Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    mockery.mockModules(self, "../utils", "../endPointTransceiver", "../metadata", "../grabberUtils", "../widgetInstanceGrabber")

    self.endPointTransceiver.instance = "instance_name"

    self.endPointTransceiver.get.returnsResponse("image contents")

    self.elementInstanceGrabber = mockery.require("../elementInstanceGrabber")
  })

  afterEach(mockery.stopAll)

  it("should process element instances", done => {

    const widget = {
      descriptor: {
        widgetType: "myWidgetType"
      },
      displayName: "My Widget"
    }

    const elements = [
      {
        type: "instance",
        inline: true,
        config: {
          imageConfig: {
            values: {
              src: "image_src",
              titleTextId: "title_text_id"
            }
          },
          richTextConfig: {
            values: {
              sourceMedia: "source_media"
            }
          }
        }
      }
    ]

    self.widgetInstanceGrabber.getWidgetInstancePath.returns("widget/Some Widget/instances/My Widget")

    self.utils.splitPath.returnsFirstArg()

    self.elementInstanceGrabber.processElementInstances(widget, elements, "etag_value").then(() => {

      expect(self.utils.writeFile).toHaveBeenCalledWith("widget/Some Widget/instances/My Widget/images/image_src", "image contents")

      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith("widget/Some Widget/instances/My Widget/elementInstancesMetadata.json",
        JSON.stringify(
          {
            "elementInstances": [
              {
                "imageConfig": {
                  "fileName": "image_src"
                },
                "richTextConfig": {}
              }
            ]
          }, null, 2), "etag_value")

      done()
    })
  })
})
