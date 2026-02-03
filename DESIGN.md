# Unused Exports Highlighter - VS Code Extension 설계 문서

## 개요

프로젝트 전체에서 사용되지 않는 `export`와 **클래스 멤버**를 감지하여 **연하게 (흐리게)** 표시하는 VS Code/Cursor Extension.

IntelliJ의 미사용 코드 표시 방식과 유사하게, export된 심볼이나 클래스 멤버가 프로젝트 어디에서도 사용되지 않으면 시각적으로 구분되도록 함.

---

## 핵심 기능

| 기능                    | 설명                                                   |
| ----------------------- | ------------------------------------------------------ |
| 미사용 export 감지      | 프로젝트 전체에서 import되지 않는 export 식별          |
| 미사용 클래스 멤버 감지 | 클래스 내 사용되지 않는 속성/메서드 식별               |
| 시각적 표시             | 미사용 코드를 연하게 (opacity 50%) 표시                |
| 실시간 업데이트         | 파일 저장 시 자동으로 재분석                           |
| 제외 패턴               | `export default`, barrel files, Entity/DTO 파일 제외   |
| 데코레이터 제외         | ORM, Validation 데코레이터가 있는 멤버는 분석에서 제외 |

---

## 기술 스택

```
├── TypeScript          # Extension 개발 언어
├── VS Code Extension API
│   ├── TextEditorDecorationType  # 연하게 표시
│   ├── FileSystemWatcher         # 파일 변경 감지
│   └── DiagnosticCollection      # (선택) Problems 패널 표시
├── ts-morph            # TypeScript AST 파싱 및 분석
└── ripgrep (rg)        # 빠른 텍스트 검색
```

---

## 프로젝트 구조

```
unused-exports-highlighter/
├── .vscode/
│   ├── launch.json               # Extension 디버깅 설정
│   └── tasks.json                # 빌드 태스크
├── src/
│   ├── extension.ts              # Extension 진입점
│   ├── core/
│   │   ├── export-finder.ts          # export 구문 파싱
│   │   ├── reference-analyzer.ts     # export 참조 분석
│   │   ├── class-member-finder.ts    # 클래스 멤버 파싱 (ts-morph)
│   │   ├── member-reference-analyzer.ts  # 클래스 멤버 참조 분석
│   │   ├── decorator-checker.ts      # 데코레이터 제외 로직
│   │   └── decoration-manager.ts     # 데코레이션 관리
│   ├── utils/
│   │   ├── cache.ts                  # 분석 결과 캐싱
│   │   ├── config.ts                 # 설정 관리
│   │   └── file-utils.ts             # 파일 유틸리티
│   └── types/
│       └── index.ts                  # 타입 정의
├── package.json                  # Extension manifest
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
├── DESIGN.md
└── README.md
```

---

## 핵심 모듈 설계

### 1. ExportFinder - export 구문 파싱

```typescript
// src/core/export-finder.ts

interface ExportInfo {
  name: string; // export된 심볼 이름
  kind: ExportKind; // 'class' | 'function' | 'const' | ...
  range: vscode.Range; // 코드 위치
  isDefault: boolean; // export default 여부
  filePath: string; // 파일 경로
}

class ExportFinder {
  findExports(document: vscode.TextDocument): ExportInfo[];
  findNamedExports(document: vscode.TextDocument): ExportInfo[];
}
```

**파싱 대상:**

```typescript
// Named exports
export class MyClass {}
export function myFunction() {}
export const myConst = 'value';
export type MyType = string;
export interface MyInterface {}
export enum MyEnum {}

// Re-exports (선택적 지원)
export { something } from './module';
export * from './module';

// 제외 대상
export default class {} // default export는 제외
```

---

### 2. ClassMemberFinder - 클래스 멤버 파싱

```typescript
// src/core/class-member-finder.ts

interface ClassMemberInfo {
  name: string; // 멤버 이름
  kind: MemberKind; // 'property' | 'method' | 'getter' | 'setter'
  accessModifier: AccessModifier; // 'public' | 'protected' | 'private'
  range: vscode.Range; // 코드 위치
  className: string; // 소속 클래스 이름
  filePath: string; // 파일 경로
  hasDecorator: boolean; // 데코레이터 존재 여부
  decorators: string[]; // 데코레이터 이름 목록
}

class ClassMemberFinder {
  // ts-morph를 사용하여 정확한 AST 파싱
  findClassMembers(document: vscode.TextDocument): ClassMemberInfo[];
}
```

**파싱 대상:**

