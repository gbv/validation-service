const { MalformedRequest, NotFound } = require("../lib/errors.js")

// TODO: check query parameters
// const versionPattern = /^[a-zA-Z0-9.-]+$/
// const formatPattern = /^[a-zA-Z0-9-]+$/

module.exports = async req => {
  const { query } = req

  if (query.format) {
    const registry = req.app.get("formats")
    const format = registry.getSpecificFormat(query)
    if (format) {
      return format
    } else {
      throw new NotFound("Format not found")
    }
  } else {
    throw new MalformedRequest("Missing query parameter: format")
  }
}