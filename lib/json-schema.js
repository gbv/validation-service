const fs = require("fs")
const Ajv = require("ajv")
const ajv = new Ajv({
  addUsedSchema: false,
  allowUnionTypes: true,
  strictSchema: false, // allow unknown keywords, required for some draft-04 schemas
})

// add formats
require("ajv-formats")(ajv)
require("ajv-formats-draft2019")(ajv) // iri, iri-reference, idn-email, idn-hostname

// support draft-06 as well
const draft6MetaSchema = require("ajv/dist/refs/json-schema-draft-06.json")
ajv.addMetaSchema(draft6MetaSchema)

const migrateSchema = require("json-schema-migrate")

const { ValidationError } = require("./errors.js")

// Compiles a JSON Schema file into a validator function.
// May throw an error
module.exports = file => {
  var schema = JSON.parse(fs.readFileSync(file))

  const version = schema["$schema"]
  if (version === "http://json-schema.org/draft-04/schema#") {
    migrateSchema.draft7(schema)
    // config.log("Internally upgrading JSON Schema draft-04")
  }

  // schema $id must be unique (TODO: check against file index?)
  var validator
  try {
    validator = ajv.compile(schema)
  } catch(e) {
    throw new Error(`Failed to compile schema from ${file}`)
  }

  // map validation errors to common validation error format
  const mappedValidator = data => {
    const ok = validator(data)
    mappedValidator.errors = (validator.errors||[]).map(e => {
      return new ValidationError({
        message: e.message || "Validation with JSON Schema failed",
        position: e.instancePath,
        positionFormat: "jsonpointer",
        // ajvDetails: e
      })
    })
    return ok
  }

  return mappedValidator
}