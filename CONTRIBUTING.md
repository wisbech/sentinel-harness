# Contributing

Thanks for considering contributing to Sentinel Harness.

## Philosophy

- **Simple.** If a feature needs 200 lines, it's too complex for this project.
- **Tool-agnostic.** Adding a new transport should be 10 lines in transport.ts.
- **No breaking changes to persona format.** The `## Identity / ## Mission / ## Boundaries` parse contract is stable.
- **No framework dependencies.** TypeBox and yaml are the only deps. Keep it that way.

## Adding a Transport

1. Add a case in `createTransport()` in `src/transport.ts`
2. Add the CLI to the detection priority in `detectTransport()`
3. Add docs in README.md transports section
4. 15-20 lines of code, max

```typescript
case "my-tool":
  return {
    type: "my-tool",
    invoke: (params) => exec("my-tool", ["--print"], env, params.task, params.systemPrompt),
  };
```

## Adding a Decomposition Rule

1. Add a pattern to the `patterns` array in `ruleDecomposition()` in `src/decomposer.ts`
2. Each pattern has a `match` function and a `decompose` function
3. The decompose function returns sub-tasks with persona assignments

## Running Tests

```bash
bun install
bun test
```

## Pull Request Checklist

- [ ] Tests pass (`bun test`)
- [ ] No new dependencies
- [ ] No circular imports
- [ ] TypeScript compiles clean
- [ ] Added to docs if user-facing

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
