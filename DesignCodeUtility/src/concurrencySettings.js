"use strict"

const autoFix = require('./putterUtils').autoFix

/**
 * Used to centrally control the default level of concurrency on grabs.
 */
exports.getGrabbingConcurrency = concurrency => {

  if (!concurrency && process.env.CC_GRAB_CONCURRENCY) {

    concurrency = parseInt(process.env.CC_GRAB_CONCURRENCY, 10)

  } else {
    !concurrency && (concurrency = 7)
  }

  return {concurrency}
}

/**
 * Used to centrally control the default level of concurrency on puts and transfers.
 */
exports.getPuttingConcurrency = concurrency => {

  if (autoFix()) {

    // If we've enabled auto-fix in a putting context, we need to take things slow.
    concurrency = 1

  } else if (!concurrency && process.env.CC_PUT_CONCURRENCY) {

    concurrency = parseInt(process.env.CC_PUT_CONCURRENCY, 10)

  } else {
    !concurrency && (concurrency = 20)
  }

  return {concurrency}
}

/**
 * This setting ensures that element templates are sent to the server one by one.
 * This is because older versions of CC had concurrency issues with element template updates.
 * It is safe to increase this number (has been tested up to 20) if the CC instance has this bug fix.
 */
exports.ELEMENT_TEMPLATE_SAFE_LIMIT = 1

/**
 * We limit widget less updates as these usually kick off theme compilation which can swamp the server.
 * It would be safe to increase this number a little if theme compilation is not being used but theme
 * compilation suppression (-N) is a very recent change.
 *
 * Could do something like:
 *
 * const shouldSuppressThemeCompile = require('./putterUtils').shouldSuppressThemeCompile
 * exports.WIDGET_LESS_SAFE_LIMIT = shouldSuppressThemeCompile() ? 4 : 1
 */
exports.WIDGET_LESS_SAFE_LIMIT = 1

/**
 * This setting ensures that stack base files are sent to the server one by one.
 * This is because older versions of CC had concurrency issues with base stack file updates.
 * It is safe to increase this number (has been tested up to 20) if the CC instance has this bug fix.
 */
exports.STACK_BASE_SAFE_LIMIT = 1
