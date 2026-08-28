import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * 简单的 JSON 文件存储
 * 用于替代 SQLite，避免原生模块兼容性问题
 */
export class JsonStore<T> {
  private filePath: string;
  private defaultValue: T;

  constructor(filePath: string, defaultValue: T) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
    this.ensureDir();
  }

  private ensureDir(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
  }

  private read(): T {
    if (!existsSync(this.filePath)) {
      return JSON.parse(JSON.stringify(this.defaultValue));
    }
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8'));
    } catch {
      return JSON.parse(JSON.stringify(this.defaultValue));
    }
  }

  private write(data: T): void {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  get(): T {
    return this.read();
  }

  set(data: T): void {
    this.write(data);
  }

  update(updater: (data: T) => T): T {
    const data = this.read();
    const updated = updater(data);
    this.write(updated);
    return updated;
  }
}
