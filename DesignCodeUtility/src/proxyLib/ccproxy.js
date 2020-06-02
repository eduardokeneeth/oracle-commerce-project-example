"use strict"

const constants     = require('../constants').constants
const info          = require('../logger').info
const logDebug      = require('../logger').logDebug
const glob          = require("glob")
const buildDataMaps = require('./datamaps').buildDataMaps


const path    = require('path')
const process = require('process')
const url     = require('url')
const hoxy    = require('hoxy')
const pem     = require('pem')

/**
 * Look for substitution rule handlers in a given directory (default "./rules/")
 * and load any modules that satisfy the criteria for a proxy handler.
 * i.e. Have a rule definition and a function(req,resp) to perform the work.
 *
 * @param proxy Internal Proxy Daemon
 * @param dir Directory to walk for rule modules
 * @param node CC Node we're hitting
 * @param handlers List of handler names to register
 */
function registerHandlers (proxy, dir, node, handlers) {
  glob.sync(`${dir}/**/*.rule.js`).forEach(file => {
    let module = require(file)

    const urls = []
    if (module.rule && module.handler && handlers.indexOf(module.name) >= 0) {

      // Do node Url substitution.
      if (module.rule.fullUrl) {
        const uri = module.rule.fullUrl.replace("__NODE__", node)
        module.rule.fullUrl = uri

        if (!urls.includes(uri)) {

          // For Every response handler we want to intercept, we also need to
          // register a request handler whose only job is to disable cache for the
          // GET request. We can only do this if we know the url. (Virtually all
          // interceptor rules should be acting on a fullUrl field anyway.)
          const requestRule = {
            method: 'GET',
            phase: 'request',
            fullUrl: uri,
          }

          proxy.intercept(requestRule, function (req, resp) {
            const d = new Date()
            const q_char = req.url.includes("?") ? "&" : "?"
            req.url += q_char + 'dnc=' + d.getTime()
          })

          urls.push(uri)
        }
      }

      info("proxyRegisterHandlerText", {name: module.name, doc: module.doc})
      logDebug(JSON.stringify(module.rule, null, 2) + "\n")

      proxy.intercept(module.rule, function (req, resp) {
        // Doctor max-age and cache-control here...
        resp.headers['cache-control'] = 'no-store, no-cache, must-revalidate'

        module.handler(req, resp)
      })
    }
  })
}

function printHandlerInfo (dir, node) {
  glob.sync(`${dir}/**/*.rule.js`).forEach(file => {
    let module = require(file)

    if (module.rule && module.handler) {

      // Do node Url substitution.
      if (module.rule.fullUrl)
        module.rule.fullUrl = module.rule.fullUrl.replace("__NODE__", node)

      info("proxyFoundHandlerText", {name: module.name, doc:module.doc})
      logDebug(JSON.stringify(module.rule, null, 2) + "\n")
    }
  })
}

function getHandlerNames(dir) {
  const list = []

  glob.sync(`${dir}/**/*.rule.js`).forEach(file => {
    let module = require(file)

    if (module.rule && module.handler) {
      list.push(module.name)
    }
  })

  return list
}

function getHandlers () {
  return getHandlerNames(path.join(__dirname, "rules"))
  .concat(getHandlerNames(path.join(process.cwd(), constants.trackingDir, "rules")))
}

exports.getHandlers = getHandlers

exports.listHandlers = function (node) {
  printHandlerInfo(path.join(__dirname, "rules"), node)
  printHandlerInfo(path.join(process.cwd(), constants.trackingDir, "rules"), node)
  process.exit(0)
}

/**
 * Start the Cloud Developer Proxy and register a set of rules to
 * intercept requests to the current node and replace /file/ requests to
 * equivalent local versions stored under basePath.
 */
exports.startProxyDaemon = function (node, port, refreshCerts, handlers) {
  handlers = handlers || getHandlers()
  // Build maps of Widget/Element resources to filesystem paths.
  buildDataMaps()


  pem.createCertificate({days:1, selfSigned: true}, (err, keys) => {

    if (err) {
      throw err
    }

    const options = {
      certAuthority: {
        key: keys.serviceKey,
        cert: keys.certificate
      }
    }

    process.on('uncaughtException', function (err) {
      console.log("Internal error:\n", err)
    })

    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0
    const proxy = hoxy.createServer(options)

    proxy.on('error', function (err) {
      console.log("Internal Error:\n", err)
    })

    proxy.log('error warn debug', process.stderr)
    proxy.log('info', process.stdout)

    proxy.listen(port, function () {
      info('proxyListeningMessage', {node, port})
    })

    registerHandlers(proxy, path.join(__dirname, "rules"), node, handlers)
    registerHandlers(proxy, path.join(process.cwd(), constants.trackingDir, "rules"), node, handlers)
  })
}
