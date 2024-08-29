import xmllint from "../xmllint.js"
import xml from "./xml.js"
import fs from "fs"
import { unbuffer, disallowSelect } from "../utils.js"

async function loadXSD(url, options) {
  const { logger, cache, timeout } = options

  // Get from cache if schema has been loaded and validated
  const found = await cache.get(url)
  if (found && found.metadata.valid) {
    return found.path
  }

  // Remember we process this url
  const includes = options.includes || (options.includes = new Set())
  includes.add(url)

  // Download otherwise
  logger.debug(`Loading XSD ${url}`)
  const {path, metadata} = await cache.fetch(url, { timeout })

  // Make sure schema is valid XSD
  const metaschema = await cache.get("http://www.w3.org/2009/XMLSchema/XMLSchema.xsd")
  const catalog = await cache.get("catalog.xml")
  await xmllint({ schema: metaschema.path, path, catalog: catalog.path })
    .catch((e) => {
      console.log(e);throw new Error(`Invalid XSD ${url}`)
    })

  // Rewrite external references to absolute URLs
  // Using regex is not best practice, we could use xpath in xmllint way, but slow.
  // This MAY break if the schema contains a comment that looks like an include.
  const refs = new Set()
  const xml = fs.readFileSync(path).toString()
  const pattern = /(\sschemaLocation\s*=\s*)"([^"]*)"/gm
  const rewritten = xml.replace(pattern, (match, attr, href) => {
    const absolute = new URL(href, url).href
    if (includes.has(absolute)) {
      logger.debug(`${url} => ${absolute} (skipped)`)
    } else {
      refs.add(absolute)
      logger.debug(`${url} => ${absolute}`)
    }
    return `${attr}"${absolute}"`
  })

  // Recursively load external references
  await Promise.all([...refs].map(href => loadXSD(href, options)))

  logger.debug(`Got valid XSD ${url}`)

  // Store rewritten schema, marked as valid
  await cache.put(url, rewritten, { ...metadata, valid: true })
  const stored = await cache.get(url)
  return stored.path
}

async function createValidator({ url, cache, logger, timeout }) {

  if (!url) {
    throw new Error("XSD validator requires url")
  }

  const schema = await loadXSD(url, { cache, logger, timeout })
    .catch(e => {
      console.error(e); throw e 
    })

  return (async (data, options) => {
    disallowSelect(options, "xsd")
    try {
      data = unbuffer(data)
      xml.parse(data)
    } catch(e) {
      return [[e]]
    }

    const catalog = await cache.get("catalog.xml")
    return xmllint({ schema, data, catalog: catalog.path })
      .then(() => [true])
      .catch(e => [[e]])
  })
}

export default {
  title: "XML Schema",
  short: "XSD",
  base: "xml",
  restricts: "xml",
  url: "https://www.w3.org/XML/Schema",
  description: "Most common schema language for XML",
  mimetypes: ["application/xml"],
  wikidata: "Q16342",
  versions: {
    1.1: {
      schemas: [
        {
          url: "http://www.w3.org/2009/XMLSchema/XMLSchema.xsd",
          type: "xsd",
        },/*, {
          url: "http://www.w3.org/2009/XMLSchema/XMLSchema.dtd",
          type: "dtd",
        },*/
      ],
    },
    "1.0": {
      schemas: [
        {
          url: "http://www.w3.org/2001/XMLSchema.xsd",
          type: "xsd",
        },/*,
        {
          url: "http://www.w3.org/2001/XMLSchema.dtd",
          type: "dtd",
        },*/
      ],
    },
  },
  createValidator,
}
