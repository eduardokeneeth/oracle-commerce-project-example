"use strict"

const constants = require("../constants").constants
const mockery = require("./mockery")

describe("Request Builder", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../state", "../utils", "../endPointTransceiver")

    self.utils.readFile.returns("file contents")

    self.requestBuilder = mockery.require("../requestBuilder")
  })

  afterEach(mockery.stopAll)

  it("should let us build a request", () => {

    const requestBuilder = self.requestBuilder.request()

    const request = requestBuilder
      .withHeader("someHeader", "some header value")
      .withLocale("en").withEtag("QUITE_SHORT_ETAG")
      .fromPathAs("some/path/to/source.js", "source")
      .ignoring(404)
      .withBody("small body").build("access token",
        {
          useOptimisticLock : true,
          localeHint : "assetLanguageRequired"
        })

    expect(request.headers.someHeader).toEqual("some header value")
    expect(request.headers.Accept).toEqual("application/json, text/javascript, */*; q=0.01")
    expect(request.headers["X-CCProfileType"]).toEqual("adminUI")
    expect(request.headers.Authorization).toEqual("Bearer access token")
    expect(request.headers["Content-Type"]).toEqual("application/json")
    expect(request.headers.ETag).toEqual("QUITE_SHORT_ETAG")
    expect(request.headers["If-Match"]).toEqual("QUITE_SHORT_ETAG")
    expect(request.headers["X-CCAsset-Language"]).toEqual("en")

    expect(request.data.source).toEqual("file contents")

    expect(requestBuilder.shouldIgnore(404)).toBeTruthy()
    expect(requestBuilder.shouldIgnore(200)).toBeFalsy()
  })

  it("should let us force a different profile type", () => {

    self.requestBuilder.setProfileType("otherProfileType")

    const request = self.requestBuilder.request().build("access token",
      {
        useOptimisticLock : true,
        localeHint : "assetLanguageRequired"
      })

    expect(request.headers["X-CCProfileType"]).toEqual("otherProfileType")
  })

  it("should exclude locale header for listLocales", () => {

    const request = self.requestBuilder.request().build("access token",
      {
        id : "listLocales",
        useOptimisticLock : true,
        localeHint : "assetLanguageRequired"
      })

    expect(request.headers["X-CCAsset-Language"]).toBeUndefined()
  })

  it("should exclude etag in transfer mode", () => {

    self.state.inTransferMode.returnsTrue()

    const request = self.requestBuilder.request().withEtag("QUITE_SHORT_ETAG").build("access token",
      {
        useOptimisticLock : true,
        localeHint : "assetLanguageRequired"
      })

    expect(request.headers.ETag).not.toEqual("QUITE_SHORT_ETAG")
  })
})
