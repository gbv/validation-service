import chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
const { expect } = chai

import path from "path"
import fs from "fs"
const __dirname = new URL(".", import.meta.url).pathname

const file = name => path.resolve(__dirname, name)
const readFile = path => fs.readFileSync(file(path))
const jsonFile = path => JSON.parse(readFile(path))

// format identifiers from test configuration
const formatIds = [
  "about/data",
  "array",
  "digits",
  "isbn",
  "jskos",
  "json",
  "json-schema",
  "myxml",
  "ndjson",
  "ntriples",
  "regexp",
  "turtle",
  "w3c-ebnf",
  "xml",
  "xsd",
  "yaml",
]

// Mock HTTP responses
import moxios from "moxios"
moxios.install()
moxios.stubRequest("http://example.org/schema.xsd", { headers: {}, responseText: readFile("files/schema.xsd") })
moxios.stubRequest("http://example.org/include.xsd", { headers: {}, responseText: readFile("files/include.xsd") })

export { chai, expect, file, readFile, jsonFile, formatIds, moxios }
