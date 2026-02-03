import * as vscode from 'vscode';

/**
 * Export 종류
 */
export type ExportKind =
  | 'class'
  | 'function'
  | 'const'
  | 'let'
  | 'var'
  | 'type'
  | 'interface'
  | 'enum'
  | 'namespace';

/**
 * Export 정보
 */
export interface ExportInfo {
  /** export된 심볼 이름 */
  name: string;
  /** export 종류 */
  kind: ExportKind;
  /** 코드 위치 (Range) */
  range: vscode.Range;
  /** export default 여부 */
  isDefault: boolean;
  /** 파일 경로 */
  filePath: string;
  /** 전체 export 구문 텍스트 */
  fullText?: string;
}

/**
 * 참조 분석 결과
 */
export interface ReferenceResult {
  /** 분석 대상 export */
  exportInfo: ExportInfo;
  /** 참조하는 파일 경로들 */
  references: string[];
  /** 사용 여부 (참조가 1개 이상이면 true) */
  isUsed: boolean;
}

/**
 * 캐시 엔트리
 */
export interface CacheEntry {
  /** 파일의 export 목록 */
  exports: ExportInfo[];
  /** 참조 분석 결과 */
  references: Map<string, ReferenceResult>;
  /** 캐시 생성 시간 */
  timestamp: number;
  /** 파일 해시 (변경 감지용) */
  fileHash: string;
}

/**
 * Extension 설정
 */
export interface ExtensionConfig {
  /** 활성화 여부 */
  enabled: boolean;
  /** 미사용 export 투명도 (0.1 ~ 1.0) */
  opacity: number;
  /** 분석 제외 패턴 */
  excludePatterns: string[];
  /** default export 포함 여부 */
  includeDefaultExports: boolean;
  /** debounce 시간 (ms) */
  debounceMs: number;
  /** 분석 전략 */
  analysisStrategy: 'fast' | 'accurate' | 'hybrid';
  /** 클래스 멤버 분석 활성화 여부 */
  analyzeClassMembers: boolean;
  /** 미사용 감지에서 제외할 데코레이터 목록 */
  excludeDecorators: string[];
  /** 클래스 멤버 분석에서 제외할 파일 패턴 */
  excludeMemberPatterns: string[];
}

/**
 * 분석 상태
 */
export interface AnalysisStatus {
  /** 분석 중 여부 */
  isAnalyzing: boolean;
  /** 마지막 분석 시간 */
  lastAnalyzedAt?: number;
  /** 분석된 파일 수 */
  analyzedFiles: number;
  /** 발견된 미사용 export 수 */
  unusedExportsCount: number;
  /** 발견된 미사용 클래스 멤버 수 */
  unusedMembersCount: number;
}

// ============================================
// 클래스 멤버 관련 타입
// ============================================

/**
 * 클래스 멤버 종류
 */
export type MemberKind = 'property' | 'method' | 'getter' | 'setter';

/**
 * 접근 제어자
 */
export type AccessModifier = 'public' | 'protected' | 'private';

/**
 * 클래스 멤버 정보
 */
export interface ClassMemberInfo {
  /** 멤버 이름 */
  name: string;
  /** 멤버 종류 */
  kind: MemberKind;
  /** 접근 제어자 */
  accessModifier: AccessModifier;
  /** 코드 위치 (Range) */
  range: vscode.Range;
  /** 소속 클래스 이름 */
  className: string;
  /** 파일 경로 */
  filePath: string;
  /** 데코레이터 존재 여부 */
  hasDecorator: boolean;
  /** 데코레이터 이름 목록 */
  decorators: string[];
}

/**
 * 클래스 멤버 참조 분석 결과
 */
export interface MemberReferenceResult {
  /** 분석 대상 멤버 */
  memberInfo: ClassMemberInfo;
  /** 참조 위치들 */
  references: vscode.Range[];
  /** 사용 여부 */
  isUsed: boolean;
}

/**
 * 미사용 항목 (export 또는 클래스 멤버)
 */
export interface UnusedItem {
  /** 항목 종류 */
  type: 'export' | 'member';
  /** 이름 */
  name: string;
  /** 코드 위치 */
  range: vscode.Range;
  /** 상세 정보 */
  detail?: string;
}
