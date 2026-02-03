import * as vscode from 'vscode';
import { ExportInfo, ExportKind } from '../types';

/**
 * Export 구문 파싱을 위한 정규식 패턴들
 */
const EXPORT_PATTERNS = {
  // export class ClassName
  class: /export\s+class\s+(\w+)/g,
  // export abstract class ClassName
  abstractClass: /export\s+abstract\s+class\s+(\w+)/g,
  // export function functionName
  function: /export\s+function\s+(\w+)/g,
  // export async function functionName
  asyncFunction: /export\s+async\s+function\s+(\w+)/g,
  // export const/let/var variableName
  variable: /export\s+(const|let|var)\s+(\w+)/g,
  // export type TypeName
  type: /export\s+type\s+(\w+)/g,
  // export interface InterfaceName
  interface: /export\s+interface\s+(\w+)/g,
  // export enum EnumName
  enum: /export\s+enum\s+(\w+)/g,
  // export namespace NamespaceName
  namespace: /export\s+namespace\s+(\w+)/g,
  // export default (감지용)
  default: /export\s+default\s+/g,
};

/**
 * 파일에서 export 구문을 찾는 클래스
 */
export class ExportFinder {
  /**
   * 문서에서 모든 export 구문을 찾아 반환
   */
  findExports(document: vscode.TextDocument): ExportInfo[] {
    const text = document.getText();
    const filePath = document.uri.fsPath;
    const exports: ExportInfo[] = [];

    // Class exports
    exports.push(
      ...this.findPattern(document, text, EXPORT_PATTERNS.class, 'class', 1)
    );
    exports.push(
      ...this.findPattern(
        document,
        text,
        EXPORT_PATTERNS.abstractClass,
        'class',
        1
      )
    );

    // Function exports
    exports.push(
      ...this.findPattern(
        document,
        text,
        EXPORT_PATTERNS.function,
        'function',
        1
      )
    );
    exports.push(
      ...this.findPattern(
        document,
        text,
        EXPORT_PATTERNS.asyncFunction,
        'function',
        1
      )
    );

    // Variable exports
    exports.push(...this.findVariableExports(document, text));

    // Type exports
    exports.push(
      ...this.findPattern(document, text, EXPORT_PATTERNS.type, 'type', 1)
    );

    // Interface exports
    exports.push(
      ...this.findPattern(
        document,
        text,
        EXPORT_PATTERNS.interface,
        'interface',
        1
      )
    );

    // Enum exports
    exports.push(
      ...this.findPattern(document, text, EXPORT_PATTERNS.enum, 'enum', 1)
    );

    // Namespace exports
    exports.push(
      ...this.findPattern(
        document,
        text,
        EXPORT_PATTERNS.namespace,
        'namespace',
        1
      )
    );

    // 파일 경로 설정
    return exports.map((exp) => ({ ...exp, filePath }));
  }

  /**
   * Named export만 필터링 (export default 제외)
   */
  findNamedExports(document: vscode.TextDocument): ExportInfo[] {
    return this.findExports(document).filter((exp) => !exp.isDefault);
  }

  /**
   * 정규식 패턴으로 export 찾기
   */
  private findPattern(
    document: vscode.TextDocument,
    text: string,
    pattern: RegExp,
    kind: ExportKind,
    nameGroupIndex: number
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];
    // 정규식 재사용을 위해 lastIndex 리셋
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[nameGroupIndex];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);

      exports.push({
        name,
        kind,
        range: new vscode.Range(startPos, endPos),
        isDefault: false,
        filePath: document.uri.fsPath,
        fullText: match[0],
      });
    }

    return exports;
  }

  /**
   * 변수 export 찾기 (const, let, var)
   */
  private findVariableExports(
    document: vscode.TextDocument,
    text: string
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const pattern = EXPORT_PATTERNS.variable;
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const varKind = match[1] as 'const' | 'let' | 'var';
      const name = match[2];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);

      exports.push({
        name,
        kind: varKind,
        range: new vscode.Range(startPos, endPos),
        isDefault: false,
        filePath: document.uri.fsPath,
        fullText: match[0],
      });
    }

    return exports;
  }

  /**
   * export default 구문인지 확인
   */
  isDefaultExport(text: string, position: number): boolean {
    const beforeText = text.substring(
      Math.max(0, position - 50),
      position + 20
    );
    return /export\s+default\s+/.test(beforeText);
  }
}
