
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Session
 * 
 */
export type Session = $Result.DefaultSelection<Prisma.$SessionPayload>
/**
 * Model Template
 * 
 */
export type Template = $Result.DefaultSelection<Prisma.$TemplatePayload>
/**
 * Model account
 * 
 */
export type account = $Result.DefaultSelection<Prisma.$accountPayload>
/**
 * Model congressional_office
 * 
 */
export type congressional_office = $Result.DefaultSelection<Prisma.$congressional_officePayload>
/**
 * Model template_campaign
 * 
 */
export type template_campaign = $Result.DefaultSelection<Prisma.$template_campaignPayload>
/**
 * Model representative
 * 
 */
export type representative = $Result.DefaultSelection<Prisma.$representativePayload>
/**
 * Model user_representatives
 * 
 */
export type user_representatives = $Result.DefaultSelection<Prisma.$user_representativesPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.session`: Exposes CRUD operations for the **Session** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Sessions
    * const sessions = await prisma.session.findMany()
    * ```
    */
  get session(): Prisma.SessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.template`: Exposes CRUD operations for the **Template** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Templates
    * const templates = await prisma.template.findMany()
    * ```
    */
  get template(): Prisma.TemplateDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.account`: Exposes CRUD operations for the **account** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Accounts
    * const accounts = await prisma.account.findMany()
    * ```
    */
  get account(): Prisma.accountDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.congressional_office`: Exposes CRUD operations for the **congressional_office** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Congressional_offices
    * const congressional_offices = await prisma.congressional_office.findMany()
    * ```
    */
  get congressional_office(): Prisma.congressional_officeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.template_campaign`: Exposes CRUD operations for the **template_campaign** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Template_campaigns
    * const template_campaigns = await prisma.template_campaign.findMany()
    * ```
    */
  get template_campaign(): Prisma.template_campaignDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.representative`: Exposes CRUD operations for the **representative** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Representatives
    * const representatives = await prisma.representative.findMany()
    * ```
    */
  get representative(): Prisma.representativeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user_representatives`: Exposes CRUD operations for the **user_representatives** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more User_representatives
    * const user_representatives = await prisma.user_representatives.findMany()
    * ```
    */
  get user_representatives(): Prisma.user_representativesDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.10.1
   * Query Engine version: 9b628578b3b7cae625e8c927178f15a170e74a9c
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Session: 'Session',
    Template: 'Template',
    account: 'account',
    congressional_office: 'congressional_office',
    template_campaign: 'template_campaign',
    representative: 'representative',
    user_representatives: 'user_representatives'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "session" | "template" | "account" | "congressional_office" | "template_campaign" | "representative" | "user_representatives"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Session: {
        payload: Prisma.$SessionPayload<ExtArgs>
        fields: Prisma.SessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findFirst: {
            args: Prisma.SessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findMany: {
            args: Prisma.SessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          create: {
            args: Prisma.SessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          createMany: {
            args: Prisma.SessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          delete: {
            args: Prisma.SessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          update: {
            args: Prisma.SessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          deleteMany: {
            args: Prisma.SessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          upsert: {
            args: Prisma.SessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          aggregate: {
            args: Prisma.SessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSession>
          }
          groupBy: {
            args: Prisma.SessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SessionCountArgs<ExtArgs>
            result: $Utils.Optional<SessionCountAggregateOutputType> | number
          }
        }
      }
      Template: {
        payload: Prisma.$TemplatePayload<ExtArgs>
        fields: Prisma.TemplateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TemplateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TemplateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>
          }
          findFirst: {
            args: Prisma.TemplateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TemplateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>
          }
          findMany: {
            args: Prisma.TemplateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>[]
          }
          create: {
            args: Prisma.TemplateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>
          }
          createMany: {
            args: Prisma.TemplateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TemplateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>[]
          }
          delete: {
            args: Prisma.TemplateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>
          }
          update: {
            args: Prisma.TemplateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>
          }
          deleteMany: {
            args: Prisma.TemplateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TemplateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TemplateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>[]
          }
          upsert: {
            args: Prisma.TemplateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TemplatePayload>
          }
          aggregate: {
            args: Prisma.TemplateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTemplate>
          }
          groupBy: {
            args: Prisma.TemplateGroupByArgs<ExtArgs>
            result: $Utils.Optional<TemplateGroupByOutputType>[]
          }
          count: {
            args: Prisma.TemplateCountArgs<ExtArgs>
            result: $Utils.Optional<TemplateCountAggregateOutputType> | number
          }
        }
      }
      account: {
        payload: Prisma.$accountPayload<ExtArgs>
        fields: Prisma.accountFieldRefs
        operations: {
          findUnique: {
            args: Prisma.accountFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.accountFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>
          }
          findFirst: {
            args: Prisma.accountFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.accountFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>
          }
          findMany: {
            args: Prisma.accountFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>[]
          }
          create: {
            args: Prisma.accountCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>
          }
          createMany: {
            args: Prisma.accountCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.accountCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>[]
          }
          delete: {
            args: Prisma.accountDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>
          }
          update: {
            args: Prisma.accountUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>
          }
          deleteMany: {
            args: Prisma.accountDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.accountUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.accountUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>[]
          }
          upsert: {
            args: Prisma.accountUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$accountPayload>
          }
          aggregate: {
            args: Prisma.AccountAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAccount>
          }
          groupBy: {
            args: Prisma.accountGroupByArgs<ExtArgs>
            result: $Utils.Optional<AccountGroupByOutputType>[]
          }
          count: {
            args: Prisma.accountCountArgs<ExtArgs>
            result: $Utils.Optional<AccountCountAggregateOutputType> | number
          }
        }
      }
      congressional_office: {
        payload: Prisma.$congressional_officePayload<ExtArgs>
        fields: Prisma.congressional_officeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.congressional_officeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.congressional_officeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>
          }
          findFirst: {
            args: Prisma.congressional_officeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.congressional_officeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>
          }
          findMany: {
            args: Prisma.congressional_officeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>[]
          }
          create: {
            args: Prisma.congressional_officeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>
          }
          createMany: {
            args: Prisma.congressional_officeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.congressional_officeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>[]
          }
          delete: {
            args: Prisma.congressional_officeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>
          }
          update: {
            args: Prisma.congressional_officeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>
          }
          deleteMany: {
            args: Prisma.congressional_officeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.congressional_officeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.congressional_officeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>[]
          }
          upsert: {
            args: Prisma.congressional_officeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$congressional_officePayload>
          }
          aggregate: {
            args: Prisma.Congressional_officeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCongressional_office>
          }
          groupBy: {
            args: Prisma.congressional_officeGroupByArgs<ExtArgs>
            result: $Utils.Optional<Congressional_officeGroupByOutputType>[]
          }
          count: {
            args: Prisma.congressional_officeCountArgs<ExtArgs>
            result: $Utils.Optional<Congressional_officeCountAggregateOutputType> | number
          }
        }
      }
      template_campaign: {
        payload: Prisma.$template_campaignPayload<ExtArgs>
        fields: Prisma.template_campaignFieldRefs
        operations: {
          findUnique: {
            args: Prisma.template_campaignFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.template_campaignFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>
          }
          findFirst: {
            args: Prisma.template_campaignFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.template_campaignFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>
          }
          findMany: {
            args: Prisma.template_campaignFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>[]
          }
          create: {
            args: Prisma.template_campaignCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>
          }
          createMany: {
            args: Prisma.template_campaignCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.template_campaignCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>[]
          }
          delete: {
            args: Prisma.template_campaignDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>
          }
          update: {
            args: Prisma.template_campaignUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>
          }
          deleteMany: {
            args: Prisma.template_campaignDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.template_campaignUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.template_campaignUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>[]
          }
          upsert: {
            args: Prisma.template_campaignUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$template_campaignPayload>
          }
          aggregate: {
            args: Prisma.Template_campaignAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTemplate_campaign>
          }
          groupBy: {
            args: Prisma.template_campaignGroupByArgs<ExtArgs>
            result: $Utils.Optional<Template_campaignGroupByOutputType>[]
          }
          count: {
            args: Prisma.template_campaignCountArgs<ExtArgs>
            result: $Utils.Optional<Template_campaignCountAggregateOutputType> | number
          }
        }
      }
      representative: {
        payload: Prisma.$representativePayload<ExtArgs>
        fields: Prisma.representativeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.representativeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.representativeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>
          }
          findFirst: {
            args: Prisma.representativeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.representativeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>
          }
          findMany: {
            args: Prisma.representativeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>[]
          }
          create: {
            args: Prisma.representativeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>
          }
          createMany: {
            args: Prisma.representativeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.representativeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>[]
          }
          delete: {
            args: Prisma.representativeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>
          }
          update: {
            args: Prisma.representativeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>
          }
          deleteMany: {
            args: Prisma.representativeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.representativeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.representativeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>[]
          }
          upsert: {
            args: Prisma.representativeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$representativePayload>
          }
          aggregate: {
            args: Prisma.RepresentativeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRepresentative>
          }
          groupBy: {
            args: Prisma.representativeGroupByArgs<ExtArgs>
            result: $Utils.Optional<RepresentativeGroupByOutputType>[]
          }
          count: {
            args: Prisma.representativeCountArgs<ExtArgs>
            result: $Utils.Optional<RepresentativeCountAggregateOutputType> | number
          }
        }
      }
      user_representatives: {
        payload: Prisma.$user_representativesPayload<ExtArgs>
        fields: Prisma.user_representativesFieldRefs
        operations: {
          findUnique: {
            args: Prisma.user_representativesFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.user_representativesFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>
          }
          findFirst: {
            args: Prisma.user_representativesFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.user_representativesFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>
          }
          findMany: {
            args: Prisma.user_representativesFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>[]
          }
          create: {
            args: Prisma.user_representativesCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>
          }
          createMany: {
            args: Prisma.user_representativesCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.user_representativesCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>[]
          }
          delete: {
            args: Prisma.user_representativesDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>
          }
          update: {
            args: Prisma.user_representativesUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>
          }
          deleteMany: {
            args: Prisma.user_representativesDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.user_representativesUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.user_representativesUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>[]
          }
          upsert: {
            args: Prisma.user_representativesUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$user_representativesPayload>
          }
          aggregate: {
            args: Prisma.User_representativesAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser_representatives>
          }
          groupBy: {
            args: Prisma.user_representativesGroupByArgs<ExtArgs>
            result: $Utils.Optional<User_representativesGroupByOutputType>[]
          }
          count: {
            args: Prisma.user_representativesCountArgs<ExtArgs>
            result: $Utils.Optional<User_representativesCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    session?: SessionOmit
    template?: TemplateOmit
    account?: accountOmit
    congressional_office?: congressional_officeOmit
    template_campaign?: template_campaignOmit
    representative?: representativeOmit
    user_representatives?: user_representativesOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    account: number
    sessions: number
    templates: number
    representatives: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | UserCountOutputTypeCountAccountArgs
    sessions?: boolean | UserCountOutputTypeCountSessionsArgs
    templates?: boolean | UserCountOutputTypeCountTemplatesArgs
    representatives?: boolean | UserCountOutputTypeCountRepresentativesArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAccountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: accountWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountTemplatesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TemplateWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountRepresentativesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: user_representativesWhereInput
  }


  /**
   * Count Type TemplateCountOutputType
   */

  export type TemplateCountOutputType = {
    template_campaign: number
  }

  export type TemplateCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    template_campaign?: boolean | TemplateCountOutputTypeCountTemplate_campaignArgs
  }

  // Custom InputTypes
  /**
   * TemplateCountOutputType without action
   */
  export type TemplateCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TemplateCountOutputType
     */
    select?: TemplateCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TemplateCountOutputType without action
   */
  export type TemplateCountOutputTypeCountTemplate_campaignArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: template_campaignWhereInput
  }


  /**
   * Count Type RepresentativeCountOutputType
   */

  export type RepresentativeCountOutputType = {
    user_representatives: number
  }

  export type RepresentativeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user_representatives?: boolean | RepresentativeCountOutputTypeCountUser_representativesArgs
  }

  // Custom InputTypes
  /**
   * RepresentativeCountOutputType without action
   */
  export type RepresentativeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RepresentativeCountOutputType
     */
    select?: RepresentativeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * RepresentativeCountOutputType without action
   */
  export type RepresentativeCountOutputTypeCountUser_representativesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: user_representativesWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    avatar: string | null
    phone: string | null
    street: string | null
    city: string | null
    state: string | null
    zip: string | null
    congressional_district: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    avatar: string | null
    phone: string | null
    street: string | null
    city: string | null
    state: string | null
    zip: string | null
    congressional_district: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    name: number
    avatar: number
    phone: number
    street: number
    city: number
    state: number
    zip: number
    congressional_district: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    name?: true
    avatar?: true
    phone?: true
    street?: true
    city?: true
    state?: true
    zip?: true
    congressional_district?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    name?: true
    avatar?: true
    phone?: true
    street?: true
    city?: true
    state?: true
    zip?: true
    congressional_district?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    name?: true
    avatar?: true
    phone?: true
    street?: true
    city?: true
    state?: true
    zip?: true
    congressional_district?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    name: string | null
    avatar: string | null
    phone: string | null
    street: string | null
    city: string | null
    state: string | null
    zip: string | null
    congressional_district: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    avatar?: boolean
    phone?: boolean
    street?: boolean
    city?: boolean
    state?: boolean
    zip?: boolean
    congressional_district?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    account?: boolean | User$accountArgs<ExtArgs>
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    templates?: boolean | User$templatesArgs<ExtArgs>
    representatives?: boolean | User$representativesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    avatar?: boolean
    phone?: boolean
    street?: boolean
    city?: boolean
    state?: boolean
    zip?: boolean
    congressional_district?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    avatar?: boolean
    phone?: boolean
    street?: boolean
    city?: boolean
    state?: boolean
    zip?: boolean
    congressional_district?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    name?: boolean
    avatar?: boolean
    phone?: boolean
    street?: boolean
    city?: boolean
    state?: boolean
    zip?: boolean
    congressional_district?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "name" | "avatar" | "phone" | "street" | "city" | "state" | "zip" | "congressional_district" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | User$accountArgs<ExtArgs>
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    templates?: boolean | User$templatesArgs<ExtArgs>
    representatives?: boolean | User$representativesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      account: Prisma.$accountPayload<ExtArgs>[]
      sessions: Prisma.$SessionPayload<ExtArgs>[]
      templates: Prisma.$TemplatePayload<ExtArgs>[]
      representatives: Prisma.$user_representativesPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      name: string | null
      avatar: string | null
      phone: string | null
      street: string | null
      city: string | null
      state: string | null
      zip: string | null
      congressional_district: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    account<T extends User$accountArgs<ExtArgs> = {}>(args?: Subset<T, User$accountArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    sessions<T extends User$sessionsArgs<ExtArgs> = {}>(args?: Subset<T, User$sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    templates<T extends User$templatesArgs<ExtArgs> = {}>(args?: Subset<T, User$templatesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    representatives<T extends User$representativesArgs<ExtArgs> = {}>(args?: Subset<T, User$representativesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly avatar: FieldRef<"User", 'String'>
    readonly phone: FieldRef<"User", 'String'>
    readonly street: FieldRef<"User", 'String'>
    readonly city: FieldRef<"User", 'String'>
    readonly state: FieldRef<"User", 'String'>
    readonly zip: FieldRef<"User", 'String'>
    readonly congressional_district: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.account
   */
  export type User$accountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    where?: accountWhereInput
    orderBy?: accountOrderByWithRelationInput | accountOrderByWithRelationInput[]
    cursor?: accountWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * User.sessions
   */
  export type User$sessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    cursor?: SessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * User.templates
   */
  export type User$templatesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    where?: TemplateWhereInput
    orderBy?: TemplateOrderByWithRelationInput | TemplateOrderByWithRelationInput[]
    cursor?: TemplateWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TemplateScalarFieldEnum | TemplateScalarFieldEnum[]
  }

  /**
   * User.representatives
   */
  export type User$representativesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    where?: user_representativesWhereInput
    orderBy?: user_representativesOrderByWithRelationInput | user_representativesOrderByWithRelationInput[]
    cursor?: user_representativesWhereUniqueInput
    take?: number
    skip?: number
    distinct?: User_representativesScalarFieldEnum | User_representativesScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Session
   */

  export type AggregateSession = {
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  export type SessionMinAggregateOutputType = {
    id: string | null
    userId: string | null
    expiresAt: Date | null
    createdAt: Date | null
  }

  export type SessionMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    expiresAt: Date | null
    createdAt: Date | null
  }

  export type SessionCountAggregateOutputType = {
    id: number
    userId: number
    expiresAt: number
    createdAt: number
    _all: number
  }


  export type SessionMinAggregateInputType = {
    id?: true
    userId?: true
    expiresAt?: true
    createdAt?: true
  }

  export type SessionMaxAggregateInputType = {
    id?: true
    userId?: true
    expiresAt?: true
    createdAt?: true
  }

  export type SessionCountAggregateInputType = {
    id?: true
    userId?: true
    expiresAt?: true
    createdAt?: true
    _all?: true
  }

  export type SessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Session to aggregate.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Sessions
    **/
    _count?: true | SessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SessionMaxAggregateInputType
  }

  export type GetSessionAggregateType<T extends SessionAggregateArgs> = {
        [P in keyof T & keyof AggregateSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSession[P]>
      : GetScalarType<T[P], AggregateSession[P]>
  }




  export type SessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithAggregationInput | SessionOrderByWithAggregationInput[]
    by: SessionScalarFieldEnum[] | SessionScalarFieldEnum
    having?: SessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SessionCountAggregateInputType | true
    _min?: SessionMinAggregateInputType
    _max?: SessionMaxAggregateInputType
  }

  export type SessionGroupByOutputType = {
    id: string
    userId: string
    expiresAt: Date
    createdAt: Date
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  type GetSessionGroupByPayload<T extends SessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionGroupByOutputType[P]>
            : GetScalarType<T[P], SessionGroupByOutputType[P]>
        }
      >
    >


  export type SessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectScalar = {
    id?: boolean
    userId?: boolean
    expiresAt?: boolean
    createdAt?: boolean
  }

  export type SessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "expiresAt" | "createdAt", ExtArgs["result"]["session"]>
  export type SessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SessionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Session"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      expiresAt: Date
      createdAt: Date
    }, ExtArgs["result"]["session"]>
    composites: {}
  }

  type SessionGetPayload<S extends boolean | null | undefined | SessionDefaultArgs> = $Result.GetResult<Prisma.$SessionPayload, S>

  type SessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SessionCountAggregateInputType | true
    }

  export interface SessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Session'], meta: { name: 'Session' } }
    /**
     * Find zero or one Session that matches the filter.
     * @param {SessionFindUniqueArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SessionFindUniqueArgs>(args: SelectSubset<T, SessionFindUniqueArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Session that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SessionFindUniqueOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SessionFindUniqueOrThrowArgs>(args: SelectSubset<T, SessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SessionFindFirstArgs>(args?: SelectSubset<T, SessionFindFirstArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SessionFindFirstOrThrowArgs>(args?: SelectSubset<T, SessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Sessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Sessions
     * const sessions = await prisma.session.findMany()
     * 
     * // Get first 10 Sessions
     * const sessions = await prisma.session.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sessionWithIdOnly = await prisma.session.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SessionFindManyArgs>(args?: SelectSubset<T, SessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Session.
     * @param {SessionCreateArgs} args - Arguments to create a Session.
     * @example
     * // Create one Session
     * const Session = await prisma.session.create({
     *   data: {
     *     // ... data to create a Session
     *   }
     * })
     * 
     */
    create<T extends SessionCreateArgs>(args: SelectSubset<T, SessionCreateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Sessions.
     * @param {SessionCreateManyArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SessionCreateManyArgs>(args?: SelectSubset<T, SessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Sessions and returns the data saved in the database.
     * @param {SessionCreateManyAndReturnArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SessionCreateManyAndReturnArgs>(args?: SelectSubset<T, SessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Session.
     * @param {SessionDeleteArgs} args - Arguments to delete one Session.
     * @example
     * // Delete one Session
     * const Session = await prisma.session.delete({
     *   where: {
     *     // ... filter to delete one Session
     *   }
     * })
     * 
     */
    delete<T extends SessionDeleteArgs>(args: SelectSubset<T, SessionDeleteArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Session.
     * @param {SessionUpdateArgs} args - Arguments to update one Session.
     * @example
     * // Update one Session
     * const session = await prisma.session.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SessionUpdateArgs>(args: SelectSubset<T, SessionUpdateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Sessions.
     * @param {SessionDeleteManyArgs} args - Arguments to filter Sessions to delete.
     * @example
     * // Delete a few Sessions
     * const { count } = await prisma.session.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SessionDeleteManyArgs>(args?: SelectSubset<T, SessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SessionUpdateManyArgs>(args: SelectSubset<T, SessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions and returns the data updated in the database.
     * @param {SessionUpdateManyAndReturnArgs} args - Arguments to update many Sessions.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SessionUpdateManyAndReturnArgs>(args: SelectSubset<T, SessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Session.
     * @param {SessionUpsertArgs} args - Arguments to update or create a Session.
     * @example
     * // Update or create a Session
     * const session = await prisma.session.upsert({
     *   create: {
     *     // ... data to create a Session
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Session we want to update
     *   }
     * })
     */
    upsert<T extends SessionUpsertArgs>(args: SelectSubset<T, SessionUpsertArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionCountArgs} args - Arguments to filter Sessions to count.
     * @example
     * // Count the number of Sessions
     * const count = await prisma.session.count({
     *   where: {
     *     // ... the filter for the Sessions we want to count
     *   }
     * })
    **/
    count<T extends SessionCountArgs>(
      args?: Subset<T, SessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SessionAggregateArgs>(args: Subset<T, SessionAggregateArgs>): Prisma.PrismaPromise<GetSessionAggregateType<T>>

    /**
     * Group by Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionGroupByArgs['orderBy'] }
        : { orderBy?: SessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Session model
   */
  readonly fields: SessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Session.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Session model
   */
  interface SessionFieldRefs {
    readonly id: FieldRef<"Session", 'String'>
    readonly userId: FieldRef<"Session", 'String'>
    readonly expiresAt: FieldRef<"Session", 'DateTime'>
    readonly createdAt: FieldRef<"Session", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Session findUnique
   */
  export type SessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findUniqueOrThrow
   */
  export type SessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findFirst
   */
  export type SessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findFirstOrThrow
   */
  export type SessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findMany
   */
  export type SessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Sessions to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session create
   */
  export type SessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to create a Session.
     */
    data: XOR<SessionCreateInput, SessionUncheckedCreateInput>
  }

  /**
   * Session createMany
   */
  export type SessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Session createManyAndReturn
   */
  export type SessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session update
   */
  export type SessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to update a Session.
     */
    data: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
    /**
     * Choose, which Session to update.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session updateMany
   */
  export type SessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
  }

  /**
   * Session updateManyAndReturn
   */
  export type SessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session upsert
   */
  export type SessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The filter to search for the Session to update in case it exists.
     */
    where: SessionWhereUniqueInput
    /**
     * In case the Session found by the `where` argument doesn't exist, create a new Session with this data.
     */
    create: XOR<SessionCreateInput, SessionUncheckedCreateInput>
    /**
     * In case the Session was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
  }

  /**
   * Session delete
   */
  export type SessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter which Session to delete.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session deleteMany
   */
  export type SessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Sessions to delete
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to delete.
     */
    limit?: number
  }

  /**
   * Session without action
   */
  export type SessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
  }


  /**
   * Model Template
   */

  export type AggregateTemplate = {
    _count: TemplateCountAggregateOutputType | null
    _min: TemplateMinAggregateOutputType | null
    _max: TemplateMaxAggregateOutputType | null
  }

  export type TemplateMinAggregateOutputType = {
    id: string | null
    title: string | null
    description: string | null
    category: string | null
    type: string | null
    deliveryMethod: string | null
    subject: string | null
    preview: string | null
    message_body: string | null
    campaign_id: string | null
    status: string | null
    is_public: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    userId: string | null
  }

  export type TemplateMaxAggregateOutputType = {
    id: string | null
    title: string | null
    description: string | null
    category: string | null
    type: string | null
    deliveryMethod: string | null
    subject: string | null
    preview: string | null
    message_body: string | null
    campaign_id: string | null
    status: string | null
    is_public: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
    userId: string | null
  }

  export type TemplateCountAggregateOutputType = {
    id: number
    title: number
    description: number
    category: number
    type: number
    deliveryMethod: number
    subject: number
    preview: number
    message_body: number
    delivery_config: number
    cwc_config: number
    recipient_config: number
    metrics: number
    campaign_id: number
    status: number
    is_public: number
    createdAt: number
    updatedAt: number
    userId: number
    _all: number
  }


  export type TemplateMinAggregateInputType = {
    id?: true
    title?: true
    description?: true
    category?: true
    type?: true
    deliveryMethod?: true
    subject?: true
    preview?: true
    message_body?: true
    campaign_id?: true
    status?: true
    is_public?: true
    createdAt?: true
    updatedAt?: true
    userId?: true
  }

  export type TemplateMaxAggregateInputType = {
    id?: true
    title?: true
    description?: true
    category?: true
    type?: true
    deliveryMethod?: true
    subject?: true
    preview?: true
    message_body?: true
    campaign_id?: true
    status?: true
    is_public?: true
    createdAt?: true
    updatedAt?: true
    userId?: true
  }

  export type TemplateCountAggregateInputType = {
    id?: true
    title?: true
    description?: true
    category?: true
    type?: true
    deliveryMethod?: true
    subject?: true
    preview?: true
    message_body?: true
    delivery_config?: true
    cwc_config?: true
    recipient_config?: true
    metrics?: true
    campaign_id?: true
    status?: true
    is_public?: true
    createdAt?: true
    updatedAt?: true
    userId?: true
    _all?: true
  }

  export type TemplateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Template to aggregate.
     */
    where?: TemplateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Templates to fetch.
     */
    orderBy?: TemplateOrderByWithRelationInput | TemplateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TemplateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Templates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Templates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Templates
    **/
    _count?: true | TemplateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TemplateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TemplateMaxAggregateInputType
  }

  export type GetTemplateAggregateType<T extends TemplateAggregateArgs> = {
        [P in keyof T & keyof AggregateTemplate]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTemplate[P]>
      : GetScalarType<T[P], AggregateTemplate[P]>
  }




  export type TemplateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TemplateWhereInput
    orderBy?: TemplateOrderByWithAggregationInput | TemplateOrderByWithAggregationInput[]
    by: TemplateScalarFieldEnum[] | TemplateScalarFieldEnum
    having?: TemplateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TemplateCountAggregateInputType | true
    _min?: TemplateMinAggregateInputType
    _max?: TemplateMaxAggregateInputType
  }

  export type TemplateGroupByOutputType = {
    id: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject: string | null
    preview: string
    message_body: string
    delivery_config: JsonValue
    cwc_config: JsonValue | null
    recipient_config: JsonValue
    metrics: JsonValue
    campaign_id: string | null
    status: string
    is_public: boolean
    createdAt: Date
    updatedAt: Date
    userId: string | null
    _count: TemplateCountAggregateOutputType | null
    _min: TemplateMinAggregateOutputType | null
    _max: TemplateMaxAggregateOutputType | null
  }

  type GetTemplateGroupByPayload<T extends TemplateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TemplateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TemplateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TemplateGroupByOutputType[P]>
            : GetScalarType<T[P], TemplateGroupByOutputType[P]>
        }
      >
    >


  export type TemplateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    type?: boolean
    deliveryMethod?: boolean
    subject?: boolean
    preview?: boolean
    message_body?: boolean
    delivery_config?: boolean
    cwc_config?: boolean
    recipient_config?: boolean
    metrics?: boolean
    campaign_id?: boolean
    status?: boolean
    is_public?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    userId?: boolean
    user?: boolean | Template$userArgs<ExtArgs>
    template_campaign?: boolean | Template$template_campaignArgs<ExtArgs>
    _count?: boolean | TemplateCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["template"]>

  export type TemplateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    type?: boolean
    deliveryMethod?: boolean
    subject?: boolean
    preview?: boolean
    message_body?: boolean
    delivery_config?: boolean
    cwc_config?: boolean
    recipient_config?: boolean
    metrics?: boolean
    campaign_id?: boolean
    status?: boolean
    is_public?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    userId?: boolean
    user?: boolean | Template$userArgs<ExtArgs>
  }, ExtArgs["result"]["template"]>

  export type TemplateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    type?: boolean
    deliveryMethod?: boolean
    subject?: boolean
    preview?: boolean
    message_body?: boolean
    delivery_config?: boolean
    cwc_config?: boolean
    recipient_config?: boolean
    metrics?: boolean
    campaign_id?: boolean
    status?: boolean
    is_public?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    userId?: boolean
    user?: boolean | Template$userArgs<ExtArgs>
  }, ExtArgs["result"]["template"]>

  export type TemplateSelectScalar = {
    id?: boolean
    title?: boolean
    description?: boolean
    category?: boolean
    type?: boolean
    deliveryMethod?: boolean
    subject?: boolean
    preview?: boolean
    message_body?: boolean
    delivery_config?: boolean
    cwc_config?: boolean
    recipient_config?: boolean
    metrics?: boolean
    campaign_id?: boolean
    status?: boolean
    is_public?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    userId?: boolean
  }

  export type TemplateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "title" | "description" | "category" | "type" | "deliveryMethod" | "subject" | "preview" | "message_body" | "delivery_config" | "cwc_config" | "recipient_config" | "metrics" | "campaign_id" | "status" | "is_public" | "createdAt" | "updatedAt" | "userId", ExtArgs["result"]["template"]>
  export type TemplateInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | Template$userArgs<ExtArgs>
    template_campaign?: boolean | Template$template_campaignArgs<ExtArgs>
    _count?: boolean | TemplateCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TemplateIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | Template$userArgs<ExtArgs>
  }
  export type TemplateIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | Template$userArgs<ExtArgs>
  }

  export type $TemplatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Template"
    objects: {
      user: Prisma.$UserPayload<ExtArgs> | null
      template_campaign: Prisma.$template_campaignPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      title: string
      description: string
      category: string
      type: string
      deliveryMethod: string
      subject: string | null
      preview: string
      message_body: string
      delivery_config: Prisma.JsonValue
      cwc_config: Prisma.JsonValue | null
      recipient_config: Prisma.JsonValue
      metrics: Prisma.JsonValue
      campaign_id: string | null
      status: string
      is_public: boolean
      createdAt: Date
      updatedAt: Date
      userId: string | null
    }, ExtArgs["result"]["template"]>
    composites: {}
  }

  type TemplateGetPayload<S extends boolean | null | undefined | TemplateDefaultArgs> = $Result.GetResult<Prisma.$TemplatePayload, S>

  type TemplateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TemplateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TemplateCountAggregateInputType | true
    }

  export interface TemplateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Template'], meta: { name: 'Template' } }
    /**
     * Find zero or one Template that matches the filter.
     * @param {TemplateFindUniqueArgs} args - Arguments to find a Template
     * @example
     * // Get one Template
     * const template = await prisma.template.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TemplateFindUniqueArgs>(args: SelectSubset<T, TemplateFindUniqueArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Template that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TemplateFindUniqueOrThrowArgs} args - Arguments to find a Template
     * @example
     * // Get one Template
     * const template = await prisma.template.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TemplateFindUniqueOrThrowArgs>(args: SelectSubset<T, TemplateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Template that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateFindFirstArgs} args - Arguments to find a Template
     * @example
     * // Get one Template
     * const template = await prisma.template.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TemplateFindFirstArgs>(args?: SelectSubset<T, TemplateFindFirstArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Template that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateFindFirstOrThrowArgs} args - Arguments to find a Template
     * @example
     * // Get one Template
     * const template = await prisma.template.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TemplateFindFirstOrThrowArgs>(args?: SelectSubset<T, TemplateFindFirstOrThrowArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Templates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Templates
     * const templates = await prisma.template.findMany()
     * 
     * // Get first 10 Templates
     * const templates = await prisma.template.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const templateWithIdOnly = await prisma.template.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TemplateFindManyArgs>(args?: SelectSubset<T, TemplateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Template.
     * @param {TemplateCreateArgs} args - Arguments to create a Template.
     * @example
     * // Create one Template
     * const Template = await prisma.template.create({
     *   data: {
     *     // ... data to create a Template
     *   }
     * })
     * 
     */
    create<T extends TemplateCreateArgs>(args: SelectSubset<T, TemplateCreateArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Templates.
     * @param {TemplateCreateManyArgs} args - Arguments to create many Templates.
     * @example
     * // Create many Templates
     * const template = await prisma.template.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TemplateCreateManyArgs>(args?: SelectSubset<T, TemplateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Templates and returns the data saved in the database.
     * @param {TemplateCreateManyAndReturnArgs} args - Arguments to create many Templates.
     * @example
     * // Create many Templates
     * const template = await prisma.template.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Templates and only return the `id`
     * const templateWithIdOnly = await prisma.template.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TemplateCreateManyAndReturnArgs>(args?: SelectSubset<T, TemplateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Template.
     * @param {TemplateDeleteArgs} args - Arguments to delete one Template.
     * @example
     * // Delete one Template
     * const Template = await prisma.template.delete({
     *   where: {
     *     // ... filter to delete one Template
     *   }
     * })
     * 
     */
    delete<T extends TemplateDeleteArgs>(args: SelectSubset<T, TemplateDeleteArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Template.
     * @param {TemplateUpdateArgs} args - Arguments to update one Template.
     * @example
     * // Update one Template
     * const template = await prisma.template.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TemplateUpdateArgs>(args: SelectSubset<T, TemplateUpdateArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Templates.
     * @param {TemplateDeleteManyArgs} args - Arguments to filter Templates to delete.
     * @example
     * // Delete a few Templates
     * const { count } = await prisma.template.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TemplateDeleteManyArgs>(args?: SelectSubset<T, TemplateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Templates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Templates
     * const template = await prisma.template.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TemplateUpdateManyArgs>(args: SelectSubset<T, TemplateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Templates and returns the data updated in the database.
     * @param {TemplateUpdateManyAndReturnArgs} args - Arguments to update many Templates.
     * @example
     * // Update many Templates
     * const template = await prisma.template.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Templates and only return the `id`
     * const templateWithIdOnly = await prisma.template.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TemplateUpdateManyAndReturnArgs>(args: SelectSubset<T, TemplateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Template.
     * @param {TemplateUpsertArgs} args - Arguments to update or create a Template.
     * @example
     * // Update or create a Template
     * const template = await prisma.template.upsert({
     *   create: {
     *     // ... data to create a Template
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Template we want to update
     *   }
     * })
     */
    upsert<T extends TemplateUpsertArgs>(args: SelectSubset<T, TemplateUpsertArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Templates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateCountArgs} args - Arguments to filter Templates to count.
     * @example
     * // Count the number of Templates
     * const count = await prisma.template.count({
     *   where: {
     *     // ... the filter for the Templates we want to count
     *   }
     * })
    **/
    count<T extends TemplateCountArgs>(
      args?: Subset<T, TemplateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TemplateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Template.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TemplateAggregateArgs>(args: Subset<T, TemplateAggregateArgs>): Prisma.PrismaPromise<GetTemplateAggregateType<T>>

    /**
     * Group by Template.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TemplateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TemplateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TemplateGroupByArgs['orderBy'] }
        : { orderBy?: TemplateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TemplateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTemplateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Template model
   */
  readonly fields: TemplateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Template.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TemplateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends Template$userArgs<ExtArgs> = {}>(args?: Subset<T, Template$userArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    template_campaign<T extends Template$template_campaignArgs<ExtArgs> = {}>(args?: Subset<T, Template$template_campaignArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Template model
   */
  interface TemplateFieldRefs {
    readonly id: FieldRef<"Template", 'String'>
    readonly title: FieldRef<"Template", 'String'>
    readonly description: FieldRef<"Template", 'String'>
    readonly category: FieldRef<"Template", 'String'>
    readonly type: FieldRef<"Template", 'String'>
    readonly deliveryMethod: FieldRef<"Template", 'String'>
    readonly subject: FieldRef<"Template", 'String'>
    readonly preview: FieldRef<"Template", 'String'>
    readonly message_body: FieldRef<"Template", 'String'>
    readonly delivery_config: FieldRef<"Template", 'Json'>
    readonly cwc_config: FieldRef<"Template", 'Json'>
    readonly recipient_config: FieldRef<"Template", 'Json'>
    readonly metrics: FieldRef<"Template", 'Json'>
    readonly campaign_id: FieldRef<"Template", 'String'>
    readonly status: FieldRef<"Template", 'String'>
    readonly is_public: FieldRef<"Template", 'Boolean'>
    readonly createdAt: FieldRef<"Template", 'DateTime'>
    readonly updatedAt: FieldRef<"Template", 'DateTime'>
    readonly userId: FieldRef<"Template", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Template findUnique
   */
  export type TemplateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * Filter, which Template to fetch.
     */
    where: TemplateWhereUniqueInput
  }

  /**
   * Template findUniqueOrThrow
   */
  export type TemplateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * Filter, which Template to fetch.
     */
    where: TemplateWhereUniqueInput
  }

  /**
   * Template findFirst
   */
  export type TemplateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * Filter, which Template to fetch.
     */
    where?: TemplateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Templates to fetch.
     */
    orderBy?: TemplateOrderByWithRelationInput | TemplateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Templates.
     */
    cursor?: TemplateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Templates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Templates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Templates.
     */
    distinct?: TemplateScalarFieldEnum | TemplateScalarFieldEnum[]
  }

  /**
   * Template findFirstOrThrow
   */
  export type TemplateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * Filter, which Template to fetch.
     */
    where?: TemplateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Templates to fetch.
     */
    orderBy?: TemplateOrderByWithRelationInput | TemplateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Templates.
     */
    cursor?: TemplateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Templates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Templates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Templates.
     */
    distinct?: TemplateScalarFieldEnum | TemplateScalarFieldEnum[]
  }

  /**
   * Template findMany
   */
  export type TemplateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * Filter, which Templates to fetch.
     */
    where?: TemplateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Templates to fetch.
     */
    orderBy?: TemplateOrderByWithRelationInput | TemplateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Templates.
     */
    cursor?: TemplateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Templates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Templates.
     */
    skip?: number
    distinct?: TemplateScalarFieldEnum | TemplateScalarFieldEnum[]
  }

  /**
   * Template create
   */
  export type TemplateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * The data needed to create a Template.
     */
    data: XOR<TemplateCreateInput, TemplateUncheckedCreateInput>
  }

  /**
   * Template createMany
   */
  export type TemplateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Templates.
     */
    data: TemplateCreateManyInput | TemplateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Template createManyAndReturn
   */
  export type TemplateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * The data used to create many Templates.
     */
    data: TemplateCreateManyInput | TemplateCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Template update
   */
  export type TemplateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * The data needed to update a Template.
     */
    data: XOR<TemplateUpdateInput, TemplateUncheckedUpdateInput>
    /**
     * Choose, which Template to update.
     */
    where: TemplateWhereUniqueInput
  }

  /**
   * Template updateMany
   */
  export type TemplateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Templates.
     */
    data: XOR<TemplateUpdateManyMutationInput, TemplateUncheckedUpdateManyInput>
    /**
     * Filter which Templates to update
     */
    where?: TemplateWhereInput
    /**
     * Limit how many Templates to update.
     */
    limit?: number
  }

  /**
   * Template updateManyAndReturn
   */
  export type TemplateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * The data used to update Templates.
     */
    data: XOR<TemplateUpdateManyMutationInput, TemplateUncheckedUpdateManyInput>
    /**
     * Filter which Templates to update
     */
    where?: TemplateWhereInput
    /**
     * Limit how many Templates to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Template upsert
   */
  export type TemplateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * The filter to search for the Template to update in case it exists.
     */
    where: TemplateWhereUniqueInput
    /**
     * In case the Template found by the `where` argument doesn't exist, create a new Template with this data.
     */
    create: XOR<TemplateCreateInput, TemplateUncheckedCreateInput>
    /**
     * In case the Template was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TemplateUpdateInput, TemplateUncheckedUpdateInput>
  }

  /**
   * Template delete
   */
  export type TemplateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
    /**
     * Filter which Template to delete.
     */
    where: TemplateWhereUniqueInput
  }

  /**
   * Template deleteMany
   */
  export type TemplateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Templates to delete
     */
    where?: TemplateWhereInput
    /**
     * Limit how many Templates to delete.
     */
    limit?: number
  }

  /**
   * Template.user
   */
  export type Template$userArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * Template.template_campaign
   */
  export type Template$template_campaignArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    where?: template_campaignWhereInput
    orderBy?: template_campaignOrderByWithRelationInput | template_campaignOrderByWithRelationInput[]
    cursor?: template_campaignWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Template_campaignScalarFieldEnum | Template_campaignScalarFieldEnum[]
  }

  /**
   * Template without action
   */
  export type TemplateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Template
     */
    select?: TemplateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Template
     */
    omit?: TemplateOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TemplateInclude<ExtArgs> | null
  }


  /**
   * Model account
   */

  export type AggregateAccount = {
    _count: AccountCountAggregateOutputType | null
    _avg: AccountAvgAggregateOutputType | null
    _sum: AccountSumAggregateOutputType | null
    _min: AccountMinAggregateOutputType | null
    _max: AccountMaxAggregateOutputType | null
  }

  export type AccountAvgAggregateOutputType = {
    expires_at: number | null
  }

  export type AccountSumAggregateOutputType = {
    expires_at: number | null
  }

  export type AccountMinAggregateOutputType = {
    id: string | null
    user_id: string | null
    type: string | null
    provider: string | null
    provider_account_id: string | null
    refresh_token: string | null
    access_token: string | null
    expires_at: number | null
    token_type: string | null
    scope: string | null
    id_token: string | null
    session_state: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type AccountMaxAggregateOutputType = {
    id: string | null
    user_id: string | null
    type: string | null
    provider: string | null
    provider_account_id: string | null
    refresh_token: string | null
    access_token: string | null
    expires_at: number | null
    token_type: string | null
    scope: string | null
    id_token: string | null
    session_state: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type AccountCountAggregateOutputType = {
    id: number
    user_id: number
    type: number
    provider: number
    provider_account_id: number
    refresh_token: number
    access_token: number
    expires_at: number
    token_type: number
    scope: number
    id_token: number
    session_state: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type AccountAvgAggregateInputType = {
    expires_at?: true
  }

  export type AccountSumAggregateInputType = {
    expires_at?: true
  }

  export type AccountMinAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    provider?: true
    provider_account_id?: true
    refresh_token?: true
    access_token?: true
    expires_at?: true
    token_type?: true
    scope?: true
    id_token?: true
    session_state?: true
    created_at?: true
    updated_at?: true
  }

  export type AccountMaxAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    provider?: true
    provider_account_id?: true
    refresh_token?: true
    access_token?: true
    expires_at?: true
    token_type?: true
    scope?: true
    id_token?: true
    session_state?: true
    created_at?: true
    updated_at?: true
  }

  export type AccountCountAggregateInputType = {
    id?: true
    user_id?: true
    type?: true
    provider?: true
    provider_account_id?: true
    refresh_token?: true
    access_token?: true
    expires_at?: true
    token_type?: true
    scope?: true
    id_token?: true
    session_state?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type AccountAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which account to aggregate.
     */
    where?: accountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of accounts to fetch.
     */
    orderBy?: accountOrderByWithRelationInput | accountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: accountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` accounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned accounts
    **/
    _count?: true | AccountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AccountAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AccountSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AccountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AccountMaxAggregateInputType
  }

  export type GetAccountAggregateType<T extends AccountAggregateArgs> = {
        [P in keyof T & keyof AggregateAccount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAccount[P]>
      : GetScalarType<T[P], AggregateAccount[P]>
  }




  export type accountGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: accountWhereInput
    orderBy?: accountOrderByWithAggregationInput | accountOrderByWithAggregationInput[]
    by: AccountScalarFieldEnum[] | AccountScalarFieldEnum
    having?: accountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AccountCountAggregateInputType | true
    _avg?: AccountAvgAggregateInputType
    _sum?: AccountSumAggregateInputType
    _min?: AccountMinAggregateInputType
    _max?: AccountMaxAggregateInputType
  }

  export type AccountGroupByOutputType = {
    id: string
    user_id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token: string | null
    access_token: string | null
    expires_at: number | null
    token_type: string | null
    scope: string | null
    id_token: string | null
    session_state: string | null
    created_at: Date
    updated_at: Date
    _count: AccountCountAggregateOutputType | null
    _avg: AccountAvgAggregateOutputType | null
    _sum: AccountSumAggregateOutputType | null
    _min: AccountMinAggregateOutputType | null
    _max: AccountMaxAggregateOutputType | null
  }

  type GetAccountGroupByPayload<T extends accountGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AccountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AccountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AccountGroupByOutputType[P]>
            : GetScalarType<T[P], AccountGroupByOutputType[P]>
        }
      >
    >


  export type accountSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    type?: boolean
    provider?: boolean
    provider_account_id?: boolean
    refresh_token?: boolean
    access_token?: boolean
    expires_at?: boolean
    token_type?: boolean
    scope?: boolean
    id_token?: boolean
    session_state?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["account"]>

  export type accountSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    type?: boolean
    provider?: boolean
    provider_account_id?: boolean
    refresh_token?: boolean
    access_token?: boolean
    expires_at?: boolean
    token_type?: boolean
    scope?: boolean
    id_token?: boolean
    session_state?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["account"]>

  export type accountSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    type?: boolean
    provider?: boolean
    provider_account_id?: boolean
    refresh_token?: boolean
    access_token?: boolean
    expires_at?: boolean
    token_type?: boolean
    scope?: boolean
    id_token?: boolean
    session_state?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["account"]>

  export type accountSelectScalar = {
    id?: boolean
    user_id?: boolean
    type?: boolean
    provider?: boolean
    provider_account_id?: boolean
    refresh_token?: boolean
    access_token?: boolean
    expires_at?: boolean
    token_type?: boolean
    scope?: boolean
    id_token?: boolean
    session_state?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type accountOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "type" | "provider" | "provider_account_id" | "refresh_token" | "access_token" | "expires_at" | "token_type" | "scope" | "id_token" | "session_state" | "created_at" | "updated_at", ExtArgs["result"]["account"]>
  export type accountInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type accountIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type accountIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $accountPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "account"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: string
      type: string
      provider: string
      provider_account_id: string
      refresh_token: string | null
      access_token: string | null
      expires_at: number | null
      token_type: string | null
      scope: string | null
      id_token: string | null
      session_state: string | null
      created_at: Date
      updated_at: Date
    }, ExtArgs["result"]["account"]>
    composites: {}
  }

  type accountGetPayload<S extends boolean | null | undefined | accountDefaultArgs> = $Result.GetResult<Prisma.$accountPayload, S>

  type accountCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<accountFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AccountCountAggregateInputType | true
    }

  export interface accountDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['account'], meta: { name: 'account' } }
    /**
     * Find zero or one Account that matches the filter.
     * @param {accountFindUniqueArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends accountFindUniqueArgs>(args: SelectSubset<T, accountFindUniqueArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Account that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {accountFindUniqueOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends accountFindUniqueOrThrowArgs>(args: SelectSubset<T, accountFindUniqueOrThrowArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Account that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {accountFindFirstArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends accountFindFirstArgs>(args?: SelectSubset<T, accountFindFirstArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Account that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {accountFindFirstOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends accountFindFirstOrThrowArgs>(args?: SelectSubset<T, accountFindFirstOrThrowArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Accounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {accountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Accounts
     * const accounts = await prisma.account.findMany()
     * 
     * // Get first 10 Accounts
     * const accounts = await prisma.account.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const accountWithIdOnly = await prisma.account.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends accountFindManyArgs>(args?: SelectSubset<T, accountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Account.
     * @param {accountCreateArgs} args - Arguments to create a Account.
     * @example
     * // Create one Account
     * const Account = await prisma.account.create({
     *   data: {
     *     // ... data to create a Account
     *   }
     * })
     * 
     */
    create<T extends accountCreateArgs>(args: SelectSubset<T, accountCreateArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Accounts.
     * @param {accountCreateManyArgs} args - Arguments to create many Accounts.
     * @example
     * // Create many Accounts
     * const account = await prisma.account.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends accountCreateManyArgs>(args?: SelectSubset<T, accountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Accounts and returns the data saved in the database.
     * @param {accountCreateManyAndReturnArgs} args - Arguments to create many Accounts.
     * @example
     * // Create many Accounts
     * const account = await prisma.account.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Accounts and only return the `id`
     * const accountWithIdOnly = await prisma.account.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends accountCreateManyAndReturnArgs>(args?: SelectSubset<T, accountCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Account.
     * @param {accountDeleteArgs} args - Arguments to delete one Account.
     * @example
     * // Delete one Account
     * const Account = await prisma.account.delete({
     *   where: {
     *     // ... filter to delete one Account
     *   }
     * })
     * 
     */
    delete<T extends accountDeleteArgs>(args: SelectSubset<T, accountDeleteArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Account.
     * @param {accountUpdateArgs} args - Arguments to update one Account.
     * @example
     * // Update one Account
     * const account = await prisma.account.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends accountUpdateArgs>(args: SelectSubset<T, accountUpdateArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Accounts.
     * @param {accountDeleteManyArgs} args - Arguments to filter Accounts to delete.
     * @example
     * // Delete a few Accounts
     * const { count } = await prisma.account.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends accountDeleteManyArgs>(args?: SelectSubset<T, accountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {accountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends accountUpdateManyArgs>(args: SelectSubset<T, accountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Accounts and returns the data updated in the database.
     * @param {accountUpdateManyAndReturnArgs} args - Arguments to update many Accounts.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Accounts and only return the `id`
     * const accountWithIdOnly = await prisma.account.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends accountUpdateManyAndReturnArgs>(args: SelectSubset<T, accountUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Account.
     * @param {accountUpsertArgs} args - Arguments to update or create a Account.
     * @example
     * // Update or create a Account
     * const account = await prisma.account.upsert({
     *   create: {
     *     // ... data to create a Account
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Account we want to update
     *   }
     * })
     */
    upsert<T extends accountUpsertArgs>(args: SelectSubset<T, accountUpsertArgs<ExtArgs>>): Prisma__accountClient<$Result.GetResult<Prisma.$accountPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {accountCountArgs} args - Arguments to filter Accounts to count.
     * @example
     * // Count the number of Accounts
     * const count = await prisma.account.count({
     *   where: {
     *     // ... the filter for the Accounts we want to count
     *   }
     * })
    **/
    count<T extends accountCountArgs>(
      args?: Subset<T, accountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AccountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AccountAggregateArgs>(args: Subset<T, AccountAggregateArgs>): Prisma.PrismaPromise<GetAccountAggregateType<T>>

    /**
     * Group by Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {accountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends accountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: accountGroupByArgs['orderBy'] }
        : { orderBy?: accountGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, accountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAccountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the account model
   */
  readonly fields: accountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for account.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__accountClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the account model
   */
  interface accountFieldRefs {
    readonly id: FieldRef<"account", 'String'>
    readonly user_id: FieldRef<"account", 'String'>
    readonly type: FieldRef<"account", 'String'>
    readonly provider: FieldRef<"account", 'String'>
    readonly provider_account_id: FieldRef<"account", 'String'>
    readonly refresh_token: FieldRef<"account", 'String'>
    readonly access_token: FieldRef<"account", 'String'>
    readonly expires_at: FieldRef<"account", 'Int'>
    readonly token_type: FieldRef<"account", 'String'>
    readonly scope: FieldRef<"account", 'String'>
    readonly id_token: FieldRef<"account", 'String'>
    readonly session_state: FieldRef<"account", 'String'>
    readonly created_at: FieldRef<"account", 'DateTime'>
    readonly updated_at: FieldRef<"account", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * account findUnique
   */
  export type accountFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * Filter, which account to fetch.
     */
    where: accountWhereUniqueInput
  }

  /**
   * account findUniqueOrThrow
   */
  export type accountFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * Filter, which account to fetch.
     */
    where: accountWhereUniqueInput
  }

  /**
   * account findFirst
   */
  export type accountFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * Filter, which account to fetch.
     */
    where?: accountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of accounts to fetch.
     */
    orderBy?: accountOrderByWithRelationInput | accountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for accounts.
     */
    cursor?: accountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` accounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of accounts.
     */
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * account findFirstOrThrow
   */
  export type accountFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * Filter, which account to fetch.
     */
    where?: accountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of accounts to fetch.
     */
    orderBy?: accountOrderByWithRelationInput | accountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for accounts.
     */
    cursor?: accountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` accounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of accounts.
     */
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * account findMany
   */
  export type accountFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * Filter, which accounts to fetch.
     */
    where?: accountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of accounts to fetch.
     */
    orderBy?: accountOrderByWithRelationInput | accountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing accounts.
     */
    cursor?: accountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` accounts.
     */
    skip?: number
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * account create
   */
  export type accountCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * The data needed to create a account.
     */
    data: XOR<accountCreateInput, accountUncheckedCreateInput>
  }

  /**
   * account createMany
   */
  export type accountCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many accounts.
     */
    data: accountCreateManyInput | accountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * account createManyAndReturn
   */
  export type accountCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * The data used to create many accounts.
     */
    data: accountCreateManyInput | accountCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * account update
   */
  export type accountUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * The data needed to update a account.
     */
    data: XOR<accountUpdateInput, accountUncheckedUpdateInput>
    /**
     * Choose, which account to update.
     */
    where: accountWhereUniqueInput
  }

  /**
   * account updateMany
   */
  export type accountUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update accounts.
     */
    data: XOR<accountUpdateManyMutationInput, accountUncheckedUpdateManyInput>
    /**
     * Filter which accounts to update
     */
    where?: accountWhereInput
    /**
     * Limit how many accounts to update.
     */
    limit?: number
  }

  /**
   * account updateManyAndReturn
   */
  export type accountUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * The data used to update accounts.
     */
    data: XOR<accountUpdateManyMutationInput, accountUncheckedUpdateManyInput>
    /**
     * Filter which accounts to update
     */
    where?: accountWhereInput
    /**
     * Limit how many accounts to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * account upsert
   */
  export type accountUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * The filter to search for the account to update in case it exists.
     */
    where: accountWhereUniqueInput
    /**
     * In case the account found by the `where` argument doesn't exist, create a new account with this data.
     */
    create: XOR<accountCreateInput, accountUncheckedCreateInput>
    /**
     * In case the account was found with the provided `where` argument, update it with this data.
     */
    update: XOR<accountUpdateInput, accountUncheckedUpdateInput>
  }

  /**
   * account delete
   */
  export type accountDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
    /**
     * Filter which account to delete.
     */
    where: accountWhereUniqueInput
  }

  /**
   * account deleteMany
   */
  export type accountDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which accounts to delete
     */
    where?: accountWhereInput
    /**
     * Limit how many accounts to delete.
     */
    limit?: number
  }

  /**
   * account without action
   */
  export type accountDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the account
     */
    select?: accountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the account
     */
    omit?: accountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: accountInclude<ExtArgs> | null
  }


  /**
   * Model congressional_office
   */

  export type AggregateCongressional_office = {
    _count: Congressional_officeCountAggregateOutputType | null
    _min: Congressional_officeMinAggregateOutputType | null
    _max: Congressional_officeMaxAggregateOutputType | null
  }

  export type Congressional_officeMinAggregateOutputType = {
    id: string | null
    office_code: string | null
    state: string | null
    district: string | null
    member_name: string | null
    party: string | null
    is_active: boolean | null
    last_updated: Date | null
  }

  export type Congressional_officeMaxAggregateOutputType = {
    id: string | null
    office_code: string | null
    state: string | null
    district: string | null
    member_name: string | null
    party: string | null
    is_active: boolean | null
    last_updated: Date | null
  }

  export type Congressional_officeCountAggregateOutputType = {
    id: number
    office_code: number
    state: number
    district: number
    member_name: number
    party: number
    is_active: number
    last_updated: number
    _all: number
  }


  export type Congressional_officeMinAggregateInputType = {
    id?: true
    office_code?: true
    state?: true
    district?: true
    member_name?: true
    party?: true
    is_active?: true
    last_updated?: true
  }

  export type Congressional_officeMaxAggregateInputType = {
    id?: true
    office_code?: true
    state?: true
    district?: true
    member_name?: true
    party?: true
    is_active?: true
    last_updated?: true
  }

  export type Congressional_officeCountAggregateInputType = {
    id?: true
    office_code?: true
    state?: true
    district?: true
    member_name?: true
    party?: true
    is_active?: true
    last_updated?: true
    _all?: true
  }

  export type Congressional_officeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which congressional_office to aggregate.
     */
    where?: congressional_officeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of congressional_offices to fetch.
     */
    orderBy?: congressional_officeOrderByWithRelationInput | congressional_officeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: congressional_officeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` congressional_offices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` congressional_offices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned congressional_offices
    **/
    _count?: true | Congressional_officeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Congressional_officeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Congressional_officeMaxAggregateInputType
  }

  export type GetCongressional_officeAggregateType<T extends Congressional_officeAggregateArgs> = {
        [P in keyof T & keyof AggregateCongressional_office]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCongressional_office[P]>
      : GetScalarType<T[P], AggregateCongressional_office[P]>
  }




  export type congressional_officeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: congressional_officeWhereInput
    orderBy?: congressional_officeOrderByWithAggregationInput | congressional_officeOrderByWithAggregationInput[]
    by: Congressional_officeScalarFieldEnum[] | Congressional_officeScalarFieldEnum
    having?: congressional_officeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Congressional_officeCountAggregateInputType | true
    _min?: Congressional_officeMinAggregateInputType
    _max?: Congressional_officeMaxAggregateInputType
  }

  export type Congressional_officeGroupByOutputType = {
    id: string
    office_code: string
    state: string
    district: string
    member_name: string
    party: string | null
    is_active: boolean
    last_updated: Date
    _count: Congressional_officeCountAggregateOutputType | null
    _min: Congressional_officeMinAggregateOutputType | null
    _max: Congressional_officeMaxAggregateOutputType | null
  }

  type GetCongressional_officeGroupByPayload<T extends congressional_officeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Congressional_officeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Congressional_officeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Congressional_officeGroupByOutputType[P]>
            : GetScalarType<T[P], Congressional_officeGroupByOutputType[P]>
        }
      >
    >


  export type congressional_officeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    office_code?: boolean
    state?: boolean
    district?: boolean
    member_name?: boolean
    party?: boolean
    is_active?: boolean
    last_updated?: boolean
  }, ExtArgs["result"]["congressional_office"]>

  export type congressional_officeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    office_code?: boolean
    state?: boolean
    district?: boolean
    member_name?: boolean
    party?: boolean
    is_active?: boolean
    last_updated?: boolean
  }, ExtArgs["result"]["congressional_office"]>

  export type congressional_officeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    office_code?: boolean
    state?: boolean
    district?: boolean
    member_name?: boolean
    party?: boolean
    is_active?: boolean
    last_updated?: boolean
  }, ExtArgs["result"]["congressional_office"]>

  export type congressional_officeSelectScalar = {
    id?: boolean
    office_code?: boolean
    state?: boolean
    district?: boolean
    member_name?: boolean
    party?: boolean
    is_active?: boolean
    last_updated?: boolean
  }

  export type congressional_officeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "office_code" | "state" | "district" | "member_name" | "party" | "is_active" | "last_updated", ExtArgs["result"]["congressional_office"]>

  export type $congressional_officePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "congressional_office"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      office_code: string
      state: string
      district: string
      member_name: string
      party: string | null
      is_active: boolean
      last_updated: Date
    }, ExtArgs["result"]["congressional_office"]>
    composites: {}
  }

  type congressional_officeGetPayload<S extends boolean | null | undefined | congressional_officeDefaultArgs> = $Result.GetResult<Prisma.$congressional_officePayload, S>

  type congressional_officeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<congressional_officeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Congressional_officeCountAggregateInputType | true
    }

  export interface congressional_officeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['congressional_office'], meta: { name: 'congressional_office' } }
    /**
     * Find zero or one Congressional_office that matches the filter.
     * @param {congressional_officeFindUniqueArgs} args - Arguments to find a Congressional_office
     * @example
     * // Get one Congressional_office
     * const congressional_office = await prisma.congressional_office.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends congressional_officeFindUniqueArgs>(args: SelectSubset<T, congressional_officeFindUniqueArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Congressional_office that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {congressional_officeFindUniqueOrThrowArgs} args - Arguments to find a Congressional_office
     * @example
     * // Get one Congressional_office
     * const congressional_office = await prisma.congressional_office.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends congressional_officeFindUniqueOrThrowArgs>(args: SelectSubset<T, congressional_officeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Congressional_office that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {congressional_officeFindFirstArgs} args - Arguments to find a Congressional_office
     * @example
     * // Get one Congressional_office
     * const congressional_office = await prisma.congressional_office.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends congressional_officeFindFirstArgs>(args?: SelectSubset<T, congressional_officeFindFirstArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Congressional_office that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {congressional_officeFindFirstOrThrowArgs} args - Arguments to find a Congressional_office
     * @example
     * // Get one Congressional_office
     * const congressional_office = await prisma.congressional_office.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends congressional_officeFindFirstOrThrowArgs>(args?: SelectSubset<T, congressional_officeFindFirstOrThrowArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Congressional_offices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {congressional_officeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Congressional_offices
     * const congressional_offices = await prisma.congressional_office.findMany()
     * 
     * // Get first 10 Congressional_offices
     * const congressional_offices = await prisma.congressional_office.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const congressional_officeWithIdOnly = await prisma.congressional_office.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends congressional_officeFindManyArgs>(args?: SelectSubset<T, congressional_officeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Congressional_office.
     * @param {congressional_officeCreateArgs} args - Arguments to create a Congressional_office.
     * @example
     * // Create one Congressional_office
     * const Congressional_office = await prisma.congressional_office.create({
     *   data: {
     *     // ... data to create a Congressional_office
     *   }
     * })
     * 
     */
    create<T extends congressional_officeCreateArgs>(args: SelectSubset<T, congressional_officeCreateArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Congressional_offices.
     * @param {congressional_officeCreateManyArgs} args - Arguments to create many Congressional_offices.
     * @example
     * // Create many Congressional_offices
     * const congressional_office = await prisma.congressional_office.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends congressional_officeCreateManyArgs>(args?: SelectSubset<T, congressional_officeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Congressional_offices and returns the data saved in the database.
     * @param {congressional_officeCreateManyAndReturnArgs} args - Arguments to create many Congressional_offices.
     * @example
     * // Create many Congressional_offices
     * const congressional_office = await prisma.congressional_office.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Congressional_offices and only return the `id`
     * const congressional_officeWithIdOnly = await prisma.congressional_office.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends congressional_officeCreateManyAndReturnArgs>(args?: SelectSubset<T, congressional_officeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Congressional_office.
     * @param {congressional_officeDeleteArgs} args - Arguments to delete one Congressional_office.
     * @example
     * // Delete one Congressional_office
     * const Congressional_office = await prisma.congressional_office.delete({
     *   where: {
     *     // ... filter to delete one Congressional_office
     *   }
     * })
     * 
     */
    delete<T extends congressional_officeDeleteArgs>(args: SelectSubset<T, congressional_officeDeleteArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Congressional_office.
     * @param {congressional_officeUpdateArgs} args - Arguments to update one Congressional_office.
     * @example
     * // Update one Congressional_office
     * const congressional_office = await prisma.congressional_office.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends congressional_officeUpdateArgs>(args: SelectSubset<T, congressional_officeUpdateArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Congressional_offices.
     * @param {congressional_officeDeleteManyArgs} args - Arguments to filter Congressional_offices to delete.
     * @example
     * // Delete a few Congressional_offices
     * const { count } = await prisma.congressional_office.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends congressional_officeDeleteManyArgs>(args?: SelectSubset<T, congressional_officeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Congressional_offices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {congressional_officeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Congressional_offices
     * const congressional_office = await prisma.congressional_office.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends congressional_officeUpdateManyArgs>(args: SelectSubset<T, congressional_officeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Congressional_offices and returns the data updated in the database.
     * @param {congressional_officeUpdateManyAndReturnArgs} args - Arguments to update many Congressional_offices.
     * @example
     * // Update many Congressional_offices
     * const congressional_office = await prisma.congressional_office.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Congressional_offices and only return the `id`
     * const congressional_officeWithIdOnly = await prisma.congressional_office.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends congressional_officeUpdateManyAndReturnArgs>(args: SelectSubset<T, congressional_officeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Congressional_office.
     * @param {congressional_officeUpsertArgs} args - Arguments to update or create a Congressional_office.
     * @example
     * // Update or create a Congressional_office
     * const congressional_office = await prisma.congressional_office.upsert({
     *   create: {
     *     // ... data to create a Congressional_office
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Congressional_office we want to update
     *   }
     * })
     */
    upsert<T extends congressional_officeUpsertArgs>(args: SelectSubset<T, congressional_officeUpsertArgs<ExtArgs>>): Prisma__congressional_officeClient<$Result.GetResult<Prisma.$congressional_officePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Congressional_offices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {congressional_officeCountArgs} args - Arguments to filter Congressional_offices to count.
     * @example
     * // Count the number of Congressional_offices
     * const count = await prisma.congressional_office.count({
     *   where: {
     *     // ... the filter for the Congressional_offices we want to count
     *   }
     * })
    **/
    count<T extends congressional_officeCountArgs>(
      args?: Subset<T, congressional_officeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Congressional_officeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Congressional_office.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Congressional_officeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Congressional_officeAggregateArgs>(args: Subset<T, Congressional_officeAggregateArgs>): Prisma.PrismaPromise<GetCongressional_officeAggregateType<T>>

    /**
     * Group by Congressional_office.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {congressional_officeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends congressional_officeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: congressional_officeGroupByArgs['orderBy'] }
        : { orderBy?: congressional_officeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, congressional_officeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCongressional_officeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the congressional_office model
   */
  readonly fields: congressional_officeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for congressional_office.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__congressional_officeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the congressional_office model
   */
  interface congressional_officeFieldRefs {
    readonly id: FieldRef<"congressional_office", 'String'>
    readonly office_code: FieldRef<"congressional_office", 'String'>
    readonly state: FieldRef<"congressional_office", 'String'>
    readonly district: FieldRef<"congressional_office", 'String'>
    readonly member_name: FieldRef<"congressional_office", 'String'>
    readonly party: FieldRef<"congressional_office", 'String'>
    readonly is_active: FieldRef<"congressional_office", 'Boolean'>
    readonly last_updated: FieldRef<"congressional_office", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * congressional_office findUnique
   */
  export type congressional_officeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * Filter, which congressional_office to fetch.
     */
    where: congressional_officeWhereUniqueInput
  }

  /**
   * congressional_office findUniqueOrThrow
   */
  export type congressional_officeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * Filter, which congressional_office to fetch.
     */
    where: congressional_officeWhereUniqueInput
  }

  /**
   * congressional_office findFirst
   */
  export type congressional_officeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * Filter, which congressional_office to fetch.
     */
    where?: congressional_officeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of congressional_offices to fetch.
     */
    orderBy?: congressional_officeOrderByWithRelationInput | congressional_officeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for congressional_offices.
     */
    cursor?: congressional_officeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` congressional_offices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` congressional_offices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of congressional_offices.
     */
    distinct?: Congressional_officeScalarFieldEnum | Congressional_officeScalarFieldEnum[]
  }

  /**
   * congressional_office findFirstOrThrow
   */
  export type congressional_officeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * Filter, which congressional_office to fetch.
     */
    where?: congressional_officeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of congressional_offices to fetch.
     */
    orderBy?: congressional_officeOrderByWithRelationInput | congressional_officeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for congressional_offices.
     */
    cursor?: congressional_officeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` congressional_offices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` congressional_offices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of congressional_offices.
     */
    distinct?: Congressional_officeScalarFieldEnum | Congressional_officeScalarFieldEnum[]
  }

  /**
   * congressional_office findMany
   */
  export type congressional_officeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * Filter, which congressional_offices to fetch.
     */
    where?: congressional_officeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of congressional_offices to fetch.
     */
    orderBy?: congressional_officeOrderByWithRelationInput | congressional_officeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing congressional_offices.
     */
    cursor?: congressional_officeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` congressional_offices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` congressional_offices.
     */
    skip?: number
    distinct?: Congressional_officeScalarFieldEnum | Congressional_officeScalarFieldEnum[]
  }

  /**
   * congressional_office create
   */
  export type congressional_officeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * The data needed to create a congressional_office.
     */
    data: XOR<congressional_officeCreateInput, congressional_officeUncheckedCreateInput>
  }

  /**
   * congressional_office createMany
   */
  export type congressional_officeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many congressional_offices.
     */
    data: congressional_officeCreateManyInput | congressional_officeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * congressional_office createManyAndReturn
   */
  export type congressional_officeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * The data used to create many congressional_offices.
     */
    data: congressional_officeCreateManyInput | congressional_officeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * congressional_office update
   */
  export type congressional_officeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * The data needed to update a congressional_office.
     */
    data: XOR<congressional_officeUpdateInput, congressional_officeUncheckedUpdateInput>
    /**
     * Choose, which congressional_office to update.
     */
    where: congressional_officeWhereUniqueInput
  }

  /**
   * congressional_office updateMany
   */
  export type congressional_officeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update congressional_offices.
     */
    data: XOR<congressional_officeUpdateManyMutationInput, congressional_officeUncheckedUpdateManyInput>
    /**
     * Filter which congressional_offices to update
     */
    where?: congressional_officeWhereInput
    /**
     * Limit how many congressional_offices to update.
     */
    limit?: number
  }

  /**
   * congressional_office updateManyAndReturn
   */
  export type congressional_officeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * The data used to update congressional_offices.
     */
    data: XOR<congressional_officeUpdateManyMutationInput, congressional_officeUncheckedUpdateManyInput>
    /**
     * Filter which congressional_offices to update
     */
    where?: congressional_officeWhereInput
    /**
     * Limit how many congressional_offices to update.
     */
    limit?: number
  }

  /**
   * congressional_office upsert
   */
  export type congressional_officeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * The filter to search for the congressional_office to update in case it exists.
     */
    where: congressional_officeWhereUniqueInput
    /**
     * In case the congressional_office found by the `where` argument doesn't exist, create a new congressional_office with this data.
     */
    create: XOR<congressional_officeCreateInput, congressional_officeUncheckedCreateInput>
    /**
     * In case the congressional_office was found with the provided `where` argument, update it with this data.
     */
    update: XOR<congressional_officeUpdateInput, congressional_officeUncheckedUpdateInput>
  }

  /**
   * congressional_office delete
   */
  export type congressional_officeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
    /**
     * Filter which congressional_office to delete.
     */
    where: congressional_officeWhereUniqueInput
  }

  /**
   * congressional_office deleteMany
   */
  export type congressional_officeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which congressional_offices to delete
     */
    where?: congressional_officeWhereInput
    /**
     * Limit how many congressional_offices to delete.
     */
    limit?: number
  }

  /**
   * congressional_office without action
   */
  export type congressional_officeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the congressional_office
     */
    select?: congressional_officeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the congressional_office
     */
    omit?: congressional_officeOmit<ExtArgs> | null
  }


  /**
   * Model template_campaign
   */

  export type AggregateTemplate_campaign = {
    _count: Template_campaignCountAggregateOutputType | null
    _min: Template_campaignMinAggregateOutputType | null
    _max: Template_campaignMaxAggregateOutputType | null
  }

  export type Template_campaignMinAggregateOutputType = {
    id: string | null
    template_id: string | null
    delivery_type: string | null
    recipient_id: string | null
    cwc_delivery_id: string | null
    status: string | null
    sent_at: Date | null
    delivered_at: Date | null
    error_message: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type Template_campaignMaxAggregateOutputType = {
    id: string | null
    template_id: string | null
    delivery_type: string | null
    recipient_id: string | null
    cwc_delivery_id: string | null
    status: string | null
    sent_at: Date | null
    delivered_at: Date | null
    error_message: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type Template_campaignCountAggregateOutputType = {
    id: number
    template_id: number
    delivery_type: number
    recipient_id: number
    cwc_delivery_id: number
    status: number
    sent_at: number
    delivered_at: number
    error_message: number
    metadata: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type Template_campaignMinAggregateInputType = {
    id?: true
    template_id?: true
    delivery_type?: true
    recipient_id?: true
    cwc_delivery_id?: true
    status?: true
    sent_at?: true
    delivered_at?: true
    error_message?: true
    created_at?: true
    updated_at?: true
  }

  export type Template_campaignMaxAggregateInputType = {
    id?: true
    template_id?: true
    delivery_type?: true
    recipient_id?: true
    cwc_delivery_id?: true
    status?: true
    sent_at?: true
    delivered_at?: true
    error_message?: true
    created_at?: true
    updated_at?: true
  }

  export type Template_campaignCountAggregateInputType = {
    id?: true
    template_id?: true
    delivery_type?: true
    recipient_id?: true
    cwc_delivery_id?: true
    status?: true
    sent_at?: true
    delivered_at?: true
    error_message?: true
    metadata?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type Template_campaignAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which template_campaign to aggregate.
     */
    where?: template_campaignWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of template_campaigns to fetch.
     */
    orderBy?: template_campaignOrderByWithRelationInput | template_campaignOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: template_campaignWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` template_campaigns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` template_campaigns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned template_campaigns
    **/
    _count?: true | Template_campaignCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Template_campaignMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Template_campaignMaxAggregateInputType
  }

  export type GetTemplate_campaignAggregateType<T extends Template_campaignAggregateArgs> = {
        [P in keyof T & keyof AggregateTemplate_campaign]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTemplate_campaign[P]>
      : GetScalarType<T[P], AggregateTemplate_campaign[P]>
  }




  export type template_campaignGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: template_campaignWhereInput
    orderBy?: template_campaignOrderByWithAggregationInput | template_campaignOrderByWithAggregationInput[]
    by: Template_campaignScalarFieldEnum[] | Template_campaignScalarFieldEnum
    having?: template_campaignScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Template_campaignCountAggregateInputType | true
    _min?: Template_campaignMinAggregateInputType
    _max?: Template_campaignMaxAggregateInputType
  }

  export type Template_campaignGroupByOutputType = {
    id: string
    template_id: string
    delivery_type: string
    recipient_id: string | null
    cwc_delivery_id: string | null
    status: string
    sent_at: Date | null
    delivered_at: Date | null
    error_message: string | null
    metadata: JsonValue | null
    created_at: Date
    updated_at: Date
    _count: Template_campaignCountAggregateOutputType | null
    _min: Template_campaignMinAggregateOutputType | null
    _max: Template_campaignMaxAggregateOutputType | null
  }

  type GetTemplate_campaignGroupByPayload<T extends template_campaignGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Template_campaignGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Template_campaignGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Template_campaignGroupByOutputType[P]>
            : GetScalarType<T[P], Template_campaignGroupByOutputType[P]>
        }
      >
    >


  export type template_campaignSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    template_id?: boolean
    delivery_type?: boolean
    recipient_id?: boolean
    cwc_delivery_id?: boolean
    status?: boolean
    sent_at?: boolean
    delivered_at?: boolean
    error_message?: boolean
    metadata?: boolean
    created_at?: boolean
    updated_at?: boolean
    template?: boolean | TemplateDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["template_campaign"]>

  export type template_campaignSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    template_id?: boolean
    delivery_type?: boolean
    recipient_id?: boolean
    cwc_delivery_id?: boolean
    status?: boolean
    sent_at?: boolean
    delivered_at?: boolean
    error_message?: boolean
    metadata?: boolean
    created_at?: boolean
    updated_at?: boolean
    template?: boolean | TemplateDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["template_campaign"]>

  export type template_campaignSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    template_id?: boolean
    delivery_type?: boolean
    recipient_id?: boolean
    cwc_delivery_id?: boolean
    status?: boolean
    sent_at?: boolean
    delivered_at?: boolean
    error_message?: boolean
    metadata?: boolean
    created_at?: boolean
    updated_at?: boolean
    template?: boolean | TemplateDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["template_campaign"]>

  export type template_campaignSelectScalar = {
    id?: boolean
    template_id?: boolean
    delivery_type?: boolean
    recipient_id?: boolean
    cwc_delivery_id?: boolean
    status?: boolean
    sent_at?: boolean
    delivered_at?: boolean
    error_message?: boolean
    metadata?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type template_campaignOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "template_id" | "delivery_type" | "recipient_id" | "cwc_delivery_id" | "status" | "sent_at" | "delivered_at" | "error_message" | "metadata" | "created_at" | "updated_at", ExtArgs["result"]["template_campaign"]>
  export type template_campaignInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    template?: boolean | TemplateDefaultArgs<ExtArgs>
  }
  export type template_campaignIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    template?: boolean | TemplateDefaultArgs<ExtArgs>
  }
  export type template_campaignIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    template?: boolean | TemplateDefaultArgs<ExtArgs>
  }

  export type $template_campaignPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "template_campaign"
    objects: {
      template: Prisma.$TemplatePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      template_id: string
      delivery_type: string
      recipient_id: string | null
      cwc_delivery_id: string | null
      status: string
      sent_at: Date | null
      delivered_at: Date | null
      error_message: string | null
      metadata: Prisma.JsonValue | null
      created_at: Date
      updated_at: Date
    }, ExtArgs["result"]["template_campaign"]>
    composites: {}
  }

  type template_campaignGetPayload<S extends boolean | null | undefined | template_campaignDefaultArgs> = $Result.GetResult<Prisma.$template_campaignPayload, S>

  type template_campaignCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<template_campaignFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Template_campaignCountAggregateInputType | true
    }

  export interface template_campaignDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['template_campaign'], meta: { name: 'template_campaign' } }
    /**
     * Find zero or one Template_campaign that matches the filter.
     * @param {template_campaignFindUniqueArgs} args - Arguments to find a Template_campaign
     * @example
     * // Get one Template_campaign
     * const template_campaign = await prisma.template_campaign.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends template_campaignFindUniqueArgs>(args: SelectSubset<T, template_campaignFindUniqueArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Template_campaign that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {template_campaignFindUniqueOrThrowArgs} args - Arguments to find a Template_campaign
     * @example
     * // Get one Template_campaign
     * const template_campaign = await prisma.template_campaign.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends template_campaignFindUniqueOrThrowArgs>(args: SelectSubset<T, template_campaignFindUniqueOrThrowArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Template_campaign that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {template_campaignFindFirstArgs} args - Arguments to find a Template_campaign
     * @example
     * // Get one Template_campaign
     * const template_campaign = await prisma.template_campaign.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends template_campaignFindFirstArgs>(args?: SelectSubset<T, template_campaignFindFirstArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Template_campaign that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {template_campaignFindFirstOrThrowArgs} args - Arguments to find a Template_campaign
     * @example
     * // Get one Template_campaign
     * const template_campaign = await prisma.template_campaign.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends template_campaignFindFirstOrThrowArgs>(args?: SelectSubset<T, template_campaignFindFirstOrThrowArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Template_campaigns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {template_campaignFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Template_campaigns
     * const template_campaigns = await prisma.template_campaign.findMany()
     * 
     * // Get first 10 Template_campaigns
     * const template_campaigns = await prisma.template_campaign.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const template_campaignWithIdOnly = await prisma.template_campaign.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends template_campaignFindManyArgs>(args?: SelectSubset<T, template_campaignFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Template_campaign.
     * @param {template_campaignCreateArgs} args - Arguments to create a Template_campaign.
     * @example
     * // Create one Template_campaign
     * const Template_campaign = await prisma.template_campaign.create({
     *   data: {
     *     // ... data to create a Template_campaign
     *   }
     * })
     * 
     */
    create<T extends template_campaignCreateArgs>(args: SelectSubset<T, template_campaignCreateArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Template_campaigns.
     * @param {template_campaignCreateManyArgs} args - Arguments to create many Template_campaigns.
     * @example
     * // Create many Template_campaigns
     * const template_campaign = await prisma.template_campaign.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends template_campaignCreateManyArgs>(args?: SelectSubset<T, template_campaignCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Template_campaigns and returns the data saved in the database.
     * @param {template_campaignCreateManyAndReturnArgs} args - Arguments to create many Template_campaigns.
     * @example
     * // Create many Template_campaigns
     * const template_campaign = await prisma.template_campaign.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Template_campaigns and only return the `id`
     * const template_campaignWithIdOnly = await prisma.template_campaign.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends template_campaignCreateManyAndReturnArgs>(args?: SelectSubset<T, template_campaignCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Template_campaign.
     * @param {template_campaignDeleteArgs} args - Arguments to delete one Template_campaign.
     * @example
     * // Delete one Template_campaign
     * const Template_campaign = await prisma.template_campaign.delete({
     *   where: {
     *     // ... filter to delete one Template_campaign
     *   }
     * })
     * 
     */
    delete<T extends template_campaignDeleteArgs>(args: SelectSubset<T, template_campaignDeleteArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Template_campaign.
     * @param {template_campaignUpdateArgs} args - Arguments to update one Template_campaign.
     * @example
     * // Update one Template_campaign
     * const template_campaign = await prisma.template_campaign.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends template_campaignUpdateArgs>(args: SelectSubset<T, template_campaignUpdateArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Template_campaigns.
     * @param {template_campaignDeleteManyArgs} args - Arguments to filter Template_campaigns to delete.
     * @example
     * // Delete a few Template_campaigns
     * const { count } = await prisma.template_campaign.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends template_campaignDeleteManyArgs>(args?: SelectSubset<T, template_campaignDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Template_campaigns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {template_campaignUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Template_campaigns
     * const template_campaign = await prisma.template_campaign.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends template_campaignUpdateManyArgs>(args: SelectSubset<T, template_campaignUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Template_campaigns and returns the data updated in the database.
     * @param {template_campaignUpdateManyAndReturnArgs} args - Arguments to update many Template_campaigns.
     * @example
     * // Update many Template_campaigns
     * const template_campaign = await prisma.template_campaign.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Template_campaigns and only return the `id`
     * const template_campaignWithIdOnly = await prisma.template_campaign.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends template_campaignUpdateManyAndReturnArgs>(args: SelectSubset<T, template_campaignUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Template_campaign.
     * @param {template_campaignUpsertArgs} args - Arguments to update or create a Template_campaign.
     * @example
     * // Update or create a Template_campaign
     * const template_campaign = await prisma.template_campaign.upsert({
     *   create: {
     *     // ... data to create a Template_campaign
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Template_campaign we want to update
     *   }
     * })
     */
    upsert<T extends template_campaignUpsertArgs>(args: SelectSubset<T, template_campaignUpsertArgs<ExtArgs>>): Prisma__template_campaignClient<$Result.GetResult<Prisma.$template_campaignPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Template_campaigns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {template_campaignCountArgs} args - Arguments to filter Template_campaigns to count.
     * @example
     * // Count the number of Template_campaigns
     * const count = await prisma.template_campaign.count({
     *   where: {
     *     // ... the filter for the Template_campaigns we want to count
     *   }
     * })
    **/
    count<T extends template_campaignCountArgs>(
      args?: Subset<T, template_campaignCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Template_campaignCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Template_campaign.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Template_campaignAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Template_campaignAggregateArgs>(args: Subset<T, Template_campaignAggregateArgs>): Prisma.PrismaPromise<GetTemplate_campaignAggregateType<T>>

    /**
     * Group by Template_campaign.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {template_campaignGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends template_campaignGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: template_campaignGroupByArgs['orderBy'] }
        : { orderBy?: template_campaignGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, template_campaignGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTemplate_campaignGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the template_campaign model
   */
  readonly fields: template_campaignFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for template_campaign.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__template_campaignClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    template<T extends TemplateDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TemplateDefaultArgs<ExtArgs>>): Prisma__TemplateClient<$Result.GetResult<Prisma.$TemplatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the template_campaign model
   */
  interface template_campaignFieldRefs {
    readonly id: FieldRef<"template_campaign", 'String'>
    readonly template_id: FieldRef<"template_campaign", 'String'>
    readonly delivery_type: FieldRef<"template_campaign", 'String'>
    readonly recipient_id: FieldRef<"template_campaign", 'String'>
    readonly cwc_delivery_id: FieldRef<"template_campaign", 'String'>
    readonly status: FieldRef<"template_campaign", 'String'>
    readonly sent_at: FieldRef<"template_campaign", 'DateTime'>
    readonly delivered_at: FieldRef<"template_campaign", 'DateTime'>
    readonly error_message: FieldRef<"template_campaign", 'String'>
    readonly metadata: FieldRef<"template_campaign", 'Json'>
    readonly created_at: FieldRef<"template_campaign", 'DateTime'>
    readonly updated_at: FieldRef<"template_campaign", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * template_campaign findUnique
   */
  export type template_campaignFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * Filter, which template_campaign to fetch.
     */
    where: template_campaignWhereUniqueInput
  }

  /**
   * template_campaign findUniqueOrThrow
   */
  export type template_campaignFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * Filter, which template_campaign to fetch.
     */
    where: template_campaignWhereUniqueInput
  }

  /**
   * template_campaign findFirst
   */
  export type template_campaignFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * Filter, which template_campaign to fetch.
     */
    where?: template_campaignWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of template_campaigns to fetch.
     */
    orderBy?: template_campaignOrderByWithRelationInput | template_campaignOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for template_campaigns.
     */
    cursor?: template_campaignWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` template_campaigns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` template_campaigns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of template_campaigns.
     */
    distinct?: Template_campaignScalarFieldEnum | Template_campaignScalarFieldEnum[]
  }

  /**
   * template_campaign findFirstOrThrow
   */
  export type template_campaignFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * Filter, which template_campaign to fetch.
     */
    where?: template_campaignWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of template_campaigns to fetch.
     */
    orderBy?: template_campaignOrderByWithRelationInput | template_campaignOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for template_campaigns.
     */
    cursor?: template_campaignWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` template_campaigns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` template_campaigns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of template_campaigns.
     */
    distinct?: Template_campaignScalarFieldEnum | Template_campaignScalarFieldEnum[]
  }

  /**
   * template_campaign findMany
   */
  export type template_campaignFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * Filter, which template_campaigns to fetch.
     */
    where?: template_campaignWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of template_campaigns to fetch.
     */
    orderBy?: template_campaignOrderByWithRelationInput | template_campaignOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing template_campaigns.
     */
    cursor?: template_campaignWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` template_campaigns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` template_campaigns.
     */
    skip?: number
    distinct?: Template_campaignScalarFieldEnum | Template_campaignScalarFieldEnum[]
  }

  /**
   * template_campaign create
   */
  export type template_campaignCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * The data needed to create a template_campaign.
     */
    data: XOR<template_campaignCreateInput, template_campaignUncheckedCreateInput>
  }

  /**
   * template_campaign createMany
   */
  export type template_campaignCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many template_campaigns.
     */
    data: template_campaignCreateManyInput | template_campaignCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * template_campaign createManyAndReturn
   */
  export type template_campaignCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * The data used to create many template_campaigns.
     */
    data: template_campaignCreateManyInput | template_campaignCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * template_campaign update
   */
  export type template_campaignUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * The data needed to update a template_campaign.
     */
    data: XOR<template_campaignUpdateInput, template_campaignUncheckedUpdateInput>
    /**
     * Choose, which template_campaign to update.
     */
    where: template_campaignWhereUniqueInput
  }

  /**
   * template_campaign updateMany
   */
  export type template_campaignUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update template_campaigns.
     */
    data: XOR<template_campaignUpdateManyMutationInput, template_campaignUncheckedUpdateManyInput>
    /**
     * Filter which template_campaigns to update
     */
    where?: template_campaignWhereInput
    /**
     * Limit how many template_campaigns to update.
     */
    limit?: number
  }

  /**
   * template_campaign updateManyAndReturn
   */
  export type template_campaignUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * The data used to update template_campaigns.
     */
    data: XOR<template_campaignUpdateManyMutationInput, template_campaignUncheckedUpdateManyInput>
    /**
     * Filter which template_campaigns to update
     */
    where?: template_campaignWhereInput
    /**
     * Limit how many template_campaigns to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * template_campaign upsert
   */
  export type template_campaignUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * The filter to search for the template_campaign to update in case it exists.
     */
    where: template_campaignWhereUniqueInput
    /**
     * In case the template_campaign found by the `where` argument doesn't exist, create a new template_campaign with this data.
     */
    create: XOR<template_campaignCreateInput, template_campaignUncheckedCreateInput>
    /**
     * In case the template_campaign was found with the provided `where` argument, update it with this data.
     */
    update: XOR<template_campaignUpdateInput, template_campaignUncheckedUpdateInput>
  }

  /**
   * template_campaign delete
   */
  export type template_campaignDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
    /**
     * Filter which template_campaign to delete.
     */
    where: template_campaignWhereUniqueInput
  }

  /**
   * template_campaign deleteMany
   */
  export type template_campaignDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which template_campaigns to delete
     */
    where?: template_campaignWhereInput
    /**
     * Limit how many template_campaigns to delete.
     */
    limit?: number
  }

  /**
   * template_campaign without action
   */
  export type template_campaignDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the template_campaign
     */
    select?: template_campaignSelect<ExtArgs> | null
    /**
     * Omit specific fields from the template_campaign
     */
    omit?: template_campaignOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: template_campaignInclude<ExtArgs> | null
  }


  /**
   * Model representative
   */

  export type AggregateRepresentative = {
    _count: RepresentativeCountAggregateOutputType | null
    _min: RepresentativeMinAggregateOutputType | null
    _max: RepresentativeMaxAggregateOutputType | null
  }

  export type RepresentativeMinAggregateOutputType = {
    id: string | null
    bioguide_id: string | null
    name: string | null
    party: string | null
    state: string | null
    district: string | null
    chamber: string | null
    office_code: string | null
    phone: string | null
    email: string | null
    is_active: boolean | null
    last_updated: Date | null
  }

  export type RepresentativeMaxAggregateOutputType = {
    id: string | null
    bioguide_id: string | null
    name: string | null
    party: string | null
    state: string | null
    district: string | null
    chamber: string | null
    office_code: string | null
    phone: string | null
    email: string | null
    is_active: boolean | null
    last_updated: Date | null
  }

  export type RepresentativeCountAggregateOutputType = {
    id: number
    bioguide_id: number
    name: number
    party: number
    state: number
    district: number
    chamber: number
    office_code: number
    phone: number
    email: number
    is_active: number
    last_updated: number
    _all: number
  }


  export type RepresentativeMinAggregateInputType = {
    id?: true
    bioguide_id?: true
    name?: true
    party?: true
    state?: true
    district?: true
    chamber?: true
    office_code?: true
    phone?: true
    email?: true
    is_active?: true
    last_updated?: true
  }

  export type RepresentativeMaxAggregateInputType = {
    id?: true
    bioguide_id?: true
    name?: true
    party?: true
    state?: true
    district?: true
    chamber?: true
    office_code?: true
    phone?: true
    email?: true
    is_active?: true
    last_updated?: true
  }

  export type RepresentativeCountAggregateInputType = {
    id?: true
    bioguide_id?: true
    name?: true
    party?: true
    state?: true
    district?: true
    chamber?: true
    office_code?: true
    phone?: true
    email?: true
    is_active?: true
    last_updated?: true
    _all?: true
  }

  export type RepresentativeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which representative to aggregate.
     */
    where?: representativeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of representatives to fetch.
     */
    orderBy?: representativeOrderByWithRelationInput | representativeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: representativeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` representatives.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned representatives
    **/
    _count?: true | RepresentativeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RepresentativeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RepresentativeMaxAggregateInputType
  }

  export type GetRepresentativeAggregateType<T extends RepresentativeAggregateArgs> = {
        [P in keyof T & keyof AggregateRepresentative]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRepresentative[P]>
      : GetScalarType<T[P], AggregateRepresentative[P]>
  }




  export type representativeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: representativeWhereInput
    orderBy?: representativeOrderByWithAggregationInput | representativeOrderByWithAggregationInput[]
    by: RepresentativeScalarFieldEnum[] | RepresentativeScalarFieldEnum
    having?: representativeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RepresentativeCountAggregateInputType | true
    _min?: RepresentativeMinAggregateInputType
    _max?: RepresentativeMaxAggregateInputType
  }

  export type RepresentativeGroupByOutputType = {
    id: string
    bioguide_id: string
    name: string
    party: string
    state: string
    district: string
    chamber: string
    office_code: string
    phone: string | null
    email: string | null
    is_active: boolean
    last_updated: Date
    _count: RepresentativeCountAggregateOutputType | null
    _min: RepresentativeMinAggregateOutputType | null
    _max: RepresentativeMaxAggregateOutputType | null
  }

  type GetRepresentativeGroupByPayload<T extends representativeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RepresentativeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RepresentativeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RepresentativeGroupByOutputType[P]>
            : GetScalarType<T[P], RepresentativeGroupByOutputType[P]>
        }
      >
    >


  export type representativeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bioguide_id?: boolean
    name?: boolean
    party?: boolean
    state?: boolean
    district?: boolean
    chamber?: boolean
    office_code?: boolean
    phone?: boolean
    email?: boolean
    is_active?: boolean
    last_updated?: boolean
    user_representatives?: boolean | representative$user_representativesArgs<ExtArgs>
    _count?: boolean | RepresentativeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["representative"]>

  export type representativeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bioguide_id?: boolean
    name?: boolean
    party?: boolean
    state?: boolean
    district?: boolean
    chamber?: boolean
    office_code?: boolean
    phone?: boolean
    email?: boolean
    is_active?: boolean
    last_updated?: boolean
  }, ExtArgs["result"]["representative"]>

  export type representativeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bioguide_id?: boolean
    name?: boolean
    party?: boolean
    state?: boolean
    district?: boolean
    chamber?: boolean
    office_code?: boolean
    phone?: boolean
    email?: boolean
    is_active?: boolean
    last_updated?: boolean
  }, ExtArgs["result"]["representative"]>

  export type representativeSelectScalar = {
    id?: boolean
    bioguide_id?: boolean
    name?: boolean
    party?: boolean
    state?: boolean
    district?: boolean
    chamber?: boolean
    office_code?: boolean
    phone?: boolean
    email?: boolean
    is_active?: boolean
    last_updated?: boolean
  }

  export type representativeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bioguide_id" | "name" | "party" | "state" | "district" | "chamber" | "office_code" | "phone" | "email" | "is_active" | "last_updated", ExtArgs["result"]["representative"]>
  export type representativeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user_representatives?: boolean | representative$user_representativesArgs<ExtArgs>
    _count?: boolean | RepresentativeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type representativeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type representativeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $representativePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "representative"
    objects: {
      user_representatives: Prisma.$user_representativesPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bioguide_id: string
      name: string
      party: string
      state: string
      district: string
      chamber: string
      office_code: string
      phone: string | null
      email: string | null
      is_active: boolean
      last_updated: Date
    }, ExtArgs["result"]["representative"]>
    composites: {}
  }

  type representativeGetPayload<S extends boolean | null | undefined | representativeDefaultArgs> = $Result.GetResult<Prisma.$representativePayload, S>

  type representativeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<representativeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RepresentativeCountAggregateInputType | true
    }

  export interface representativeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['representative'], meta: { name: 'representative' } }
    /**
     * Find zero or one Representative that matches the filter.
     * @param {representativeFindUniqueArgs} args - Arguments to find a Representative
     * @example
     * // Get one Representative
     * const representative = await prisma.representative.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends representativeFindUniqueArgs>(args: SelectSubset<T, representativeFindUniqueArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Representative that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {representativeFindUniqueOrThrowArgs} args - Arguments to find a Representative
     * @example
     * // Get one Representative
     * const representative = await prisma.representative.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends representativeFindUniqueOrThrowArgs>(args: SelectSubset<T, representativeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Representative that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {representativeFindFirstArgs} args - Arguments to find a Representative
     * @example
     * // Get one Representative
     * const representative = await prisma.representative.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends representativeFindFirstArgs>(args?: SelectSubset<T, representativeFindFirstArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Representative that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {representativeFindFirstOrThrowArgs} args - Arguments to find a Representative
     * @example
     * // Get one Representative
     * const representative = await prisma.representative.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends representativeFindFirstOrThrowArgs>(args?: SelectSubset<T, representativeFindFirstOrThrowArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Representatives that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {representativeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Representatives
     * const representatives = await prisma.representative.findMany()
     * 
     * // Get first 10 Representatives
     * const representatives = await prisma.representative.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const representativeWithIdOnly = await prisma.representative.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends representativeFindManyArgs>(args?: SelectSubset<T, representativeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Representative.
     * @param {representativeCreateArgs} args - Arguments to create a Representative.
     * @example
     * // Create one Representative
     * const Representative = await prisma.representative.create({
     *   data: {
     *     // ... data to create a Representative
     *   }
     * })
     * 
     */
    create<T extends representativeCreateArgs>(args: SelectSubset<T, representativeCreateArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Representatives.
     * @param {representativeCreateManyArgs} args - Arguments to create many Representatives.
     * @example
     * // Create many Representatives
     * const representative = await prisma.representative.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends representativeCreateManyArgs>(args?: SelectSubset<T, representativeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Representatives and returns the data saved in the database.
     * @param {representativeCreateManyAndReturnArgs} args - Arguments to create many Representatives.
     * @example
     * // Create many Representatives
     * const representative = await prisma.representative.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Representatives and only return the `id`
     * const representativeWithIdOnly = await prisma.representative.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends representativeCreateManyAndReturnArgs>(args?: SelectSubset<T, representativeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Representative.
     * @param {representativeDeleteArgs} args - Arguments to delete one Representative.
     * @example
     * // Delete one Representative
     * const Representative = await prisma.representative.delete({
     *   where: {
     *     // ... filter to delete one Representative
     *   }
     * })
     * 
     */
    delete<T extends representativeDeleteArgs>(args: SelectSubset<T, representativeDeleteArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Representative.
     * @param {representativeUpdateArgs} args - Arguments to update one Representative.
     * @example
     * // Update one Representative
     * const representative = await prisma.representative.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends representativeUpdateArgs>(args: SelectSubset<T, representativeUpdateArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Representatives.
     * @param {representativeDeleteManyArgs} args - Arguments to filter Representatives to delete.
     * @example
     * // Delete a few Representatives
     * const { count } = await prisma.representative.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends representativeDeleteManyArgs>(args?: SelectSubset<T, representativeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Representatives.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {representativeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Representatives
     * const representative = await prisma.representative.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends representativeUpdateManyArgs>(args: SelectSubset<T, representativeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Representatives and returns the data updated in the database.
     * @param {representativeUpdateManyAndReturnArgs} args - Arguments to update many Representatives.
     * @example
     * // Update many Representatives
     * const representative = await prisma.representative.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Representatives and only return the `id`
     * const representativeWithIdOnly = await prisma.representative.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends representativeUpdateManyAndReturnArgs>(args: SelectSubset<T, representativeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Representative.
     * @param {representativeUpsertArgs} args - Arguments to update or create a Representative.
     * @example
     * // Update or create a Representative
     * const representative = await prisma.representative.upsert({
     *   create: {
     *     // ... data to create a Representative
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Representative we want to update
     *   }
     * })
     */
    upsert<T extends representativeUpsertArgs>(args: SelectSubset<T, representativeUpsertArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Representatives.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {representativeCountArgs} args - Arguments to filter Representatives to count.
     * @example
     * // Count the number of Representatives
     * const count = await prisma.representative.count({
     *   where: {
     *     // ... the filter for the Representatives we want to count
     *   }
     * })
    **/
    count<T extends representativeCountArgs>(
      args?: Subset<T, representativeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RepresentativeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Representative.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RepresentativeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RepresentativeAggregateArgs>(args: Subset<T, RepresentativeAggregateArgs>): Prisma.PrismaPromise<GetRepresentativeAggregateType<T>>

    /**
     * Group by Representative.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {representativeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends representativeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: representativeGroupByArgs['orderBy'] }
        : { orderBy?: representativeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, representativeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRepresentativeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the representative model
   */
  readonly fields: representativeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for representative.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__representativeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user_representatives<T extends representative$user_representativesArgs<ExtArgs> = {}>(args?: Subset<T, representative$user_representativesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the representative model
   */
  interface representativeFieldRefs {
    readonly id: FieldRef<"representative", 'String'>
    readonly bioguide_id: FieldRef<"representative", 'String'>
    readonly name: FieldRef<"representative", 'String'>
    readonly party: FieldRef<"representative", 'String'>
    readonly state: FieldRef<"representative", 'String'>
    readonly district: FieldRef<"representative", 'String'>
    readonly chamber: FieldRef<"representative", 'String'>
    readonly office_code: FieldRef<"representative", 'String'>
    readonly phone: FieldRef<"representative", 'String'>
    readonly email: FieldRef<"representative", 'String'>
    readonly is_active: FieldRef<"representative", 'Boolean'>
    readonly last_updated: FieldRef<"representative", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * representative findUnique
   */
  export type representativeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * Filter, which representative to fetch.
     */
    where: representativeWhereUniqueInput
  }

  /**
   * representative findUniqueOrThrow
   */
  export type representativeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * Filter, which representative to fetch.
     */
    where: representativeWhereUniqueInput
  }

  /**
   * representative findFirst
   */
  export type representativeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * Filter, which representative to fetch.
     */
    where?: representativeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of representatives to fetch.
     */
    orderBy?: representativeOrderByWithRelationInput | representativeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for representatives.
     */
    cursor?: representativeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` representatives.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of representatives.
     */
    distinct?: RepresentativeScalarFieldEnum | RepresentativeScalarFieldEnum[]
  }

  /**
   * representative findFirstOrThrow
   */
  export type representativeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * Filter, which representative to fetch.
     */
    where?: representativeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of representatives to fetch.
     */
    orderBy?: representativeOrderByWithRelationInput | representativeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for representatives.
     */
    cursor?: representativeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` representatives.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of representatives.
     */
    distinct?: RepresentativeScalarFieldEnum | RepresentativeScalarFieldEnum[]
  }

  /**
   * representative findMany
   */
  export type representativeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * Filter, which representatives to fetch.
     */
    where?: representativeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of representatives to fetch.
     */
    orderBy?: representativeOrderByWithRelationInput | representativeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing representatives.
     */
    cursor?: representativeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` representatives.
     */
    skip?: number
    distinct?: RepresentativeScalarFieldEnum | RepresentativeScalarFieldEnum[]
  }

  /**
   * representative create
   */
  export type representativeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * The data needed to create a representative.
     */
    data: XOR<representativeCreateInput, representativeUncheckedCreateInput>
  }

  /**
   * representative createMany
   */
  export type representativeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many representatives.
     */
    data: representativeCreateManyInput | representativeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * representative createManyAndReturn
   */
  export type representativeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * The data used to create many representatives.
     */
    data: representativeCreateManyInput | representativeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * representative update
   */
  export type representativeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * The data needed to update a representative.
     */
    data: XOR<representativeUpdateInput, representativeUncheckedUpdateInput>
    /**
     * Choose, which representative to update.
     */
    where: representativeWhereUniqueInput
  }

  /**
   * representative updateMany
   */
  export type representativeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update representatives.
     */
    data: XOR<representativeUpdateManyMutationInput, representativeUncheckedUpdateManyInput>
    /**
     * Filter which representatives to update
     */
    where?: representativeWhereInput
    /**
     * Limit how many representatives to update.
     */
    limit?: number
  }

  /**
   * representative updateManyAndReturn
   */
  export type representativeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * The data used to update representatives.
     */
    data: XOR<representativeUpdateManyMutationInput, representativeUncheckedUpdateManyInput>
    /**
     * Filter which representatives to update
     */
    where?: representativeWhereInput
    /**
     * Limit how many representatives to update.
     */
    limit?: number
  }

  /**
   * representative upsert
   */
  export type representativeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * The filter to search for the representative to update in case it exists.
     */
    where: representativeWhereUniqueInput
    /**
     * In case the representative found by the `where` argument doesn't exist, create a new representative with this data.
     */
    create: XOR<representativeCreateInput, representativeUncheckedCreateInput>
    /**
     * In case the representative was found with the provided `where` argument, update it with this data.
     */
    update: XOR<representativeUpdateInput, representativeUncheckedUpdateInput>
  }

  /**
   * representative delete
   */
  export type representativeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
    /**
     * Filter which representative to delete.
     */
    where: representativeWhereUniqueInput
  }

  /**
   * representative deleteMany
   */
  export type representativeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which representatives to delete
     */
    where?: representativeWhereInput
    /**
     * Limit how many representatives to delete.
     */
    limit?: number
  }

  /**
   * representative.user_representatives
   */
  export type representative$user_representativesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    where?: user_representativesWhereInput
    orderBy?: user_representativesOrderByWithRelationInput | user_representativesOrderByWithRelationInput[]
    cursor?: user_representativesWhereUniqueInput
    take?: number
    skip?: number
    distinct?: User_representativesScalarFieldEnum | User_representativesScalarFieldEnum[]
  }

  /**
   * representative without action
   */
  export type representativeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the representative
     */
    select?: representativeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the representative
     */
    omit?: representativeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: representativeInclude<ExtArgs> | null
  }


  /**
   * Model user_representatives
   */

  export type AggregateUser_representatives = {
    _count: User_representativesCountAggregateOutputType | null
    _min: User_representativesMinAggregateOutputType | null
    _max: User_representativesMaxAggregateOutputType | null
  }

  export type User_representativesMinAggregateOutputType = {
    id: string | null
    user_id: string | null
    representative_id: string | null
    relationship: string | null
    is_active: boolean | null
    assigned_at: Date | null
    last_validated: Date | null
  }

  export type User_representativesMaxAggregateOutputType = {
    id: string | null
    user_id: string | null
    representative_id: string | null
    relationship: string | null
    is_active: boolean | null
    assigned_at: Date | null
    last_validated: Date | null
  }

  export type User_representativesCountAggregateOutputType = {
    id: number
    user_id: number
    representative_id: number
    relationship: number
    is_active: number
    assigned_at: number
    last_validated: number
    _all: number
  }


  export type User_representativesMinAggregateInputType = {
    id?: true
    user_id?: true
    representative_id?: true
    relationship?: true
    is_active?: true
    assigned_at?: true
    last_validated?: true
  }

  export type User_representativesMaxAggregateInputType = {
    id?: true
    user_id?: true
    representative_id?: true
    relationship?: true
    is_active?: true
    assigned_at?: true
    last_validated?: true
  }

  export type User_representativesCountAggregateInputType = {
    id?: true
    user_id?: true
    representative_id?: true
    relationship?: true
    is_active?: true
    assigned_at?: true
    last_validated?: true
    _all?: true
  }

  export type User_representativesAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which user_representatives to aggregate.
     */
    where?: user_representativesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of user_representatives to fetch.
     */
    orderBy?: user_representativesOrderByWithRelationInput | user_representativesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: user_representativesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` user_representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` user_representatives.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned user_representatives
    **/
    _count?: true | User_representativesCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: User_representativesMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: User_representativesMaxAggregateInputType
  }

  export type GetUser_representativesAggregateType<T extends User_representativesAggregateArgs> = {
        [P in keyof T & keyof AggregateUser_representatives]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser_representatives[P]>
      : GetScalarType<T[P], AggregateUser_representatives[P]>
  }




  export type user_representativesGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: user_representativesWhereInput
    orderBy?: user_representativesOrderByWithAggregationInput | user_representativesOrderByWithAggregationInput[]
    by: User_representativesScalarFieldEnum[] | User_representativesScalarFieldEnum
    having?: user_representativesScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: User_representativesCountAggregateInputType | true
    _min?: User_representativesMinAggregateInputType
    _max?: User_representativesMaxAggregateInputType
  }

  export type User_representativesGroupByOutputType = {
    id: string
    user_id: string
    representative_id: string
    relationship: string
    is_active: boolean
    assigned_at: Date
    last_validated: Date | null
    _count: User_representativesCountAggregateOutputType | null
    _min: User_representativesMinAggregateOutputType | null
    _max: User_representativesMaxAggregateOutputType | null
  }

  type GetUser_representativesGroupByPayload<T extends user_representativesGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<User_representativesGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof User_representativesGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], User_representativesGroupByOutputType[P]>
            : GetScalarType<T[P], User_representativesGroupByOutputType[P]>
        }
      >
    >


  export type user_representativesSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    representative_id?: boolean
    relationship?: boolean
    is_active?: boolean
    assigned_at?: boolean
    last_validated?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    representative?: boolean | representativeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user_representatives"]>

  export type user_representativesSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    representative_id?: boolean
    relationship?: boolean
    is_active?: boolean
    assigned_at?: boolean
    last_validated?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    representative?: boolean | representativeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user_representatives"]>

  export type user_representativesSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    representative_id?: boolean
    relationship?: boolean
    is_active?: boolean
    assigned_at?: boolean
    last_validated?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    representative?: boolean | representativeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user_representatives"]>

  export type user_representativesSelectScalar = {
    id?: boolean
    user_id?: boolean
    representative_id?: boolean
    relationship?: boolean
    is_active?: boolean
    assigned_at?: boolean
    last_validated?: boolean
  }

  export type user_representativesOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "representative_id" | "relationship" | "is_active" | "assigned_at" | "last_validated", ExtArgs["result"]["user_representatives"]>
  export type user_representativesInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    representative?: boolean | representativeDefaultArgs<ExtArgs>
  }
  export type user_representativesIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    representative?: boolean | representativeDefaultArgs<ExtArgs>
  }
  export type user_representativesIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    representative?: boolean | representativeDefaultArgs<ExtArgs>
  }

  export type $user_representativesPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "user_representatives"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      representative: Prisma.$representativePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: string
      representative_id: string
      relationship: string
      is_active: boolean
      assigned_at: Date
      last_validated: Date | null
    }, ExtArgs["result"]["user_representatives"]>
    composites: {}
  }

  type user_representativesGetPayload<S extends boolean | null | undefined | user_representativesDefaultArgs> = $Result.GetResult<Prisma.$user_representativesPayload, S>

  type user_representativesCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<user_representativesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: User_representativesCountAggregateInputType | true
    }

  export interface user_representativesDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['user_representatives'], meta: { name: 'user_representatives' } }
    /**
     * Find zero or one User_representatives that matches the filter.
     * @param {user_representativesFindUniqueArgs} args - Arguments to find a User_representatives
     * @example
     * // Get one User_representatives
     * const user_representatives = await prisma.user_representatives.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends user_representativesFindUniqueArgs>(args: SelectSubset<T, user_representativesFindUniqueArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User_representatives that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {user_representativesFindUniqueOrThrowArgs} args - Arguments to find a User_representatives
     * @example
     * // Get one User_representatives
     * const user_representatives = await prisma.user_representatives.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends user_representativesFindUniqueOrThrowArgs>(args: SelectSubset<T, user_representativesFindUniqueOrThrowArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User_representatives that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {user_representativesFindFirstArgs} args - Arguments to find a User_representatives
     * @example
     * // Get one User_representatives
     * const user_representatives = await prisma.user_representatives.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends user_representativesFindFirstArgs>(args?: SelectSubset<T, user_representativesFindFirstArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User_representatives that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {user_representativesFindFirstOrThrowArgs} args - Arguments to find a User_representatives
     * @example
     * // Get one User_representatives
     * const user_representatives = await prisma.user_representatives.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends user_representativesFindFirstOrThrowArgs>(args?: SelectSubset<T, user_representativesFindFirstOrThrowArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more User_representatives that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {user_representativesFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all User_representatives
     * const user_representatives = await prisma.user_representatives.findMany()
     * 
     * // Get first 10 User_representatives
     * const user_representatives = await prisma.user_representatives.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const user_representativesWithIdOnly = await prisma.user_representatives.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends user_representativesFindManyArgs>(args?: SelectSubset<T, user_representativesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User_representatives.
     * @param {user_representativesCreateArgs} args - Arguments to create a User_representatives.
     * @example
     * // Create one User_representatives
     * const User_representatives = await prisma.user_representatives.create({
     *   data: {
     *     // ... data to create a User_representatives
     *   }
     * })
     * 
     */
    create<T extends user_representativesCreateArgs>(args: SelectSubset<T, user_representativesCreateArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many User_representatives.
     * @param {user_representativesCreateManyArgs} args - Arguments to create many User_representatives.
     * @example
     * // Create many User_representatives
     * const user_representatives = await prisma.user_representatives.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends user_representativesCreateManyArgs>(args?: SelectSubset<T, user_representativesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many User_representatives and returns the data saved in the database.
     * @param {user_representativesCreateManyAndReturnArgs} args - Arguments to create many User_representatives.
     * @example
     * // Create many User_representatives
     * const user_representatives = await prisma.user_representatives.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many User_representatives and only return the `id`
     * const user_representativesWithIdOnly = await prisma.user_representatives.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends user_representativesCreateManyAndReturnArgs>(args?: SelectSubset<T, user_representativesCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User_representatives.
     * @param {user_representativesDeleteArgs} args - Arguments to delete one User_representatives.
     * @example
     * // Delete one User_representatives
     * const User_representatives = await prisma.user_representatives.delete({
     *   where: {
     *     // ... filter to delete one User_representatives
     *   }
     * })
     * 
     */
    delete<T extends user_representativesDeleteArgs>(args: SelectSubset<T, user_representativesDeleteArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User_representatives.
     * @param {user_representativesUpdateArgs} args - Arguments to update one User_representatives.
     * @example
     * // Update one User_representatives
     * const user_representatives = await prisma.user_representatives.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends user_representativesUpdateArgs>(args: SelectSubset<T, user_representativesUpdateArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more User_representatives.
     * @param {user_representativesDeleteManyArgs} args - Arguments to filter User_representatives to delete.
     * @example
     * // Delete a few User_representatives
     * const { count } = await prisma.user_representatives.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends user_representativesDeleteManyArgs>(args?: SelectSubset<T, user_representativesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more User_representatives.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {user_representativesUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many User_representatives
     * const user_representatives = await prisma.user_representatives.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends user_representativesUpdateManyArgs>(args: SelectSubset<T, user_representativesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more User_representatives and returns the data updated in the database.
     * @param {user_representativesUpdateManyAndReturnArgs} args - Arguments to update many User_representatives.
     * @example
     * // Update many User_representatives
     * const user_representatives = await prisma.user_representatives.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more User_representatives and only return the `id`
     * const user_representativesWithIdOnly = await prisma.user_representatives.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends user_representativesUpdateManyAndReturnArgs>(args: SelectSubset<T, user_representativesUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User_representatives.
     * @param {user_representativesUpsertArgs} args - Arguments to update or create a User_representatives.
     * @example
     * // Update or create a User_representatives
     * const user_representatives = await prisma.user_representatives.upsert({
     *   create: {
     *     // ... data to create a User_representatives
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User_representatives we want to update
     *   }
     * })
     */
    upsert<T extends user_representativesUpsertArgs>(args: SelectSubset<T, user_representativesUpsertArgs<ExtArgs>>): Prisma__user_representativesClient<$Result.GetResult<Prisma.$user_representativesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of User_representatives.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {user_representativesCountArgs} args - Arguments to filter User_representatives to count.
     * @example
     * // Count the number of User_representatives
     * const count = await prisma.user_representatives.count({
     *   where: {
     *     // ... the filter for the User_representatives we want to count
     *   }
     * })
    **/
    count<T extends user_representativesCountArgs>(
      args?: Subset<T, user_representativesCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], User_representativesCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User_representatives.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {User_representativesAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends User_representativesAggregateArgs>(args: Subset<T, User_representativesAggregateArgs>): Prisma.PrismaPromise<GetUser_representativesAggregateType<T>>

    /**
     * Group by User_representatives.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {user_representativesGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends user_representativesGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: user_representativesGroupByArgs['orderBy'] }
        : { orderBy?: user_representativesGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, user_representativesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUser_representativesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the user_representatives model
   */
  readonly fields: user_representativesFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for user_representatives.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__user_representativesClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    representative<T extends representativeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, representativeDefaultArgs<ExtArgs>>): Prisma__representativeClient<$Result.GetResult<Prisma.$representativePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the user_representatives model
   */
  interface user_representativesFieldRefs {
    readonly id: FieldRef<"user_representatives", 'String'>
    readonly user_id: FieldRef<"user_representatives", 'String'>
    readonly representative_id: FieldRef<"user_representatives", 'String'>
    readonly relationship: FieldRef<"user_representatives", 'String'>
    readonly is_active: FieldRef<"user_representatives", 'Boolean'>
    readonly assigned_at: FieldRef<"user_representatives", 'DateTime'>
    readonly last_validated: FieldRef<"user_representatives", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * user_representatives findUnique
   */
  export type user_representativesFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * Filter, which user_representatives to fetch.
     */
    where: user_representativesWhereUniqueInput
  }

  /**
   * user_representatives findUniqueOrThrow
   */
  export type user_representativesFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * Filter, which user_representatives to fetch.
     */
    where: user_representativesWhereUniqueInput
  }

  /**
   * user_representatives findFirst
   */
  export type user_representativesFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * Filter, which user_representatives to fetch.
     */
    where?: user_representativesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of user_representatives to fetch.
     */
    orderBy?: user_representativesOrderByWithRelationInput | user_representativesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for user_representatives.
     */
    cursor?: user_representativesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` user_representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` user_representatives.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of user_representatives.
     */
    distinct?: User_representativesScalarFieldEnum | User_representativesScalarFieldEnum[]
  }

  /**
   * user_representatives findFirstOrThrow
   */
  export type user_representativesFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * Filter, which user_representatives to fetch.
     */
    where?: user_representativesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of user_representatives to fetch.
     */
    orderBy?: user_representativesOrderByWithRelationInput | user_representativesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for user_representatives.
     */
    cursor?: user_representativesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` user_representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` user_representatives.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of user_representatives.
     */
    distinct?: User_representativesScalarFieldEnum | User_representativesScalarFieldEnum[]
  }

  /**
   * user_representatives findMany
   */
  export type user_representativesFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * Filter, which user_representatives to fetch.
     */
    where?: user_representativesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of user_representatives to fetch.
     */
    orderBy?: user_representativesOrderByWithRelationInput | user_representativesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing user_representatives.
     */
    cursor?: user_representativesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` user_representatives from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` user_representatives.
     */
    skip?: number
    distinct?: User_representativesScalarFieldEnum | User_representativesScalarFieldEnum[]
  }

  /**
   * user_representatives create
   */
  export type user_representativesCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * The data needed to create a user_representatives.
     */
    data: XOR<user_representativesCreateInput, user_representativesUncheckedCreateInput>
  }

  /**
   * user_representatives createMany
   */
  export type user_representativesCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many user_representatives.
     */
    data: user_representativesCreateManyInput | user_representativesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * user_representatives createManyAndReturn
   */
  export type user_representativesCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * The data used to create many user_representatives.
     */
    data: user_representativesCreateManyInput | user_representativesCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * user_representatives update
   */
  export type user_representativesUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * The data needed to update a user_representatives.
     */
    data: XOR<user_representativesUpdateInput, user_representativesUncheckedUpdateInput>
    /**
     * Choose, which user_representatives to update.
     */
    where: user_representativesWhereUniqueInput
  }

  /**
   * user_representatives updateMany
   */
  export type user_representativesUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update user_representatives.
     */
    data: XOR<user_representativesUpdateManyMutationInput, user_representativesUncheckedUpdateManyInput>
    /**
     * Filter which user_representatives to update
     */
    where?: user_representativesWhereInput
    /**
     * Limit how many user_representatives to update.
     */
    limit?: number
  }

  /**
   * user_representatives updateManyAndReturn
   */
  export type user_representativesUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * The data used to update user_representatives.
     */
    data: XOR<user_representativesUpdateManyMutationInput, user_representativesUncheckedUpdateManyInput>
    /**
     * Filter which user_representatives to update
     */
    where?: user_representativesWhereInput
    /**
     * Limit how many user_representatives to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * user_representatives upsert
   */
  export type user_representativesUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * The filter to search for the user_representatives to update in case it exists.
     */
    where: user_representativesWhereUniqueInput
    /**
     * In case the user_representatives found by the `where` argument doesn't exist, create a new user_representatives with this data.
     */
    create: XOR<user_representativesCreateInput, user_representativesUncheckedCreateInput>
    /**
     * In case the user_representatives was found with the provided `where` argument, update it with this data.
     */
    update: XOR<user_representativesUpdateInput, user_representativesUncheckedUpdateInput>
  }

  /**
   * user_representatives delete
   */
  export type user_representativesDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
    /**
     * Filter which user_representatives to delete.
     */
    where: user_representativesWhereUniqueInput
  }

  /**
   * user_representatives deleteMany
   */
  export type user_representativesDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which user_representatives to delete
     */
    where?: user_representativesWhereInput
    /**
     * Limit how many user_representatives to delete.
     */
    limit?: number
  }

  /**
   * user_representatives without action
   */
  export type user_representativesDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the user_representatives
     */
    select?: user_representativesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the user_representatives
     */
    omit?: user_representativesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: user_representativesInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadCommitted: 'ReadCommitted',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    name: 'name',
    avatar: 'avatar',
    phone: 'phone',
    street: 'street',
    city: 'city',
    state: 'state',
    zip: 'zip',
    congressional_district: 'congressional_district',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const SessionScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt'
  };

  export type SessionScalarFieldEnum = (typeof SessionScalarFieldEnum)[keyof typeof SessionScalarFieldEnum]


  export const TemplateScalarFieldEnum: {
    id: 'id',
    title: 'title',
    description: 'description',
    category: 'category',
    type: 'type',
    deliveryMethod: 'deliveryMethod',
    subject: 'subject',
    preview: 'preview',
    message_body: 'message_body',
    delivery_config: 'delivery_config',
    cwc_config: 'cwc_config',
    recipient_config: 'recipient_config',
    metrics: 'metrics',
    campaign_id: 'campaign_id',
    status: 'status',
    is_public: 'is_public',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    userId: 'userId'
  };

  export type TemplateScalarFieldEnum = (typeof TemplateScalarFieldEnum)[keyof typeof TemplateScalarFieldEnum]


  export const AccountScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    type: 'type',
    provider: 'provider',
    provider_account_id: 'provider_account_id',
    refresh_token: 'refresh_token',
    access_token: 'access_token',
    expires_at: 'expires_at',
    token_type: 'token_type',
    scope: 'scope',
    id_token: 'id_token',
    session_state: 'session_state',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type AccountScalarFieldEnum = (typeof AccountScalarFieldEnum)[keyof typeof AccountScalarFieldEnum]


  export const Congressional_officeScalarFieldEnum: {
    id: 'id',
    office_code: 'office_code',
    state: 'state',
    district: 'district',
    member_name: 'member_name',
    party: 'party',
    is_active: 'is_active',
    last_updated: 'last_updated'
  };

  export type Congressional_officeScalarFieldEnum = (typeof Congressional_officeScalarFieldEnum)[keyof typeof Congressional_officeScalarFieldEnum]


  export const Template_campaignScalarFieldEnum: {
    id: 'id',
    template_id: 'template_id',
    delivery_type: 'delivery_type',
    recipient_id: 'recipient_id',
    cwc_delivery_id: 'cwc_delivery_id',
    status: 'status',
    sent_at: 'sent_at',
    delivered_at: 'delivered_at',
    error_message: 'error_message',
    metadata: 'metadata',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type Template_campaignScalarFieldEnum = (typeof Template_campaignScalarFieldEnum)[keyof typeof Template_campaignScalarFieldEnum]


  export const RepresentativeScalarFieldEnum: {
    id: 'id',
    bioguide_id: 'bioguide_id',
    name: 'name',
    party: 'party',
    state: 'state',
    district: 'district',
    chamber: 'chamber',
    office_code: 'office_code',
    phone: 'phone',
    email: 'email',
    is_active: 'is_active',
    last_updated: 'last_updated'
  };

  export type RepresentativeScalarFieldEnum = (typeof RepresentativeScalarFieldEnum)[keyof typeof RepresentativeScalarFieldEnum]


  export const User_representativesScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    representative_id: 'representative_id',
    relationship: 'relationship',
    is_active: 'is_active',
    assigned_at: 'assigned_at',
    last_validated: 'last_validated'
  };

  export type User_representativesScalarFieldEnum = (typeof User_representativesScalarFieldEnum)[keyof typeof User_representativesScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    avatar?: StringNullableFilter<"User"> | string | null
    phone?: StringNullableFilter<"User"> | string | null
    street?: StringNullableFilter<"User"> | string | null
    city?: StringNullableFilter<"User"> | string | null
    state?: StringNullableFilter<"User"> | string | null
    zip?: StringNullableFilter<"User"> | string | null
    congressional_district?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    account?: AccountListRelationFilter
    sessions?: SessionListRelationFilter
    templates?: TemplateListRelationFilter
    representatives?: User_representativesListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrderInput | SortOrder
    avatar?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    state?: SortOrderInput | SortOrder
    zip?: SortOrderInput | SortOrder
    congressional_district?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    account?: accountOrderByRelationAggregateInput
    sessions?: SessionOrderByRelationAggregateInput
    templates?: TemplateOrderByRelationAggregateInput
    representatives?: user_representativesOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringNullableFilter<"User"> | string | null
    avatar?: StringNullableFilter<"User"> | string | null
    phone?: StringNullableFilter<"User"> | string | null
    street?: StringNullableFilter<"User"> | string | null
    city?: StringNullableFilter<"User"> | string | null
    state?: StringNullableFilter<"User"> | string | null
    zip?: StringNullableFilter<"User"> | string | null
    congressional_district?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    account?: AccountListRelationFilter
    sessions?: SessionListRelationFilter
    templates?: TemplateListRelationFilter
    representatives?: User_representativesListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrderInput | SortOrder
    avatar?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    street?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    state?: SortOrderInput | SortOrder
    zip?: SortOrderInput | SortOrder
    congressional_district?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    avatar?: StringNullableWithAggregatesFilter<"User"> | string | null
    phone?: StringNullableWithAggregatesFilter<"User"> | string | null
    street?: StringNullableWithAggregatesFilter<"User"> | string | null
    city?: StringNullableWithAggregatesFilter<"User"> | string | null
    state?: StringNullableWithAggregatesFilter<"User"> | string | null
    zip?: StringNullableWithAggregatesFilter<"User"> | string | null
    congressional_district?: StringNullableWithAggregatesFilter<"User"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type SessionWhereInput = {
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    id?: StringFilter<"Session"> | string
    userId?: StringFilter<"Session"> | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    createdAt?: DateTimeFilter<"Session"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type SessionOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type SessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    userId?: StringFilter<"Session"> | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    createdAt?: DateTimeFilter<"Session"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type SessionOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    _count?: SessionCountOrderByAggregateInput
    _max?: SessionMaxOrderByAggregateInput
    _min?: SessionMinOrderByAggregateInput
  }

  export type SessionScalarWhereWithAggregatesInput = {
    AND?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    OR?: SessionScalarWhereWithAggregatesInput[]
    NOT?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Session"> | string
    userId?: StringWithAggregatesFilter<"Session"> | string
    expiresAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
  }

  export type TemplateWhereInput = {
    AND?: TemplateWhereInput | TemplateWhereInput[]
    OR?: TemplateWhereInput[]
    NOT?: TemplateWhereInput | TemplateWhereInput[]
    id?: StringFilter<"Template"> | string
    title?: StringFilter<"Template"> | string
    description?: StringFilter<"Template"> | string
    category?: StringFilter<"Template"> | string
    type?: StringFilter<"Template"> | string
    deliveryMethod?: StringFilter<"Template"> | string
    subject?: StringNullableFilter<"Template"> | string | null
    preview?: StringFilter<"Template"> | string
    message_body?: StringFilter<"Template"> | string
    delivery_config?: JsonFilter<"Template">
    cwc_config?: JsonNullableFilter<"Template">
    recipient_config?: JsonFilter<"Template">
    metrics?: JsonFilter<"Template">
    campaign_id?: StringNullableFilter<"Template"> | string | null
    status?: StringFilter<"Template"> | string
    is_public?: BoolFilter<"Template"> | boolean
    createdAt?: DateTimeFilter<"Template"> | Date | string
    updatedAt?: DateTimeFilter<"Template"> | Date | string
    userId?: StringNullableFilter<"Template"> | string | null
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    template_campaign?: Template_campaignListRelationFilter
  }

  export type TemplateOrderByWithRelationInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    type?: SortOrder
    deliveryMethod?: SortOrder
    subject?: SortOrderInput | SortOrder
    preview?: SortOrder
    message_body?: SortOrder
    delivery_config?: SortOrder
    cwc_config?: SortOrderInput | SortOrder
    recipient_config?: SortOrder
    metrics?: SortOrder
    campaign_id?: SortOrderInput | SortOrder
    status?: SortOrder
    is_public?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    userId?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
    template_campaign?: template_campaignOrderByRelationAggregateInput
  }

  export type TemplateWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TemplateWhereInput | TemplateWhereInput[]
    OR?: TemplateWhereInput[]
    NOT?: TemplateWhereInput | TemplateWhereInput[]
    title?: StringFilter<"Template"> | string
    description?: StringFilter<"Template"> | string
    category?: StringFilter<"Template"> | string
    type?: StringFilter<"Template"> | string
    deliveryMethod?: StringFilter<"Template"> | string
    subject?: StringNullableFilter<"Template"> | string | null
    preview?: StringFilter<"Template"> | string
    message_body?: StringFilter<"Template"> | string
    delivery_config?: JsonFilter<"Template">
    cwc_config?: JsonNullableFilter<"Template">
    recipient_config?: JsonFilter<"Template">
    metrics?: JsonFilter<"Template">
    campaign_id?: StringNullableFilter<"Template"> | string | null
    status?: StringFilter<"Template"> | string
    is_public?: BoolFilter<"Template"> | boolean
    createdAt?: DateTimeFilter<"Template"> | Date | string
    updatedAt?: DateTimeFilter<"Template"> | Date | string
    userId?: StringNullableFilter<"Template"> | string | null
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    template_campaign?: Template_campaignListRelationFilter
  }, "id">

  export type TemplateOrderByWithAggregationInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    type?: SortOrder
    deliveryMethod?: SortOrder
    subject?: SortOrderInput | SortOrder
    preview?: SortOrder
    message_body?: SortOrder
    delivery_config?: SortOrder
    cwc_config?: SortOrderInput | SortOrder
    recipient_config?: SortOrder
    metrics?: SortOrder
    campaign_id?: SortOrderInput | SortOrder
    status?: SortOrder
    is_public?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    userId?: SortOrderInput | SortOrder
    _count?: TemplateCountOrderByAggregateInput
    _max?: TemplateMaxOrderByAggregateInput
    _min?: TemplateMinOrderByAggregateInput
  }

  export type TemplateScalarWhereWithAggregatesInput = {
    AND?: TemplateScalarWhereWithAggregatesInput | TemplateScalarWhereWithAggregatesInput[]
    OR?: TemplateScalarWhereWithAggregatesInput[]
    NOT?: TemplateScalarWhereWithAggregatesInput | TemplateScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Template"> | string
    title?: StringWithAggregatesFilter<"Template"> | string
    description?: StringWithAggregatesFilter<"Template"> | string
    category?: StringWithAggregatesFilter<"Template"> | string
    type?: StringWithAggregatesFilter<"Template"> | string
    deliveryMethod?: StringWithAggregatesFilter<"Template"> | string
    subject?: StringNullableWithAggregatesFilter<"Template"> | string | null
    preview?: StringWithAggregatesFilter<"Template"> | string
    message_body?: StringWithAggregatesFilter<"Template"> | string
    delivery_config?: JsonWithAggregatesFilter<"Template">
    cwc_config?: JsonNullableWithAggregatesFilter<"Template">
    recipient_config?: JsonWithAggregatesFilter<"Template">
    metrics?: JsonWithAggregatesFilter<"Template">
    campaign_id?: StringNullableWithAggregatesFilter<"Template"> | string | null
    status?: StringWithAggregatesFilter<"Template"> | string
    is_public?: BoolWithAggregatesFilter<"Template"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Template"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Template"> | Date | string
    userId?: StringNullableWithAggregatesFilter<"Template"> | string | null
  }

  export type accountWhereInput = {
    AND?: accountWhereInput | accountWhereInput[]
    OR?: accountWhereInput[]
    NOT?: accountWhereInput | accountWhereInput[]
    id?: StringFilter<"account"> | string
    user_id?: StringFilter<"account"> | string
    type?: StringFilter<"account"> | string
    provider?: StringFilter<"account"> | string
    provider_account_id?: StringFilter<"account"> | string
    refresh_token?: StringNullableFilter<"account"> | string | null
    access_token?: StringNullableFilter<"account"> | string | null
    expires_at?: IntNullableFilter<"account"> | number | null
    token_type?: StringNullableFilter<"account"> | string | null
    scope?: StringNullableFilter<"account"> | string | null
    id_token?: StringNullableFilter<"account"> | string | null
    session_state?: StringNullableFilter<"account"> | string | null
    created_at?: DateTimeFilter<"account"> | Date | string
    updated_at?: DateTimeFilter<"account"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type accountOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    provider?: SortOrder
    provider_account_id?: SortOrder
    refresh_token?: SortOrderInput | SortOrder
    access_token?: SortOrderInput | SortOrder
    expires_at?: SortOrderInput | SortOrder
    token_type?: SortOrderInput | SortOrder
    scope?: SortOrderInput | SortOrder
    id_token?: SortOrderInput | SortOrder
    session_state?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type accountWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    provider_provider_account_id?: accountProviderProvider_account_idCompoundUniqueInput
    AND?: accountWhereInput | accountWhereInput[]
    OR?: accountWhereInput[]
    NOT?: accountWhereInput | accountWhereInput[]
    user_id?: StringFilter<"account"> | string
    type?: StringFilter<"account"> | string
    provider?: StringFilter<"account"> | string
    provider_account_id?: StringFilter<"account"> | string
    refresh_token?: StringNullableFilter<"account"> | string | null
    access_token?: StringNullableFilter<"account"> | string | null
    expires_at?: IntNullableFilter<"account"> | number | null
    token_type?: StringNullableFilter<"account"> | string | null
    scope?: StringNullableFilter<"account"> | string | null
    id_token?: StringNullableFilter<"account"> | string | null
    session_state?: StringNullableFilter<"account"> | string | null
    created_at?: DateTimeFilter<"account"> | Date | string
    updated_at?: DateTimeFilter<"account"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "provider_provider_account_id">

  export type accountOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    provider?: SortOrder
    provider_account_id?: SortOrder
    refresh_token?: SortOrderInput | SortOrder
    access_token?: SortOrderInput | SortOrder
    expires_at?: SortOrderInput | SortOrder
    token_type?: SortOrderInput | SortOrder
    scope?: SortOrderInput | SortOrder
    id_token?: SortOrderInput | SortOrder
    session_state?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    _count?: accountCountOrderByAggregateInput
    _avg?: accountAvgOrderByAggregateInput
    _max?: accountMaxOrderByAggregateInput
    _min?: accountMinOrderByAggregateInput
    _sum?: accountSumOrderByAggregateInput
  }

  export type accountScalarWhereWithAggregatesInput = {
    AND?: accountScalarWhereWithAggregatesInput | accountScalarWhereWithAggregatesInput[]
    OR?: accountScalarWhereWithAggregatesInput[]
    NOT?: accountScalarWhereWithAggregatesInput | accountScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"account"> | string
    user_id?: StringWithAggregatesFilter<"account"> | string
    type?: StringWithAggregatesFilter<"account"> | string
    provider?: StringWithAggregatesFilter<"account"> | string
    provider_account_id?: StringWithAggregatesFilter<"account"> | string
    refresh_token?: StringNullableWithAggregatesFilter<"account"> | string | null
    access_token?: StringNullableWithAggregatesFilter<"account"> | string | null
    expires_at?: IntNullableWithAggregatesFilter<"account"> | number | null
    token_type?: StringNullableWithAggregatesFilter<"account"> | string | null
    scope?: StringNullableWithAggregatesFilter<"account"> | string | null
    id_token?: StringNullableWithAggregatesFilter<"account"> | string | null
    session_state?: StringNullableWithAggregatesFilter<"account"> | string | null
    created_at?: DateTimeWithAggregatesFilter<"account"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"account"> | Date | string
  }

  export type congressional_officeWhereInput = {
    AND?: congressional_officeWhereInput | congressional_officeWhereInput[]
    OR?: congressional_officeWhereInput[]
    NOT?: congressional_officeWhereInput | congressional_officeWhereInput[]
    id?: StringFilter<"congressional_office"> | string
    office_code?: StringFilter<"congressional_office"> | string
    state?: StringFilter<"congressional_office"> | string
    district?: StringFilter<"congressional_office"> | string
    member_name?: StringFilter<"congressional_office"> | string
    party?: StringNullableFilter<"congressional_office"> | string | null
    is_active?: BoolFilter<"congressional_office"> | boolean
    last_updated?: DateTimeFilter<"congressional_office"> | Date | string
  }

  export type congressional_officeOrderByWithRelationInput = {
    id?: SortOrder
    office_code?: SortOrder
    state?: SortOrder
    district?: SortOrder
    member_name?: SortOrder
    party?: SortOrderInput | SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type congressional_officeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    office_code?: string
    AND?: congressional_officeWhereInput | congressional_officeWhereInput[]
    OR?: congressional_officeWhereInput[]
    NOT?: congressional_officeWhereInput | congressional_officeWhereInput[]
    state?: StringFilter<"congressional_office"> | string
    district?: StringFilter<"congressional_office"> | string
    member_name?: StringFilter<"congressional_office"> | string
    party?: StringNullableFilter<"congressional_office"> | string | null
    is_active?: BoolFilter<"congressional_office"> | boolean
    last_updated?: DateTimeFilter<"congressional_office"> | Date | string
  }, "id" | "office_code">

  export type congressional_officeOrderByWithAggregationInput = {
    id?: SortOrder
    office_code?: SortOrder
    state?: SortOrder
    district?: SortOrder
    member_name?: SortOrder
    party?: SortOrderInput | SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
    _count?: congressional_officeCountOrderByAggregateInput
    _max?: congressional_officeMaxOrderByAggregateInput
    _min?: congressional_officeMinOrderByAggregateInput
  }

  export type congressional_officeScalarWhereWithAggregatesInput = {
    AND?: congressional_officeScalarWhereWithAggregatesInput | congressional_officeScalarWhereWithAggregatesInput[]
    OR?: congressional_officeScalarWhereWithAggregatesInput[]
    NOT?: congressional_officeScalarWhereWithAggregatesInput | congressional_officeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"congressional_office"> | string
    office_code?: StringWithAggregatesFilter<"congressional_office"> | string
    state?: StringWithAggregatesFilter<"congressional_office"> | string
    district?: StringWithAggregatesFilter<"congressional_office"> | string
    member_name?: StringWithAggregatesFilter<"congressional_office"> | string
    party?: StringNullableWithAggregatesFilter<"congressional_office"> | string | null
    is_active?: BoolWithAggregatesFilter<"congressional_office"> | boolean
    last_updated?: DateTimeWithAggregatesFilter<"congressional_office"> | Date | string
  }

  export type template_campaignWhereInput = {
    AND?: template_campaignWhereInput | template_campaignWhereInput[]
    OR?: template_campaignWhereInput[]
    NOT?: template_campaignWhereInput | template_campaignWhereInput[]
    id?: StringFilter<"template_campaign"> | string
    template_id?: StringFilter<"template_campaign"> | string
    delivery_type?: StringFilter<"template_campaign"> | string
    recipient_id?: StringNullableFilter<"template_campaign"> | string | null
    cwc_delivery_id?: StringNullableFilter<"template_campaign"> | string | null
    status?: StringFilter<"template_campaign"> | string
    sent_at?: DateTimeNullableFilter<"template_campaign"> | Date | string | null
    delivered_at?: DateTimeNullableFilter<"template_campaign"> | Date | string | null
    error_message?: StringNullableFilter<"template_campaign"> | string | null
    metadata?: JsonNullableFilter<"template_campaign">
    created_at?: DateTimeFilter<"template_campaign"> | Date | string
    updated_at?: DateTimeFilter<"template_campaign"> | Date | string
    template?: XOR<TemplateScalarRelationFilter, TemplateWhereInput>
  }

  export type template_campaignOrderByWithRelationInput = {
    id?: SortOrder
    template_id?: SortOrder
    delivery_type?: SortOrder
    recipient_id?: SortOrderInput | SortOrder
    cwc_delivery_id?: SortOrderInput | SortOrder
    status?: SortOrder
    sent_at?: SortOrderInput | SortOrder
    delivered_at?: SortOrderInput | SortOrder
    error_message?: SortOrderInput | SortOrder
    metadata?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    template?: TemplateOrderByWithRelationInput
  }

  export type template_campaignWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: template_campaignWhereInput | template_campaignWhereInput[]
    OR?: template_campaignWhereInput[]
    NOT?: template_campaignWhereInput | template_campaignWhereInput[]
    template_id?: StringFilter<"template_campaign"> | string
    delivery_type?: StringFilter<"template_campaign"> | string
    recipient_id?: StringNullableFilter<"template_campaign"> | string | null
    cwc_delivery_id?: StringNullableFilter<"template_campaign"> | string | null
    status?: StringFilter<"template_campaign"> | string
    sent_at?: DateTimeNullableFilter<"template_campaign"> | Date | string | null
    delivered_at?: DateTimeNullableFilter<"template_campaign"> | Date | string | null
    error_message?: StringNullableFilter<"template_campaign"> | string | null
    metadata?: JsonNullableFilter<"template_campaign">
    created_at?: DateTimeFilter<"template_campaign"> | Date | string
    updated_at?: DateTimeFilter<"template_campaign"> | Date | string
    template?: XOR<TemplateScalarRelationFilter, TemplateWhereInput>
  }, "id">

  export type template_campaignOrderByWithAggregationInput = {
    id?: SortOrder
    template_id?: SortOrder
    delivery_type?: SortOrder
    recipient_id?: SortOrderInput | SortOrder
    cwc_delivery_id?: SortOrderInput | SortOrder
    status?: SortOrder
    sent_at?: SortOrderInput | SortOrder
    delivered_at?: SortOrderInput | SortOrder
    error_message?: SortOrderInput | SortOrder
    metadata?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    _count?: template_campaignCountOrderByAggregateInput
    _max?: template_campaignMaxOrderByAggregateInput
    _min?: template_campaignMinOrderByAggregateInput
  }

  export type template_campaignScalarWhereWithAggregatesInput = {
    AND?: template_campaignScalarWhereWithAggregatesInput | template_campaignScalarWhereWithAggregatesInput[]
    OR?: template_campaignScalarWhereWithAggregatesInput[]
    NOT?: template_campaignScalarWhereWithAggregatesInput | template_campaignScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"template_campaign"> | string
    template_id?: StringWithAggregatesFilter<"template_campaign"> | string
    delivery_type?: StringWithAggregatesFilter<"template_campaign"> | string
    recipient_id?: StringNullableWithAggregatesFilter<"template_campaign"> | string | null
    cwc_delivery_id?: StringNullableWithAggregatesFilter<"template_campaign"> | string | null
    status?: StringWithAggregatesFilter<"template_campaign"> | string
    sent_at?: DateTimeNullableWithAggregatesFilter<"template_campaign"> | Date | string | null
    delivered_at?: DateTimeNullableWithAggregatesFilter<"template_campaign"> | Date | string | null
    error_message?: StringNullableWithAggregatesFilter<"template_campaign"> | string | null
    metadata?: JsonNullableWithAggregatesFilter<"template_campaign">
    created_at?: DateTimeWithAggregatesFilter<"template_campaign"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"template_campaign"> | Date | string
  }

  export type representativeWhereInput = {
    AND?: representativeWhereInput | representativeWhereInput[]
    OR?: representativeWhereInput[]
    NOT?: representativeWhereInput | representativeWhereInput[]
    id?: StringFilter<"representative"> | string
    bioguide_id?: StringFilter<"representative"> | string
    name?: StringFilter<"representative"> | string
    party?: StringFilter<"representative"> | string
    state?: StringFilter<"representative"> | string
    district?: StringFilter<"representative"> | string
    chamber?: StringFilter<"representative"> | string
    office_code?: StringFilter<"representative"> | string
    phone?: StringNullableFilter<"representative"> | string | null
    email?: StringNullableFilter<"representative"> | string | null
    is_active?: BoolFilter<"representative"> | boolean
    last_updated?: DateTimeFilter<"representative"> | Date | string
    user_representatives?: User_representativesListRelationFilter
  }

  export type representativeOrderByWithRelationInput = {
    id?: SortOrder
    bioguide_id?: SortOrder
    name?: SortOrder
    party?: SortOrder
    state?: SortOrder
    district?: SortOrder
    chamber?: SortOrder
    office_code?: SortOrder
    phone?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
    user_representatives?: user_representativesOrderByRelationAggregateInput
  }

  export type representativeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    bioguide_id?: string
    AND?: representativeWhereInput | representativeWhereInput[]
    OR?: representativeWhereInput[]
    NOT?: representativeWhereInput | representativeWhereInput[]
    name?: StringFilter<"representative"> | string
    party?: StringFilter<"representative"> | string
    state?: StringFilter<"representative"> | string
    district?: StringFilter<"representative"> | string
    chamber?: StringFilter<"representative"> | string
    office_code?: StringFilter<"representative"> | string
    phone?: StringNullableFilter<"representative"> | string | null
    email?: StringNullableFilter<"representative"> | string | null
    is_active?: BoolFilter<"representative"> | boolean
    last_updated?: DateTimeFilter<"representative"> | Date | string
    user_representatives?: User_representativesListRelationFilter
  }, "id" | "bioguide_id">

  export type representativeOrderByWithAggregationInput = {
    id?: SortOrder
    bioguide_id?: SortOrder
    name?: SortOrder
    party?: SortOrder
    state?: SortOrder
    district?: SortOrder
    chamber?: SortOrder
    office_code?: SortOrder
    phone?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
    _count?: representativeCountOrderByAggregateInput
    _max?: representativeMaxOrderByAggregateInput
    _min?: representativeMinOrderByAggregateInput
  }

  export type representativeScalarWhereWithAggregatesInput = {
    AND?: representativeScalarWhereWithAggregatesInput | representativeScalarWhereWithAggregatesInput[]
    OR?: representativeScalarWhereWithAggregatesInput[]
    NOT?: representativeScalarWhereWithAggregatesInput | representativeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"representative"> | string
    bioguide_id?: StringWithAggregatesFilter<"representative"> | string
    name?: StringWithAggregatesFilter<"representative"> | string
    party?: StringWithAggregatesFilter<"representative"> | string
    state?: StringWithAggregatesFilter<"representative"> | string
    district?: StringWithAggregatesFilter<"representative"> | string
    chamber?: StringWithAggregatesFilter<"representative"> | string
    office_code?: StringWithAggregatesFilter<"representative"> | string
    phone?: StringNullableWithAggregatesFilter<"representative"> | string | null
    email?: StringNullableWithAggregatesFilter<"representative"> | string | null
    is_active?: BoolWithAggregatesFilter<"representative"> | boolean
    last_updated?: DateTimeWithAggregatesFilter<"representative"> | Date | string
  }

  export type user_representativesWhereInput = {
    AND?: user_representativesWhereInput | user_representativesWhereInput[]
    OR?: user_representativesWhereInput[]
    NOT?: user_representativesWhereInput | user_representativesWhereInput[]
    id?: StringFilter<"user_representatives"> | string
    user_id?: StringFilter<"user_representatives"> | string
    representative_id?: StringFilter<"user_representatives"> | string
    relationship?: StringFilter<"user_representatives"> | string
    is_active?: BoolFilter<"user_representatives"> | boolean
    assigned_at?: DateTimeFilter<"user_representatives"> | Date | string
    last_validated?: DateTimeNullableFilter<"user_representatives"> | Date | string | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    representative?: XOR<RepresentativeScalarRelationFilter, representativeWhereInput>
  }

  export type user_representativesOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    representative_id?: SortOrder
    relationship?: SortOrder
    is_active?: SortOrder
    assigned_at?: SortOrder
    last_validated?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
    representative?: representativeOrderByWithRelationInput
  }

  export type user_representativesWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    user_id_representative_id?: user_representativesUser_idRepresentative_idCompoundUniqueInput
    AND?: user_representativesWhereInput | user_representativesWhereInput[]
    OR?: user_representativesWhereInput[]
    NOT?: user_representativesWhereInput | user_representativesWhereInput[]
    user_id?: StringFilter<"user_representatives"> | string
    representative_id?: StringFilter<"user_representatives"> | string
    relationship?: StringFilter<"user_representatives"> | string
    is_active?: BoolFilter<"user_representatives"> | boolean
    assigned_at?: DateTimeFilter<"user_representatives"> | Date | string
    last_validated?: DateTimeNullableFilter<"user_representatives"> | Date | string | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    representative?: XOR<RepresentativeScalarRelationFilter, representativeWhereInput>
  }, "id" | "user_id_representative_id">

  export type user_representativesOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    representative_id?: SortOrder
    relationship?: SortOrder
    is_active?: SortOrder
    assigned_at?: SortOrder
    last_validated?: SortOrderInput | SortOrder
    _count?: user_representativesCountOrderByAggregateInput
    _max?: user_representativesMaxOrderByAggregateInput
    _min?: user_representativesMinOrderByAggregateInput
  }

  export type user_representativesScalarWhereWithAggregatesInput = {
    AND?: user_representativesScalarWhereWithAggregatesInput | user_representativesScalarWhereWithAggregatesInput[]
    OR?: user_representativesScalarWhereWithAggregatesInput[]
    NOT?: user_representativesScalarWhereWithAggregatesInput | user_representativesScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"user_representatives"> | string
    user_id?: StringWithAggregatesFilter<"user_representatives"> | string
    representative_id?: StringWithAggregatesFilter<"user_representatives"> | string
    relationship?: StringWithAggregatesFilter<"user_representatives"> | string
    is_active?: BoolWithAggregatesFilter<"user_representatives"> | boolean
    assigned_at?: DateTimeWithAggregatesFilter<"user_representatives"> | Date | string
    last_validated?: DateTimeNullableWithAggregatesFilter<"user_representatives"> | Date | string | null
  }

  export type UserCreateInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountCreateNestedManyWithoutUserInput
    sessions?: SessionCreateNestedManyWithoutUserInput
    templates?: TemplateCreateNestedManyWithoutUserInput
    representatives?: user_representativesCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountUncheckedCreateNestedManyWithoutUserInput
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    templates?: TemplateUncheckedCreateNestedManyWithoutUserInput
    representatives?: user_representativesUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUpdateManyWithoutUserNestedInput
    sessions?: SessionUpdateManyWithoutUserNestedInput
    templates?: TemplateUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUncheckedUpdateManyWithoutUserNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    templates?: TemplateUncheckedUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateInput = {
    id?: string
    expiresAt: Date | string
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateInput = {
    id?: string
    userId: string
    expiresAt: Date | string
    createdAt?: Date | string
  }

  export type SessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateManyInput = {
    id?: string
    userId: string
    expiresAt: Date | string
    createdAt?: Date | string
  }

  export type SessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TemplateCreateInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    user?: UserCreateNestedOneWithoutTemplatesInput
    template_campaign?: template_campaignCreateNestedManyWithoutTemplateInput
  }

  export type TemplateUncheckedCreateInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    userId?: string | null
    template_campaign?: template_campaignUncheckedCreateNestedManyWithoutTemplateInput
  }

  export type TemplateUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutTemplatesNestedInput
    template_campaign?: template_campaignUpdateManyWithoutTemplateNestedInput
  }

  export type TemplateUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    template_campaign?: template_campaignUncheckedUpdateManyWithoutTemplateNestedInput
  }

  export type TemplateCreateManyInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    userId?: string | null
  }

  export type TemplateUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TemplateUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type accountCreateInput = {
    id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
    created_at?: Date | string
    updated_at: Date | string
    user: UserCreateNestedOneWithoutAccountInput
  }

  export type accountUncheckedCreateInput = {
    id: string
    user_id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
    created_at?: Date | string
    updated_at: Date | string
  }

  export type accountUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutAccountNestedInput
  }

  export type accountUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type accountCreateManyInput = {
    id: string
    user_id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
    created_at?: Date | string
    updated_at: Date | string
  }

  export type accountUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type accountUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type congressional_officeCreateInput = {
    id: string
    office_code: string
    state: string
    district: string
    member_name: string
    party?: string | null
    is_active?: boolean
    last_updated?: Date | string
  }

  export type congressional_officeUncheckedCreateInput = {
    id: string
    office_code: string
    state: string
    district: string
    member_name: string
    party?: string | null
    is_active?: boolean
    last_updated?: Date | string
  }

  export type congressional_officeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    member_name?: StringFieldUpdateOperationsInput | string
    party?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type congressional_officeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    member_name?: StringFieldUpdateOperationsInput | string
    party?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type congressional_officeCreateManyInput = {
    id: string
    office_code: string
    state: string
    district: string
    member_name: string
    party?: string | null
    is_active?: boolean
    last_updated?: Date | string
  }

  export type congressional_officeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    member_name?: StringFieldUpdateOperationsInput | string
    party?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type congressional_officeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    member_name?: StringFieldUpdateOperationsInput | string
    party?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type template_campaignCreateInput = {
    id: string
    delivery_type: string
    recipient_id?: string | null
    cwc_delivery_id?: string | null
    status?: string
    sent_at?: Date | string | null
    delivered_at?: Date | string | null
    error_message?: string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string
    updated_at: Date | string
    template: TemplateCreateNestedOneWithoutTemplate_campaignInput
  }

  export type template_campaignUncheckedCreateInput = {
    id: string
    template_id: string
    delivery_type: string
    recipient_id?: string | null
    cwc_delivery_id?: string | null
    status?: string
    sent_at?: Date | string | null
    delivered_at?: Date | string | null
    error_message?: string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string
    updated_at: Date | string
  }

  export type template_campaignUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    template?: TemplateUpdateOneRequiredWithoutTemplate_campaignNestedInput
  }

  export type template_campaignUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    template_id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type template_campaignCreateManyInput = {
    id: string
    template_id: string
    delivery_type: string
    recipient_id?: string | null
    cwc_delivery_id?: string | null
    status?: string
    sent_at?: Date | string | null
    delivered_at?: Date | string | null
    error_message?: string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string
    updated_at: Date | string
  }

  export type template_campaignUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type template_campaignUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    template_id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type representativeCreateInput = {
    id?: string
    bioguide_id: string
    name: string
    party: string
    state: string
    district: string
    chamber: string
    office_code: string
    phone?: string | null
    email?: string | null
    is_active?: boolean
    last_updated?: Date | string
    user_representatives?: user_representativesCreateNestedManyWithoutRepresentativeInput
  }

  export type representativeUncheckedCreateInput = {
    id?: string
    bioguide_id: string
    name: string
    party: string
    state: string
    district: string
    chamber: string
    office_code: string
    phone?: string | null
    email?: string | null
    is_active?: boolean
    last_updated?: Date | string
    user_representatives?: user_representativesUncheckedCreateNestedManyWithoutRepresentativeInput
  }

  export type representativeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bioguide_id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    party?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    chamber?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
    user_representatives?: user_representativesUpdateManyWithoutRepresentativeNestedInput
  }

  export type representativeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bioguide_id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    party?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    chamber?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
    user_representatives?: user_representativesUncheckedUpdateManyWithoutRepresentativeNestedInput
  }

  export type representativeCreateManyInput = {
    id?: string
    bioguide_id: string
    name: string
    party: string
    state: string
    district: string
    chamber: string
    office_code: string
    phone?: string | null
    email?: string | null
    is_active?: boolean
    last_updated?: Date | string
  }

  export type representativeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    bioguide_id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    party?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    chamber?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type representativeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bioguide_id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    party?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    chamber?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type user_representativesCreateInput = {
    id?: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
    user: UserCreateNestedOneWithoutRepresentativesInput
    representative: representativeCreateNestedOneWithoutUser_representativesInput
  }

  export type user_representativesUncheckedCreateInput = {
    id?: string
    user_id: string
    representative_id: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
  }

  export type user_representativesUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutRepresentativesNestedInput
    representative?: representativeUpdateOneRequiredWithoutUser_representativesNestedInput
  }

  export type user_representativesUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    representative_id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type user_representativesCreateManyInput = {
    id?: string
    user_id: string
    representative_id: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
  }

  export type user_representativesUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type user_representativesUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    representative_id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type AccountListRelationFilter = {
    every?: accountWhereInput
    some?: accountWhereInput
    none?: accountWhereInput
  }

  export type SessionListRelationFilter = {
    every?: SessionWhereInput
    some?: SessionWhereInput
    none?: SessionWhereInput
  }

  export type TemplateListRelationFilter = {
    every?: TemplateWhereInput
    some?: TemplateWhereInput
    none?: TemplateWhereInput
  }

  export type User_representativesListRelationFilter = {
    every?: user_representativesWhereInput
    some?: user_representativesWhereInput
    none?: user_representativesWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type accountOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TemplateOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type user_representativesOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    avatar?: SortOrder
    phone?: SortOrder
    street?: SortOrder
    city?: SortOrder
    state?: SortOrder
    zip?: SortOrder
    congressional_district?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    avatar?: SortOrder
    phone?: SortOrder
    street?: SortOrder
    city?: SortOrder
    state?: SortOrder
    zip?: SortOrder
    congressional_district?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    avatar?: SortOrder
    phone?: SortOrder
    street?: SortOrder
    city?: SortOrder
    state?: SortOrder
    zip?: SortOrder
    congressional_district?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type SessionCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
  }

  export type SessionMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
  }

  export type SessionMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type Template_campaignListRelationFilter = {
    every?: template_campaignWhereInput
    some?: template_campaignWhereInput
    none?: template_campaignWhereInput
  }

  export type template_campaignOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TemplateCountOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    type?: SortOrder
    deliveryMethod?: SortOrder
    subject?: SortOrder
    preview?: SortOrder
    message_body?: SortOrder
    delivery_config?: SortOrder
    cwc_config?: SortOrder
    recipient_config?: SortOrder
    metrics?: SortOrder
    campaign_id?: SortOrder
    status?: SortOrder
    is_public?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    userId?: SortOrder
  }

  export type TemplateMaxOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    type?: SortOrder
    deliveryMethod?: SortOrder
    subject?: SortOrder
    preview?: SortOrder
    message_body?: SortOrder
    campaign_id?: SortOrder
    status?: SortOrder
    is_public?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    userId?: SortOrder
  }

  export type TemplateMinOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    description?: SortOrder
    category?: SortOrder
    type?: SortOrder
    deliveryMethod?: SortOrder
    subject?: SortOrder
    preview?: SortOrder
    message_body?: SortOrder
    campaign_id?: SortOrder
    status?: SortOrder
    is_public?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    userId?: SortOrder
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type accountProviderProvider_account_idCompoundUniqueInput = {
    provider: string
    provider_account_id: string
  }

  export type accountCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    provider?: SortOrder
    provider_account_id?: SortOrder
    refresh_token?: SortOrder
    access_token?: SortOrder
    expires_at?: SortOrder
    token_type?: SortOrder
    scope?: SortOrder
    id_token?: SortOrder
    session_state?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type accountAvgOrderByAggregateInput = {
    expires_at?: SortOrder
  }

  export type accountMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    provider?: SortOrder
    provider_account_id?: SortOrder
    refresh_token?: SortOrder
    access_token?: SortOrder
    expires_at?: SortOrder
    token_type?: SortOrder
    scope?: SortOrder
    id_token?: SortOrder
    session_state?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type accountMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    type?: SortOrder
    provider?: SortOrder
    provider_account_id?: SortOrder
    refresh_token?: SortOrder
    access_token?: SortOrder
    expires_at?: SortOrder
    token_type?: SortOrder
    scope?: SortOrder
    id_token?: SortOrder
    session_state?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type accountSumOrderByAggregateInput = {
    expires_at?: SortOrder
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type congressional_officeCountOrderByAggregateInput = {
    id?: SortOrder
    office_code?: SortOrder
    state?: SortOrder
    district?: SortOrder
    member_name?: SortOrder
    party?: SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type congressional_officeMaxOrderByAggregateInput = {
    id?: SortOrder
    office_code?: SortOrder
    state?: SortOrder
    district?: SortOrder
    member_name?: SortOrder
    party?: SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type congressional_officeMinOrderByAggregateInput = {
    id?: SortOrder
    office_code?: SortOrder
    state?: SortOrder
    district?: SortOrder
    member_name?: SortOrder
    party?: SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type TemplateScalarRelationFilter = {
    is?: TemplateWhereInput
    isNot?: TemplateWhereInput
  }

  export type template_campaignCountOrderByAggregateInput = {
    id?: SortOrder
    template_id?: SortOrder
    delivery_type?: SortOrder
    recipient_id?: SortOrder
    cwc_delivery_id?: SortOrder
    status?: SortOrder
    sent_at?: SortOrder
    delivered_at?: SortOrder
    error_message?: SortOrder
    metadata?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type template_campaignMaxOrderByAggregateInput = {
    id?: SortOrder
    template_id?: SortOrder
    delivery_type?: SortOrder
    recipient_id?: SortOrder
    cwc_delivery_id?: SortOrder
    status?: SortOrder
    sent_at?: SortOrder
    delivered_at?: SortOrder
    error_message?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type template_campaignMinOrderByAggregateInput = {
    id?: SortOrder
    template_id?: SortOrder
    delivery_type?: SortOrder
    recipient_id?: SortOrder
    cwc_delivery_id?: SortOrder
    status?: SortOrder
    sent_at?: SortOrder
    delivered_at?: SortOrder
    error_message?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type representativeCountOrderByAggregateInput = {
    id?: SortOrder
    bioguide_id?: SortOrder
    name?: SortOrder
    party?: SortOrder
    state?: SortOrder
    district?: SortOrder
    chamber?: SortOrder
    office_code?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type representativeMaxOrderByAggregateInput = {
    id?: SortOrder
    bioguide_id?: SortOrder
    name?: SortOrder
    party?: SortOrder
    state?: SortOrder
    district?: SortOrder
    chamber?: SortOrder
    office_code?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type representativeMinOrderByAggregateInput = {
    id?: SortOrder
    bioguide_id?: SortOrder
    name?: SortOrder
    party?: SortOrder
    state?: SortOrder
    district?: SortOrder
    chamber?: SortOrder
    office_code?: SortOrder
    phone?: SortOrder
    email?: SortOrder
    is_active?: SortOrder
    last_updated?: SortOrder
  }

  export type RepresentativeScalarRelationFilter = {
    is?: representativeWhereInput
    isNot?: representativeWhereInput
  }

  export type user_representativesUser_idRepresentative_idCompoundUniqueInput = {
    user_id: string
    representative_id: string
  }

  export type user_representativesCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    representative_id?: SortOrder
    relationship?: SortOrder
    is_active?: SortOrder
    assigned_at?: SortOrder
    last_validated?: SortOrder
  }

  export type user_representativesMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    representative_id?: SortOrder
    relationship?: SortOrder
    is_active?: SortOrder
    assigned_at?: SortOrder
    last_validated?: SortOrder
  }

  export type user_representativesMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    representative_id?: SortOrder
    relationship?: SortOrder
    is_active?: SortOrder
    assigned_at?: SortOrder
    last_validated?: SortOrder
  }

  export type accountCreateNestedManyWithoutUserInput = {
    create?: XOR<accountCreateWithoutUserInput, accountUncheckedCreateWithoutUserInput> | accountCreateWithoutUserInput[] | accountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: accountCreateOrConnectWithoutUserInput | accountCreateOrConnectWithoutUserInput[]
    createMany?: accountCreateManyUserInputEnvelope
    connect?: accountWhereUniqueInput | accountWhereUniqueInput[]
  }

  export type SessionCreateNestedManyWithoutUserInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type TemplateCreateNestedManyWithoutUserInput = {
    create?: XOR<TemplateCreateWithoutUserInput, TemplateUncheckedCreateWithoutUserInput> | TemplateCreateWithoutUserInput[] | TemplateUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TemplateCreateOrConnectWithoutUserInput | TemplateCreateOrConnectWithoutUserInput[]
    createMany?: TemplateCreateManyUserInputEnvelope
    connect?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
  }

  export type user_representativesCreateNestedManyWithoutUserInput = {
    create?: XOR<user_representativesCreateWithoutUserInput, user_representativesUncheckedCreateWithoutUserInput> | user_representativesCreateWithoutUserInput[] | user_representativesUncheckedCreateWithoutUserInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutUserInput | user_representativesCreateOrConnectWithoutUserInput[]
    createMany?: user_representativesCreateManyUserInputEnvelope
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
  }

  export type accountUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<accountCreateWithoutUserInput, accountUncheckedCreateWithoutUserInput> | accountCreateWithoutUserInput[] | accountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: accountCreateOrConnectWithoutUserInput | accountCreateOrConnectWithoutUserInput[]
    createMany?: accountCreateManyUserInputEnvelope
    connect?: accountWhereUniqueInput | accountWhereUniqueInput[]
  }

  export type SessionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type TemplateUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<TemplateCreateWithoutUserInput, TemplateUncheckedCreateWithoutUserInput> | TemplateCreateWithoutUserInput[] | TemplateUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TemplateCreateOrConnectWithoutUserInput | TemplateCreateOrConnectWithoutUserInput[]
    createMany?: TemplateCreateManyUserInputEnvelope
    connect?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
  }

  export type user_representativesUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<user_representativesCreateWithoutUserInput, user_representativesUncheckedCreateWithoutUserInput> | user_representativesCreateWithoutUserInput[] | user_representativesUncheckedCreateWithoutUserInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutUserInput | user_representativesCreateOrConnectWithoutUserInput[]
    createMany?: user_representativesCreateManyUserInputEnvelope
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type accountUpdateManyWithoutUserNestedInput = {
    create?: XOR<accountCreateWithoutUserInput, accountUncheckedCreateWithoutUserInput> | accountCreateWithoutUserInput[] | accountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: accountCreateOrConnectWithoutUserInput | accountCreateOrConnectWithoutUserInput[]
    upsert?: accountUpsertWithWhereUniqueWithoutUserInput | accountUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: accountCreateManyUserInputEnvelope
    set?: accountWhereUniqueInput | accountWhereUniqueInput[]
    disconnect?: accountWhereUniqueInput | accountWhereUniqueInput[]
    delete?: accountWhereUniqueInput | accountWhereUniqueInput[]
    connect?: accountWhereUniqueInput | accountWhereUniqueInput[]
    update?: accountUpdateWithWhereUniqueWithoutUserInput | accountUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: accountUpdateManyWithWhereWithoutUserInput | accountUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: accountScalarWhereInput | accountScalarWhereInput[]
  }

  export type SessionUpdateManyWithoutUserNestedInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutUserInput | SessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutUserInput | SessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutUserInput | SessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type TemplateUpdateManyWithoutUserNestedInput = {
    create?: XOR<TemplateCreateWithoutUserInput, TemplateUncheckedCreateWithoutUserInput> | TemplateCreateWithoutUserInput[] | TemplateUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TemplateCreateOrConnectWithoutUserInput | TemplateCreateOrConnectWithoutUserInput[]
    upsert?: TemplateUpsertWithWhereUniqueWithoutUserInput | TemplateUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: TemplateCreateManyUserInputEnvelope
    set?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    disconnect?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    delete?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    connect?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    update?: TemplateUpdateWithWhereUniqueWithoutUserInput | TemplateUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: TemplateUpdateManyWithWhereWithoutUserInput | TemplateUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: TemplateScalarWhereInput | TemplateScalarWhereInput[]
  }

  export type user_representativesUpdateManyWithoutUserNestedInput = {
    create?: XOR<user_representativesCreateWithoutUserInput, user_representativesUncheckedCreateWithoutUserInput> | user_representativesCreateWithoutUserInput[] | user_representativesUncheckedCreateWithoutUserInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutUserInput | user_representativesCreateOrConnectWithoutUserInput[]
    upsert?: user_representativesUpsertWithWhereUniqueWithoutUserInput | user_representativesUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: user_representativesCreateManyUserInputEnvelope
    set?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    disconnect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    delete?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    update?: user_representativesUpdateWithWhereUniqueWithoutUserInput | user_representativesUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: user_representativesUpdateManyWithWhereWithoutUserInput | user_representativesUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: user_representativesScalarWhereInput | user_representativesScalarWhereInput[]
  }

  export type accountUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<accountCreateWithoutUserInput, accountUncheckedCreateWithoutUserInput> | accountCreateWithoutUserInput[] | accountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: accountCreateOrConnectWithoutUserInput | accountCreateOrConnectWithoutUserInput[]
    upsert?: accountUpsertWithWhereUniqueWithoutUserInput | accountUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: accountCreateManyUserInputEnvelope
    set?: accountWhereUniqueInput | accountWhereUniqueInput[]
    disconnect?: accountWhereUniqueInput | accountWhereUniqueInput[]
    delete?: accountWhereUniqueInput | accountWhereUniqueInput[]
    connect?: accountWhereUniqueInput | accountWhereUniqueInput[]
    update?: accountUpdateWithWhereUniqueWithoutUserInput | accountUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: accountUpdateManyWithWhereWithoutUserInput | accountUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: accountScalarWhereInput | accountScalarWhereInput[]
  }

  export type SessionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutUserInput | SessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutUserInput | SessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutUserInput | SessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type TemplateUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<TemplateCreateWithoutUserInput, TemplateUncheckedCreateWithoutUserInput> | TemplateCreateWithoutUserInput[] | TemplateUncheckedCreateWithoutUserInput[]
    connectOrCreate?: TemplateCreateOrConnectWithoutUserInput | TemplateCreateOrConnectWithoutUserInput[]
    upsert?: TemplateUpsertWithWhereUniqueWithoutUserInput | TemplateUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: TemplateCreateManyUserInputEnvelope
    set?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    disconnect?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    delete?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    connect?: TemplateWhereUniqueInput | TemplateWhereUniqueInput[]
    update?: TemplateUpdateWithWhereUniqueWithoutUserInput | TemplateUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: TemplateUpdateManyWithWhereWithoutUserInput | TemplateUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: TemplateScalarWhereInput | TemplateScalarWhereInput[]
  }

  export type user_representativesUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<user_representativesCreateWithoutUserInput, user_representativesUncheckedCreateWithoutUserInput> | user_representativesCreateWithoutUserInput[] | user_representativesUncheckedCreateWithoutUserInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutUserInput | user_representativesCreateOrConnectWithoutUserInput[]
    upsert?: user_representativesUpsertWithWhereUniqueWithoutUserInput | user_representativesUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: user_representativesCreateManyUserInputEnvelope
    set?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    disconnect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    delete?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    update?: user_representativesUpdateWithWhereUniqueWithoutUserInput | user_representativesUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: user_representativesUpdateManyWithWhereWithoutUserInput | user_representativesUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: user_representativesScalarWhereInput | user_representativesScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutSessionsInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    upsert?: UserUpsertWithoutSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSessionsInput, UserUpdateWithoutSessionsInput>, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserCreateNestedOneWithoutTemplatesInput = {
    create?: XOR<UserCreateWithoutTemplatesInput, UserUncheckedCreateWithoutTemplatesInput>
    connectOrCreate?: UserCreateOrConnectWithoutTemplatesInput
    connect?: UserWhereUniqueInput
  }

  export type template_campaignCreateNestedManyWithoutTemplateInput = {
    create?: XOR<template_campaignCreateWithoutTemplateInput, template_campaignUncheckedCreateWithoutTemplateInput> | template_campaignCreateWithoutTemplateInput[] | template_campaignUncheckedCreateWithoutTemplateInput[]
    connectOrCreate?: template_campaignCreateOrConnectWithoutTemplateInput | template_campaignCreateOrConnectWithoutTemplateInput[]
    createMany?: template_campaignCreateManyTemplateInputEnvelope
    connect?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
  }

  export type template_campaignUncheckedCreateNestedManyWithoutTemplateInput = {
    create?: XOR<template_campaignCreateWithoutTemplateInput, template_campaignUncheckedCreateWithoutTemplateInput> | template_campaignCreateWithoutTemplateInput[] | template_campaignUncheckedCreateWithoutTemplateInput[]
    connectOrCreate?: template_campaignCreateOrConnectWithoutTemplateInput | template_campaignCreateOrConnectWithoutTemplateInput[]
    createMany?: template_campaignCreateManyTemplateInputEnvelope
    connect?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type UserUpdateOneWithoutTemplatesNestedInput = {
    create?: XOR<UserCreateWithoutTemplatesInput, UserUncheckedCreateWithoutTemplatesInput>
    connectOrCreate?: UserCreateOrConnectWithoutTemplatesInput
    upsert?: UserUpsertWithoutTemplatesInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutTemplatesInput, UserUpdateWithoutTemplatesInput>, UserUncheckedUpdateWithoutTemplatesInput>
  }

  export type template_campaignUpdateManyWithoutTemplateNestedInput = {
    create?: XOR<template_campaignCreateWithoutTemplateInput, template_campaignUncheckedCreateWithoutTemplateInput> | template_campaignCreateWithoutTemplateInput[] | template_campaignUncheckedCreateWithoutTemplateInput[]
    connectOrCreate?: template_campaignCreateOrConnectWithoutTemplateInput | template_campaignCreateOrConnectWithoutTemplateInput[]
    upsert?: template_campaignUpsertWithWhereUniqueWithoutTemplateInput | template_campaignUpsertWithWhereUniqueWithoutTemplateInput[]
    createMany?: template_campaignCreateManyTemplateInputEnvelope
    set?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    disconnect?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    delete?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    connect?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    update?: template_campaignUpdateWithWhereUniqueWithoutTemplateInput | template_campaignUpdateWithWhereUniqueWithoutTemplateInput[]
    updateMany?: template_campaignUpdateManyWithWhereWithoutTemplateInput | template_campaignUpdateManyWithWhereWithoutTemplateInput[]
    deleteMany?: template_campaignScalarWhereInput | template_campaignScalarWhereInput[]
  }

  export type template_campaignUncheckedUpdateManyWithoutTemplateNestedInput = {
    create?: XOR<template_campaignCreateWithoutTemplateInput, template_campaignUncheckedCreateWithoutTemplateInput> | template_campaignCreateWithoutTemplateInput[] | template_campaignUncheckedCreateWithoutTemplateInput[]
    connectOrCreate?: template_campaignCreateOrConnectWithoutTemplateInput | template_campaignCreateOrConnectWithoutTemplateInput[]
    upsert?: template_campaignUpsertWithWhereUniqueWithoutTemplateInput | template_campaignUpsertWithWhereUniqueWithoutTemplateInput[]
    createMany?: template_campaignCreateManyTemplateInputEnvelope
    set?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    disconnect?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    delete?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    connect?: template_campaignWhereUniqueInput | template_campaignWhereUniqueInput[]
    update?: template_campaignUpdateWithWhereUniqueWithoutTemplateInput | template_campaignUpdateWithWhereUniqueWithoutTemplateInput[]
    updateMany?: template_campaignUpdateManyWithWhereWithoutTemplateInput | template_campaignUpdateManyWithWhereWithoutTemplateInput[]
    deleteMany?: template_campaignScalarWhereInput | template_campaignScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutAccountInput = {
    create?: XOR<UserCreateWithoutAccountInput, UserUncheckedCreateWithoutAccountInput>
    connectOrCreate?: UserCreateOrConnectWithoutAccountInput
    connect?: UserWhereUniqueInput
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutAccountNestedInput = {
    create?: XOR<UserCreateWithoutAccountInput, UserUncheckedCreateWithoutAccountInput>
    connectOrCreate?: UserCreateOrConnectWithoutAccountInput
    upsert?: UserUpsertWithoutAccountInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAccountInput, UserUpdateWithoutAccountInput>, UserUncheckedUpdateWithoutAccountInput>
  }

  export type TemplateCreateNestedOneWithoutTemplate_campaignInput = {
    create?: XOR<TemplateCreateWithoutTemplate_campaignInput, TemplateUncheckedCreateWithoutTemplate_campaignInput>
    connectOrCreate?: TemplateCreateOrConnectWithoutTemplate_campaignInput
    connect?: TemplateWhereUniqueInput
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type TemplateUpdateOneRequiredWithoutTemplate_campaignNestedInput = {
    create?: XOR<TemplateCreateWithoutTemplate_campaignInput, TemplateUncheckedCreateWithoutTemplate_campaignInput>
    connectOrCreate?: TemplateCreateOrConnectWithoutTemplate_campaignInput
    upsert?: TemplateUpsertWithoutTemplate_campaignInput
    connect?: TemplateWhereUniqueInput
    update?: XOR<XOR<TemplateUpdateToOneWithWhereWithoutTemplate_campaignInput, TemplateUpdateWithoutTemplate_campaignInput>, TemplateUncheckedUpdateWithoutTemplate_campaignInput>
  }

  export type user_representativesCreateNestedManyWithoutRepresentativeInput = {
    create?: XOR<user_representativesCreateWithoutRepresentativeInput, user_representativesUncheckedCreateWithoutRepresentativeInput> | user_representativesCreateWithoutRepresentativeInput[] | user_representativesUncheckedCreateWithoutRepresentativeInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutRepresentativeInput | user_representativesCreateOrConnectWithoutRepresentativeInput[]
    createMany?: user_representativesCreateManyRepresentativeInputEnvelope
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
  }

  export type user_representativesUncheckedCreateNestedManyWithoutRepresentativeInput = {
    create?: XOR<user_representativesCreateWithoutRepresentativeInput, user_representativesUncheckedCreateWithoutRepresentativeInput> | user_representativesCreateWithoutRepresentativeInput[] | user_representativesUncheckedCreateWithoutRepresentativeInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutRepresentativeInput | user_representativesCreateOrConnectWithoutRepresentativeInput[]
    createMany?: user_representativesCreateManyRepresentativeInputEnvelope
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
  }

  export type user_representativesUpdateManyWithoutRepresentativeNestedInput = {
    create?: XOR<user_representativesCreateWithoutRepresentativeInput, user_representativesUncheckedCreateWithoutRepresentativeInput> | user_representativesCreateWithoutRepresentativeInput[] | user_representativesUncheckedCreateWithoutRepresentativeInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutRepresentativeInput | user_representativesCreateOrConnectWithoutRepresentativeInput[]
    upsert?: user_representativesUpsertWithWhereUniqueWithoutRepresentativeInput | user_representativesUpsertWithWhereUniqueWithoutRepresentativeInput[]
    createMany?: user_representativesCreateManyRepresentativeInputEnvelope
    set?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    disconnect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    delete?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    update?: user_representativesUpdateWithWhereUniqueWithoutRepresentativeInput | user_representativesUpdateWithWhereUniqueWithoutRepresentativeInput[]
    updateMany?: user_representativesUpdateManyWithWhereWithoutRepresentativeInput | user_representativesUpdateManyWithWhereWithoutRepresentativeInput[]
    deleteMany?: user_representativesScalarWhereInput | user_representativesScalarWhereInput[]
  }

  export type user_representativesUncheckedUpdateManyWithoutRepresentativeNestedInput = {
    create?: XOR<user_representativesCreateWithoutRepresentativeInput, user_representativesUncheckedCreateWithoutRepresentativeInput> | user_representativesCreateWithoutRepresentativeInput[] | user_representativesUncheckedCreateWithoutRepresentativeInput[]
    connectOrCreate?: user_representativesCreateOrConnectWithoutRepresentativeInput | user_representativesCreateOrConnectWithoutRepresentativeInput[]
    upsert?: user_representativesUpsertWithWhereUniqueWithoutRepresentativeInput | user_representativesUpsertWithWhereUniqueWithoutRepresentativeInput[]
    createMany?: user_representativesCreateManyRepresentativeInputEnvelope
    set?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    disconnect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    delete?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    connect?: user_representativesWhereUniqueInput | user_representativesWhereUniqueInput[]
    update?: user_representativesUpdateWithWhereUniqueWithoutRepresentativeInput | user_representativesUpdateWithWhereUniqueWithoutRepresentativeInput[]
    updateMany?: user_representativesUpdateManyWithWhereWithoutRepresentativeInput | user_representativesUpdateManyWithWhereWithoutRepresentativeInput[]
    deleteMany?: user_representativesScalarWhereInput | user_representativesScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutRepresentativesInput = {
    create?: XOR<UserCreateWithoutRepresentativesInput, UserUncheckedCreateWithoutRepresentativesInput>
    connectOrCreate?: UserCreateOrConnectWithoutRepresentativesInput
    connect?: UserWhereUniqueInput
  }

  export type representativeCreateNestedOneWithoutUser_representativesInput = {
    create?: XOR<representativeCreateWithoutUser_representativesInput, representativeUncheckedCreateWithoutUser_representativesInput>
    connectOrCreate?: representativeCreateOrConnectWithoutUser_representativesInput
    connect?: representativeWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutRepresentativesNestedInput = {
    create?: XOR<UserCreateWithoutRepresentativesInput, UserUncheckedCreateWithoutRepresentativesInput>
    connectOrCreate?: UserCreateOrConnectWithoutRepresentativesInput
    upsert?: UserUpsertWithoutRepresentativesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutRepresentativesInput, UserUpdateWithoutRepresentativesInput>, UserUncheckedUpdateWithoutRepresentativesInput>
  }

  export type representativeUpdateOneRequiredWithoutUser_representativesNestedInput = {
    create?: XOR<representativeCreateWithoutUser_representativesInput, representativeUncheckedCreateWithoutUser_representativesInput>
    connectOrCreate?: representativeCreateOrConnectWithoutUser_representativesInput
    upsert?: representativeUpsertWithoutUser_representativesInput
    connect?: representativeWhereUniqueInput
    update?: XOR<XOR<representativeUpdateToOneWithWhereWithoutUser_representativesInput, representativeUpdateWithoutUser_representativesInput>, representativeUncheckedUpdateWithoutUser_representativesInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type accountCreateWithoutUserInput = {
    id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
    created_at?: Date | string
    updated_at: Date | string
  }

  export type accountUncheckedCreateWithoutUserInput = {
    id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
    created_at?: Date | string
    updated_at: Date | string
  }

  export type accountCreateOrConnectWithoutUserInput = {
    where: accountWhereUniqueInput
    create: XOR<accountCreateWithoutUserInput, accountUncheckedCreateWithoutUserInput>
  }

  export type accountCreateManyUserInputEnvelope = {
    data: accountCreateManyUserInput | accountCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type SessionCreateWithoutUserInput = {
    id?: string
    expiresAt: Date | string
    createdAt?: Date | string
  }

  export type SessionUncheckedCreateWithoutUserInput = {
    id?: string
    expiresAt: Date | string
    createdAt?: Date | string
  }

  export type SessionCreateOrConnectWithoutUserInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput>
  }

  export type SessionCreateManyUserInputEnvelope = {
    data: SessionCreateManyUserInput | SessionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type TemplateCreateWithoutUserInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    template_campaign?: template_campaignCreateNestedManyWithoutTemplateInput
  }

  export type TemplateUncheckedCreateWithoutUserInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    template_campaign?: template_campaignUncheckedCreateNestedManyWithoutTemplateInput
  }

  export type TemplateCreateOrConnectWithoutUserInput = {
    where: TemplateWhereUniqueInput
    create: XOR<TemplateCreateWithoutUserInput, TemplateUncheckedCreateWithoutUserInput>
  }

  export type TemplateCreateManyUserInputEnvelope = {
    data: TemplateCreateManyUserInput | TemplateCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type user_representativesCreateWithoutUserInput = {
    id?: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
    representative: representativeCreateNestedOneWithoutUser_representativesInput
  }

  export type user_representativesUncheckedCreateWithoutUserInput = {
    id?: string
    representative_id: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
  }

  export type user_representativesCreateOrConnectWithoutUserInput = {
    where: user_representativesWhereUniqueInput
    create: XOR<user_representativesCreateWithoutUserInput, user_representativesUncheckedCreateWithoutUserInput>
  }

  export type user_representativesCreateManyUserInputEnvelope = {
    data: user_representativesCreateManyUserInput | user_representativesCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type accountUpsertWithWhereUniqueWithoutUserInput = {
    where: accountWhereUniqueInput
    update: XOR<accountUpdateWithoutUserInput, accountUncheckedUpdateWithoutUserInput>
    create: XOR<accountCreateWithoutUserInput, accountUncheckedCreateWithoutUserInput>
  }

  export type accountUpdateWithWhereUniqueWithoutUserInput = {
    where: accountWhereUniqueInput
    data: XOR<accountUpdateWithoutUserInput, accountUncheckedUpdateWithoutUserInput>
  }

  export type accountUpdateManyWithWhereWithoutUserInput = {
    where: accountScalarWhereInput
    data: XOR<accountUpdateManyMutationInput, accountUncheckedUpdateManyWithoutUserInput>
  }

  export type accountScalarWhereInput = {
    AND?: accountScalarWhereInput | accountScalarWhereInput[]
    OR?: accountScalarWhereInput[]
    NOT?: accountScalarWhereInput | accountScalarWhereInput[]
    id?: StringFilter<"account"> | string
    user_id?: StringFilter<"account"> | string
    type?: StringFilter<"account"> | string
    provider?: StringFilter<"account"> | string
    provider_account_id?: StringFilter<"account"> | string
    refresh_token?: StringNullableFilter<"account"> | string | null
    access_token?: StringNullableFilter<"account"> | string | null
    expires_at?: IntNullableFilter<"account"> | number | null
    token_type?: StringNullableFilter<"account"> | string | null
    scope?: StringNullableFilter<"account"> | string | null
    id_token?: StringNullableFilter<"account"> | string | null
    session_state?: StringNullableFilter<"account"> | string | null
    created_at?: DateTimeFilter<"account"> | Date | string
    updated_at?: DateTimeFilter<"account"> | Date | string
  }

  export type SessionUpsertWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput
    update: XOR<SessionUpdateWithoutUserInput, SessionUncheckedUpdateWithoutUserInput>
    create: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput>
  }

  export type SessionUpdateWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput
    data: XOR<SessionUpdateWithoutUserInput, SessionUncheckedUpdateWithoutUserInput>
  }

  export type SessionUpdateManyWithWhereWithoutUserInput = {
    where: SessionScalarWhereInput
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyWithoutUserInput>
  }

  export type SessionScalarWhereInput = {
    AND?: SessionScalarWhereInput | SessionScalarWhereInput[]
    OR?: SessionScalarWhereInput[]
    NOT?: SessionScalarWhereInput | SessionScalarWhereInput[]
    id?: StringFilter<"Session"> | string
    userId?: StringFilter<"Session"> | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    createdAt?: DateTimeFilter<"Session"> | Date | string
  }

  export type TemplateUpsertWithWhereUniqueWithoutUserInput = {
    where: TemplateWhereUniqueInput
    update: XOR<TemplateUpdateWithoutUserInput, TemplateUncheckedUpdateWithoutUserInput>
    create: XOR<TemplateCreateWithoutUserInput, TemplateUncheckedCreateWithoutUserInput>
  }

  export type TemplateUpdateWithWhereUniqueWithoutUserInput = {
    where: TemplateWhereUniqueInput
    data: XOR<TemplateUpdateWithoutUserInput, TemplateUncheckedUpdateWithoutUserInput>
  }

  export type TemplateUpdateManyWithWhereWithoutUserInput = {
    where: TemplateScalarWhereInput
    data: XOR<TemplateUpdateManyMutationInput, TemplateUncheckedUpdateManyWithoutUserInput>
  }

  export type TemplateScalarWhereInput = {
    AND?: TemplateScalarWhereInput | TemplateScalarWhereInput[]
    OR?: TemplateScalarWhereInput[]
    NOT?: TemplateScalarWhereInput | TemplateScalarWhereInput[]
    id?: StringFilter<"Template"> | string
    title?: StringFilter<"Template"> | string
    description?: StringFilter<"Template"> | string
    category?: StringFilter<"Template"> | string
    type?: StringFilter<"Template"> | string
    deliveryMethod?: StringFilter<"Template"> | string
    subject?: StringNullableFilter<"Template"> | string | null
    preview?: StringFilter<"Template"> | string
    message_body?: StringFilter<"Template"> | string
    delivery_config?: JsonFilter<"Template">
    cwc_config?: JsonNullableFilter<"Template">
    recipient_config?: JsonFilter<"Template">
    metrics?: JsonFilter<"Template">
    campaign_id?: StringNullableFilter<"Template"> | string | null
    status?: StringFilter<"Template"> | string
    is_public?: BoolFilter<"Template"> | boolean
    createdAt?: DateTimeFilter<"Template"> | Date | string
    updatedAt?: DateTimeFilter<"Template"> | Date | string
    userId?: StringNullableFilter<"Template"> | string | null
  }

  export type user_representativesUpsertWithWhereUniqueWithoutUserInput = {
    where: user_representativesWhereUniqueInput
    update: XOR<user_representativesUpdateWithoutUserInput, user_representativesUncheckedUpdateWithoutUserInput>
    create: XOR<user_representativesCreateWithoutUserInput, user_representativesUncheckedCreateWithoutUserInput>
  }

  export type user_representativesUpdateWithWhereUniqueWithoutUserInput = {
    where: user_representativesWhereUniqueInput
    data: XOR<user_representativesUpdateWithoutUserInput, user_representativesUncheckedUpdateWithoutUserInput>
  }

  export type user_representativesUpdateManyWithWhereWithoutUserInput = {
    where: user_representativesScalarWhereInput
    data: XOR<user_representativesUpdateManyMutationInput, user_representativesUncheckedUpdateManyWithoutUserInput>
  }

  export type user_representativesScalarWhereInput = {
    AND?: user_representativesScalarWhereInput | user_representativesScalarWhereInput[]
    OR?: user_representativesScalarWhereInput[]
    NOT?: user_representativesScalarWhereInput | user_representativesScalarWhereInput[]
    id?: StringFilter<"user_representatives"> | string
    user_id?: StringFilter<"user_representatives"> | string
    representative_id?: StringFilter<"user_representatives"> | string
    relationship?: StringFilter<"user_representatives"> | string
    is_active?: BoolFilter<"user_representatives"> | boolean
    assigned_at?: DateTimeFilter<"user_representatives"> | Date | string
    last_validated?: DateTimeNullableFilter<"user_representatives"> | Date | string | null
  }

  export type UserCreateWithoutSessionsInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountCreateNestedManyWithoutUserInput
    templates?: TemplateCreateNestedManyWithoutUserInput
    representatives?: user_representativesCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSessionsInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountUncheckedCreateNestedManyWithoutUserInput
    templates?: TemplateUncheckedCreateNestedManyWithoutUserInput
    representatives?: user_representativesUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
  }

  export type UserUpsertWithoutSessionsInput = {
    update: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSessionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUpdateManyWithoutUserNestedInput
    templates?: TemplateUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUncheckedUpdateManyWithoutUserNestedInput
    templates?: TemplateUncheckedUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutTemplatesInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountCreateNestedManyWithoutUserInput
    sessions?: SessionCreateNestedManyWithoutUserInput
    representatives?: user_representativesCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutTemplatesInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountUncheckedCreateNestedManyWithoutUserInput
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    representatives?: user_representativesUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutTemplatesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutTemplatesInput, UserUncheckedCreateWithoutTemplatesInput>
  }

  export type template_campaignCreateWithoutTemplateInput = {
    id: string
    delivery_type: string
    recipient_id?: string | null
    cwc_delivery_id?: string | null
    status?: string
    sent_at?: Date | string | null
    delivered_at?: Date | string | null
    error_message?: string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string
    updated_at: Date | string
  }

  export type template_campaignUncheckedCreateWithoutTemplateInput = {
    id: string
    delivery_type: string
    recipient_id?: string | null
    cwc_delivery_id?: string | null
    status?: string
    sent_at?: Date | string | null
    delivered_at?: Date | string | null
    error_message?: string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string
    updated_at: Date | string
  }

  export type template_campaignCreateOrConnectWithoutTemplateInput = {
    where: template_campaignWhereUniqueInput
    create: XOR<template_campaignCreateWithoutTemplateInput, template_campaignUncheckedCreateWithoutTemplateInput>
  }

  export type template_campaignCreateManyTemplateInputEnvelope = {
    data: template_campaignCreateManyTemplateInput | template_campaignCreateManyTemplateInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutTemplatesInput = {
    update: XOR<UserUpdateWithoutTemplatesInput, UserUncheckedUpdateWithoutTemplatesInput>
    create: XOR<UserCreateWithoutTemplatesInput, UserUncheckedCreateWithoutTemplatesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutTemplatesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutTemplatesInput, UserUncheckedUpdateWithoutTemplatesInput>
  }

  export type UserUpdateWithoutTemplatesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUpdateManyWithoutUserNestedInput
    sessions?: SessionUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutTemplatesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUncheckedUpdateManyWithoutUserNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUncheckedUpdateManyWithoutUserNestedInput
  }

  export type template_campaignUpsertWithWhereUniqueWithoutTemplateInput = {
    where: template_campaignWhereUniqueInput
    update: XOR<template_campaignUpdateWithoutTemplateInput, template_campaignUncheckedUpdateWithoutTemplateInput>
    create: XOR<template_campaignCreateWithoutTemplateInput, template_campaignUncheckedCreateWithoutTemplateInput>
  }

  export type template_campaignUpdateWithWhereUniqueWithoutTemplateInput = {
    where: template_campaignWhereUniqueInput
    data: XOR<template_campaignUpdateWithoutTemplateInput, template_campaignUncheckedUpdateWithoutTemplateInput>
  }

  export type template_campaignUpdateManyWithWhereWithoutTemplateInput = {
    where: template_campaignScalarWhereInput
    data: XOR<template_campaignUpdateManyMutationInput, template_campaignUncheckedUpdateManyWithoutTemplateInput>
  }

  export type template_campaignScalarWhereInput = {
    AND?: template_campaignScalarWhereInput | template_campaignScalarWhereInput[]
    OR?: template_campaignScalarWhereInput[]
    NOT?: template_campaignScalarWhereInput | template_campaignScalarWhereInput[]
    id?: StringFilter<"template_campaign"> | string
    template_id?: StringFilter<"template_campaign"> | string
    delivery_type?: StringFilter<"template_campaign"> | string
    recipient_id?: StringNullableFilter<"template_campaign"> | string | null
    cwc_delivery_id?: StringNullableFilter<"template_campaign"> | string | null
    status?: StringFilter<"template_campaign"> | string
    sent_at?: DateTimeNullableFilter<"template_campaign"> | Date | string | null
    delivered_at?: DateTimeNullableFilter<"template_campaign"> | Date | string | null
    error_message?: StringNullableFilter<"template_campaign"> | string | null
    metadata?: JsonNullableFilter<"template_campaign">
    created_at?: DateTimeFilter<"template_campaign"> | Date | string
    updated_at?: DateTimeFilter<"template_campaign"> | Date | string
  }

  export type UserCreateWithoutAccountInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    templates?: TemplateCreateNestedManyWithoutUserInput
    representatives?: user_representativesCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutAccountInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    templates?: TemplateUncheckedCreateNestedManyWithoutUserInput
    representatives?: user_representativesUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutAccountInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAccountInput, UserUncheckedCreateWithoutAccountInput>
  }

  export type UserUpsertWithoutAccountInput = {
    update: XOR<UserUpdateWithoutAccountInput, UserUncheckedUpdateWithoutAccountInput>
    create: XOR<UserCreateWithoutAccountInput, UserUncheckedCreateWithoutAccountInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAccountInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAccountInput, UserUncheckedUpdateWithoutAccountInput>
  }

  export type UserUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    templates?: TemplateUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    templates?: TemplateUncheckedUpdateManyWithoutUserNestedInput
    representatives?: user_representativesUncheckedUpdateManyWithoutUserNestedInput
  }

  export type TemplateCreateWithoutTemplate_campaignInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    user?: UserCreateNestedOneWithoutTemplatesInput
  }

  export type TemplateUncheckedCreateWithoutTemplate_campaignInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    userId?: string | null
  }

  export type TemplateCreateOrConnectWithoutTemplate_campaignInput = {
    where: TemplateWhereUniqueInput
    create: XOR<TemplateCreateWithoutTemplate_campaignInput, TemplateUncheckedCreateWithoutTemplate_campaignInput>
  }

  export type TemplateUpsertWithoutTemplate_campaignInput = {
    update: XOR<TemplateUpdateWithoutTemplate_campaignInput, TemplateUncheckedUpdateWithoutTemplate_campaignInput>
    create: XOR<TemplateCreateWithoutTemplate_campaignInput, TemplateUncheckedCreateWithoutTemplate_campaignInput>
    where?: TemplateWhereInput
  }

  export type TemplateUpdateToOneWithWhereWithoutTemplate_campaignInput = {
    where?: TemplateWhereInput
    data: XOR<TemplateUpdateWithoutTemplate_campaignInput, TemplateUncheckedUpdateWithoutTemplate_campaignInput>
  }

  export type TemplateUpdateWithoutTemplate_campaignInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneWithoutTemplatesNestedInput
  }

  export type TemplateUncheckedUpdateWithoutTemplate_campaignInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type user_representativesCreateWithoutRepresentativeInput = {
    id?: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
    user: UserCreateNestedOneWithoutRepresentativesInput
  }

  export type user_representativesUncheckedCreateWithoutRepresentativeInput = {
    id?: string
    user_id: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
  }

  export type user_representativesCreateOrConnectWithoutRepresentativeInput = {
    where: user_representativesWhereUniqueInput
    create: XOR<user_representativesCreateWithoutRepresentativeInput, user_representativesUncheckedCreateWithoutRepresentativeInput>
  }

  export type user_representativesCreateManyRepresentativeInputEnvelope = {
    data: user_representativesCreateManyRepresentativeInput | user_representativesCreateManyRepresentativeInput[]
    skipDuplicates?: boolean
  }

  export type user_representativesUpsertWithWhereUniqueWithoutRepresentativeInput = {
    where: user_representativesWhereUniqueInput
    update: XOR<user_representativesUpdateWithoutRepresentativeInput, user_representativesUncheckedUpdateWithoutRepresentativeInput>
    create: XOR<user_representativesCreateWithoutRepresentativeInput, user_representativesUncheckedCreateWithoutRepresentativeInput>
  }

  export type user_representativesUpdateWithWhereUniqueWithoutRepresentativeInput = {
    where: user_representativesWhereUniqueInput
    data: XOR<user_representativesUpdateWithoutRepresentativeInput, user_representativesUncheckedUpdateWithoutRepresentativeInput>
  }

  export type user_representativesUpdateManyWithWhereWithoutRepresentativeInput = {
    where: user_representativesScalarWhereInput
    data: XOR<user_representativesUpdateManyMutationInput, user_representativesUncheckedUpdateManyWithoutRepresentativeInput>
  }

  export type UserCreateWithoutRepresentativesInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountCreateNestedManyWithoutUserInput
    sessions?: SessionCreateNestedManyWithoutUserInput
    templates?: TemplateCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutRepresentativesInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    phone?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    congressional_district?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account?: accountUncheckedCreateNestedManyWithoutUserInput
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    templates?: TemplateUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutRepresentativesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutRepresentativesInput, UserUncheckedCreateWithoutRepresentativesInput>
  }

  export type representativeCreateWithoutUser_representativesInput = {
    id?: string
    bioguide_id: string
    name: string
    party: string
    state: string
    district: string
    chamber: string
    office_code: string
    phone?: string | null
    email?: string | null
    is_active?: boolean
    last_updated?: Date | string
  }

  export type representativeUncheckedCreateWithoutUser_representativesInput = {
    id?: string
    bioguide_id: string
    name: string
    party: string
    state: string
    district: string
    chamber: string
    office_code: string
    phone?: string | null
    email?: string | null
    is_active?: boolean
    last_updated?: Date | string
  }

  export type representativeCreateOrConnectWithoutUser_representativesInput = {
    where: representativeWhereUniqueInput
    create: XOR<representativeCreateWithoutUser_representativesInput, representativeUncheckedCreateWithoutUser_representativesInput>
  }

  export type UserUpsertWithoutRepresentativesInput = {
    update: XOR<UserUpdateWithoutRepresentativesInput, UserUncheckedUpdateWithoutRepresentativesInput>
    create: XOR<UserCreateWithoutRepresentativesInput, UserUncheckedCreateWithoutRepresentativesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutRepresentativesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutRepresentativesInput, UserUncheckedUpdateWithoutRepresentativesInput>
  }

  export type UserUpdateWithoutRepresentativesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUpdateManyWithoutUserNestedInput
    sessions?: SessionUpdateManyWithoutUserNestedInput
    templates?: TemplateUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutRepresentativesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    street?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    zip?: NullableStringFieldUpdateOperationsInput | string | null
    congressional_district?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: accountUncheckedUpdateManyWithoutUserNestedInput
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    templates?: TemplateUncheckedUpdateManyWithoutUserNestedInput
  }

  export type representativeUpsertWithoutUser_representativesInput = {
    update: XOR<representativeUpdateWithoutUser_representativesInput, representativeUncheckedUpdateWithoutUser_representativesInput>
    create: XOR<representativeCreateWithoutUser_representativesInput, representativeUncheckedCreateWithoutUser_representativesInput>
    where?: representativeWhereInput
  }

  export type representativeUpdateToOneWithWhereWithoutUser_representativesInput = {
    where?: representativeWhereInput
    data: XOR<representativeUpdateWithoutUser_representativesInput, representativeUncheckedUpdateWithoutUser_representativesInput>
  }

  export type representativeUpdateWithoutUser_representativesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bioguide_id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    party?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    chamber?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type representativeUncheckedUpdateWithoutUser_representativesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bioguide_id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    party?: StringFieldUpdateOperationsInput | string
    state?: StringFieldUpdateOperationsInput | string
    district?: StringFieldUpdateOperationsInput | string
    chamber?: StringFieldUpdateOperationsInput | string
    office_code?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    is_active?: BoolFieldUpdateOperationsInput | boolean
    last_updated?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type accountCreateManyUserInput = {
    id: string
    type: string
    provider: string
    provider_account_id: string
    refresh_token?: string | null
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
    session_state?: string | null
    created_at?: Date | string
    updated_at: Date | string
  }

  export type SessionCreateManyUserInput = {
    id?: string
    expiresAt: Date | string
    createdAt?: Date | string
  }

  export type TemplateCreateManyUserInput = {
    id?: string
    title: string
    description: string
    category: string
    type: string
    deliveryMethod: string
    subject?: string | null
    preview: string
    message_body: string
    delivery_config: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config: JsonNullValueInput | InputJsonValue
    metrics: JsonNullValueInput | InputJsonValue
    campaign_id?: string | null
    status?: string
    is_public?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type user_representativesCreateManyUserInput = {
    id?: string
    representative_id: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
  }

  export type accountUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type accountUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type accountUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    provider_account_id?: StringFieldUpdateOperationsInput | string
    refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    access_token?: NullableStringFieldUpdateOperationsInput | string | null
    expires_at?: NullableIntFieldUpdateOperationsInput | number | null
    token_type?: NullableStringFieldUpdateOperationsInput | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    id_token?: NullableStringFieldUpdateOperationsInput | string | null
    session_state?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TemplateUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    template_campaign?: template_campaignUpdateManyWithoutTemplateNestedInput
  }

  export type TemplateUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    template_campaign?: template_campaignUncheckedUpdateManyWithoutTemplateNestedInput
  }

  export type TemplateUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    category?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    deliveryMethod?: StringFieldUpdateOperationsInput | string
    subject?: NullableStringFieldUpdateOperationsInput | string | null
    preview?: StringFieldUpdateOperationsInput | string
    message_body?: StringFieldUpdateOperationsInput | string
    delivery_config?: JsonNullValueInput | InputJsonValue
    cwc_config?: NullableJsonNullValueInput | InputJsonValue
    recipient_config?: JsonNullValueInput | InputJsonValue
    metrics?: JsonNullValueInput | InputJsonValue
    campaign_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    is_public?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type user_representativesUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    representative?: representativeUpdateOneRequiredWithoutUser_representativesNestedInput
  }

  export type user_representativesUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    representative_id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type user_representativesUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    representative_id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type template_campaignCreateManyTemplateInput = {
    id: string
    delivery_type: string
    recipient_id?: string | null
    cwc_delivery_id?: string | null
    status?: string
    sent_at?: Date | string | null
    delivered_at?: Date | string | null
    error_message?: string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: Date | string
    updated_at: Date | string
  }

  export type template_campaignUpdateWithoutTemplateInput = {
    id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type template_campaignUncheckedUpdateWithoutTemplateInput = {
    id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type template_campaignUncheckedUpdateManyWithoutTemplateInput = {
    id?: StringFieldUpdateOperationsInput | string
    delivery_type?: StringFieldUpdateOperationsInput | string
    recipient_id?: NullableStringFieldUpdateOperationsInput | string | null
    cwc_delivery_id?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    sent_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    delivered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    error_message?: NullableStringFieldUpdateOperationsInput | string | null
    metadata?: NullableJsonNullValueInput | InputJsonValue
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type user_representativesCreateManyRepresentativeInput = {
    id?: string
    user_id: string
    relationship: string
    is_active?: boolean
    assigned_at?: Date | string
    last_validated?: Date | string | null
  }

  export type user_representativesUpdateWithoutRepresentativeInput = {
    id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneRequiredWithoutRepresentativesNestedInput
  }

  export type user_representativesUncheckedUpdateWithoutRepresentativeInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type user_representativesUncheckedUpdateManyWithoutRepresentativeInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    relationship?: StringFieldUpdateOperationsInput | string
    is_active?: BoolFieldUpdateOperationsInput | boolean
    assigned_at?: DateTimeFieldUpdateOperationsInput | Date | string
    last_validated?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}