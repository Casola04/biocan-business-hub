// Data-scope helper.
//
// The same dashboard / clients / orders / expenses pages render for
// three audiences:
//   - admin viewing their own data       → scope = { kind: "admin" }
//   - distributor viewing their own data → scope = { kind: "self"  }
//   - admin viewing one distributor      → scope = { kind: "distributor", id }
//
// Components call applyDistributorScope(query, scope) to attach the
// right filter on top of an existing supabase query builder.

import { useParams } from "@tanstack/react-router";
import { useAuth } from "./auth";

export type DataScope =
  | { kind: "admin" }
  | { kind: "self" }
  | { kind: "distributor"; id: string };

/**
 * Decide which scope this page is rendering in based on URL + auth.
 * URLs under /distributors/:distributorId render scope.kind = "distributor".
 */
export function useDataScope(): DataScope {
  const { isDistributor } = useAuth();
  const params = useParams({ strict: false }) as { distributorId?: string };
  if (params?.distributorId) return { kind: "distributor", id: params.distributorId };
  if (isDistributor) return { kind: "self" };
  return { kind: "admin" };
}

/**
 * Apply the scope filter to a supabase query builder.
 *  - "admin" → only rows where distributor_id IS NULL (admin's own data)
 *  - "self"  → no filter; RLS already constrains to the distributor's rows
 *  - "distributor" → distributor_id = id
 *
 * Typed with `any` because the supabase query-builder type chain is too
 * narrow for a generic helper — every method returns a slightly different
 * builder. We trust the runtime API instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyDistributorScope(query: any, scope: DataScope): any {
  if (scope.kind === "admin") return query.is("distributor_id", null);
  if (scope.kind === "distributor") return query.eq("distributor_id", scope.id);
  return query;
}

/** When inserting a row, what to set distributor_id to. null = let trigger decide. */
export function distributorIdForInsert(scope: DataScope): string | null {
  if (scope.kind === "distributor") return scope.id; // admin creating on behalf of distributor
  if (scope.kind === "self") return null; // trigger fills it in
  return null; // admin's own data stays null
}
