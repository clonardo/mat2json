import { inflate as pakoInflate } from 'pako'
import * as fs from 'fs'
import { outputJsonSync } from 'fs-extra'
import * as path from 'path'
import { FormatError, FeatureError } from './processor-errors'

function round8byte(byte) {
  if (byte % 8 === 0) return byte
  return byte + (8 - (byte % 8))
}
function calcIndex(index, size) {
  let i = index[0]
  for (let j = 1; j < size.length; j++) {
    i += index[j] * size[j - 1]
  }
  return i
}

// Arr data
// This recursive function takes the column-major data ('flat') and the array's dimensions and constructs the multidimensional array
function iterateN(size, flat) {
  const d = 0
  let n = 0
  // eslint-disable-next-line prefer-const
  let index = []
  for (let i = 0; i < size.length; i++) index.push(0)
  function rec(size, d) {
    // eslint-disable-next-line prefer-const
    let res = []
    for (let i = 0; size[d] > i; i++) {
      if (d === size.length - 1) {
        res.push(flat[calcIndex(index, size)])
        index[n]++
      } else {
        n++
        res.push(rec(size, d + 1))
        index[n] = 0
        n--
        index[n]++
      }
    }
    return res
  }
  return rec(size, d)
}

type ReadResult = {
  type: number
  length: number
  data?: Array<any> | string
  name?: string
}

