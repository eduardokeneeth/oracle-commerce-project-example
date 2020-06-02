/**
 * Use the BCP code from the aliases if there is one.
 * @param locale
 * @return {string}
 */
function getInitialMatchName(locale) {
  return locale.aliases ? locale.aliases[0] : locale.name
}

/**
 * Return true if we have fallback locale to try.
 * @param locale
 * @return {string[]|number}
 */
function hasFallBack(locale) {
  return locale.aliases && locale.aliases.length
}

/**
 * Get the second of the aliases.
 * @param locale
 * @return {string}
 */
function getFallBackName(locale) {
  return locale.aliases[1]
}

exports.getFallBackName = getFallBackName
exports.getInitialMatchName = getInitialMatchName
exports.hasFallBack = hasFallBack
