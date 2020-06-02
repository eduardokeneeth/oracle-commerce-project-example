
const constants = require("./constants").constants
const endPointTransceiver = require("./endPointTransceiver")
const grabGlobalElements = require("./globalElementGrabber").grabGlobalElements
const grabWidgetElements = require("./widgetElementGrabber").grabWidgetElements
const makeTrackedDirectory = require("./utils").makeTrackedDirectory
const warn = require("./logger").warn

/**
 * Note that there are two types of elements - those that live under widgets and those that are global and standalone.
 * Currently, even though you can edit the JS for elements uploaded via an Extension, the JS for an element will not be
 * editable here unless one of their parent widgets has editable JS.
 *
 * Note that we are assuming here that widgets have already been grabbed in previous step.
 * @returns A BlueBird promise
 */
function grabAllElements(includeWidgetElements = true) {

  // Create a directory for global elements.
  makeTrackedDirectory(constants.elementsDir)

  // The endpoints we need to manipulate elements were added fairly recently so let's not assume they are there.
  if (endPointTransceiver.serverSupports("getFragmentTemplate", "getFragmentJavaScript")) {

    // Try to get any global elements first.
    return grabGlobalElements().then(results => {

      // In some cases, the user may only want global elements.
      if (includeWidgetElements) {
        return grabWidgetElements()
      }
    })
  } else {
    warn("elementsCannotBeGrabbed")
  }
}

exports.grabAllElements = grabAllElements
