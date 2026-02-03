import * as vscode from 'vscode';
import { ClassMemberFinder } from './core/class-member-finder';
import { DecorationManager } from './core/decoration-manager';
import { DecoratorChecker } from './core/decorator-checker';
import { ExportFinder } from './core/export-finder';
import { MemberReferenceAnalyzer } from './core/member-reference-analyzer';
import { ReferenceAnalyzer } from './core/reference-analyzer';
import { AnalysisStatus, ExtensionConfig, UnusedItem } from './types';
import { AnalysisCache } from './utils/cache';
import { getConfig, onConfigChange } from './utils/config';
import { debounce, isExcluded, isSupportedFile } from './utils/file-utils';

let exportFinder: ExportFinder;
let referenceAnalyzer: ReferenceAnalyzer;
let classMemberFinder: ClassMemberFinder;
let memberReferenceAnalyzer: MemberReferenceAnalyzer;
let decoratorChecker: DecoratorChecker;
let decorationManager: DecorationManager;
let analysisCache: AnalysisCache;
let config: ExtensionConfig;
let statusBarItem: vscode.StatusBarItem;
let isEnabled = true;

// 분석 상태
const analysisStatus: AnalysisStatus = {
  isAnalyzing: false,
  analyzedFiles: 0,
  unusedExportsCount: 0,
  unusedMembersCount: 0,
};

/**
 * Extension 활성화
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Unused Exports Highlighter is now active');

  // 설정 로드
  config = getConfig();
  isEnabled = config.enabled;

  // 핵심 모듈 초기화
  exportFinder = new ExportFinder();
  referenceAnalyzer = new ReferenceAnalyzer(config.excludePatterns);
  classMemberFinder = new ClassMemberFinder();
  memberReferenceAnalyzer = new MemberReferenceAnalyzer();
  decoratorChecker = new DecoratorChecker(config.excludeDecorators);
  decorationManager = new DecorationManager(config.opacity);
  analysisCache = new AnalysisCache();

  // 상태바 아이템 생성
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'unusedExports.toggle';
  updateStatusBar();
  statusBarItem.show();

  // debounced 분석 함수
  const debouncedAnalyze = debounce(
    (document: vscode.TextDocument) => analyzeDocument(document),
    config.debounceMs
  );

  // 이벤트 리스너 등록
  context.subscriptions.push(
    // 에디터 변경 시
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isEnabled) {
        debouncedAnalyze(editor.document);
      }
    }),

    // 문서 저장 시
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isEnabled) {
        // 저장된 파일과 관련된 캐시 무효화
        analysisCache.invalidate(document.uri.fsPath);
        analysisCache.invalidateRelated(document.uri.fsPath);

        // 현재 열린 에디터 재분석
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          debouncedAnalyze(editor.document);
        }
      }
    }),

    // 문서 열릴 때
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isEnabled) {
        debouncedAnalyze(document);
      }
    }),

    // 설정 변경 시
    onConfigChange((newConfig) => {
      config = newConfig;
      referenceAnalyzer.setExcludePatterns(config.excludePatterns);
      decoratorChecker.setExcludeDecorators(config.excludeDecorators);
      decorationManager.updateOpacity(config.opacity);

      if (config.enabled !== isEnabled) {
        isEnabled = config.enabled;
        if (!isEnabled) {
          decorationManager.clearAllDecorations();
        } else {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            analyzeDocument(editor.document);
          }
        }
      }

      updateStatusBar();
    }),

    // 명령어 등록
    vscode.commands.registerCommand(
      'unusedExports.analyzeWorkspace',
      analyzeWorkspace
    ),
    vscode.commands.registerCommand(
      'unusedExports.analyzeCurrentFile',
      analyzeCurrentFile
    ),
    vscode.commands.registerCommand('unusedExports.clearCache', clearCache),
    vscode.commands.registerCommand('unusedExports.toggle', toggleHighlighting),

    // 상태바 아이템
    statusBarItem,

    // 데코레이션 매니저
    { dispose: () => decorationManager.dispose() },

    // 클래스 멤버 파인더
    { dispose: () => classMemberFinder.dispose() }
  );

  // 현재 열린 에디터 분석
  if (vscode.window.activeTextEditor && isEnabled) {
    analyzeDocument(vscode.window.activeTextEditor.document);
  }
}

/**
 * Extension 비활성화
 */
