import fs from "fs"
import os from "os"
import path from "path"
import getStdin from "get-stdin"

import { unbuffer } from "./utils.js"
import createService from "./service.js"
import { loadConfig } from "./config.js"
import createLogger from "./logger.js"

import meow from "meow"

const defaultConfig = path.resolve(process.env.XDG_CONFIG_HOME
  || `${os.homedir()}/.config`,"validate.json")

export default async function(argv, log) {
  const cli = meow(`
Usage
  $ validate [<format> [<files>...]]

Options
  --help, -h            Show this help
  --config, -c FILE     Set configuration file (${defaultConfig})
  --formats, -f FILE    Set formats file
  --select, -s QUERY    Validate records within the data (e.g. $.* in json)
  --encoding, -e FORMAT Parse in another encoding format (e.g. yaml)
  --schema, -m          Return schema file
  --verbosity, -v LEVEL Set log level (debug, info, warn, error=default, silent)
  --list, -l            List configured formats

Examples
  $ validate json-schema schema.json
  $ echo {} | validate json
  $ validate -c config.json json < input.json
  $ validate -m json-schema@draft-07
`, {
    importMeta: import.meta,
    argv,
    pkg: {
      description: "Validate data in several formats",
    },
    flags: {
      help: {
        type: "boolean",
        alias: "h",
      },
      formats: {
        type: "string",
        alias: "f",
      },
      config: {
        type: "string",
        alias: "c",
      },
      select: {
        type: "string",
        alias: "s",
      },
      verbosity: {
        type: "string",
        alias: "v",
        default: "error",
      },
      list: {
        type: "boolean",
        alias: "l",
      },
      schema: {
        type: "boolean",
        alias: "m",
      },
      encoding: {
        type: "string",
        alias: "e",
      },
    },
  })

  const { flags, input } = cli

  // c8 ignore next 4
  if (flags.help) {
    cli.showHelp(0)
    return
  }

  var logger
  if (flags.verbosity.match(/^(silent|error|warn|info|debug)$/)) {
    logger = createLogger({ level: flags.verbosity })
  } else {
    throw new Error("Invalid verbosity level")
  }

  const configFile = flags.config ? path.resolve(flags.config, "./") :
    (fs.existsSync(defaultConfig) ? defaultConfig : null)
  const config = loadConfig(configFile, logger)

  // TODO: filter config.formats because compiling each schema takes time
  const service = await createService(config)

  if (flags.list) {
    const formats = service.listFormats()
    formats.forEach(f => log(f.id))
    return
  }

  if (!input.length) {
    throw new Error("Missing first argument <format>")
  }

  if (input.length < 2) {
    input.push("-")
  }

  if (flags.formats) {
    throw new Error("--formats not supported yet")
  }

  const formatName = input.shift()
  const [ formatId, version ] = formatName.split("@")

  const format = service.getFormat(formatId, { version })
  if (!format) {
    throw new Error(`Format not found: ${formatName}`)
  }

  // TODO: auto-detect encoding from filename extension
  const encoding = (flags.encoding||"").toLowerCase()
  const encodingFormat = encoding ? service.getEncoding(encoding, formatId) : null
  if (encoding === "ndjson" || encoding === "yaml") {
    // TODO: what if select is already set?
    flags.select = flags.select ?? "$.*"
  }

  if (flags.schema) {
    const schema = await service.promiseSchema(format)
    if (schema.value) {
      log(schema.value)
    } else {
      log(fs.readFileSync(schema.file.path).toString())
    }
    return
  }

  var errors = 0
  const showResult = result => {
    result.forEach(result => {
      log(JSON.stringify(result))
      if (result !== true) {
        errors++
      }
    })
  }

  for (let file of input) {
    const source = (file === "-" ? getStdin() : fs.promises.readFile(file))

    await source.then(data => unbuffer(data)).then(async data => {
      if (encodingFormat) {
        try {
          data = encodingFormat.parse(data)
        } catch(e) {
          console.log(JSON.stringify([e]))
          return
        }
      }
      const { select } = flags
      return format.validateAll(data, { select }).then(showResult)
    })
  }

  return errors ? 1 : 0
}
