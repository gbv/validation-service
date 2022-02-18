import { ValidationError } from "../errors.js"

export default async function (data) {
  const type = typeof data
  if (type === "object") {
    return Array.isArray(data) ? data : [data]
  } else if (type === "string") {
    try {
      data = JSON.parse(data)
      return Array.isArray(data) ? data : [data]
    } catch(e) {
      const message = e.message
      var pos = message.match(/^Unexpected .+ .*position\s+(\d+)/i)
      pos = pos ? +pos[1] : message.match(/^Unexpected end of JSON.*/i) ? data.length : 0
      throw new ValidationError({
        message,
        format: "json",
        position: `char=${pos}`,
        positionFormat: "rfc5147",
      })
    }
  } else {
    throw new ValidationError()
  }
}