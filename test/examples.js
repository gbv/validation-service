import { readFile } from "./test.js"

export const validationExamples = {
  array: {
    invalid: {
      "[{\" \":1}]": [
        {
          message: "must NOT have additional properties ' '",
          position: { jsonpointer: "/0" },
        },
      ],
    },
  },
  "json-schema": {
    valid: [ "{\"type\":\"array\"}" ],
    invalid: {
      "[": [
        {
          message: "Unexpected end of JSON input",
          position: { rfc5147: "char=1", linecol: "1:2" },
        },
      ],
      "[]": [
        {
          message: "must be object,boolean",
          position: { jsonpointer: "" },
        },
      ],
    },
  },
  "json-schema@draft-07": {
    invalid: {
      "{\"$id\":false}": [{
        message: "must be string",
        position: { jsonpointer: "/$id" },
      }],
    },
  },
  "json-schema@draft-04": {
    invalid: {
      "{\"id\":false}": [{
        message: "must be string",
        position: { jsonpointer: "/id" },
      }],
    },
  },
  regexp: {
    valid: ["^a+"],
    invalid: {
      "?": [{ message: "Invalid regular expression: /?/: Nothing to repeat" }],
    },
  },
  digits: { // defined by regexp
    valid: ["123\n456\n"],
    invalid: {
      xy: [{
        message: "Value does not match regular expression",
      }],
    },
  },
  "digits@ebnf": { // defined by W3C-EBNF
    valid: ["123"],
    invalid: {
      x: [{
        message: "Value does not match grammar",
      }],
    },
  },
  isbn: { // example of a format defined by parser
    valid: ["978-3-16-148410-0"],
    invalid: {
      "978-3-16-148410-1": [{ message: "Invalid ISBN" }],
    },
  },
  json: {
    valid: [
      "[]",
      "{}",
    ],
    invalid: {
      "{": [{
        message: "Unexpected end of JSON input",
        position: { rfc5147: "char=1", linecol: "1:2" },
      }],
      "{\n1": [{
        message: "Unexpected number in JSON at position 2",
        position: { rfc5147: "char=2", linecol: "2:1" },
      }],
    },
  },
  ndjson: {
    valid: ["42\n{}"],
    invalid: {
      "null\n.\n": [{
        message: "Line 2 is no valid JSON",
        position: { rfc5147: "line=2" },
      }],
    },
  },
  xml: {
    valid: ["<x:y/>"],
    invalid: {
      "<x>\n<y>\n</x>": [{
        message: "Expected closing tag 'y' (opened in line 2, col 1) instead of closing tag 'x'.",
        position: { rfc5147: "line=3" },
      }],
    },
  },
  jskos: {
    valid: [
      {},
      {uri:"https://example.org"},
      "{\"uri\":\"https://example.org\"}",
      {prefLabel:{en:"x"},type:["http://www.w3.org/2004/02/skos/core#Concept"]},
    ],
    invalid: {
      "{\"type\":0}": [{
        message: "must be array",
        position: { jsonpointer: "/type" },
      }],
    },
  },
  xsd: {
    valid: [ readFile("../lib/schemas/xml-schema-2009.xsd") ],
    invalid: {
      [`<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" version="1.0">
        <xs:foo/>
        </xs:schema>`]: [{
        message: "element foo: Schemas validity error : Element '{http://www.w3.org/2001/XMLSchema}foo': This element is not expected. Expected is one of ( {http://www.w3.org/2001/XMLSchema}include, {http://www.w3.org/2001/XMLSchema}import, {http://www.w3.org/2001/XMLSchema}redefine, {http://www.w3.org/2001/XMLSchema}override, {http://www.w3.org/2001/XMLSchema}annotation, {http://www.w3.org/2001/XMLSchema}defaultOpenContent, {http://www.w3.org/2001/XMLSchema}simpleType, {http://www.w3.org/2001/XMLSchema}complexType, {http://www.w3.org/2001/XMLSchema}group, {http://www.w3.org/2001/XMLSchema}attributeGroup ).",
        position: { rfc5147: "line=2" },
      }],
      x: [{
        message: "char 'x' is not expected.",
        position: {
          rfc5147: "line=1",
        },
      }],
    },
  },
  yaml: {
    valid: [
      "a: 1",
    ],
    invalid: {
      "{\n,}": [{
        message: "Unexpected , in flow map at line 2, column 1:\n\n{\n,}\n^\n",
        position: { linecol: "2:1", rfc5147: "char=2" },
      }],
    },
  },
  ntriples: {
    valid: [
      "<x:foo> <x:bar> \"doz\"@en .",
    ],
    invalid: {
      "<x:foo> @": [{
        message: "Unexpected \"@\" on line 1.",
        position: { rfc5147: "line=1", linecol: "1:9" },
      }],
    },
  },
  turtle: {
    valid: [
      "@prefix x: <http://example.org/> .\n <x:y> x:a 23, 42 .",
    ],
    invalid: {
      "@prefix 123": [{
        message: "Expected prefix to follow @prefix on line 1.",
        position: { rfc5147: "line=1", linecol: "1:8" },
      }],
    },
  },
  ["w3c-ebnf"]: {
    valid: [
      "Char ::= #x9 | #xA | #xD",
    ],
    invalid: {
      "X = 1": [{
        message: "Invalid EBNF",
      }],
    },
  },
}
