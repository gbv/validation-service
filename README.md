# Validation Service

[![Test](https://github.com/gbv/validation-service/actions/workflows/test.yml/badge.svg)](https://github.com/gbv/validation-service/actions/workflows/test.yml)
[![GitHub package version](https://img.shields.io/github/package-json/v/gbv/validation-service.svg?label=version)](https://github.com/gbv/validation-service)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)

> Web service to validate data against schemas

This validation service provides methods to validate records against different kinds of schemas to ensure that they conform to known data formats.

## Table of Contents

- [Install](#install)
  - [From GitHub](#from-github)
  - [Configuration](#configuration)
- [Background](#background)
  - [Formats](#formats)
  - [Schema languages](#schema-languages)
- [Usage](#usage)
  - [Run Server](#run-server)
  - [Run Tests](#run-tests)
- [Data model](#data-model)
- [API](#api)
  - [GET /validate](#get-validate)
  - [POST /validate](#post-validate)
  - [GET /formats](#get-formats)
  - [GET /schema](#get-schema)
  - [Validation errors](#validation-errors)
  - [API errors](#api-errors)
- [Deployment](#deployment)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Install

Requires at least Node 12.

### From GitHub

```bash
git clone https://github.com/gbv/jskos-server.git
cd jskos-server
npm ci
```

### Configuration

The service must be customized via configuration files. By default, this configuration file resides in `config/config.json` (or `config/config.test.json` for tests). However, it is possible to adjust this path via the `CONFIG_FILE` environment variable. Missing keys are defaulted from `config/config.default.json`:

```json
{
  "title": "Validation Service",
  "description": null,
  "version": null,
  "port": 3700,
  "proxies": [],
  "verbosity": "log",
  "formats": [],
  "formatsDirectory": "./formats",
  "update": "startup",
  "types": [
    { "id": "json-schema" }
  ]
}
```

Keys `version` and `description` are defaulted to its value in `package.json`. In addition the environment variable `NODE_ENV` is respected with `development` as default. Alternative values are `production` and `test`.

Key `formats` and `types` must contain arrays of [formats](#formats) or [schema languages](#schema-languages), respectively. The arrays are automatically extended by some hardcoded formats automatically included in every instance of validation service.

## Background

Large parts of practical data science or other data processing work is spent by cleaning dirty data. To detect errors in data or to ensure that data is good enough, it must be **validated** against some critera. A **data format** is a set of digital objects (aka records) that meet some defined criteria. This application helps to check whether records conform to known data formats. [Validation errors](#validation-errors) show when and how a format is violated so data can be cleaned or rejected.

### Formats

A format, as specified in array `formats` and/or `types` of [configuration](#configuration) must be a JSON Object with keys:

* `id` format identifier
* `title` optional title
* `short` optional short title
* `contentType` optional content type
* `base` optional identifier of a base format (e.g. `json` for JSON-based formats)
* `schemas` an optional array of schemas, each with
  * `version` version number or name (set to `"default"` if missing)
  * `type` Schema type (identifier of a schema language, e.g. `json-schema`)
  * `url` where to retrieve the schema file from

API endpoint [/formats](#get-formats) can be used to list formats supported by an instance of validation service.

### Schema languages

Some formats are also schema languages (aka schema types). Records in a schema language (aka schemas) define other data formats that all share a common base format. For instance JSON Schema is a schema language to define JSON-based formats, XML Schema is a schema language to define XML-based formats, and regular expressions can be used as schema language to describe character-based formats.

This service supports some known schema languages:

* JSON Schema (`json-schema`)
* XML Schema (*not implemented yet*)
* ...

These schema languages are automatically included as [formats](#formats) with an additional key:

* `for` identifier of the base format of formats defined by the schema language

API endpoint [/types](#get-types) can be used to list schema languages supported by an instance of validation service.

### See Also

The format registry <http://format.gbv.de/> (mostly German) lists data formats relevant to cultural heritage institutions. The thesis described at <http://aboutdata.org> includes some theoretical background.

## Usage

### Run Server

```bash
# Development server with hot reload and auto reconnect at localhost:3700 (default)
npm run start

# To run the server in production, run this:
NODE_ENV=production node ./server.js
```

On startup all configured schemas are downloaded to `formatsDirectory` (set `update` to `"missing"` will only download missing schema files) and compiled. Addition and updates require to restart the server.

### Run Tests

```bash
npm test
```

## API

The response status code should always be 200 (possibly including [validation errors](#validation-errors), unless there was an [API error](#api-errors) such as wrong request parameters or unexpected internal failures.

### GET /validate

Endpoint to validate records passed via query parameter or URL.

**URL Params**

`url=[url]` URL to load data from

`data=[string]` Serialized data to be validated. Ignored when parameter `url` is given.

**Success Response**

Array of same length as the posted data and validation result formeach record.  An element is `true` when the object passed validation, or an array of [validation errors](#validation-errors) when the object failed validation.

**Examples**

Check whether a simple string such as `{}` or `[x]` is valid or invalid JSON:

```sh
curl -g 'http://format.gbv.de/validate/validate?format=json&data={}'
```

```json
[
  true
]
```

```sh
curl -g 'http://format.gbv.de/validate/validate?format=json&data=[x]'
```

```json
[
  [
    {
      "message": "Unexpected token x in JSON at position 1",
      "position": "char=1",
      "positionFormat": "rfc5147"
    }
  ]
]
```

JSON parsing errors are returned with character position in [RFC 5147](https://datatracker.ietf.org/doc/html/rfc5147) format.

### POST /validate

Endpoint to validate records like [GET /validate](#validate) but data is send via HTTP POST payload.

**Query Parameters**

* `format=[string]` a known data format (required)

**Success Response**

Same as response of [POST /validate](#post-validate).

**Examples**

```sh
curl -X POST 'http://format.gbv.de/validate/validate?format=json' -d '[]'
```

...

### GET /formats

Lists all [formats](#formats), optionally filtered by identifier, version, and/or schema type.

**Query Parameters**

* `format=[id]` select format with given format identifier

* `version=[string]` version to filter for

* `type=[string]` schema type filter for

* **Success Response**

  JSON Array of format objects.

### GET /schema

Get a schema file.

**Query Parameters**

* `format=[id]` format identifier

* `version=[string]` optional version (set to `default` by default)

* `type=[string]` optional schema type

**Success Response**

The schema file is served with corresponding content type.

**Error Resonse**

An [API error](#api-errors) with status code 404 is returned in no corresponding schema was found.

### GET /types

List schema types as array of [formats](#formats).

**Query Parameters**

* `type=[string]` optional schema type

**Success Response**

JSON Array of format objects.

### Validation errors

Validation results (see [GET /validate](#get-validate) and [POST /validate](#post-validate)) can include validation errors. Each error is a JSON object with

* `message` mandatory error message
* `error` optional type of error
* `position` optional locator of the error
* `positionFormat` optional locator format (e.g. `rfc5147` to locate character positions in a string or `jsonpointer` to reference elements in a JSON document)

Errors may contain additional keys but these may change with future versions of the service.

### API errors

Non-validation errors such as wrong request parameters or unexpected internal failures are returned as JSON object such as the following:

```json
{
  "error": "MalformedRequest",
  "status": 400,
  "message": "Missing query parameter: format"
}
```

A stack trace is included in development mode.

## Deployment

To provide the service behind a nginx web server at path `/validate/` (like at <http://format.gbv.de/validate/>), add this to nginx configuration file:

```
	location /validate/ {
		proxy_pass http://127.0.0.1:3700/;
	}
```

We recommend to use [PM2](https://pm2.keymetrics.io/) to start and update the service:

```bash
pm2 start ecosystem.config.json
```

To update an instance deployed with PM2:

```bash
# get updates from repository
git pull

# install dependencies
npm ci

# restart the process (adjust process name if needed)
pm2 restart validation-service
```

Automatic update of formats and schemas has *not been implemented yet (<https://github.com/gbv/validation-service/issues/8>).*

## Maintainers

- [@nichtich](https://github.com/nichtich)
- [@stefandesu](https://github.com/stefandesu)

## Contribute

PRs accepted against the `dev` branch. Never directly work on the main branch.

For releases (maintainers only) make changes on `dev` and then run the release script:

```bash
npm run release:patch # or minor or major
```

## License

MIT © 2022 Verbundzentrale des GBV (VZG)
