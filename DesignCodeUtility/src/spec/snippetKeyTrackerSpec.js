"use strict"

const mockery = require("./mockery")

describe("Snippet Key Tracker", () => {

  const self = this

  beforeEach(done => {
    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, "../utils", "../metadata", "../logger")

    self.snippetKeyTracker = mockery.require("../snippetKeyTracker")

    setTimeout(() => {
      done()
    }, 1)
  })

  afterEach(mockery.stopAll)

  it("should update metadata at grab time for Oracle supplied widget instances", () => {

    self.snippetKeyTracker.saveTrackingInformation("widgetInstanceDir",
      {
        descriptor: {
          source: 66
        }
      },
      ["a", "b", "c"])

    // Verify calls made
    expect(self.metadata.updateMetadata).toHaveBeenCalledWith('widgetInstanceDir', 'widgetInstance.json', {
      snippetKeyCount: 3,
      source: 66
    })
  })

  it("should validate snippet key counts at put time for instances of Oracle supplied widgets", () => {

    self.metadata.readMetadataFromDisk.returns({
      source: 100,
      snippetKeyCount: 1
    })

    self.snippetKeyTracker.checkForSnippetKeyMismatch("element instance snippets path",
      {
        instance: {
          repositoryId: "instanceRepositoryId"
        }
      },
      {
        "a": "x",
        "b": "y",
        "c": "z"
      })

    expect(self.logger.warn).toHaveBeenCalledWith("widgetInstanceSnippetKeyCountMismatch",
      {
        path: 'element instance snippets path',
        expectedKeyCount: 1,
        actualKeyCount: 3
      })

    self.metadata.readMetadataFromDisk.calls.reset()

    self.snippetKeyTracker.checkForSnippetKeyMismatch("element instance snippets path",
      {
        instance: {
          repositoryId: "instanceRepositoryId"
        }
      },
      {
        "a": "x",
        "b": "y",
        "c": "z"
      })

    expect(self.logger.warn).toHaveBeenCalledWith("widgetInstanceSnippetKeyCountMismatch",
      {
        path: 'element instance snippets path',
        expectedKeyCount: 1,
        actualKeyCount: 3
      })

    expect(self.metadata.readMetadataFromDisk).not.toHaveBeenCalled() // Info should have been cached after first call.
  })

  it("should validate snippet key counts at put time for instances of user created widgets", () => {

    self.metadata.readMetadataFromDisk.returns({
      source: 101,
      snippetKeyCount: 1
    })

    self.utils.normalize.returnsFirstArg()

    self.utils.readJsonFile.returns(
      {
        resources: {
          "yo": "ho"
        }
      })

    self.snippetKeyTracker.checkForSnippetKeyMismatch("widget/Incomplete/instances/Incomplete Instance/locales/el/ns.incomplete.json",
      {
        instance: {
          repositoryId: "instanceRepositoryId"
        }
      },
      {
        "a": "x",
        "b": "y",
        "c": "z"
      })

    expect(self.logger.warn).toHaveBeenCalledWith("widgetInstanceSnippetKeyCountMismatch",
      {
        path: 'widget/Incomplete/instances/Incomplete Instance/locales/el/ns.incomplete.json',
        expectedKeyCount: 1,
        actualKeyCount: 3
      })

    self.metadata.readMetadataFromDisk.calls.reset()

    self.snippetKeyTracker.checkForSnippetKeyMismatch("element instance snippets path",
      {
        instance: {
          repositoryId: "instanceRepositoryId"
        }
      },
      {
        "a": "x",
        "b": "y",
        "c": "z"
      })

    expect(self.logger.warn).toHaveBeenCalledWith("widgetInstanceSnippetKeyCountMismatch",
      {
        path: 'element instance snippets path',
        expectedKeyCount: 1,
        actualKeyCount: 3
      })

    expect(self.metadata.readMetadataFromDisk).not.toHaveBeenCalled() // Info should have been cached after first call.
  })
})
