const dust = require('dustjs-linkedin')
require('dustjs-helpers')
const fs = require("fs")
const upath = require("upath")

const writeFile = require("./utils").writeFile

// Tell dust to preserve cr/nl and such.
dust.optimizers.format = (ctx, node) => node

/**
 * Load up the template, compile it and render it via the callback.
 * @param name
 * @param context
 * @param renderHandler
 */
function renderWithTemplate(name, context, renderHandler) {

  const src = fs.readFileSync(upath.resolve(__dirname, `${figureExamplePath(name)}.dust`), 'utf8')
  dust.loadSource(dust.compile(src, name))

  // Render it based on what the user wants to do.
  dust.render(name, context, renderHandler)
}

/**
 * Put the path handling logic in one place.
 * @param path
 * @returns {string}
 */
function figureExamplePath(path) {
  return `./examples/${path}`
}

/**
 * Given an output path, a set of user responses an a template name, render an example file.
 * @param outputPath
 * @param context
 * @param name
 */
function createFileFromTemplate(outputPath, context, name) {

  renderWithTemplate(name, context, (err, out) => writeFile(outputPath, out))
}

exports.createFileFromTemplate = createFileFromTemplate
exports.renderWithTemplate = renderWithTemplate
