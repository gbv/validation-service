/* eslint-env node, mocha */
import { expect } from "chai"

import { loadConfig, validateConfig, createService, knownFormats } from "../index.js"
import defaultImport from "../index.js"

describe("Module", () => {

  it("should export loadConfig", done => {
    expect(loadConfig).to.be.instanceOf(Function)
    expect(defaultImport.loadConfig).to.be.instanceOf(Function)
    done()
  })

  it("should export validateConfig", done => {
    expect(validateConfig).to.be.instanceOf(Function)
    expect(defaultImport.validateConfig).to.be.instanceOf(Function)
    done()
  })

  it("should export createService", done => {
    expect(createService).to.be.instanceOf(Function)
    expect(defaultImport.createService).to.be.instanceOf(Function)
    done()
  })

  it("should export knownFormats", done => {
    expect(knownFormats).to.be.instanceOf(Object)
    expect(defaultImport.knownFormats).to.be.instanceOf(Object)
    done()
  })

})

describe("knownFormats", () => {

  it("should include json parser", async () => {
    const { json } = knownFormats
    expect(json.title).to.equal("JSON")

    expect(json.parse("[null,42]")).to.deep.equal([null,42])
    expect(json.parse("{\"x\":1}")).to.deep.equal({x:1})
    expect(() => json.parse("{")).to.throw()
  })

})
