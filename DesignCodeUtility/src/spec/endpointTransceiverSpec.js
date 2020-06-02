const mockery = require('./mockery')

describe("Endpoint Transceiver", () => {

  const self = this

  beforeEach(done => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../utils', '../etags', '../logger', '../i18n', '../promisingClient')

    self.promisingClientInstance = {
      postAndPromise : mockery.addConvenienceMethods(jasmine.createSpy()),
      getAndPromise : mockery.addConvenienceMethods(jasmine.createSpy())
    }

    self.promisingClientInstance.postAndPromise.returnsPromise({
      data : {
        access_token : "big long access token"
      },
      response : {
        headers : {
          "set-cookie" : [
            "FILE_OAUTH_TOKEN"
          ]
        }
      }
    })

    self.promisingClient.makePromisingClient.returns(self.promisingClientInstance)

    self.i18n.t.returnsFirstArg()

    self.utils.stripProtocol.returnsFirstArg()

    self.endPointTransceiver = mockery.require("../endPointTransceiver")

    setTimeout(() => {
      done()
    }, 1)
  })

  afterEach(mockery.stopAll)

  function fakeSuccessfulLogin(defaultLocale = "en") {

    self.promisingClientInstance.getAndPromise.returnsPromise({
      data : {
        endpointMap : {
          listLocales : {
            method : "GET"
          },
          listOrderTypes : {
            method : "GET"
          },
          updateWidgetDescriptorJavascript : {
            method : "POST",
            url : "\/ccadminui\/v1\/widgetDescriptors\/{}\/javascript\/{}"
          },
          getElements : {
            method : "GET",
            url : "\/ccadminui\/v1\/elements"
          }
        },
        defaultLocale : {
          name : defaultLocale
        },
        items : [
          {
            name : "de"
          },
          {
            name : "en"
          },
          {
            name : "chinese",
            aliases : ["traditional chinese"]
          }
        ]
      },
      response : {
        headers : {
          "oraclecommercecloud-version" : "16.5"
        }
      }
    })
  }

  const dummyRequestBuilder = {
    build : () => {
      return "dummy request"
    }
  }

  it("should be able to set up a list of endpoints and then call one of them", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {

      // Make sure etag module was set up.
      expect(self.etags.setNodeName).toHaveBeenCalledWith("http//localhost9080")

      // Change getAndPromise to return different data.
      self.promisingClientInstance.getAndPromise.returnsPromise({
        order : {displayName : "Order"},
        response : {
          statusCode : 200
        }
      })

      expect(self.endPointTransceiver.serverSupports("listOrderTypes")).toEqual(true)

      self.endPointTransceiver.listOrderTypes().then(results => {
        expect(results.order.displayName).toEqual("Order")
        return self.endPointTransceiver.listOrderTypes("specialOrderType")
      }).then(results => {
        expect(results.order.displayName).toEqual("Order")
        done()
      })
    })
  })

  it("should be able to detect when you hit storefront by mistake", done => {

    self.promisingClientInstance.getAndPromise.returnsPromise({
      data : {
        endpointMap : {},
        defaultLocale : {
          name : "en"
        }
      },
      response : {
        headers : {}
      }
    })

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).catch(error => {
      expect(error).toEqual("notAdministrationInterface")
      done()
    })
  })

  it("should be able to do a direct get by full url", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {

      self.promisingClientInstance.getAndPromise.returnsPromise("js source")

      self.endPointTransceiver.get("http://localhost:9080/file/v5102134760245801134/widget/v2/quote-widget-multiple/js/quote-tester.js").then(results => {
        expect(results).toEqual("js source")
        done()
      })
    })
  })

  it("should be able to ensure that we want all resources for all locales", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, true).then(() => {
      expect(self.endPointTransceiver.locales.length).toEqual(3)
      expect(self.endPointTransceiver.locales[2].name).toEqual("chinese")
      done()
    })
  })

  it("should be able to specify a target locale", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, "de", false).then(() => {
      expect(self.endPointTransceiver.locales.length).toEqual(1)
      expect(self.i18n.init).toHaveBeenCalledWith("de")
      done()
    })
  })

  it("should be able to detect a non existent locale", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, "silly", false).catch(error => {
      expect(error.toString()).toEqual("Error: localeIsNotRecognized")
      done()
    })
  })

  it("should be able to support parameter substitution and use of requestBuilder", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {

      self.endPointTransceiver.updateWidgetDescriptorJavascript(["rep1234", "something.js"], dummyRequestBuilder).then(results => {
        expect(self.promisingClientInstance.postAndPromise).toHaveBeenCalledWith(
          "http://localhost:9080/ccadminui/v1/widgetDescriptors/rep1234/javascript/something.js", "dummy request", dummyRequestBuilder)
        done()
      })
    })
  })

  it("should be able to support query strings", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {
      self.endPointTransceiver.getElements("?globals=true", dummyRequestBuilder).tap(results => {
        expect(self.promisingClientInstance.getAndPromise).toHaveBeenCalledWith("http://localhost:9080/ccadminui/v1/elements?globals=true", "dummy request", dummyRequestBuilder)
        done()
      })
    })
  })

  it("should be able to support parameter substitution and query strings", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {
      self.endPointTransceiver.updateWidgetDescriptorJavascript(["rep4000", "rep4001"], "?globals=true", dummyRequestBuilder).tap(results => {
        expect(self.promisingClientInstance.postAndPromise).toHaveBeenCalledWith("http://localhost:9080/ccadminui/v1/widgetDescriptors/rep4000/javascript/rep4001?globals=true",
          'dummy request', dummyRequestBuilder)
        done()
      })
    })
  })

  it("should be able to support parameter substitution and query strings and a request builder", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {
      self.endPointTransceiver.updateWidgetDescriptorJavascript(["rep4000", "rep4001"], "?globals=true", dummyRequestBuilder).tap(results => {
        expect(self.promisingClientInstance.postAndPromise).toHaveBeenCalledWith(
          'http://localhost:9080/ccadminui/v1/widgetDescriptors/rep4000/javascript/rep4001?globals=true', 'dummy request', dummyRequestBuilder)
        done()
      })
    })
  })

  it("should support authentication by application key", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", "dummyApplicationId", null, false).then(() => {

      expect(self.endPointTransceiver.urlBase).toEqual("/ccadmin/v1/")

      expect(self.promisingClientInstance.postAndPromise).toHaveBeenCalledWith('http://localhost:9080/ccadmin/v1/login/',
        {
          data : 'grant_type=client_credentials',
          headers : {
            "Content-Type" : 'application/x-www-form-urlencoded; charset=UTF-8',
            Authorization : 'Bearer dummyApplicationId'
          }
        })
      done()
    })
  })

  it("should use the instance locale by default", done => {

    fakeSuccessfulLogin()

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {
      expect(self.endPointTransceiver.locales.length).toEqual(1)
      expect(self.i18n.init).toHaveBeenCalledWith("en")
      done()
    })
  })

  it("should support a partial match on the client OS locale", done => {

    self.utils.shortLocale.returns("en")

    fakeSuccessfulLogin("en_US")

    self.endPointTransceiver.init("http://localhost:9080", "admin", "admin", null, null, false).then(() => {
      expect(self.endPointTransceiver.locales.length).toEqual(1)
      expect(self.i18n.init).toHaveBeenCalledWith("en")
      done()
    })
  })

  it("should be able to interpret http responses", () => {

    expect(self.endPointTransceiver.checkCallSucceeded({ data: { } })).toEqual(true)
    expect(self.endPointTransceiver.checkCallSucceeded({ data: { errorCode : 999 } })).toEqual(false)
  })
})
