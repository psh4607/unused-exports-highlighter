import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ClassMemberInfo, MemberReferenceResult } from '../types';
import { getWorkspaceRoot } from '../utils/file-utils';

/**
 * 클래스 멤버 참조 분석 클래스
 */
export class MemberReferenceAnalyzer {
  /**
   * 단일 멤버의 참조 분석
   */
  async analyzeReference(
    member: ClassMemberInfo,
    documentText: string
  ): Promise<MemberReferenceResult> {
    const references: vscode.Range[] = [];

    switch (member.accessModifier) {
      case 'private':
        // private 멤버는 클래스 내부에서만 검색
        references.push(
          ...this.findPrivateMemberReferences(member, documentText)
        );
        break;

      case 'protected':
        // protected 멤버는 클래스 내부 + 상속 클래스에서 검색
        // Phase 2에서 상속 분석 추가 예정
        references.push(
          ...this.findPrivateMemberReferences(member, documentText)
        );
        break;

      case 'public': {
        // public 멤버는 클래스 내부 + 프로젝트 전체에서 검색
        references.push(
          ...this.findPrivateMemberReferences(member, documentText)
        );
        // Phase 3에서 프로젝트 전체 검색 추가 예정
        const externalRefs = await this.findPublicMemberReferences(member);
        if (externalRefs.length > 0) {
          // 외부 참조가 있으면 사용된 것으로 표시
          return {
            memberInfo: member,
            references: [],
            isUsed: true,
          };
        }
        break;
      }
    }

    return {
      memberInfo: member,
      references,
      isUsed: references.length > 0,
    };
  }

  /**
   * 여러 멤버를 배치로 분석
   */
  async analyzeBatch(
    members: ClassMemberInfo[],
    documentText: string
  ): Promise<MemberReferenceResult[]> {
    const results: MemberReferenceResult[] = [];

    for (const member of members) {
      const result = await this.analyzeReference(member, documentText);
      results.push(result);
    }

    return results;
  }

  /**
   * private/protected 멤버의 클래스 내부 참조 검색
   * this.memberName 또는 memberName() 패턴 검색
   */
  private findPrivateMemberReferences(
    member: ClassMemberInfo,
    documentText: string
  ): vscode.Range[] {
    const references: vscode.Range[] = [];
    const memberName = member.name;

    // 검색 패턴들
    const patterns = [
      // this.memberName
      new RegExp(`this\\.${this.escapeRegex(memberName)}\\b`, 'g'),
      // this.memberName() - 메서드 호출
      new RegExp(`this\\.${this.escapeRegex(memberName)}\\s*\\(`, 'g'),
      // this.memberName = - 할당
      new RegExp(`this\\.${this.escapeRegex(memberName)}\\s*=`, 'g'),
    ];

    // 멤버 정의 위치 (제외해야 함)
    const definitionStart = member.range.start;
    const definitionEnd = member.range.end;

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(documentText)) !== null) {
        const startOffset = match.index;
        const endOffset = match.index + match[0].length;

        // vscode.Position으로 변환
        const startPos = this.offsetToPosition(documentText, startOffset);
        const endPos = this.offsetToPosition(documentText, endOffset);

        // 정의 위치는 제외
        if (
          startPos.line >= definitionStart.line &&
          startPos.line <= definitionEnd.line
        ) {
          continue;
        }

        references.push(new vscode.Range(startPos, endPos));
      }
    }

    return references;
  }

  /**
   * public 멤버의 프로젝트 전체 참조 검색 (ripgrep 사용)
   */
  private async findPublicMemberReferences(
    member: ClassMemberInfo
  ): Promise<string[]> {
    // member.filePath를 URI로 변환하여 올바른 워크스페이스 찾기
    const documentUri = vscode.Uri.file(member.filePath);
    const workspaceRoot = getWorkspaceRoot(documentUri);

    if (!workspaceRoot) {
      return [];
    }

    return new Promise((resolve) => {
      // .memberName 또는 .memberName( 패턴 검색 (인스턴스 접근)
      // 리터럴 문자열로 검색 (정규식 대신)
      const pattern = `.${member.name}`;

      const args = [
        '--type',
        'ts',
        '--type',
        'js',
        '-l', // 파일명만 출력
        '-F', // Fixed string (리터럴 검색)
        pattern,
        '--glob',
        '!node_modules/**',
        '--glob',
        '!**/node_modules/**',
        '--glob',
        '!*.d.ts',
        '--glob',
        '!dist/**',
        '--glob',
        '!build/**',
      ];

      const rg = cp.spawn('rg', args, {
        cwd: workspaceRoot,
        shell: false, // shell 없이 직접 실행
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
        // code 0: 매치 있음, code 1: 매치 없음, 그 외: 에러
        if (code !== 0 && code !== 1) {
          console.error(`ripgrep error for ${member.name}:`, stderr);
          resolve([]);
          return;
        }

        const files = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((relativePath) => path.resolve(workspaceRoot, relativePath))
          // 자기 자신 파일 제외
          .filter((filePath) => filePath !== member.filePath);

        resolve(files);
      });

      rg.on('error', (err) => {
        console.error(`ripgrep spawn error for ${member.name}:`, err.message);
        resolve([]);
      });
    });
  }

  /**
   * 문자열 offset을 vscode.Position으로 변환
   */
  private offsetToPosition(text: string, offset: number): vscode.Position {
    let line = 0;
    let character = 0;

    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
        character = 0;
      } else {
        character++;
      }
    }

    return new vscode.Position(line, character);
  }

  /**
   * 정규식 특수문자 이스케이프
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