const readDataElem = (data, index, en: boolean) => {
  let type, length, taglength
  const view = new DataView(data)

  // Checking the first two bytes for 0 (as per the docs) should not work, because 1) length and type are not reversed as they shoud be for the small format, 2) length can be 0. This creates ambiguity as to the length of the tag. However, whith the 64 bit padding considered, small and long format data tags with 0 length data are identical.
  let longFormatFlag = false
  if (view.getInt32(index, en) >>> 16 === 0) {
    longFormatFlag = true
  }
  if (longFormatFlag) {
    type = view.getInt32(index, en)
    length = view.getInt32(index + 4, en)
    taglength = 8
  } else {
    // According to the specification these should be in the reverse order, but the files that I've seen do not follow the specification.
    type = view.getInt16(index, en)
    length = view.getInt16(index + 2, en)
    taglength = 4
  }

  // eslint-disable-next-line prefer-const
  let read: ReadResult = { type: type, length: round8byte(length + taglength) } // Uncompressed data is padded
  let pr: ReadResult
  let arr: number[] = []
  switch (type) {
    case 1: // int8
      for (let i = 0; i < length; i++) {
        arr.push(view.getInt8(index + taglength + i))
      }
      read.data = arr
      return read
    case 2: // uint8
      arr = []
      for (let i = 0; i < length; i++) {
        arr.push(view.getUint8(index + taglength + i))
      }
      read.data = arr
      return read

    case 3: // int16
      arr = []
      for (let i = 0; i < length / 2; i++) {
        arr.push(view.getInt16(index + taglength + i * 2, en))
      }
      read.data = arr
      return read
    case 4: // uint16
      arr = []
      for (let i = 0; i < length / 2; i++) {
        arr.push(view.getUint16(index + taglength + i * 2, en))
      }
      read.data = arr
      return read

    case 5: // int32
      arr = []
      for (let i = 0; i < length / 4; i++) {
        arr.push(view.getInt32(index + taglength + i * 4, en))
      }
      read.data = arr
      return read
    case 6: // uint32
      arr = []
      for (let i = 0; i < length / 4; i++) {
        arr.push(view.getUint32(index + taglength + i * 4, en))
      }
      read.data = arr
      return read

    case 7: // single
      arr = []
      for (let i = 0; i < length / 4; i++) {
        arr.push(view.getFloat32(index + taglength + i * 4, en))
      }
      read.data = arr
      return read

    case 8: // reserved
      throw new FormatError(data, index, "Data element's type is 8, 'Reserved' (unknown)")

    case 9: // double
      arr = []
      for (let i = 0; i < length / 8; i++) {
        arr.push(view.getFloat64(index + taglength + i * 8, en))
      }
      read.data = arr
      return read

    case 10: // reserved
      throw new FormatError(data, index, "Data element's type is 10, 'Reserved' (unknown)")

    case 11: // reserved
      throw new FormatError(data, index, "Data element's type is 11, 'Reserved' (unknown)")

    case 12: // int64
      throw new FeatureError(data, index, 'INT64', "Data element's type is 12, 'INT64' (unsupported)")
    case 13: // uint64
      throw new FeatureError(data, index, 'UINT64', "Data element's type is 13, 'UINT64' (unsupported)")

    case 14: // matrix
      let reader = index + taglength
      let realFlag: number
      let mxClass: number
      // Array flags subelement is written as an int32, which makes manual byte shifting necessary
      if (en) {
        // little endian: taglength (8) + 8 byte + 4th bit of the 2nd byte is the real flag
        realFlag = (view.getInt8(reader + 9) >> 3) & 1
        mxClass = view.getInt8(reader + 8)
      } else {
        // big endian: 5th bit of the 3rd byte
        realFlag = (view.getInt8(reader + 10) >> 3) & 1
        mxClass = view.getInt8(reader + 11)
      }
      reader += 16

      // Array dimensions
      // eslint-disable-next-line prefer-const
      let dim = readDataElem(data, reader, en)
      reader += dim.length
      // Horizontal (1xn) and vertical (nx1) vectors should be treated as 1D (n)
      if (dim.data.length === 2) {
        if (dim.data[0] === 1) {
          dim.data = [dim.data[1]]
        } else if (dim.data[1] === 1) {
          // 1x1 -> 1
          dim.data = [dim.data[0]]
        }
      }

      // Array name
      let name = ''
      let flat = []
      const nameArr = readDataElem(data, reader, en)
      for (let i = 0; i < nameArr.data.length; i++) {
        name += String.fromCharCode(nameArr.data[i])
      }
      reader += nameArr.length

      let arrData

      switch (mxClass) {
        case 1: // Cell array
          let elemNum = 0
          for (let i = 0; i < dim.data.length; i++) {
            if (!i) {
              elemNum = dim.data[i]
            } else {
              elemNum *= dim.data[i]
            }
          }
          for (let i = 0; i < elemNum; i++) {
            const subArr = readDataElem(data, reader, en)
            flat.push(subArr.data)
            reader += subArr.length
          }
          arrData = iterateN(dim.data, flat)
          break

        case 2: // Structure
          arrData = {}
          const nameLength = readDataElem(data, reader, en)
          reader += nameLength.length
          // eslint-disable-next-line prefer-const
          let fieldNameFlat = readDataElem(data, reader, en)
          reader += fieldNameFlat.length
          // eslint-disable-next-line prefer-const
          let fieldNames = []
          for (let i = 0; i < fieldNameFlat.data.length / nameLength.data[0]; i++) {
            fieldNames.push('')
            for (let j = 0; fieldNameFlat.data[j + i * nameLength.data[0]] !== 0 && j < nameLength.data[0]; j++) {
              fieldNames[i] += String.fromCharCode(fieldNameFlat.data[j + i * nameLength.data[0]])
            }
          }

          // Structs can be defined as scalar (1x1) or not regardless of the presence of cell arrays in the data
          if (dim.data[0] !== 1 || dim.data.length > 1) {
            flat = []
            elemNum = 0
            for (let i = 0; i < dim.data.length; i++) {
              if (!i) {
                elemNum = dim.data[i]
              } else {
                elemNum *= dim.data[i]
              }
            }
            for (let i = 0; i < elemNum; i++) {
              // eslint-disable-next-line prefer-const
              let cell = {}
              for (let j = 0; j < fieldNames.length; j++) {
                const field = readDataElem(data, reader, en)
                reader += field.length
                cell[fieldNames[j]] = field.data
              }
              flat.push(cell)
            }
            arrData = iterateN(dim.data, flat)
          } else {
            for (let i = 0; i < fieldNames.length; i++) {
              const field = readDataElem(data, reader, en)
              reader += field.length
              arrData[fieldNames[i]] = field.data
            }
          }
          break
        case 3: // Object
          throw new FeatureError(data, index, 'OBJECT', "Array's type is 3, 'mxOBJECT_CLASS' (unsupported)")
        case 4: // Character array
          flat = readDataElem(data, reader, en) as any
          reader += flat.length
          // It might be a multidimensional array instead of a char vector. If it isn't though, the string shouldn't be broken up
          if (dim.data.length > 1) {
            arrData = iterateN(dim.data, (flat as any).data)
          } else {
            arrData = (flat as any).data
          }
          break
        case 5: // Sparse array
          const ir = readDataElem(data, reader, en)
          reader += ir.length
          const jc = readDataElem(data, reader, en)
          reader += jc.length
          pr = readDataElem(data, reader, en)
          reader += pr.length
          let numArr: any[] = []
          if (realFlag) {
            const pi = readDataElem(data, reader, en)
            reader += pi.length
            numArr = []
            for (let i = 0; i < ir.data.length; i++) {
              numArr.push({ r: pr.data[i], i: pi.data[i] })
            }
          } else {
            ;(numArr as any) = pr.data
          }

          // Sparse arrays can only be two dimensional
          if (dim.data.length !== 2)
            throw new FormatError(
              data,
              index,
              'MATLAB only supports two dimensional sparse arrays, while this sparse array is ' +
                dim.data.length +
                ' dimensional'
            )
          arrData = { x: dim.data[1], y: dim.data[0], nz: [] }

          for (let i = 0; i < jc.data.length - 1; i++) {
            for (let j = jc.data[i]; j < jc.data[i + 1]; j++) {
              arrData.nz.push({ x: i, y: ir.data[j], v: numArr[j] })
            }
          }
          break
        case 6: // Double precision array
        case 7: // Single precision array
        case 8: // 8-bit, signed integer
        case 9: // 8-bit, unsigned integer
        case 10: // 16-bit, signed integer
        case 11: // 16-bit, unsigned integer
        case 12: // 32-bit, signed integer
        case 13: // 32-bit, unsigned integer
          flat = []
          // let pr:ReadResult;
          if (realFlag) {
            pr = readDataElem(data, reader, en)
            reader += pr.length
            const pi = readDataElem(data, reader, en)
            reader += pi.length

            for (let i = 0; i < pr.data.length; i++) {
              flat.push({ r: pr.data[i], i: pi.data[i] })
            }
          } else {
            pr = readDataElem(data, reader, en)
            reader += pr.length
            flat = pr.data as any
          }
          arrData = iterateN(dim.data, flat)
          break
        case 14: // 64-bit, signed integer
          throw new FeatureError(data, index, 'INT64', "Array's type is 14, 'mxINT64_CLASS' (unsupported)")
        case 15: // 64-bit, unsigned integer
          throw new FeatureError(data, index, 'UINT64', "Array's type is 15, 'mxUINT64_CLASS' (unsupported)")
        case 16: // undocumented mxFUNCTION_CLASS
        case 17: // undocumented mxOPAQUE_CLASS
          // Ignore
          return read
        default:
          throw new FormatError(data, index, "Array's type is " + mxClass + ' (unknown)')
      }

      read.name = name
      read.data = arrData
      return read

    case 15: // compressed
      const compressed = new Uint8Array(data.slice(index + taglength, index + taglength + length))
      const inflate = pakoInflate(compressed)
      const plain = readDataElem(inflate.buffer, 0, en)
      // var plain = readDataElem(inflate.decompress().buffer, 0);
      if (plain.hasOwnProperty('data')) read.data = plain.data
      if (plain.hasOwnProperty('name')) read.name = plain.name
      read.length = length + taglength // Compressed data doesn't use 64-bit padding
      return read

    case 16: // utf8
      let str = ''
      for (let i = 0; i < length; i++) {
        str += String.fromCodePoint(view.getInt8(index + taglength + i))
      }
      read.data = str
      return read

    case 17: // utf16
      str = ''
      for (let i = 0; i < length; i++) {
        str += String.fromCodePoint(view.getInt16(index + taglength + i, en))
      }
      read.data = str
      return read
    case 18: // utf32
      str = ''
      for (let i = 0; i < length; i++) {
        str += String.fromCodePoint(view.getInt32(index + taglength + i, en))
      }
      read.data = str
      return read
    default:
      throw new FormatError(data, index, "Data element's type is " + type + ' (unknown)')
  }
}