export function deactivate(): void {
  decorationManager?.dispose();
  classMemberFinder?.dispose();
  analysisCache?.clear();
}

/**
 * 파일이 클래스 멤버 분석 제외 패턴에 해당하는지 확인
 */
function isExcludedFromMemberAnalysis(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  return config.excludeMemberPatterns.some((pattern) => {
    // 간단한 glob 패턴 매칭 (*.entity.ts 등)
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$'
    );
    return regex.test(fileName);
  });
}

/**
 * 문서 분석 및 데코레이션 적용
 */
async function analyzeDocument(document: vscode.TextDocument): Promise<void> {
  if (!isEnabled) {
    return;
  }

  const filePath = document.uri.fsPath;

  // 지원하지 않는 파일 또는 제외 패턴 체크
  if (
    !isSupportedFile(filePath) ||
    isExcluded(filePath, config.excludePatterns)
  ) {
    return;
  }

  const editor = vscode.window.visibleTextEditors.find(
    (e) => e.document.uri.fsPath === filePath
  );

  if (!editor) {
    return;
  }

  // 캐시 확인
  const content = document.getText();
  if (!analysisCache.hasChanged(filePath, content)) {
    const cached = analysisCache.get(filePath);
    if (cached) {
      const unusedExports = Array.from(cached.references.values())
        .filter((r) => !r.isUsed)
        .map((r) => r.exportInfo);
      decorationManager.applyDecorations(editor, unusedExports);
      return;
    }
  }

  // 분석 시작
  analysisStatus.isAnalyzing = true;
  updateStatusBar();

  try {
    // 미사용 항목 수집
    const unusedItems: UnusedItem[] = [];

    // 1. Export 분석
    const exports = config.includeDefaultExports
      ? exportFinder.findExports(document)
      : exportFinder.findNamedExports(document);

    if (exports.length > 0) {
      const exportResults = await referenceAnalyzer.analyzeBatch(exports);
      const unusedExports = exportResults
        .filter((r) => !r.isUsed)
        .map((r) => ({
          type: 'export' as const,
          name: r.exportInfo.name,
          range: r.exportInfo.range,
          detail: `Unused ${r.exportInfo.kind}`,
        }));
      unusedItems.push(...unusedExports);

      // 캐시 저장
      const referencesMap = new Map(
        exportResults.map((r) => [r.exportInfo.name, r])
      );
      analysisCache.set(filePath, exports, referencesMap, content);
    }

    // 2. 클래스 멤버 분석 (설정이 활성화되어 있고, 제외 패턴이 아닌 경우)
    if (config.analyzeClassMembers && !isExcludedFromMemberAnalysis(filePath)) {
      const unusedMembers = await analyzeClassMembers(document, content);
      unusedItems.push(...unusedMembers);
    }

    // 데코레이션 적용 (모든 미사용 항목)
    decorationManager.applyDecorationsFromItems(editor, unusedItems);

    // 상태 업데이트
    analysisStatus.unusedExportsCount = unusedItems.filter(
      (i) => i.type === 'export'
    ).length;
    analysisStatus.unusedMembersCount = unusedItems.filter(
      (i) => i.type === 'member'
    ).length;
    analysisStatus.lastAnalyzedAt = Date.now();
  } catch (error) {
    console.error('Analysis error:', error);
  } finally {
    analysisStatus.isAnalyzing = false;
    updateStatusBar();
  }
}

/**
 * 클래스 멤버 분석
 * 현재는 private 멤버만 분석 (public/protected는 외부 참조 분석이 복잡하여 제외)
 */
