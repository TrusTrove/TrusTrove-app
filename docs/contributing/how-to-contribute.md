# How to Contribute

TrusTrove is open source and actively looking for contributors through the
Stellar Wave program on Drips.

### Find an issue

All open issues are on GitHub:

- [TrusTrove-app issues](https://github.com/TrusTrove/TrusTrove-app/issues)
- [TrusTrove-contract issues](https://github.com/TrusTrove/TrusTrove-contract/issues)

Issues are labeled by complexity:

- `complexity:low` — isolated scope, good starting point
- `complexity:medium` — touches 2–3 components
- `complexity:high` — architectural changes

Assign yourself to an issue before starting work. If two people are working on
the same issue, only one PR will be merged.

### Setup

Follow the local setup guide for the repo you are contributing to:

- [App repo setup](../developer-guide/local-setup.md)
- [Contracts repo setup](https://github.com/TrusTrove/TrusTrove-contract#quick-start)

### Branch naming

```
feat/123-short-description
fix/456-short-description
docs/short-description
test/short-description
```

### Commit format

```
feat(web): add invoice status timeline component
fix(sdk): handle soroban rpc timeout with retry
test(pool): add yield distribution unit tests
docs(api): add indexer pagination reference
```

### PR checklist

Before opening a PR:

- [ ] All existing tests pass
- [ ] New tests written for new functionality
- [ ] TypeScript compiles with no errors (`tsc --noEmit`)
- [ ] No `console.log` left in production code
- [ ] Commit messages follow the format above

### Contact

Questions? Reach us on Telegram: **[t.me/trusttrove](https://t.me/trusttrove)**  
Or open a discussion on GitHub.



