import { minimatch } from 'minimatch';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * 지원하는 파일 확장자
 */
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];

/**
 * 파일이 TypeScript/JavaScript 파일인지 확인
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * 파일이 제외 패턴에 해당하는지 확인
 */
export function isExcluded(
  filePath: string,
  excludePatterns: string[]
): boolean {
  const relativePath = vscode.workspace.asRelativePath(filePath);

  return excludePatterns.some((pattern) => {
    return minimatch(relativePath, pattern, { dot: true });
  });
}

/**
 * 워크스페이스 루트 경로 반환
 * @param documentUri - 문서 URI (제공되면 해당 문서가 속한 워크스페이스 반환)
 */
export function getWorkspaceRoot(documentUri?: vscode.Uri): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  // documentUri가 제공되면 해당 문서가 속한 워크스페이스 찾기
  if (documentUri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (workspaceFolder) {
      return workspaceFolder.uri.fsPath;
    }
  }

  // fallback: 첫 번째 워크스페이스 반환
  return workspaceFolders[0].uri.fsPath;
}

/**
 * 상대 경로를 절대 경로로 변환
 */
export function toAbsolutePath(relativePath: string): string | undefined {
  const root = getWorkspaceRoot();

  if (!root) {
    return undefined;
  }

  return path.resolve(root, relativePath);
}

/**
 * 절대 경로를 상대 경로로 변환
 */
export function toRelativePath(absolutePath: string): string {
  return vscode.workspace.asRelativePath(absolutePath);
}

/**
 * debounce 유틸리티
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, ms);
  };
}