```typescript
class MyClass {
  // 속성
  private name: string;
  protected count: number;
  public items: string[];

  // 메서드
  private helper() {}
  protected calculate() {}
  public getData() {}

  // Getter/Setter
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = v;
  }
}
```

---

### 3. DecoratorChecker - 데코레이터 제외 로직

```typescript
// src/core/decorator-checker.ts

const DEFAULT_EXCLUDE_DECORATORS = [
  // TypeORM
  'Column',
  'PrimaryColumn',
  'PrimaryGeneratedColumn',
  'OneToMany',
  'ManyToOne',
  'OneToOne',
  'ManyToMany',
  'JoinColumn',
  'JoinTable',

  // class-validator
  'IsString',
  'IsNumber',
  'IsArray',
  'IsEnum',
  'IsOptional',
  'ValidateNested',

  // class-transformer
  'Type',
  'Transform',
  'Expose',
  'Exclude',

  // Swagger
  'ApiProperty',
  'ApiPropertyOptional',

  // NestJS
  'Inject',
  'Injectable',
];

class DecoratorChecker {
  shouldExclude(member: ClassMemberInfo): boolean;
  filterAnalyzableMembers(members: ClassMemberInfo[]): ClassMemberInfo[];
}
```

---

### 4. MemberReferenceAnalyzer - 클래스 멤버 참조 분석

```typescript
// src/core/member-reference-analyzer.ts

interface MemberReferenceResult {
  memberInfo: ClassMemberInfo;
  references: vscode.Range[];
  isUsed: boolean;
}

class MemberReferenceAnalyzer {
  async analyzeReference(
    member: ClassMemberInfo,
    documentText: string
  ): Promise<MemberReferenceResult>;

  async analyzeBatch(
    members: ClassMemberInfo[],
    documentText: string
  ): Promise<MemberReferenceResult[]>;
}
```

**분석 전략 (접근 제어자별):**

| 접근 제어자 | 분석 범위            | 감지 방식                         |
| ----------- | -------------------- | --------------------------------- |
| `private`   | 클래스 내부만        | 클래스 내 `this.member` 참조 검색 |
| `protected` | 클래스 + 상속 클래스 | 상속 체인 분석 (Phase 2)          |
| `public`    | 프로젝트 전체        | 외부 파일에서 `.member` 참조 검색 |

---

### 5. ReferenceAnalyzer - export 참조 분석

```typescript
// src/core/reference-analyzer.ts

interface ReferenceResult {
  exportInfo: ExportInfo;
  references: string[]; // 참조하는 파일 경로들
  isUsed: boolean;
}

class ReferenceAnalyzer {
  async analyzeReferences(exportInfo: ExportInfo): Promise<ReferenceResult>;
  async analyzeBatch(exports: ExportInfo[]): Promise<ReferenceResult[]>;
}
```

**분석 전략:**

| 전략         | 사용 시점           | 장점                   | 단점                    |
| ------------ | ------------------- | ---------------------- | ----------------------- |
| **ripgrep**  | 빠른 검색 필요 시   | 매우 빠름              | 동적 import 감지 어려움 |
| **ts-morph** | 정확한 분석 필요 시 | 타입 정보 포함, 정확함 | 느림                    |
| **Hybrid**   | 기본 전략           | 균형 잡힘              | 구현 복잡               |

---

### 6. DecorationManager - 시각적 표시

```typescript
// src/core/decoration-manager.ts

interface UnusedItem {
  type: 'export' | 'member';
  name: string;
  range: vscode.Range;
  detail?: string;
}

class DecorationManager {
  private unusedDecoration: vscode.TextEditorDecorationType;

  constructor(opacity: number = 0.5) {
    this.unusedDecoration = vscode.window.createTextEditorDecorationType({
      opacity: opacity.toString(),
    });
  }

  applyDecorations(
    editor: vscode.TextEditor,
    unusedExports: ExportInfo[]
  ): void;
  applyDecorationsFromItems(
    editor: vscode.TextEditor,
    unusedItems: UnusedItem[]
  ): void;
  clearDecorations(editor: vscode.TextEditor): void;
  clearAllDecorations(): void;
}
```

---

## Extension 설정 (package.json)

