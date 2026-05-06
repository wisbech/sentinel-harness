# Contributing

Thanks for considering contributing to Sentinel Harness.

## Branching

- `develop` — default branch. All feature work starts here.
- `main` — production. Merged from `develop` on release.
- Branch from `develop` for features/fixes. PR into `develop`.

```
main       ◄── merge only on release
  ▲
develop    ◄── feature PRs land here
  ▲
feature/xyz
```

## Philosophy

- **Simple.** If a feature needs 200 lines, it's too complex for this project.
- **Tool-agnostic.** Adding a new transport should be 10 lines in transport.ts.
- **No breaking changes to persona format.** The `## Identity / ## Mission / ## Boundaries` parse contract is stable.
- **No framework dependencies.** Zero runtime deps. `@types/bun` is dev-only.

## Adding a Transport

1. Add a case in `createTransport()` in `src/transport.ts`
2. Add the CLI to the detection list in `detectAvailable()` in `src/config.ts`
3. Add defaults in `DEFAULTS` and `allTransports()` in `src/config.ts`
4. Update help text in `printHelp()` in `src/index.ts`
5. 15-20 lines of code, max

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
