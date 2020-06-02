const mockery = require('./mockery')

/**
 * Boilerplate to create a mock version of commander.
 * We can't use the real one as it will try to parse the command line options passed to jasmine.
 * @param jasmine
 * @returns a thing that looks like a commander but isn't...
 */
function mockCommander(jasmine) {

  const commander = mockery.require('commander')

  commander.version = jasmine.createSpy("version").and.callFake(() => commander)
  commander.option = jasmine.createSpy("option").and.callFake(() => commander)
  commander.parse = jasmine.createSpy("parse").and.callFake(() => commander)
  commander.node = "http://somehost:8090"
  commander.clean = false
  commander.username = "admin"
  commander.password = "admin"
  commander.help = jasmine.createSpy("help")

  return commander
}

exports.mockCommander = mockCommander
