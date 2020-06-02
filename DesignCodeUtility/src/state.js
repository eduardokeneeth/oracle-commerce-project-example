let transferMode

/**
 * Set a system wide flag so modules can find out what we are up to.
 */
function inTransferMode(value) {
  if (value) {
    transferMode = value
  } else {
    return transferMode
  }
}

exports.inTransferMode = inTransferMode