/**
 * Process raw data as loaded from a file
 *
 * @param data Data that has been read from a file
 */
export const ProcessData = (data): { header: string; data: Record<string, unknown> } => {
  const view = new DataView(data)

  let en = true // Little endian true
  const endianIndicator = view.getInt16(126, en)
  if (endianIndicator === 0x494d) {
    en = false
  } else if (endianIndicator !== 0x4d49) {
    throw new FormatError(
      data,
      126,
      'Expected 0x4D49 for big endian or 0x494D for little endian, but got ' + endianIndicator
    )
  }

  const version = view.getInt16(124, en)
  switch (version) {
    case 0x0100:
      break
    case 0x0200:
      throw new FeatureError(data, 124, 'HDF5', 'Matlab v7.3 MAT-files are not supported')
    default:
      throw new FormatError(data, 124, 'Version identifier ' + version + ' unknown')
  }

  // First 116 bytes is human-readable text field
  let header = ''
  for (let i = 0; i < 116; i++) {
    header += String.fromCharCode(view.getInt8(i))
  }

  const output = { header: header, data: {} }

  // TODO: Figure out what to do with "subsystem-specific data"

  let index = 128
  while (index < data.byteLength) {
    const elem = readDataElem(data, index, en)
    if (elem.hasOwnProperty('name')) output.data[elem.name] = elem.data

    index += elem.length
  }
  return output
}

/**
 *
 * @param filePath Path to input Matlab data file
 * @param outputRootDir optional target output directory. defaults: ./outputs
 */
export const ProcessFile = (filePath: string, outputRootDir: string = 'outputs') => {
  const buffer = fs.readFileSync(filePath)

  const converted = new Uint8Array(buffer).buffer
  const res = ProcessData(converted)
  // console.log(JSON.stringify(res, null, 2))
  const newName = path.basename(filePath).replace(path.extname(filePath), '.json')
  const outputDir = path.normalize(path.dirname(filePath)).split(`\\`).pop()
  const targetName = path.join(outputRootDir, outputDir, newName)
  console.log(`- Writing ${targetName}`)
  // path.parse(filePath);

  // console.log(path.dirname(filePath))
  outputJsonSync(targetName, res, { spaces: 2 })
}
