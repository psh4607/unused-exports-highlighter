import { ClassDeclaration, Project, Scope } from 'ts-morph';
import * as vscode from 'vscode';
import { AccessModifier, ClassMemberInfo } from '../types';

/**
 * ts-morph를 사용하여 클래스 멤버를 파싱하는 클래스
 */
export class ClassMemberFinder {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        strict: true,
      },
    });
  }

  /**
   * 문서에서 모든 클래스 멤버를 찾아 반환
   */
  findClassMembers(document: vscode.TextDocument): ClassMemberInfo[] {
    const text = document.getText();
    const filePath = document.uri.fsPath;
    const members: ClassMemberInfo[] = [];

    try {
      // 임시 소스 파일 생성
      const sourceFile = this.project.createSourceFile(
        `temp_${Date.now()}.ts`,
        text,
        { overwrite: true }
      );

      const classes = sourceFile.getClasses();

      for (const cls of classes) {
        const className = cls.getName() || 'AnonymousClass';

        // 속성 추출
        members.push(
          ...this.extractProperties(cls, className, filePath, document)
        );

        // 메서드 추출
        members.push(
          ...this.extractMethods(cls, className, filePath, document)
        );

        // Getter/Setter 추출
        members.push(
          ...this.extractAccessors(cls, className, filePath, document)
        );
      }

      // 임시 파일 제거
      this.project.removeSourceFile(sourceFile);
    } catch (error) {
      console.error('ClassMemberFinder error:', error);
    }

    return members;
  }

  /**
   * 클래스 속성 추출
   */
  private extractProperties(
    cls: ClassDeclaration,
    className: string,
    filePath: string,
    document: vscode.TextDocument
  ): ClassMemberInfo[] {
    const members: ClassMemberInfo[] = [];

    for (const prop of cls.getProperties()) {
      const name = prop.getName();
      const decorators = prop.getDecorators().map((d) => d.getName());
      const scope = prop.getScope();
      const accessModifier = this.scopeToAccessModifier(scope);

      const start = prop.getStart();
      const end = prop.getEnd();
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);

      members.push({
        name,
        kind: 'property',
        accessModifier,
        range: new vscode.Range(startPos, endPos),
        className,
        filePath,
        hasDecorator: decorators.length > 0,
        decorators,
      });
    }

    return members;
  }

  /**
   * 클래스 메서드 추출
   */
  private extractMethods(
    cls: ClassDeclaration,
    className: string,
    filePath: string,
    document: vscode.TextDocument
  ): ClassMemberInfo[] {
    const members: ClassMemberInfo[] = [];

    for (const method of cls.getMethods()) {
      const name = method.getName();

      // constructor는 제외
      if (name === 'constructor') {
        continue;
      }

      const decorators = method.getDecorators().map((d) => d.getName());
      const scope = method.getScope();
      const accessModifier = this.scopeToAccessModifier(scope);

      const start = method.getStart();
      const end = method.getEnd();
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);

      members.push({
        name,
        kind: 'method',
        accessModifier,
        range: new vscode.Range(startPos, endPos),
        className,
        filePath,
        hasDecorator: decorators.length > 0,
        decorators,
      });
    }

    return members;
  }

  /**
   * Getter/Setter 추출
   */
  private extractAccessors(
    cls: ClassDeclaration,
    className: string,
    filePath: string,
    document: vscode.TextDocument
  ): ClassMemberInfo[] {
    const members: ClassMemberInfo[] = [];

    // Getters
    for (const getter of cls.getGetAccessors()) {
      const name = getter.getName();
      const decorators = getter.getDecorators().map((d) => d.getName());
      const scope = getter.getScope();
      const accessModifier = this.scopeToAccessModifier(scope);

      const start = getter.getStart();
      const end = getter.getEnd();
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);

      members.push({
        name,
        kind: 'getter',
        accessModifier,
        range: new vscode.Range(startPos, endPos),
        className,
        filePath,
        hasDecorator: decorators.length > 0,
        decorators,
      });
    }

    // Setters
    for (const setter of cls.getSetAccessors()) {
      const name = setter.getName();
      const decorators = setter.getDecorators().map((d) => d.getName());
      const scope = setter.getScope();
      const accessModifier = this.scopeToAccessModifier(scope);

      const start = setter.getStart();
      const end = setter.getEnd();
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);

      members.push({
        name,
        kind: 'setter',
        accessModifier,
        range: new vscode.Range(startPos, endPos),
        className,
        filePath,
        hasDecorator: decorators.length > 0,
        decorators,
      });
    }

    return members;
  }

  /**
   * ts-morph Scope를 AccessModifier로 변환
   */
  private scopeToAccessModifier(scope: Scope | undefined): AccessModifier {
    switch (scope) {
      case Scope.Private:
        return 'private';
      case Scope.Protected:
        return 'protected';
      case Scope.Public:
      default:
        return 'public';
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    // ts-morph 프로젝트 정리
    for (const sourceFile of this.project.getSourceFiles()) {
      this.project.removeSourceFile(sourceFile);
    }
  }
}
