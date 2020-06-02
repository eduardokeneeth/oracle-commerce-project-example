const Promise = require("bluebird")

const mockery = require('./mockery')

const realProcessExit = process.exit

describe("Exit Handler", () => {

  const self = this

  beforeEach(() => {

    mockery.use(jasmine.createSpy)

    process.exit = exitCode => {
      self.exitCode = exitCode
    }

    mockery.mockModules(self, '../logger')

    self.exitHandler = mockery.require("../exitHandler")
  })

  afterEach(() => {
    mockery.stopAll()
    process.exit = realProcessExit
    delete self.exitCode
  })

  it("should not set the exit code if everything is OK", done => {

    self.exitHandler.addExitHandler(Promise.method(() => null)()).then(() => {

      expect(self.exitCode).not.toEqual(1)
      done()
    })
  })

  it("should set the exit code if an exception is thrown", done => {

    self.exitHandler.addExitHandler(Promise.method(() => {
      throw "Boom"
    })()).then(() => {

      expect(self.exitCode).toEqual(1)
      done()
    })
  })

  it("should exit out if the logger got an error", done => {

    self.logger.hadSeriousError = true

    self.exitHandler.addExitHandler(Promise.method(() => null)()).then(() => {

      expect(self.exitCode).toEqual(1)
      done()
    })
  })

  it("should set the exit code if the program was called wrong", () => {

    const program = {
      outputHelp : jasmine.createSpy("outputHelp")
    }

    self.exitHandler.exitDueToInvalidCall(program)

    expect(self.exitCode).toEqual(1)
    expect(program.outputHelp).toHaveBeenCalled()
  })
})
