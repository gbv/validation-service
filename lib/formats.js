import isbn from "./format/isbn.js"
import jskos from "./format/jskos.js" // FIXME: this is slow
import json from "./format/json.js"
import ndjson from "./format/ndjson.js"
import xml from "./format/xml.js"
import yaml from "./format/yaml.js"
import { ntriples, turtle } from "./format/rdf.js"
import w3cebnf from "./format/w3c-ebnf.js"

// Schema languages
import jsonSchema from "./format/json-schema.js" // FIXME: this is slow
import xsd from "./format/xsd.js"
import regexp from "./format/regexp.js"

export const knownFormats = {
  "about/data": {
    title: "Data About Data Formats",
    description: "Data format to describe data formats, versions and schemas",
    base: "json",
    // TODO: validate using compiled schema?
    versions: {
      default: {
        schemas: [ {
          type: "json-schema",
          url: "https://format.gbv.de/validate/format-schema.json",
        } ],
      },
    },
  },
  isbn,
  jskos,
  json,
  "json-schema": jsonSchema,
  ndjson,
  ntriples,
  regexp,
  turtle,
  "w3c-ebnf": w3cebnf,
  xml,
  xsd,
  yaml,
}

// TODO: these should be registered
// registerSchemaLanguage
export const schemaFormat = {
  "json-schema": jsonSchema,
  regexp,
  xsd,
  "w3c-ebnf": w3cebnf,
}

