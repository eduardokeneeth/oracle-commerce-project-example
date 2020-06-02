const logError = require("./logger").logError
const logger = require("./logger")

/**
 * Add on some extra code to ensure that we return a non-zero exit code in the event of a serious error.
 *
 * @param promise a bluebird promise
 */
function addExitHandler(promise) {

  return promise.then(() => {

    // See if anything was bad passed to the logger.
    if (logger.hadSeriousError) {
      process.exit(1)
    }
  }).catch(error => {

    // Tell the user all is not well.
    logError(error.stack)

    // Set the return code so a caller can detect something went wrong.
    process.exit(1)
  })
}

/**
 * Called when someone calls us with bad command line options.
 * @param program
 */
function exitDueToInvalidCall(program) {

  // Display the usage string.
  program.outputHelp()

  // Set the return code so a caller can detect something went wrong.
  process.exit(1)
}

exports.addExitHandler = addExitHandler
exports.exitDueToInvalidCall = exitDueToInvalidCall
