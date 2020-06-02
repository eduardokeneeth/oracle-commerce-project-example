const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Text Snippet Grabber", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "getResourceStrings")
    self.endPointTransceiver.locales = [{name: "en"}]

    mockery.mockModules(self, "../utils", "../grabberUtils", "../logger")

    self.textSnippetGrabber = mockery.require("../textSnippetGrabber")
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.textSnippetGrabber.grabCommonTextSnippets()

    expect(self.logger.warn).toHaveBeenCalledWith("textSnippetsCannotBeGrabbed")
  })

  function mockTextSnippetResponse() {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getResourceStrings.returnsResponse(
      {
        resources: {
          "shippingItemRelationshipStates": {
            "PENDING_SUBITEM_DELIVERY_SG": "The item is wait for dependent sub-items from inventory",
            "WILL_BE_OVERRIDDEN": "You should NOT see this value"
          }
        },
        custom: {
          "WILL_BE_OVERRIDDEN": "You SHOULD see this value"
        }
      }, "resource string etag")
  }

  it("should let you grab all global text snippets", done => {

    mockTextSnippetResponse()

    self.textSnippetGrabber.grabCommonTextSnippets().then(() => {

      expect(self.endPointTransceiver.getResourceStrings).urlKeysWere(["ns.common"])
      expect(self.endPointTransceiver.getResourceStrings).localeWas("en")

      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(constants.textSnippetsDir)
      expect(self.utils.makeTrackedDirectory).toHaveBeenCalledWith(`${constants.textSnippetsDir}/en`)
      expect(self.logger.info).toHaveBeenCalledWith('grabbingTextSnippets', {name: 'en'})
      expect(self.grabberUtils.writeFileAndETag).toHaveBeenCalledWith(
        "snippets/en/snippets.json",
        JSON.stringify({
          "shippingItemRelationshipStates": {
            "PENDING_SUBITEM_DELIVERY_SG": "The item is wait for dependent sub-items from inventory",
            "WILL_BE_OVERRIDDEN": "You SHOULD see this value"
          }
        }, null, 2),
        "resource string etag")
      done()
    })
  })

  it("should use optimistic lock capable endpoints where available", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getResourceStringsForLocale = mockery.addConvenienceMethods(jasmine.createSpy("getResourceStringsForLocale"))

    self.endPointTransceiver.getResourceStringsForLocale.returnsResponse(
      {
        resources: {
          "shippingItemRelationshipStates": {
            "PENDING_SUBITEM_DELIVERY_SG": "The item is wait for dependent sub-items from inventory",
            "WILL_BE_OVERRIDDEN": "You should NOT see this value"
          }
        },
        custom: {
          "WILL_BE_OVERRIDDEN": "You SHOULD see this value"
        }
      }, "resource string etag")

    self.textSnippetGrabber.grabCommonTextSnippets().then(() => {

      expect(self.endPointTransceiver.getResourceStringsForLocale).urlKeysWere(["ns.common", "en"])
      expect(self.endPointTransceiver.getResourceStringsForLocale).localeWas("en")
      done()
    })
  })

  it("should let you grab global text snippets for a specific locale", done => {

    mockTextSnippetResponse()

    self.utils.splitPath.returns("en")

    self.textSnippetGrabber.grabTextSnippetsForLocaleDirectory("snippets/en").then(() => {

      expect(self.logger.info).toHaveBeenCalledWith('grabbingTextSnippets', {name: 'en'})
      done()
    })
  })

  it("should warn you if you try to grab global text snippets for a mythical locale", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.utils.splitPath.returns("de")

    self.endPointTransceiver.getResourceStringsForLocale = mockery.addConvenienceMethods(jasmine.createSpy("getResourceStringsForLocale"))
    self.endPointTransceiver.getResourceStringsForLocale.returnsResponse({})

    self.textSnippetGrabber.grabTextSnippetsForLocaleDirectory("snippets/de").then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("noMatchFound", {name: 'de'})
      done()
    })
  })

  it("should stop you grabbing global text snippets for a specific locale when there is no endpoint", () => {

    self.textSnippetGrabber.grabTextSnippetsForLocaleDirectory("snippets/en")

    expect(self.logger.warn).toHaveBeenCalledWith("textSnippetsCannotBeGrabbed")
  })

  it("should handle aliased locales", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    let called = false

    self.endPointTransceiver.getResourceStrings.returnsPromise(() => {

      const payload = {
        data: {},
        response: {
          headers: {
            etag: "etag value"
          }
        }
      }

      if (called) {
        payload.data = {
          resources: {
            "shippingItemRelationshipStates": {
              "PENDING_SUBITEM_DELIVERY_SG": "The item is wait for dependent sub-items from inventory",
              "WILL_BE_OVERRIDDEN": "You should NOT see this value"
            }
          },
          custom: {
            "WILL_BE_OVERRIDDEN": "You SHOULD see this value"
          }
        }
      }

      called = true

      return payload
    })

    self.endPointTransceiver.locales = [
      {
        name: "chinese",
        aliases : [
          "new chinese alias",
          "old chinese alias"
        ]
      }]

    self.textSnippetGrabber.grabCommonTextSnippets().then(() => {

      expect(self.endPointTransceiver.getResourceStrings).urlKeysWere(["ns.common"])
      expect(self.endPointTransceiver.getResourceStrings).localeWas("old chinese alias")
      done()
    })
  })

  it("should handle aliased locales where there is no match at all", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()

    self.endPointTransceiver.getResourceStrings.returnsPromise(() => {

      return {
        data: {},
        response: {
          headers: {
            etag: "etag value"
          }
        }
      }
    })

    self.endPointTransceiver.locales = [
      {
        name: "chinese",
        aliases : [
          "new chinese alias",
          "old chinese alias"
        ]
      }]

    self.textSnippetGrabber.grabCommonTextSnippets().then(() => {

      expect(self.logger.warn).toHaveBeenCalledWith("noMatchFound", {name: 'old chinese alias'})
      done()
    })
  })
})
