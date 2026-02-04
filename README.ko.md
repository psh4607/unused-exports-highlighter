# Unused Exports Highlighter

[English](./README.md) | **한국어**

프로젝트 전체에서 사용되지 않는 `export`와 **클래스 멤버**를 감지하여 **연하게 (흐리게)** 표시하는 VS Code/Cursor Extension입니다.

IntelliJ의 미사용 코드 표시 방식과 유사하게, export된 심볼이나 클래스 멤버가 프로젝트 어디에서도 사용되지 않으면 시각적으로 구분됩니다.

## 기능

- **미사용 export 감지**: 프로젝트 전체에서 import되지 않는 export 식별
- **미사용 클래스 멤버 감지**: 클래스 내 사용되지 않는 속성/메서드 식별
- **시각적 표시**: 미사용 코드를 연하게 (opacity 50%) 표시
- **실시간 업데이트**: 파일 저장 시 자동으로 재분석
- **스마트 제외**: Entity/DTO 파일, ORM 데코레이터 자동 제외
- **유연한 설정**: 제외 패턴, 투명도, 분석 전략 등 커스터마이징 가능

## 설치

### VS Code Marketplace (예정)

```
ext install seongho.unused-exports-highlighter
```

### 수동 설치

```bash
# 저장소 클론
git clone https://github.com/psh4607/unused-exports-highlighter

# 의존성 설치
cd unused-exports-highlighter
pnpm install

# 빌드
pnpm run compile

# F5를 눌러 Extension Development Host 실행
```

## 사용법

Extension이 활성화되면 자동으로 TypeScript/JavaScript 파일을 분석합니다.

### 명령어

| 명령어                                 | 설명                   |
| -------------------------------------- | ---------------------- |
| `Unused Exports: Analyze Workspace`    | 워크스페이스 전체 분석 |
| `Unused Exports: Analyze Current File` | 현재 파일 분석         |
| `Unused Exports: Clear Cache`          | 분석 캐시 클리어       |
| `Unused Exports: Toggle Highlighting`  | 하이라이팅 켜기/끄기   |

### 상태바

우측 하단 상태바에서 현재 상태를 확인할 수 있습니다:

- `$(eye) Unused: 5 (3E/2M)` - 활성화됨, 3개 export + 2개 멤버 미사용
- `$(eye-closed) Unused Exports` - 비활성화됨
- `$(sync~spin) Analyzing...` - 분석 중

## 설정

### 기본 설정

| 설정                                  | 기본값                                                               | 설명                                     |
| ------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `unusedExports.enabled`               | `true`                                                               | 하이라이팅 활성화 여부                   |
| `unusedExports.opacity`               | `0.5`                                                                | 미사용 코드 투명도 (0.1 ~ 1.0)           |
| `unusedExports.excludePatterns`       | `["**/node_modules/**", "**/*.d.ts", "**/index.ts", "**/index.tsx"]` | 분석 제외 패턴                           |
| `unusedExports.includeDefaultExports` | `false`                                                              | default export 포함 여부                 |
| `unusedExports.debounceMs`            | `1000`                                                               | 분석 debounce 시간 (ms)                  |
| `unusedExports.analysisStrategy`      | `"hybrid"`                                                           | 분석 전략 (`fast`, `accurate`, `hybrid`) |

### 클래스 멤버 분석 설정

| 설정                                  | 기본값                                       | 설명                                  |
| ------------------------------------- | -------------------------------------------- | ------------------------------------- |
| `unusedExports.analyzeClassMembers`   | `true`                                       | 클래스 멤버 분석 활성화 여부          |
| `unusedExports.excludeDecorators`     | `["Column", "IsString", "ApiProperty", ...]` | 분석에서 제외할 데코레이터            |
| `unusedExports.excludeMemberPatterns` | `["*.entity.ts", "*.dto.ts", "*.model.ts"]`  | 클래스 멤버 분석에서 제외할 파일 패턴 |

### 설정 예시

```json
{
  "unusedExports.enabled": true,
  "unusedExports.opacity": 0.4,
  "unusedExports.excludePatterns": [
    "**/node_modules/**",
    "**/*.d.ts",
    "**/index.ts",
    "**/test/**"
  ],
  "unusedExports.analyzeClassMembers": true,
  "unusedExports.excludeDecorators": [
    "Column",
    "PrimaryColumn",
    "IsString",
    "IsNumber",
    "ApiProperty",
    "Inject"
  ],
  "unusedExports.excludeMemberPatterns": [
    "*.entity.ts",
    "*.dto.ts",
    "*.model.ts"
  ]
}
```

## 분석 전략

### Export 분석

| 전략       | 설명                          | 장점      | 단점                    |
| ---------- | ----------------------------- | --------- | ----------------------- |
| `fast`     | ripgrep 기반 텍스트 검색      | 매우 빠름 | 동적 import 감지 어려움 |
| `accurate` | TypeScript 컴파일러 기반      | 정확함    | 느림                    |
| `hybrid`   | fast + 의심 케이스만 accurate | 균형      | -                       |

### 클래스 멤버 분석

| 접근 제어자 | 분석 범위            | 감지 방식                         |
| ----------- | -------------------- | --------------------------------- |
| `private`   | 클래스 내부만        | 클래스 내 `this.member` 참조 검색 |
| `protected` | 클래스 + 상속 클래스 | 상속 체인 분석 (Phase 2 예정)     |
| `public`    | 프로젝트 전체        | 외부 파일에서 `.member` 참조 검색 |

## 지원 파일 형식

- TypeScript (`.ts`, `.tsx`, `.mts`)
- JavaScript (`.js`, `.jsx`, `.mjs`)

## 감지 대상

### Export

```typescript
// Named exports (감지됨)
export class MyClass {}
export function myFunction() {}
export const myConst = 'value';
export type MyType = string;
export interface MyInterface {}
export enum MyEnum {}

// Default exports (설정에 따라)
export default class {} // includeDefaultExports: true 시 감지
```

### 클래스 멤버

```typescript
class MyService {
  private unusedProp: string; // 미사용 시 연하게 표시

  private unusedMethod() {} // 미사용 시 연하게 표시

  private usedMethod() {
    // this.usedMethod() 호출 시 정상 표시
    return this.unusedProp; // unusedProp은 사용됨으로 처리
  }
}
```

## 자동 제외 대상

### 파일 패턴 제외

- `*.entity.ts` - TypeORM Entity
- `*.dto.ts` - Data Transfer Object
- `*.model.ts` - Model 클래스

### 데코레이터 제외

ORM, Validation, Swagger 등 런타임에 프레임워크가 사용하는 데코레이터:

```typescript
// 이런 속성은 자동으로 분석에서 제외됨
@Column()
name: string;

@IsString()
email: string;

@ApiProperty()
description: string;
```

## 제한사항

- 동적 import (`import()`)는 감지가 어려울 수 있습니다
- Re-export (`export * from`)는 실제 사용으로 카운트됩니다
- protected 멤버의 상속 분석은 Phase 2에서 지원 예정입니다
- 대규모 프로젝트에서는 초기 분석에 시간이 걸릴 수 있습니다

## 개발

```bash
# 의존성 설치
pnpm install

# 빌드
pnpm run compile

# 감시 모드
pnpm run watch

# 린트
pnpm run lint

# 패키징
pnpm run package
```

## 기술 스택

- TypeScript
- VS Code Extension API
- ts-morph (AST 파싱)
- ripgrep (빠른 텍스트 검색)

## 라이선스

MIT License

## 기여

이슈와 PR을 환영합니다!
