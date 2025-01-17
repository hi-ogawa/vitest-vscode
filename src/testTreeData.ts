import type * as vscode from 'vscode'
import type { VitestFolderAPI } from './api'

export type TestData = TestFolder | TestFile | TestCase | TestSuite

const WEAKMAP_TEST_DATA = new WeakMap<vscode.TestItem, TestData>()

export function getTestData(item: vscode.TestItem): TestData {
  return WEAKMAP_TEST_DATA.get(item)!
}

export function addTestData<T extends TestData>(item: vscode.TestItem, data: T): T {
  WEAKMAP_TEST_DATA.set(item, data)
  return data
}

export class TestFolder {
  private constructor(
    public readonly item: vscode.TestItem,
  ) {}

  public static register(item: vscode.TestItem) {
    return addTestData(item, new TestFolder(item))
  }
}

export class TestFile {
  private constructor(
    public readonly item: vscode.TestItem,
    public readonly filepath: string,
    public readonly api: VitestFolderAPI,
  ) {}

  public static register(
    item: vscode.TestItem,
    filepath: string,
    api: VitestFolderAPI,
  ) {
    return addTestData(item, new TestFile(item, filepath, api))
  }
}

class TaskName {
  constructor(
    private readonly data: TestData,
  ) {}

  getTestNamePattern() {
    const patterns = [this.data.item.label]
    let iter = this.data.item.parent
    while (iter) {
      // if we reached test file, then stop
      const data = getTestData(iter)
      if (data instanceof TestFile || data instanceof TestFolder)
        break
      patterns.push(iter.label)
      iter = iter.parent
    }
    // vitest's test task name starts with ' ' of root suite
    // It's considered as a bug, but it's not fixed yet for backward compatibility
    return `\\s?${patterns.reverse().join(' ')}`
  }
}

export class TestCase {
  private nameResolver: TaskName

  private constructor(
    public readonly item: vscode.TestItem,
  ) {
    this.nameResolver = new TaskName(this)
  }

  public static register(item: vscode.TestItem) {
    return addTestData(item, new TestCase(item))
  }

  getTestNamePattern() {
    return `^${this.nameResolver.getTestNamePattern()}$`
  }
}

export class TestSuite {
  private nameResolver: TaskName

  private constructor(
    public readonly item: vscode.TestItem,
  ) {
    this.nameResolver = new TaskName(this)
  }

  public static register(item: vscode.TestItem) {
    return addTestData(item, new TestSuite(item))
  }

  getTestNamePattern() {
    return `^${this.nameResolver.getTestNamePattern()}`
  }
}
