import { ClassMemberInfo } from '../types';

/**
 * 기본 제외 데코레이터 목록
 * ORM, Validation, Swagger 등 런타임에 프레임워크가 사용하는 데코레이터
 */
export const DEFAULT_EXCLUDE_DECORATORS = [
  // TypeORM
  'Column',
  'PrimaryColumn',
  'PrimaryGeneratedColumn',
  'CreateDateColumn',
  'UpdateDateColumn',
  'DeleteDateColumn',
  'VersionColumn',
  'OneToOne',
  'OneToMany',
  'ManyToOne',
  'ManyToMany',
  'JoinColumn',
  'JoinTable',
  'RelationId',
  'Index',
  'Unique',
  'Check',
  'Exclusion',
  'Generated',
  'TreeParent',
  'TreeChildren',
  'Tree',
  'ViewColumn',
  'ViewEntity',

  // class-validator
  'IsString',
  'IsNumber',
  'IsInt',
  'IsBoolean',
  'IsArray',
  'IsEnum',
  'IsOptional',
  'IsNotEmpty',
  'IsEmail',
  'IsUrl',
  'IsUUID',
  'IsDate',
  'IsDateString',
  'IsObject',
  'IsPositive',
  'IsNegative',
  'Min',
  'Max',
  'MinLength',
  'MaxLength',
  'Length',
  'Matches',
  'Contains',
  'NotContains',
  'IsIn',
  'IsNotIn',
  'ArrayMinSize',
  'ArrayMaxSize',
  'ArrayNotEmpty',
  'ArrayUnique',
  'ValidateNested',
  'ValidateIf',
  'IsDefined',
  'Allow',

  // class-transformer
  'Type',
  'Transform',
  'Expose',
  'Exclude',
  'TransformPlainToClass',
  'TransformClassToPlain',

  // Swagger/OpenAPI
  'ApiProperty',
  'ApiPropertyOptional',
  'ApiHideProperty',
  'ApiResponseProperty',

  // NestJS
  'Inject',
  'Injectable',
  'Optional',

  // Sequelize
  'Column',
  'Table',
  'Model',
  'HasMany',
  'HasOne',
  'BelongsTo',
  'BelongsToMany',
  'ForeignKey',
  'AutoIncrement',
  'AllowNull',
  'Default',
  'Unique',
  'PrimaryKey',
  'DataType',

  // MobX
  'observable',
  'computed',
  'action',
  'makeObservable',
  'makeAutoObservable',

  // Angular
  'Input',
  'Output',
  'ViewChild',
  'ViewChildren',
  'ContentChild',
  'ContentChildren',
  'HostBinding',
  'HostListener',
];

/**
 * 데코레이터 체크 클래스
 * 멤버가 제외 대상 데코레이터를 가지고 있는지 확인
 */
export class DecoratorChecker {
  private excludeDecorators: Set<string>;

  constructor(excludeDecorators: string[] = DEFAULT_EXCLUDE_DECORATORS) {
    this.excludeDecorators = new Set(excludeDecorators);
  }

  /**
   * 제외 데코레이터 목록 업데이트
   */
  setExcludeDecorators(decorators: string[]): void {
    this.excludeDecorators = new Set(decorators);
  }

  /**
   * 제외 데코레이터 추가
   */
  addExcludeDecorators(decorators: string[]): void {
    for (const decorator of decorators) {
      this.excludeDecorators.add(decorator);
    }
  }

  /**
   * 멤버가 제외 대상인지 확인
   * @returns true면 분석에서 제외해야 함
   */
  shouldExclude(member: ClassMemberInfo): boolean {
    // 데코레이터가 없으면 제외 대상 아님
    if (!member.hasDecorator || member.decorators.length === 0) {
      return false;
    }

    // 제외 대상 데코레이터가 하나라도 있으면 제외
    return member.decorators.some((decorator) =>
      this.excludeDecorators.has(decorator)
    );
  }

  /**
   * 멤버 목록에서 분석 대상만 필터링
   * @returns 분석해야 할 멤버 목록 (제외 대상 데코레이터가 없는 멤버)
   */
  filterAnalyzableMembers(members: ClassMemberInfo[]): ClassMemberInfo[] {
    return members.filter((member) => !this.shouldExclude(member));
  }

  /**
   * 특정 데코레이터가 제외 대상인지 확인
   */
  isExcludedDecorator(decoratorName: string): boolean {
    return this.excludeDecorators.has(decoratorName);
  }

  /**
   * 현재 제외 데코레이터 목록 반환
   */
  getExcludeDecorators(): string[] {
    return Array.from(this.excludeDecorators);
  }
}
