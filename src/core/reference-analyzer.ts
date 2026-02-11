import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ExportInfo, ReferenceResult } from '../types';
import {
  getWorkspaceRoot,
  isExcluded,
  isSupportedFile,
} from '../utils/file-utils';

/**
 * Export 참조 분석 클래스
 */
export class ReferenceAnalyzer {
  private excludePatterns: string[];

  constructor(excludePatterns: string[] = []) {
    this.excludePatterns = excludePatterns;
  }

  /**
   * 제외 패턴 업데이트
   */
  setExcludePatterns(patterns: string[]): void {
    this.excludePatterns = patterns;
  }

  /**
   * 단일 export의 참조 분석
   */
  async analyzeReference(exportInfo: ExportInfo): Promise<ReferenceResult> {
    // exportInfo.filePath를 URI로 변환하여 올바른 워크스페이스 찾기
    const documentUri = vscode.Uri.file(exportInfo.filePath);
    const workspaceRoot = getWorkspaceRoot(documentUri);

    if (!workspaceRoot) {
      return {
        exportInfo,
        references: [],
        isUsed: false,
      };
    }

    // 같은 파일 내에서 사용되는지 먼저 체크
    const isUsedInSameFile = await this.checkUsageInSameFile(exportInfo);
    if (isUsedInSameFile) {
      return {
        exportInfo,
        references: [exportInfo.filePath],
        isUsed: true,
      };
    }

    const references = await this.findReferencesWithRipgrep(
      exportInfo.name,
      workspaceRoot,
      exportInfo.filePath
    );

    return {
      exportInfo,
      references,
      isUsed: references.length > 0,
    };
  }

  /**
   * 같은 파일 내에서 export된 심볼이 사용되는지 체크
   * (export 선언부 외에 다른 곳에서 참조되는지 확인)
   */
  private async checkUsageInSameFile(exportInfo: ExportInfo): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(
        exportInfo.filePath
      );
      const text = document.getText();
      const symbolName = exportInfo.name;

      // export 선언부의 위치
      const exportStartOffset = document.offsetAt(exportInfo.range.start);
      const exportEndOffset = document.offsetAt(exportInfo.range.end);

      // 심볼이 사용되는 모든 위치 찾기 (단어 경계 사용)
      const usageRegex = new RegExp(`\\b${symbolName}\\b`, 'g');
      let match: RegExpExecArray | null;

      while ((match = usageRegex.exec(text)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // export 선언부 내의 사용은 제외
        if (matchStart >= exportStartOffset && matchEnd <= exportEndOffset) {
          continue;
        }

        // import 구문 내의 사용은 제외 (re-export 등)
        const lineStart = text.lastIndexOf('\n', matchStart) + 1;
        const lineEnd = text.indexOf('\n', matchStart);
        const line = text.substring(
          lineStart,
          lineEnd === -1 ? text.length : lineEnd
        );
        if (/^\s*import\s+/.test(line)) {
          continue;
        }

        // export 선언부 외에서 사용됨
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking same file usage:', error);
      return false;
    }
  }

  /**
   * 여러 export를 배치로 분석
   */
  async analyzeBatch(exports: ExportInfo[]): Promise<ReferenceResult[]> {
    const results: ReferenceResult[] = [];

    for (const exportInfo of exports) {
      const result = await this.analyzeReference(exportInfo);
      results.push(result);
    }

    return results;
  }

  /**
   * ripgrep을 사용한 빠른 참조 검색
   */
  private async findReferencesWithRipgrep(
    symbolName: string,
    workspaceRoot: string,
    sourceFilePath: string
  ): Promise<string[]> {
    return new Promise((resolve) => {
      // import 구문에서 해당 심볼을 찾는 패턴
      // import { symbolName } from '...'
      // import { symbolName as alias } from '...'
      // import symbolName from '...'
      const importPattern = String.raw`(import\s+.*\{[^}]*\b${symbolName}\b[^}]*\}|import\s+${symbolName}\s+from|import\s+\*\s+as\s+\w+\s+from)`;

      const args = [
        '--type',
        'ts',
        '--type',
        'js',
        '-l', // 파일명만 출력
        '-e',
        importPattern,
        '--glob',
        '!node_modules/**',
        '--glob',
        '!*.d.ts',
        '.',
      ];

      const rg = cp.spawn('rg', args, {
        cwd: workspaceRoot,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      rg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      rg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      rg.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          // code 1 = no matches found (정상)
          console.error(`ripgrep error: ${stderr}`);
          resolve([]);
          return;
        }

        const files = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((relativePath) => path.resolve(workspaceRoot, relativePath))
          .filter((filePath) => {
            // 자기 자신 제외
            if (filePath === sourceFilePath) {
              return false;
            }
            // 지원하는 파일만
            if (!isSupportedFile(filePath)) {
              return false;
            }
            // 제외 패턴 체크
            if (isExcluded(filePath, this.excludePatterns)) {
              return false;
            }
            return true;
          });

        resolve(files);
      });

      rg.on('error', (err) => {
        console.error(`ripgrep spawn error: ${err.message}`);
        // ripgrep이 없으면 VS Code API로 fallback
        this.findReferencesWithVSCode(symbolName, workspaceRoot, sourceFilePath)
          .then(resolve)
          .catch(() => resolve([]));
      });
    });
  }

  /**
   * VS Code API를 사용한 참조 검색 (fallback)
   */
  private async findReferencesWithVSCode(
    symbolName: string,
    workspaceRoot: string,
    sourceFilePath: string
  ): Promise<string[]> {
    const pattern = `**/*.{ts,tsx,js,jsx}`;
    const exclude = '**/node_modules/**';

    const files = await vscode.workspace.findFiles(pattern, exclude, 1000);
    const references: string[] = [];

    for (const file of files) {
      if (file.fsPath === sourceFilePath) {
        continue;
      }

      if (isExcluded(file.fsPath, this.excludePatterns)) {
        continue;
      }

      try {
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();

        // import 구문에서 심볼 검색
        const importRegex = new RegExp(
          String.raw`import\s+.*\{[^}]*\b${symbolName}\b[^}]*\}|import\s+${symbolName}\s+from`,
          'g'
        );

        if (importRegex.test(text)) {
          references.push(file.fsPath);
        }
      } catch (error) {
        // 파일 읽기 실패 무시
      }
    }

    return references;
  }
}
