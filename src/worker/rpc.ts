import { dirname } from 'pathe'
import type { ChannelOptions } from 'birpc'
import { createBirpc } from 'birpc'
import type { Vitest } from 'vitest'
import type { BirpcEvents, BirpcMethods } from '../api/rpc'

const _require = require

export function createWorkerRPC(vitest: Vitest[], channel: ChannelOptions) {
  let debuggerEnabled = false
  const vitestByFolder = vitest.reduce((acc, vitest) => {
    acc[getId(vitest)] = vitest
    return acc
  }, {} as Record<string, Vitest>)
  const vitestEntries = Object.entries(vitestByFolder)

  function getId(vitest: Vitest) {
    return vitest.server.config.configFile || vitest.config.workspace || vitest.config.root
  }

  async function runTests(vitest: Vitest, files: string[], testNamePattern?: string) {
    const cwd = process.cwd()
    process.chdir(dirname(getId(vitest)))
    try {
      vitest.configOverride.testNamePattern = testNamePattern ? new RegExp(testNamePattern) : undefined

      if (!debuggerEnabled) {
        await vitest.rerunFiles(files)
      }
      else {
        for (const file of files)
          await vitest.rerunFiles([file])
      }
    }
    finally {
      vitest.configOverride.testNamePattern = /$a/ // don't "run" tests on change, but still collect them
      process.chdir(cwd)
    }
  }

  async function globTestFiles(vitest: Vitest, filters?: string[]) {
    const cwd = process.cwd()
    process.chdir(vitest.config.root)
    const files = await vitest.globTestFiles(filters)
    process.chdir(cwd)
    return files
  }

  const rpc = createBirpc<BirpcEvents, BirpcMethods>({
    async collectTests(config: string, testFile: string) {
      const vitest = vitestByFolder[config]
      await runTests(vitest, [testFile], '$a')
    },
    async cancelRun(config: string) {
      await vitestByFolder[config]?.cancelCurrentRun('keyboard-input')
    },
    async runTests(config, files, testNamePattern) {
      const vitest = vitestByFolder[config]
      if (!vitest)
        throw new Error(`Vitest instance not found for config: ${config}`)

      if (testNamePattern) {
        await runTests(vitest, files || vitest.state.getFilepaths(), testNamePattern)
      }
      else {
        const specs = await globTestFiles(vitest, files)
        await runTests(vitest, specs.map(([_, spec]) => spec))
      }
    },
    async getFiles(config: string) {
      const vitest = vitestByFolder[config]
      const files = await globTestFiles(vitest)
      // reset cached test files list
      vitest.projects.forEach((project) => {
        project.testFilesList = null
      })
      return files.map(([project, spec]) => [project.config.name || '', spec])
    },
    async isTestFile(file: string) {
      for (const [_, vitest] of vitestEntries) {
        for (const project of vitest.projects) {
          if (project.isTestFile(file))
            return true
        }
      }
      return false
    },
    startInspect(port) {
      _require('inspector').open(port)
      debuggerEnabled = true
    },
    stopInspect() {
      debuggerEnabled = false
      _require('inspector').close()
    },
    async close() {
      for (const vitest of vitestEntries) {
        try {
          await vitest[1].close()
        }
        catch {
          // ignore
        }
      }
    },
  }, {
    timeout: -1,
    eventNames: [
      'onConsoleLog',
      'onTaskUpdate',
      'onFinished',
      'onCollected',
    ],
    ...channel,
  })
  return rpc
}
