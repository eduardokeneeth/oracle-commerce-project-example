const constants = require("../constants").constants
const matchers = require('./matchers')
const mockery = require("./mockery")

describe("Text Snippet Putter", () => {

  const self = this

  const snippetsPath = "snippets/en/snippets.json"

  beforeEach(() => {

    mockery.use(jasmine.createSpy)
    matchers.add(jasmine)

    self.endPointTransceiver = mockery.mockModule("../endPointTransceiver", "updateCustomTranslations")

    mockery.mockModules(self, "../putterUtils", "../utils", "../logger", "../etags")

    self.textSnippetPutter = mockery.require("../textSnippetPutter")
  })

  afterEach(mockery.stopAll)

  it("should stop you if the server does not support the right endpoints", () => {

    self.endPointTransceiver.serverSupports.returnsFalse()

    self.textSnippetPutter.putGlobalSnippets(snippetsPath)

    expect(self.logger.warn).toHaveBeenCalledWith("textSnippetsCannotBeSent", {path: snippetsPath})
  })

  it("should let you send snippets back", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    const results = self.endPointTransceiver.updateCustomTranslations.returnsPromise({})
    self.etags.eTagFor.returns("etag value")
    self.utils.readJsonFile.returns(
      {
        "snippetTextGroup": {
          "snippet_key": "some snippet text"
        }
      })

    self.textSnippetPutter.putGlobalSnippets(snippetsPath).then(() => {

      expect(self.endPointTransceiver.updateCustomTranslations).urlKeysWere(["ns.common"])
      expect(self.endPointTransceiver.updateCustomTranslations).localeWas("en")
      expect(self.endPointTransceiver.updateCustomTranslations).etagWas("etag value")
      expect(self.endPointTransceiver.updateCustomTranslations).bodyWas({"custom": {"snippet_key": "some snippet text"}})

      expect(self.putterUtils.processPutResultAndEtag).toHaveBeenCalledWith(snippetsPath, results)

      done()
    })
  })

  it("should use optimistic locking where available", done => {

    self.endPointTransceiver.serverSupports.returnsTrue()
    self.endPointTransceiver.updateCustomTranslationsForLocale = mockery.addConvenienceMethods(jasmine.createSpy("updateCustomTranslationsForLocale"))
    self.endPointTransceiver.updateCustomTranslationsForLocale.returnsPromise({})
    self.etags.eTagFor.returns("etag value")
    self.utils.readJsonFile.returns(
      {
        "snippetTextGroup": {
          "snippet_key": "some snippet text"
        }
      })

    self.textSnippetPutter.putGlobalSnippets(snippetsPath).then(() => {

      expect(self.endPointTransceiver.updateCustomTranslationsForLocale).urlKeysWere(["ns.common", "en"])
      done()
    })
  })
})
