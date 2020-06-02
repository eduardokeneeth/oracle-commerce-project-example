const mockery = require('./mockery')

describe("Element Sorter", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../metadata')

    self.elementSorter = mockery.require("../elementSorter")

    self.metadata.readMetadataFromDisk.and.callFake(path => ({ type : path.split("/")[1] }))
  })

  afterEach(mockery.stopAll)

  it("should be able to compare element directories", () => {

    expect(self.elementSorter.compareElements("element/subFragment", "element/subFragment")).toBe(0)
    expect(self.elementSorter.compareElements("element/subFragment", "element/dynamicFragment")).toBe(0)
    expect(self.elementSorter.compareElements("element/subFragment", "element/staticFragment")).toBe(0)

    expect(self.elementSorter.compareElements("element/hidden", "element/container")).toBe(0)

    expect(self.elementSorter.compareElements("element/fragment", "element/staticFragment")).toBe(2)

    expect(self.elementSorter.compareElements("element/dynamicFragment", "element/container")).toBe(-1)
  })
})
