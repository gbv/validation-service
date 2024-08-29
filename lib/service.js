import { schemaFormat } from "./formats.js"
import { ValidationError } from "./errors.js"
import createLogger from "./logger.js"
import { unbuffer, asArray, addToArray, disallowSelect } from "./utils.js"
import { NotFound } from "./errors.js"
import Cache from "./cache.js"
import { Transform } from "stream"
import fs from "fs"
import tmp from "tmp"
tmp.setGracefulCleanup()

import path from "path"
const __dirname = new URL(".", import.meta.url).pathname

// Asynchronous validation of one record
function validFunction(validateAll) {
  return (data => validateAll(data)
    .then(([errors]) => {
      if (errors === true) {
        return data
      } else {
        throw new ValidationError({ errors })
      }
    }))
}

async function addValidators(format, service) {
  const { id } = format
  const { cache, logger, timeout, allErrors } = service

  // Format defined by validator function
  if (format.validateAllSync) {
    format.validateAll = async (data, options) => format.validateAllSync(data, options)
  }

  // Format defined by schema(s)
  if (format.versions) {
    await Promise.all(
      Object.entries(format.versions)
        .map(async ([ version, { schemas } ]) => {
          if (!schemas) {
            return
          }

          await Promise.all(schemas.map(async schema => {
            const { type, url, value } = schema

            // TODO: load SchemaFormat for schema type

            const { createValidator, restricts } = schemaFormat[type] || {}
            if (!createValidator) {
              logger.warn(`Skipping schema of unknown language ${type} in ${id}@${version}`)
              return
            }

            if (!format.base) {
              // TODO: merge with existing base
              format.base = restricts
            }

            schema.validateAll = await createValidator({ url, value, cache, logger, timeout, allErrors })
              .catch(e => {
                logger.warn(`Failed to create ${type} validator for ${id}@${version}`)
                logger.debug(e)
                return
              })
            schema.valid = validFunction(schema.validateAll)

            return schema
          }))
          schemas = schemas.filter(s => s.validateAll)

          if (!schemas.length) {
            return
          }

          return [version, { schemas }]
        }))
      .then(versions => {
        versions = Object.fromEntries(versions.filter(Boolean))
        const versionIds = Object.keys(versions)
        if (versionIds.length) {
          if (!format.ValidateAll) {
            const defaultVersion = versionIds.sort().reverse()[0]
            format.validateAll = versions[defaultVersion].schemas[0].validateAll
          }
          format.versions = versions
        } else {
          delete format.versions
        }
      })
  }

  // Format defined by parser function
  if (!format.validateAll && format.parse) {
    format.validateAll = async (data, options) => {
      disallowSelect(options, id)
      try {
        format.parse(unbuffer(data))
        return [true]
      } catch(e) {
        return [[e]]
      }
    }
  }

  if (!format.validateAll) {
    logger.warn(`Skipping format ${id} in lack of validation methods`)
    return
  }

  // Asynchronous validation of one record
  format.valid = validFunction(format.validateAll)

  // Validate stream of records (TODO: no support of version yet)
  format.validateStream = new Transform({
    objectMode: true,
    transform(data, encoding, done) {
      format.validateAll(data).then(result => done(null, result[0]))
    },
  })

  return format
}

class ValidationService {

  constructor(config) {
    for (let key of ["title", "version", "description", "cache", "timeout", "allErrors"]) {
      this[key] = config[key]
    }

    this.formats = {}
    this.logger = config.logger || createLogger({level:"error"})
  }

  async addFormat(format) {
    const service = this
    // TODO: dynamically import if given by known format.id
    /*if (format.id === "isbn") {
      format = await import("./format/isbn.js")
    }*/
    return addValidators(format, this)
      .then(format => {
        if (format) {
          // TODO: automatically derive base from schema type
          service.formats[format.id] = format
        }
      })
  }

  getFormat(format, query={}) {
    if (!format) {
      return
    }
    query.format = format
    if (!query.version) {
      query.version = "default"
    }
    return this.listFormats(query)[0]
  }

