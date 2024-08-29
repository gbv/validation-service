import fs from "fs"
import cacache from "cacache"
import axios from "axios"

// Simple file-system cache for resources fetched via HTTP
// Also keeps a catalog.xml file mapping URIs to local file pathes
class Cache {

  constructor(path) {
    this.path = path
    if (!fs.existsSync(this.path)) {
      if (!fs.mkdirSync(this.path, { recursive: true })) {
        throw new Error(`Failed to create cache at ${this.path}`)
      }
    }
  }

  async get(key) {
    return cacache.get.info(this.path, key) // => { key, path, metadata, ... } or null
  }

  async put(key, data, metadata={}) {
    return cacache.put(this.path, key, data, { metadata })
      .then(() => {
        if (key !== "catalog.xml") {
          this.updateCatalog()
        }
      })
  }

  async updateCatalog() {
    return this.files().then(files => {
      const entries = files.filter(({key}) => key !== "catalog.xml")
        .map(({key, path}) => `<system systemId="${key}" uri="file://${path}"/>`)
      const xml = `<?xml version="1.0"?>
<!DOCTYPE catalog PUBLIC "-//OASIS//DTD Entity Resolution XML Catalog V1.0//EN" "http://www.oasis-open.org/committees/entity/release/1.0/catalog.dtd">
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
${entries.join("\n")}
</catalog>`
      return this.put("catalog.xml", xml)
    })
  }

  async files() {
    return cacache.ls(this.path).then(index => Object.values(index))
  }

  async fetch(url, options={}) {
    const log = options.log || (() => {})
    const headers = options.headers || {}
    const rememberHeaders = ["content-type","last-modified"]
    const cache = this

    return cache.get(url)
      .then(r => {
        if (r) {
          return r
        }
        log(`Downloading ${url}`)
        return axios(url, { headers, transformResponse: [], ...options })
          .then(async res => {
            const headers = {}
            for (let key of rememberHeaders) {
              const value = res.headers[key]
              if (value) {
                headers[key] = value
              }
            }
            return cache.put(url, res.data, { headers })
              .then(() => cache.get(url))
          })
          .catch((e) => {
            throw new Error(`Failed to download ${url}: ${e.message}`)
          })
      })
  }
}

export default Cache
