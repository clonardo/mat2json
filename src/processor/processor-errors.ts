export class FormatError extends Error {
  byte: any
  data: any

  constructor(data, byte, message) {
    super('Unexpected value when reading near byte ' + byte + ': ' + message)
    this.name = 'FormatError'
    this.message = message
    this.data = data
    this.byte = byte
  }
}

export class FeatureError extends Error {
  byte: any
  data: any
  feature: any
  constructor(data, byte, feature, message) {
    super("The MAT file has features that are not supported. See Limitations on the project's page: " + message)
    this.name = 'FeatureError'
    this.data = data
    this.byte = byte
    this.feature = feature
  }
}
