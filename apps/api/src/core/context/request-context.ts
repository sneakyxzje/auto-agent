import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  userId: string | null;
  tenantId: string | null;
  isTenantAdmin: boolean;
  isExternal: boolean;
};

const storage = new AsyncLocalStorage<RequestContext>();

const emptyContext = (): RequestContext => ({
  userId: null,
  tenantId: null,
  isTenantAdmin: false,
  isExternal: true,
});

export const enterRequestContext = <T>(run: () => T): T =>
  storage.run(emptyContext(), run);

export const fillRequestContext = (value: Partial<RequestContext>): void => {
  const store = storage.getStore();
  if (store !== undefined) Object.assign(store, value);
};

export const readRequestContext = (): RequestContext | undefined =>
  storage.getStore();
