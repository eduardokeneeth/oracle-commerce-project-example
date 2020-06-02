/**
 * Boilerplate for creating out own matchers.
 * @param actual
 * @param expected
 * @param util
 * @param customEqualityTesters
 */
function match(actual, expected, util, customEqualityTesters) {

  const pass = util.equals(actual, expected, customEqualityTesters)

  return {
    pass,
    message: pass ?
      `${actual} was called with ${prettify(expected)}` :
      `${actual} called with ${prettify(actual)} not ${prettify(expected)}`
  }
}

/**
 * Make the object look nice.
 * @param object
 */
function prettify(object) {
  return JSON.stringify(object, null, 2)
}

/**
 * Endpoints can be called with various numbers arguments.
 * @param args
 * @returns {number}
 */
function getRequestBuilderIndex(args) {
  return args.length > 2 ? 2 : 1
}

const customMatchers = {

  /**
   * This is for the case where we want to see what substitution values got passed in the URL.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  urlKeysWere: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        return match(actual.calls.mostRecent().args[0], expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see what JSON field was used for the payload.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  fieldWas: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        const args = actual.calls.mostRecent().args
        return match(args[getRequestBuilderIndex(args)].field, expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see what file path was used for the payload.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  pathWas: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        const args = actual.calls.mostRecent().args
        return match(args[getRequestBuilderIndex(args)].path, expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see what etag was used for the payload.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  etagWas: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        const args = actual.calls.mostRecent().args
        return match(args[getRequestBuilderIndex(args)].etag, expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see what the body was in the payload.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  bodyWas: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        const args = actual.calls.mostRecent().args
        return match(args[getRequestBuilderIndex(args)].body, expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see what the locale was in the payload.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  localeWas: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        const args = actual.calls.mostRecent().args
        return match(args[getRequestBuilderIndex(args)].locale, expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see what the locale was in the payload.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  queryStringWas: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected) => {
        return match(actual.calls.mostRecent().args[1], expected, util, customEqualityTesters)
      }
    }
  },

  /**
   * This is for when we need to look inside request builder to see if the payload was JSON.
   * @param util
   * @param customEqualityTesters
   * @returns {{compare: (function(*, *=))}}
   */
  wasJsony: (util, customEqualityTesters) => {

    return {

      compare: (actual, expected = true) => {
        const args = actual.calls.mostRecent().args
        return match(args[getRequestBuilderIndex(args)].json, expected, util, customEqualityTesters)
      }
    }
  }
}

/**
 * Add in custom `matchers` to make the tests less noisy.
 */
exports.add = function (jasmine) {
  jasmine.addMatchers(customMatchers)
}
