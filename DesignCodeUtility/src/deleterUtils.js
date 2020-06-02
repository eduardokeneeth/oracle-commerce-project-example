/**
 * Does all the requisite post-processing after an attempted delete.
 * @param path
 * @param results
 *  * @returns true if it went OK, false otherwise.
 */
function processDeleteResult(path, results) {
    if (results.response.statusCode < 200 ||  results.response.statusCode > 299) {
        return false;
    }

    return true
}

exports.processDeleteResult = processDeleteResult