  listFormats(query={}) {
    return Object.values(this.formats)
      // optionally select by format identifier
      .filter(format => format.id === query.format || !query.format)
      // filter (by) versions
      .map(({versions, ...format}) => {
        var whichVersion = query.version

        if (whichVersion === "default") {
          if (versions) {
            whichVersion = Object.keys(versions).sort().reverse()[0]
          } else {
            whichVersion = null
          }
        }

        var { validateAll, valid } = format

        if (versions && whichVersion) {
          if (whichVersion in versions) {
            versions = { [whichVersion]: versions[whichVersion] }
            validateAll = versions[whichVersion].schemas[0].validateAll
            valid = versions[whichVersion].schemas[0].valid
          } else {
            return
          }
        }

        if (!versions) {
          return format
        }

        // TODO: optionally filter by schema type

        return { ...format, versions, validateAll, valid }
      })
      .filter(Boolean)
      .sort((a, b) => a.id > b.id ? 1 : -1)
  }

  listLanguages(query) {
    return this.listFormats(query)
      .filter(format => format.createValidator)
  }

  guessFromContentType(type) {
    if (!type) {
      return
    }
    if (type.match(/application\/json/)) {
      return "json"
    }
    if (type.match(/[/+]xml/)) {
      return "xml"
    }
    // ...
  }

  // only used internally
  async promiseSchema(format) {
    const versions = Object.values(format.versions || {}).filter(v => v.schemas)
    if (versions.length) {
      const schema = versions[0].schemas[0]
      if (schema.url) {
        const file = await this.cache.get(schema.url)
        if (!file) {
          throw new NotFound("Schema file not found")
        }
        return { ...schema, file }
      } else {
        return schema
      }
    } else {
      throw new NotFound(`Format ${format.id} has no schemas`)
    }
  }

  // only used internally so far
  getEncoding(encoding, format) {
    const encodingFormat = this.getFormat(encoding)
    if (!encodingFormat || !encodingFormat.encodes) {
      throw new NotFound(`Encoding not found: ${encoding}`)
    }

    if (this._canEncode(encodingFormat, format)) {
      return encodingFormat
    } else {
      throw new NotFound(`Encoding not found: ${format} as ${encoding}`)
    }
  }

  _canEncode(encoding, formatId) {
    const format = this.getFormat(formatId)
    if (encoding.encodes && format && format.base) {
      const encodes = asArray(encoding.encodes)
      for (let base of asArray(format.base)) {
        if (encodes.indexOf(base) >= 0) {
          return true
        } else {
          return this._canEncode(encoding, base)
        }
      }
    }
  }
}

const createService = async config => {

  // initialize cache
  const cachePath = config.cache || tmp.dirSync().name
  const cache = new Cache(cachePath)

  // these meta-schemas are required to validate schemas
  const schemaFiles = {
    "https://format.gbv.de/validate/format-schema.json": "../public/format-schema.json",
    "https://format.gbv.de/validate/config-schema.json": "../public/config-schema.json",
    "https://json-schema.org/draft-07/schema": "./schemas/json-schema-draft-07.json",
    "https://json-schema.org/draft-06/schema": "./schemas/json-schema-draft-06.json",
    "https://json-schema.org/draft-04/schema": "./schemas/json-schema-draft-04.json",
    "http://www.w3.org/2001/xml.xsd": "./schemas/xml.xsd",
    "http://www.w3.org/2009/01/xml.xsd": "./schemas/xml.xsd",
    "http://www.w3.org/2009/XMLSchema/XMLSchema.xsd": "./schemas/xml-schema-2009.xsd",
    "http://www.w3.org/2001/XMLSchema.xsd": "./schemas/xml-schema-2001.xsd",
  }

  const readFile = file => fs.promises.readFile(path.resolve(__dirname, file))
  await Promise.all(
    Object.entries(schemaFiles)
      .map(async ([uri, file]) => cache.put(uri, await readFile(file), { valid: true })))

  const service = new ValidationService({ ...config, cache })

  await Promise.all(
    Object.entries(config.formats)
      .map(([id, format]) => ({...format, id})) // override format.id
      .map(format => service.addFormat(format)))

  for (let {id, base, encodes} of service.listFormats()) {
    for (let profiles of asArray(base || [])) {
      if (profiles in service.formats) {
        addToArray(service.formats[profiles], "profiles", id)
      }
    }
    for (let encodedBy of asArray(encodes || [])) {
      if (encodedBy in service.formats) {
        addToArray(service.formats[encodedBy], "encodings", id)
      }
    }
  }

  cache.files().then(files => config.logger.info(`Cache ${cachePath} contains ${files.length} entries`))

  return service
}

export default createService
