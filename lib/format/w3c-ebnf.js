import { ValidationError } from "../errors.js"
import { Grammars, Parser } from "ebnf"

async function createValidator({ value }) {
  const rules = Grammars.W3C.getRules(value+"\n")
  const parser = new Parser(rules)

  return (async data => {
    if (parser.getAST(data)) {
      return [ true ]
    } else {
      return [[{ message: "Value does not match grammar" }]]
    }
  })
}

function parse(grammar) {
  try {
    Grammars.W3C.getRules(grammar+"\n")
  } catch(e) {
    // error messages are not helpful here :-(
    throw new ValidationError({ message: "Invalid EBNF" })
  }
  return
}

export default {
  title: "Extended Backus-Naur Form (W3C)",
  short: "W3C-EBNF",
  description: "Extended Backus-Naur Form defined by W3C",
  url: "http://www.w3.org/TR/REC-xml/#sec-notation",
  createValidator,
  parse,
}
