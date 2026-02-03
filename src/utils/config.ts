import * as vscode from 'vscode';
import { DEFAULT_EXCLUDE_DECORATORS } from '../core/decorator-checker';
import { ExtensionConfig } from '../types';

const CONFIG_SECTION = 'unusedExports';

/**
 * Extension 설정을 가져옴
 */
export function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    enabled: config.get<boolean>('enabled', true),
    opacity: config.get<number>('opacity', 0.5),
    excludePatterns: config.get<string[]>('excludePatterns', [
      '**/node_modules/**',
      '**/*.d.ts',
      '**/index.ts',
      '**/index.tsx',
    ]),
    includeDefaultExports: config.get<boolean>('includeDefaultExports', false),
    debounceMs: config.get<number>('debounceMs', 1000),
    analysisStrategy: config.get<'fast' | 'accurate' | 'hybrid'>(
      'analysisStrategy',
      'hybrid'
    ),
    analyzeClassMembers: config.get<boolean>('analyzeClassMembers', true),
    excludeDecorators: config.get<string[]>(
      'excludeDecorators',
      DEFAULT_EXCLUDE_DECORATORS
    ),
    excludeMemberPatterns: config.get<string[]>('excludeMemberPatterns', [
      '*.entity.ts',
      '*.dto.ts',
      '*.model.ts',
    ]),
  };
}

/**
 * 설정 변경 이벤트 리스너 등록
 */
export function onConfigChange(
  callback: (config: ExtensionConfig) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      callback(getConfig());
    }
  });
}