```json
{
  "contributes": {
    "configuration": {
      "title": "Unused Exports Highlighter",
      "properties": {
        "unusedExports.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable/disable unused exports highlighting"
        },
        "unusedExports.opacity": {
          "type": "number",
          "default": 0.5,
          "description": "Opacity for unused code (0.1 - 1.0)"
        },
        "unusedExports.excludePatterns": {
          "type": "array",
          "default": ["**/node_modules/**", "**/*.d.ts", "**/index.ts"],
          "description": "Glob patterns to exclude from analysis"
        },
        "unusedExports.analyzeClassMembers": {
          "type": "boolean",
          "default": true,
          "description": "Enable/disable unused class members highlighting"
        },
        "unusedExports.excludeDecorators": {
          "type": "array",
          "default": ["Column", "IsString", "ApiProperty", ...],
          "description": "Decorators to exclude from unused member analysis"
        },
        "unusedExports.excludeMemberPatterns": {
          "type": "array",
          "default": ["*.entity.ts", "*.dto.ts", "*.model.ts"],
          "description": "File patterns to exclude from class member analysis"
        }
      }
    }
  }
}
```

---

## 이벤트 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Extension Activation                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Register Event Listeners                                 │
│     - onDidOpenTextDocument                                  │
│     - onDidSaveTextDocument                                  │
│     - onDidChangeActiveTextEditor                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. File Opened / Saved / Editor Changed                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Debounce (1000ms default)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Check Cache                                              │
│     - Cache hit → Use cached result                          │
│     - Cache miss → Proceed to analysis                       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│  5a. Export Analysis     │     │  5b. Class Member Analysis   │
│  - ExportFinder          │     │  - ClassMemberFinder         │
│  - ReferenceAnalyzer     │     │  - DecoratorChecker          │
│                          │     │  - MemberReferenceAnalyzer   │
└─────────────────────────┘     └─────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Merge Results (UnusedItem[])                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  7. DecorationManager.applyDecorationsFromItems()            │
│     - Apply opacity decoration to all unused items           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  8. Update Status Bar                                        │
│     - Show count: "Unused: 5 (3E/2M)"                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 클래스 멤버 분석 상세

### 분석 제외 조건

1. **파일 패턴 제외**: `*.entity.ts`, `*.dto.ts`, `*.model.ts`
2. **데코레이터 제외**: ORM, Validation, Swagger 데코레이터가 있는 멤버

### 예시

```typescript
// user.entity.ts - 파일 패턴으로 전체 제외
@Entity()
export class User {
  @Column()
  name: string; // 분석 제외 (파일 패턴)
}

// user.service.ts - 개별 분석
export class UserService {
  @Inject()
  private repo: UserRepository; // 분석 제외 (데코레이터)

  private unusedHelper: string; // ⚠️ 연하게 표시 (미사용)

  private usedMethod() {
    // ✅ 사용됨
    return this.repo.find();
  }

  private unusedMethod() {
    // ⚠️ 연하게 표시 (미사용)
    return 'unused';
  }
}
```

---

## 성능 최적화 전략

### 1. Debouncing

```typescript
const debouncedAnalyze = debounce(analyzeDocument, config.debounceMs);
```

### 2. Caching

```typescript
class AnalysisCache {
  private cache: Map<string, CacheEntry>;
  private maxAge: number = 5 * 60 * 1000; // 5분

  hasChanged(filePath: string, content: string): boolean;
  get(filePath: string): CacheEntry | undefined;
  set(filePath: string, entry: CacheEntry): void;
  invalidate(filePath: string): void;
}
```

### 3. ts-morph 인스턴스 재사용

```typescript
class ClassMemberFinder {
  private project: Project; // 재사용

  constructor() {
    this.project = new Project({ useInMemoryFileSystem: true });
  }
}
```

---

## 개발 로드맵

### Phase 1: MVP (완료)

- [x] 프로젝트 초기 설정
- [x] ExportFinder 구현
- [x] ReferenceAnalyzer (ripgrep 기반)
- [x] DecorationManager 구현
- [x] 기본 Extension 동작

### Phase 2: 클래스 멤버 분석 (완료)

- [x] ClassMemberFinder (ts-morph 기반)
- [x] DecoratorChecker
- [x] MemberReferenceAnalyzer (private 멤버)
- [x] Extension 통합

### Phase 3: 고급 기능 (예정)

- [ ] protected 멤버 상속 분석
- [ ] public 멤버 프로젝트 전체 검색 개선
- [ ] Problems 패널 연동
- [ ] Quick Fix 제공 (미사용 코드 삭제)

### Phase 4: 최적화 (예정)

- [ ] 성능 프로파일링
- [ ] 대규모 프로젝트 테스트
- [ ] Workspace indexing
- [ ] 문서화 및 배포

---

## 참고 자료

- [VS Code Extension API](https://code.visualstudio.com/api)
- [ts-morph Documentation](https://ts-morph.com/)
- [ripgrep](https://github.com/BurntSushi/ripgrep)
- [vscode-extension-samples](https://github.com/microsoft/vscode-extension-samples)

---

## 라이선스

MIT License
