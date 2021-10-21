import * as fs from 'fs'
import * as path from 'path'

/**
 * Check if the target file path's extension matches a Set of acceptable terms
 *
 * @param filePath file path to check
 * @param extensions Set of lowercase extensions to evaluate
 */
const extensionMatches = (filePath: string, extensions: Set<string>) => {
  if (filePath && typeof filePath === 'string') {
    const rawExtension = path.extname(filePath)
    if (rawExtension && typeof rawExtension === 'string' && rawExtension.length > 0) {
      const lc = rawExtension.toLowerCase().trim()
      return extensions.has(lc)
    } else {
      return false
    }
  } else {
    return false
  }
}

/**
 * Filter an array of paths by some array of valid file extensions
 *
 * @param filePaths Array of file paths
 * @param extensions Array of extensions (including leading period)
 * @param dirName directory name to query
 */
const filterFilesOnExtensions = (filePaths: string[], extensions: string[], dirName: string): string[] => {
  if (filePaths && filePaths.length) {
    const extSet = new Set<string>(
      extensions.map(ext => {
        return ext.toLowerCase()
      })
    )
    return filePaths
      .filter(f => {
        return extensionMatches(f, extSet)
      })
      .map(f => {
        return path.join(dirName, f)
      })
  } else {
    return []
  }
}

/**
 * Get filenames in a given directory, filtering by extension type
 *
 * @param dir Full path to check
 * @param extensions extension names (with leading period) to include. Default: '.mat', '.mat2d', '.mat3d'
 */
export const getFiles = (dir: string, extensions: string[] = ['.mat', '.mat2d', '.mat3d']): string[] => {
  try {
    const normalized = path.normalize(dir)
    console.log(`-- Checking for files in ${normalized}`)
    const fileNames = fs.readdirSync(normalized)
    console.log(`-- Found ${fileNames.length} files`)
    const filteredFileNames = filterFilesOnExtensions(fileNames, extensions, dir)
    console.log(`-- Matched ${filteredFileNames.length} files to ${extensions.length} valid extensions`)
    filteredFileNames.forEach(f => {
      console.log(`---- File: ${f}. Extension: ${path.extname(f)}`)
    })
    return filteredFileNames
  } catch (e) {
    console.log(`An error has occurred: ${e}`)
    return []
  }
}
