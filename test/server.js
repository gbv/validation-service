/* eslint-env node, mocha */
import fs from "fs"
import chai from "chai"
import chaiHttp from "chai-http"
chai.use(chaiHttp)
// eslint-disable-next-line no-unused-vars
const should = chai.should()

import { loadConfig, createService } from "../index.js"

const config = await loadConfig()
const formats = await createService(config)

import app from "../server.js"
app.set("formats", formats)

describe("Server", () => {

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
          "array",
          "digits",
          "isbn",
          "json",
          "json-schema",
          "regexp",
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
      what:"list schema languages at /languages",
      path: "/languages",
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
        const draft7 = "config/json-schema-draft-07.json"
        res.body.should.deep.equal(JSON.parse(fs.readFileSync(draft7)))
      },
    },
    {
      what:"return a default schema at /schema",
      path: "/schema?format=digits",
      code: 200,
      response(res) {
        res.text.should.equal("^([0-9]+\n)*$")
      },
    },
    {
      what:"return 404 if schema not found at /schema",
      path: "/schema?format=json-schema&version=notexist",
      error: {
        error: "NotFound",
        message: "Format not found",
        status: 404,
      },
    },
    {
      what:"return 404 if format has no schemas at /schema",
      path: "/schema?format=regexp",
      error: {
        error: "NotFound",
        message: "Format regexp has no schemas",
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
      what:"require a data or url parameter at /validate",
      path: "/validate?format=json",
      code: 400,
      response(res) {
        res.body.message.should.equals("Please use HTTP POST or provide query parameter 'url' or 'data'")
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

    // POST /
    {
      what:"require a request body at POST /json",
      path: "/json",
      post: "",
      code: 400,
      response(res) {
        res.body.message.should.equals("Missing HTTP POST request body")
      },
    },
    {
      what:"complain about unknown format at POST /example",
      path: "/example",
      post: "",
      code: 404,
      response(res) {
        res.body.message.should.equals("Format not found")
      },
    },
  ]

  requestTests.forEach(({what, path, code, response, error, post}) => {
    it(`should ${what}`, done => {
      var request = chai.request(app)
      if (post !== undefined) {
        request = request.post(path).send(post)
      } else {
        request = request.get(path)
      }
      request
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
    { format: "json", data: "[]", result: [true] },
    { format: "json", data: "{}", result: [true] },
    { format: "json", data: "[false]", result: [true] },
    { format: "json", data: "null", result: [true] },
    {
      format: "json", data: "{",
      result: [[{
        message: "Unexpected end of JSON input",
        position: "char=1",
        positionFormat: "rfc5147",
      }]],
    },
    {
      format: "json", data: "{ 1",
      result: [[{
        message: "Unexpected number in JSON at position 2",
        position: "char=2",
        positionFormat: "rfc5147",
      }]],
    },
    { format: "json-schema", data: "[]", select: "$.*", result: [] },
    { format: "json-schema", data: "[]", result(r) {
      r[0].should.be.an("array")
    }},
    { format: "json-schema", data: "{}", result: [true] },
    { format: "json-schema", data: "[{}]", select: "$.*", result: [true] },
    {
      format: "json-schema", data: "{\"properties\":0}",
      result: [[{
        message: "must be object",
        position: "/properties",
        positionFormat: "jsonpointer",
      }]],
    },
    { format: "array", data: "[]", result: [true] },
    { format: "array", data: "{}", result: [[{
      message: "must be array",
      position: "",
      positionFormat: "jsonpointer",
    }]],
    },
  ]

  validationTests.forEach(({format, data, select, code, result}) => {
    const resultCheck = done =>
      ((err, res) => {
        res.should.have.status(code || 200)
        if (typeof result === "function") {
          result(res.body)
        } else {
          res.body.should.deep.equal(result)
        }
        done()
      })

    select = select || ""

    it(`should validate ${format} data ${data} ${select} (GET)`, done => {
      chai.request(app)
        .get(`/validate?format=${format}&data=${data}` + (select ? `&select=${select}` : ""))
        .end(resultCheck(done))
    })

    it(`should validate ${format} data ${data} ${select} (POST)`, done => {
      chai.request(app)
        .post(`/${format}` + (select ? `?select=${select}` : ""))
        .send(data)
        .end(resultCheck(done))
    })
  })
})