async function analyzeClassMembers(
  document: vscode.TextDocument,
  content: string
): Promise<UnusedItem[]> {
  const unusedItems: UnusedItem[] = [];

  try {
    // 클래스 멤버 찾기
    const allMembers = classMemberFinder.findClassMembers(document);

    // 데코레이터가 있는 멤버 제외
    const membersWithoutDecorators =
      decoratorChecker.filterAnalyzableMembers(allMembers);

    // private 멤버만 필터링 (public/protected는 외부에서 사용될 수 있으므로 제외)
    const analyzableMembers = membersWithoutDecorators.filter(
      (member) => member.accessModifier === 'private'
    );

    // 참조 분석
    const memberResults = await memberReferenceAnalyzer.analyzeBatch(
      analyzableMembers,
      content
    );

    // 미사용 멤버 수집
    for (const result of memberResults) {
      if (!result.isUsed) {
        unusedItems.push({
          type: 'member',
          name: result.memberInfo.name,
          range: result.memberInfo.range,
          detail: `Unused ${result.memberInfo.accessModifier} ${result.memberInfo.kind} in ${result.memberInfo.className}`,
        });
      }
    }
  } catch (error) {
    console.error('Class member analysis error:', error);
  }

  return unusedItems;
}

/**
 * 워크스페이스 전체 분석
 */
async function analyzeWorkspace(): Promise<void> {
  const files = await vscode.workspace.findFiles(
    '**/*.{ts,tsx,js,jsx}',
    '**/node_modules/**',
    500
  );

  analysisStatus.analyzedFiles = 0;
  analysisStatus.unusedExportsCount = 0;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing workspace for unused exports...',
      cancellable: true,
    },
    async (progress, token) => {
      for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }

        const file = files[i];
        progress.report({
          message: `${i + 1}/${files.length}: ${vscode.workspace.asRelativePath(
            file
          )}`,
          increment: 100 / files.length,
        });

        try {
          const document = await vscode.workspace.openTextDocument(file);
          await analyzeDocument(document);
          analysisStatus.analyzedFiles++;
        } catch (error) {
          // 파일 열기 실패 무시
        }
      }
    }
  );

  vscode.window.showInformationMessage(
    `Analyzed ${analysisStatus.analyzedFiles} files. Found ${analysisStatus.unusedExportsCount} unused exports.`
  );
}

/**
 * 현재 파일 분석
 */
async function analyzeCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  // 캐시 무효화 후 재분석
  analysisCache.invalidate(editor.document.uri.fsPath);
  await analyzeDocument(editor.document);

  vscode.window.showInformationMessage('Current file analyzed');
}

/**
 * 캐시 클리어
 */
function clearCache(): void {
  analysisCache.clear();
  vscode.window.showInformationMessage('Unused exports cache cleared');
}

/**
 * 하이라이팅 토글
 */
function toggleHighlighting(): void {
  isEnabled = !isEnabled;

  if (!isEnabled) {
    decorationManager.clearAllDecorations();
  } else {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      analyzeDocument(editor.document);
    }
  }

  updateStatusBar();
  vscode.window.showInformationMessage(
    `Unused exports highlighting ${isEnabled ? 'enabled' : 'disabled'}`
  );
}

/**
 * 상태바 업데이트
 */
function updateStatusBar(): void {
  if (analysisStatus.isAnalyzing) {
    statusBarItem.text = '$(sync~spin) Analyzing...';
  } else if (isEnabled) {
    const totalUnused =
      analysisStatus.unusedExportsCount + analysisStatus.unusedMembersCount;
    if (config.analyzeClassMembers) {
      statusBarItem.text = `$(eye) Unused: ${totalUnused} (${analysisStatus.unusedExportsCount}E/${analysisStatus.unusedMembersCount}M)`;
    } else {
      statusBarItem.text = `$(eye) Unused: ${analysisStatus.unusedExportsCount}`;
    }
  } else {
    statusBarItem.text = '$(eye-closed) Unused Exports';
  }

  statusBarItem.tooltip = isEnabled
    ? 'Click to disable unused exports highlighting'
    : 'Click to enable unused exports highlighting';
}
