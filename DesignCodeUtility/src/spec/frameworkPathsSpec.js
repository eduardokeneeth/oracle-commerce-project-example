const mockery = require('./mockery')

describe("Framework Paths", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    mockery.mockModules(self, '../utils')

    self.frameworkPaths = mockery.require("../frameworkPaths")
  })

  afterEach(mockery.stopAll)

  it("should let get various flavours of paths", () => {

    self.utils.splitFromBaseDir.returns(["", "static/my"])

    expect(self.frameworkPaths.getBaseVfsPath()).toBe("static")
    expect(self.frameworkPaths.toOutputDir("my/silly.js")).toBe("static/my/silly.js")
    expect(self.frameworkPaths.toVfsDir("static/my/silly.js")).toBe("static/my")
    expect(self.frameworkPaths.toVfsPath("static/my/silly.js")).toBe("static/my/silly.js")
  })
})
