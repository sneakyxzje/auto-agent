export const CHAT_CLIENT = Symbol('CHAT_CLIENT');
export const EMBEDDING_CLIENT = Symbol('EMBEDDING_CLIENT');

export type TokenUsage = {
  input: number;
  output: number;
};

export const emptyUsage = (): TokenUsage => ({ input: 0, output: 0 });

export const addUsage = (left: TokenUsage, right: TokenUsage): TokenUsage => ({
  input: left.input + right.input,
  output: left.output + right.output,
});
