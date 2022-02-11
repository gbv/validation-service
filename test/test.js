/* eslint-env node, mocha */
const fs = require("fs")
const chai = require("chai")
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
const chaiHttp = require("chai-http")
chai.use(chaiHttp)
// eslint-disable-next-line no-unused-vars
const should = chai.should()

const config = require("../config")
const server = require("../server")

describe("Server", () => {

  before(async () => {
    const formats = await require("../lib/formats")(config)
    server.app.set("formats", formats)
  })

  const requestTests = [

    // Non-API resources
    {
      what: "show HTML on base URL",
      path: "/",
      code: 200,
      response(res) {
        res.text.should.match(/<body/)
      },
    },

    // GET /formats
    {
      what: "list formats at /formats",
      path: "/formats",
      code: 200,
      response(res) {
        res.body.should.be.a("array")
        res.body.map(format => format.id).sort().should.deep.equal([
          "example",
          "json",
          "json-schema",
        ])
      },
    },
    {
      what:"allow unknown format name at /formats",
      path: "/formats?format=xxxx",
      code: 200,
      response(res) {
        res.body.should.deep.equal([])
      },
    },
    {
      what:"allow unknown format name at /formats",
      path: "/formats?format=xxxx",
      code: 200,
      response(res) {
        res.body.should.deep.equal([])
      },
    },

    // GET /types
    {
      what:"list schema types at /types",
      path: "/types",
      code: 200,
      response(res) {
        res.body.should.be.a("array")
      },
    },

    // GET /schema
    {
      what:"require a format parameter at /schema",
      path: "/schema",
      code: 400,
      response(res) {
        res.body.message.should.equals("Missing query parameter: format")
      },
    },
    {
      what:"return a schema at /schema",
      path: "/schema?format=json-schema&version=draft-07",
      code: 200,
      response(res) {
        const draft7 = "test/formats/json-schema/draft-07/schema.json"
        res.body.should.deep.equal(JSON.parse(fs.readFileSync(draft7)))
      },
    },
    {
      what:"return 404 if schema not found at /schema",
      path: "/schema?format=json-schema&version=notexist",
      error: {
        error: "NotFound",
        message: "Schema not found",
        status: 404,
      },
    },

    // GET /validate
    {
      what:"require a format parameter at /validate",
      path: "/validate?data=0",
      code: 400,
      response(res) {
        res.body.message.should.equals("Missing query parameter: format")
      },
    },
    {
      what:"require a data or urlt parameter at /validate",
      path: "/validate?format=json",
      code: 400,
      response(res) {
        res.body.message.should.equals("Please use HTTP POST or provide query parameter 'url' or 'data'!")
      },
    },
    {
      what:"return 404 if format not found at /validate",
      path: "/schema?format=notexist",
      error: {
        error: "NotFound",
        message: "Format not found",
        status: 404,
      },
    },

  ]

  requestTests.forEach(({what, path, code, response, error}) => {
    it(`should ${what}`, done => {
      chai.request(server.app).get(path)
        .end((err, res) => {
          res.should.have.status(error ? error.status : code)
          if (error) {
            res.body.should.deep.equal(error)
          } else {
            response(res)
          }
          done()
        })
    })
  })

  const validationTests = [
    { format: "json", data: "[]", code: 200, result: [] },
    { format: "json", data: "{}", code: 200, result: [true] },
    { format: "json", data: "[false]", code: 200, result: [true] },
    { format: "json", data: "null", code: 200, result: [true] },
    {
      format: "json", data: "{",
      code: 200, result: [[{
        message: "Unexpected end of JSON input",
        position: "char=1",
        positionFormat: "rfc5147",
      }]],
    },
    {
      format: "json", data: "{ 1",
      code: 200, result: [[{
        message: "Unexpected number in JSON at position 2",
        position: "char=2",
        positionFormat: "rfc5147",
      }]],
    },
    {
      format: "json-schema", data: "{\"properties\":0}", code: 200,
      result: [[{
        message: "must be object",
        position: "/properties",
        positionFormat: "jsonpointer",
      }]],
    },
    {
      format: "example", data: "?",
      code: 500, result: {
        error: "MalformedConfiguration",
        message: "No schema or parser available to validate example",
        status: 500,
      },
    },
  ]

  validationTests.forEach(({format, data, code, result}) => {
    const resultCheck = done =>
      ((err, res) => {
        res.should.have.status(code)
        res.body.should.deep.equal(result)
        done()
      })

    it(`should validate ${format} data ${data} (GET)`, done => {
      chai.request(server.app)
        .get(`/validate?format=${format}&data=${data}`)
        .end(resultCheck(done))
    })

    it(`should validate ${format} data ${data} (POST)`, done => {
      chai.request(server.app)
        .post(`/validate?format=${format}`)
        .send(data)
        .end(resultCheck(done))
    })
  })

})
