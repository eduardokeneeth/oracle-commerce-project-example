"use strict"

const decodeEtag = require("./etags").decodeEtag
const endPointTransceiver = require("./endPointTransceiver")
const writeEtag = require("./etags").writeEtag
const writeFile = require("./utils").writeFile

/**
 * Call the supplied endpoint passing the supplied id, then copy the contents of the supplied field in the results
 * to the supplied path. (This is just a function to reduce boilerplate).
 * Optionally, a match value and replacement value can be supplied to transform the contents.
 * @param endpoint
 * @param id
 * @param field
 * @param path
 * @param matchValue
 * @param replacementValue
 */
function copyFieldContentsToFile(endpoint, id, field, path, matchValue, replacementValue) {

  return endPointTransceiver[endpoint]([id]).tap(results => {

    let fieldVal = results.data[field]

    if (fieldVal === undefined || fieldVal === null) {
      fieldVal = ""
    }

    // See if we need to mess with the contents before we write to disk.
    const contents = (matchValue && replacementValue)
      ? fieldVal.replace(matchValue, replacementValue)
      : fieldVal

    writeFileAndETag(path, contents, results.response.headers.etag)
  })
}

/**
 * Call the supplied endpoint passing the supplied id, then copy the contents of the supplied field in the results
 * to the supplied path as a JSON file. (This is just a function to reduce boilerplate).
 * Optionally, a match value and replacement value can be supplied to transform the contents.
 *
 * @param endpoint
 * @param id
 * @param field
 * @param path
 * @param matchValue
 * @param replacementValue
 */
function copyJsonFieldContentsToFile(endpoint, id, field, path, matchValue, replacementValue) {

  return endPointTransceiver[endpoint]([id]).tap(results => {

    // See if there is something worth writing out first.
    if (results.data[field]) {

      const fieldVal = JSON.stringify(results.data[field], null, 2);

      // See if we need to mess with the contents before we write to disk.
      const contents = (matchValue && replacementValue)
        ? fieldVal.replace(matchValue, replacementValue)
        : fieldVal

      writeFileAndETag(path, contents, results.response.headers.etag)
    }
  })
}

/**
 * Write the contents to the supplied path and store its etag value in the tracking directory for
 * further use.
 * @param path
 * @param contents
 * @param etag
 */
function writeFileAndETag(path, contents, etag) {

  // Write the file contents out.
  writeFile(path, contents)

  // At the same time write out the etag - if available.
  etag && writeEtag(path, etag)
}

exports.copyFieldContentsToFile = copyFieldContentsToFile
exports.copyJsonFieldContentsToFile = copyJsonFieldContentsToFile
exports.writeFileAndETag = writeFileAndETag
