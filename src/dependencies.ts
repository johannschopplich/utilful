// Hide internal types
const _t: unique symbol = Symbol()
declare const _d: unique symbol

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {}

type List<T> = [T, ...T[]]

export interface Service<in out K extends string, in out T> {
  [_t]: T
  [_d]: undefined extends T ? { [k in K]?: T } : { [k in K]: T }
}

export interface Compute<in out T, in out R> {
  [_t]: R
  [_d]: T
  (c: T): R
}

export interface Impl<in out K extends string, in out D, in out R> {
  [_t]: { [k in K]: R }
  [_d]: D
}

export type InferResult<T extends { [_t]: any }> = T[typeof _t]
export type InferDependency<T extends { [_d]: any }> = Prettify<
  UnionToIntersection<T[typeof _d]>
>

/**
 * Create a service
 * @param name - The service name
 */
export function service<const T extends string>(name: T): (<K>() => Service<T, K> & T) {
  return () =>
    name as any
}

const tag = <const T>(f: T): T => ((f[_t] = Symbol()), f)

/**
 * Create a compute that relies on other services or computes
 * @param deps - The service dependencies
 * @param f
 */
export function use<
  const T extends List<Service<any, any> | Compute<any, any>>,
  R,
>(deps: T, f: (
  ...args: {
    [K in keyof T]: InferResult<T[K]>;
  }
) => R): Compute<InferDependency<T[number]>, R> {
  return tag(c =>
    f(
      // @ts-ignore
      ...deps.map((d: any) =>
        // @ts-ignore
        typeof d === 'function' ? (c[d[_t]] ??= d(c)) : c[d],
      ),
    ),
  )
}

/**
 * Inject dependencies to the compute
 * @param compute
 * @param deps - Dependencies to inject
 */
export function inject<T, R, D extends Partial<T>>(compute: Compute<T, R>, d: D): Compute<Prettify<Omit<T, keyof D>>, R> {
  return tag((c: any) => compute({ ...c, ...d })) as any
}

/**
 * Create an implementation of the service that depends on other services
 * @param service
 * @param compute
 */
export function impl<K extends string, T, D>(service: Service<K, T>, compute: Compute<D, T>): Impl<K, D, T> {
  return [service as any, compute] as any
}

/**
 * Provide dependencies to implementations
 * @param impls
 * @param deps
 */
export function link<
  const T extends List<Impl<any, any, any>>,
  D extends InferDependency<T[number]>,
>(impls: T, deps: D): Prettify<D & InferResult<T[number]>> {
  deps = { ...deps }
  for (let i = 0; i < impls.length; i++)
    // @ts-ignore
    deps[impls[i][0]] = impls[i][1](deps)
  return deps as any
}
