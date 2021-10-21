import 'dotenv/config'
import { getFiles } from './utils'
import { ProcessFile } from './processor'

const processDir = (targetDir: string) => {
  const filePaths = getFiles(targetDir)

  console.log(`-- Index got ${filePaths.length} files`)
  // ProcessFile(filePaths[0])

  filePaths.forEach(f => {
    ProcessFile(f)
  })
}

const targetDirs = [
  `C:\\numbersdata\\Matlab script files-20211005T020631Z-001\\Ch_NoCh5`,
  `C:\\numbersdata\\Matlab script files-20211005T020631Z-001\\Basic6Nums`,
  `C:\\numbersdata\\Habituated6Numbers_15Subjects-20211005T020553Z-001`,
  `C:\\numbersdata\\Target6Number_30pairs_correct-20211005T020919Z-001`,
  `C:\\numbersdata\\WEvaluation01-20211005T020634Z-001`
]

targetDirs.forEach(f => {
  processDir(f)
})
