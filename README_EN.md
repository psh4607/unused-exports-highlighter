# Unused Exports Highlighter

A VS Code/Cursor Extension that detects unused `exports` and **class members** throughout your project and displays them **dimmed (reduced opacity)**.

Similar to IntelliJ's unused code detection, exported symbols or class members that are not used anywhere in the project are visually distinguished.

## Features

- **Detect Unused Exports**: Identifies exports that are not imported anywhere in the project.
- **Detect Unused Class Members**: Identifies properties/methods within classes that are not used.
- **Visual Indication**: Displays unused code with reduced opacity (default 50%).
- **Real-time Updates**: Automatically re-analyzes upon file save.
- **Smart Exclusion**: Automatically excludes Entity/DTO files and ORM decorators.
- **Flexible Configuration**: Customizable exclusion patterns, opacity levels, analysis strategies, etc.

## Installation

### VS Code Marketplace (Coming Soon)

```
ext install seongho.unused-exports-highlighter
```

### Manual Installation

```bash
# Clone repository
git clone https://github.com/psh4607/unused-exports-highlighter

# Install dependencies
cd unused-exports-highlighter
pnpm install

# Build
pnpm run compile

# Press F5 to launch Extension Development Host
```

## Usage

Once the extension is activated, it automatically analyzes TypeScript/JavaScript files.

### Commands

| Command                                | Description                  |
| -------------------------------------- | ---------------------------- |
| `Unused Exports: Analyze Workspace`    | Analyze the entire workspace |
| `Unused Exports: Analyze Current File` | Analyze the current file     |
| `Unused Exports: Clear Cache`          | Clear analysis cache         |
| `Unused Exports: Toggle Highlighting`  | Toggle highlighting on/off   |

### Status Bar

You can check the current status in the bottom right status bar:

- `$(eye) Unused: 5 (3E/2M)` - Active, 3 unused exports + 2 unused members detected
- `$(eye-closed) Unused Exports` - Inactive
- `$(sync~spin) Analyzing...` - Analyzing

## Configuration

### General Settings

| Setting                               | Default                                                              | Description                                      |
| ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `unusedExports.enabled`               | `true`                                                               | Enable/disable highlighting                      |
| `unusedExports.opacity`               | `0.5`                                                                | Opacity for unused code (0.1 - 1.0)              |
| `unusedExports.excludePatterns`       | `["**/node_modules/**", "**/*.d.ts", "**/index.ts", "**/index.tsx"]` | Glob patterns to exclude from analysis           |
| `unusedExports.includeDefaultExports` | `false`                                                              | Whether to include default exports in analysis   |
| `unusedExports.debounceMs`            | `1000`                                                               | Debounce time for re-analysis (ms)               |
| `unusedExports.analysisStrategy`      | `"hybrid"`                                                           | Analysis strategy (`fast`, `accurate`, `hybrid`) |

### Class Member Analysis Settings

| Setting                               | Default                                      | Description                                         |
| ------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `unusedExports.analyzeClassMembers`   | `true`                                       | Enable/disable class member analysis                |
| `unusedExports.excludeDecorators`     | `["Column", "IsString", "ApiProperty", ...]` | Decorators to exclude from analysis                 |
| `unusedExports.excludeMemberPatterns` | `["*.entity.ts", "*.dto.ts", "*.model.ts"]`  | File patterns to exclude from class member analysis |

### Configuration Example

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

## Analysis Strategy

### Export Analysis

| Strategy   | Description                                  | Pros      | Cons                                |
| ---------- | -------------------------------------------- | --------- | ----------------------------------- |
| `fast`     | Text search based on ripgrep                 | Very fast | Difficult to detect dynamic imports |
| `accurate` | TypeScript compiler based                    | Accurate  | Slow                                |
| `hybrid`   | fast + verify suspicious cases with accurate | Balanced  | -                                   |

### Class Member Analysis

| Access Modifier | Analysis Scope     | Detection Method                                     |
| --------------- | ------------------ | ---------------------------------------------------- |
| `private`       | Inside class only  | Search for `this.member` references within the class |
| `protected`     | Class + Subclasses | Inheritance chain analysis (Planned for Phase 2)     |
| `public`        | Entire project     | Search for `.member` references in external files    |

## Supported File Types

- TypeScript (`.ts`, `.tsx`, `.mts`)
- JavaScript (`.js`, `.jsx`, `.mjs`)

## Detection Targets

### Exports

```typescript
// Named exports (Detected)
export class MyClass {}
export function myFunction() {}
export const myConst = 'value';
export type MyType = string;
export interface MyInterface {}
export enum MyEnum {}

// Default exports (Depending on settings)
export default class {} // Detected if includeDefaultExports: true
```

### Class Members

```typescript
class MyService {
  private unusedProp: string; // Dimmed if unused

  private unusedMethod() {} // Dimmed if unused

  private usedMethod() {
    // Normal display if this.usedMethod() is called
    return this.unusedProp; // unusedProp is treated as used
  }
}
```

## Auto-Exclusion Targets

### File Pattern Exclusion

- `*.entity.ts` - TypeORM Entity
- `*.dto.ts` - Data Transfer Object
- `*.model.ts` - Model Class

### Decorator Exclusion

Decorators used by frameworks at runtime (ORM, Validation, Swagger, etc.):

```typescript
// These properties are automatically excluded from analysis
@Column()
name: string;

@IsString()
email: string;

@ApiProperty()
description: string;
```

## Limitations

- Dynamic imports (`import()`) may be difficult to detect.
- Re-exports (`export * from`) are counted as actual usage.
- Inheritance analysis for protected members is planned for Phase 2.
- Initial analysis may take some time for large projects.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run compile

# Watch mode
pnpm run watch

# Lint
pnpm run lint

# Package
pnpm run package
```

## Tech Stack

- TypeScript
- VS Code Extension API
- ts-morph (AST parsing)
- ripgrep (Fast text search)

## License

MIT License

## Contribution

Issues and PRs are welcome!
