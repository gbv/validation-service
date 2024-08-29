/* eslint-env node, mocha */
import { expect, jsonFile, formatIds } from "./test.js"

import { Readable } from "stream"
import toArray from "stream-to-array"

import { loadConfig, createService } from "../index.js"

const config = loadConfig()
const service = await createService(config)

import { validationExamples } from "./examples.js"
validationExamples["json-schema"].valid.push(
  new Buffer("{\"type\":\"array\"}"), // pass Buffer
  {type:"array"},                     // pass JSON object
)

describe("ValidationService", () => {

  it("should listFormats", () => {
    const formats = service.listFormats()
    expect(formats.map(f => f.id)).deep.equal(formatIds)
  })

  it("should listLanguages", () => {
    const formats = service.listLanguages()
    expect(formats.map(f => f.id)).deep.equal([
      "json-schema",
      "regexp",
      "xsd",
    ])
  })

  it("should getFormat specific version", () => {
    const version = "draft-06"
    const result = service.getFormat("json-schema", { version })
    expect(Object.keys(result.versions)).to.deep.equal(["draft-06"])
  })

  it("should getFormat default version", () => {
    var result = service.getFormat("json-schema")
    expect(Object.keys(result.versions)).to.deep.equal(["draft-07"])

    result = service.getFormat("json-schema", { version: "default" })
    expect(Object.keys(result.versions)).to.deep.equal(["draft-07"])
  })

  it("should reduce format versions to those useable for validation", () => {
    const digits = service.getFormat("digits")
    expect(Object.keys(digits.versions)).to.deep.equal(["default"])
  })

  it("should use specific schema version, if requested", () => {
    const jsonSchema = service.getFormat("json-schema", { version: "draft-04" })
    const [ schema ] = jsonSchema.versions["draft-04"].schemas
    expect(jsonSchema.validateAll).equal(schema.validateAll)
  })

  it("should include regexp as format", async () => {
    const format = service.getFormat("regexp")

    // .validateAll
    await expect(format.validateAll(".")).to.eventually.deep.equal([true])
    await expect(format.validateAll("?")).to.eventually.be.not.empty

    // .validateStream
    return toArray(Readable.from(["^a+","?"]).pipe(format.validateStream))
      .then(result => expect(result[0]).to.equal(true) && expect(result[1]).to.be.an("array").that.is.not.empty)
  })

  Object.entries(validationExamples).forEach(([name, { valid, invalid }]) => {
    const [ id, version ] = name.split("@")
    const format = service.getFormat(id, { version })
    if (valid) {
      it(`should pass valid ${name}`, () =>
        Promise.all(valid.map(value =>
          expect(format.valid(value)).to.eventually.equal(value),
        )),
      )
    }
    if (invalid) {
      it(`should detect invalid ${name}`, () =>
        Promise.all(Object.entries(invalid).map(([value, errs]) =>
          expect(format.valid(value)).to.be.rejected
            .then(({errors}) => {
              if (typeof errs == "function") {
                errs(errors)
              } else {
                if (errs === null) {
                  expect(errors).to.be.an("array").that.is.not.empty
                } else {
                  expect(errors).to.deep.equal(errs)
                }
              }
            }),
        )),
      )
    }
  })

  it("should complain validate with selection if format doesn't support selection", () => {
    return Promise.all(["regexp", "isbn", "isbn", "xsd"].map(name => {
      const format = service.getFormat(name)
      return expect(format.validateAll("",{ select: "0" })).to.be.rejected
        .then(e => expect(e.message).to.equal(`${name} validator does not support selection`))
    }))
  })

  it("should support validating JSKOS", () => {
    const format = service.getFormat("jskos")

    const input = jsonFile("files/jskos.json")
    const errors = jsonFile("files/jskos-errors.json")
    return expect(format.validateAll(input, { select: "$.*" })).to.eventually.deep.equal(errors)

    // FIXME: validateStream stream is not persistent
    // return toArray(Readable.from(input).pipe(format.validateStream))
    //  .then(result => expect(result).to.deep.equal([ true, error ]))
  })

  it("should support validating YAML with multiple documents", () => {
    const yaml = service.getFormat("yaml")
    const errors = [{
      message: "Alias cannot be an empty string at line 3, column 1:\n\n...\n*\n^\n",
      position: { linecol: "3:1", rfc5147: "char=8" },
    }]
    return expect(yaml.validateAll("a:1\n...\n*")).eventually.deep.equal([true, errors])
  })

  it("should tell encoding (used internally so far)", () => {
    expect(service.getEncoding("yaml", "about/data").title).to.equal("YAML")
  })
})
