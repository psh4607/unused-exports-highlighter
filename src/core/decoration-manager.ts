import * as vscode from 'vscode';
import { ExportInfo, UnusedItem } from '../types';

/**
 * 미사용 export에 대한 시각적 데코레이션 관리
 */
export class DecorationManager {
  private unusedDecoration: vscode.TextEditorDecorationType;
  private readonly currentDecorations: Map<string, vscode.Range[]> = new Map();

  constructor(opacity: number = 0.5) {
    this.unusedDecoration = this.createDecorationType(opacity);
  }

  /**
   * 데코레이션 타입 생성
   */
  private createDecorationType(
    opacity: number
  ): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      opacity: opacity.toString(),
      // 추가 스타일 옵션 (필요시 활성화)
      // fontStyle: 'italic',
      // textDecoration: 'line-through',
    });
  }

  /**
   * 투명도 업데이트
   */
  updateOpacity(opacity: number): void {
    // 기존 데코레이션 타입 dispose
    this.unusedDecoration.dispose();
    // 새 데코레이션 타입 생성
    this.unusedDecoration = this.createDecorationType(opacity);
    // 현재 적용된 데코레이션 다시 적용
    this.reapplyAllDecorations();
  }

  /**
   * 미사용 export에 데코레이션 적용
   */
  applyDecorations(
    editor: vscode.TextEditor,
    unusedExports: ExportInfo[]
  ): void {
    const ranges = unusedExports.map((exp) => exp.range);
    const filePath = editor.document.uri.fsPath;

    // 현재 데코레이션 저장
    this.currentDecorations.set(filePath, ranges);

    // 데코레이션 적용
    editor.setDecorations(this.unusedDecoration, ranges);
  }

  /**
   * UnusedItem 목록으로 데코레이션 적용
   */
  applyDecorationsFromItems(
    editor: vscode.TextEditor,
    unusedItems: UnusedItem[]
  ): void {
    const ranges = unusedItems.map((item) => item.range);
    const filePath = editor.document.uri.fsPath;

    // 현재 데코레이션 저장
    this.currentDecorations.set(filePath, ranges);

    // 데코레이션 적용
    editor.setDecorations(this.unusedDecoration, ranges);
  }

  /**
   * 특정 에디터의 데코레이션 제거
   */
  clearDecorations(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    this.currentDecorations.delete(filePath);
    editor.setDecorations(this.unusedDecoration, []);
  }

  /**
   * 모든 데코레이션 제거
   */
  clearAllDecorations(): void {
    this.currentDecorations.clear();

    // 모든 열린 에디터에서 데코레이션 제거
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.unusedDecoration, []);
    }
  }

  /**
   * 현재 저장된 데코레이션 다시 적용
   */
  private reapplyAllDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = editor.document.uri.fsPath;
      const ranges = this.currentDecorations.get(filePath);

      if (ranges) {
        editor.setDecorations(this.unusedDecoration, ranges);
      }
    }
  }

  /**
   * 특정 파일의 데코레이션 가져오기
   */
  getDecorations(filePath: string): vscode.Range[] | undefined {
    return this.currentDecorations.get(filePath);
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.unusedDecoration.dispose();
    this.currentDecorations.clear();
  }
}
