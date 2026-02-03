import * as crypto from 'crypto';
import { CacheEntry, ExportInfo, ReferenceResult } from '../types';

/**
 * 분석 결과 캐시 관리
 */
export class AnalysisCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxAge: number;

  constructor(maxAgeMs: number = 5 * 60 * 1000) {
    this.maxAge = maxAgeMs;
  }

  /**
   * 캐시된 분석 결과 조회
   */
  get(filePath: string): CacheEntry | undefined {
    const entry = this.cache.get(filePath);

    if (!entry) {
      return undefined;
    }

    // 만료 체크
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(filePath);
      return undefined;
    }

    return entry;
  }

  /**
   * 분석 결과 캐싱
   */
  set(
    filePath: string,
    exports: ExportInfo[],
    references: Map<string, ReferenceResult>,
    content: string
  ): void {
    const entry: CacheEntry = {
      exports,
      references,
      timestamp: Date.now(),
      fileHash: this.computeHash(content),
    };

    this.cache.set(filePath, entry);
  }

  /**
   * 파일 내용이 변경되었는지 확인
   */
  hasChanged(filePath: string, content: string): boolean {
    const entry = this.cache.get(filePath);

    if (!entry) {
      return true;
    }

    return entry.fileHash !== this.computeHash(content);
  }

  /**
   * 특정 파일의 캐시 무효화
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * 관련 파일들의 캐시 무효화
   * (import하는 파일이 변경되면 참조 분석 결과도 무효화)
   */
  invalidateRelated(changedFilePath: string): void {
    for (const [filePath, entry] of this.cache.entries()) {
      // 참조 결과에 변경된 파일이 포함되어 있으면 무효화
      for (const result of entry.references.values()) {
        if (result.references.includes(changedFilePath)) {
          this.cache.delete(filePath);
          break;
        }
      }
    }
  }

  /**
   * 전체 캐시 클리어
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 크기 반환
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 파일 내용의 해시 계산
   */
  private computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}
