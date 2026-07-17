# Synaploom TypeScript and React Style Guide

## Formatting

Prettier is the only formatting authority: 100 columns, single quotes, semicolons, trailing commas, and LF line endings.

## Imports

- Cross-package imports use public `@synaploom/*` exports.
- Intra-package imports use private aliases such as `#src/*` or `#ui/*`.
- Authored TypeScript and TSX do not use `./` or `../` module imports.
- Consumers never import another package's `src/` directory.

## Types and boundaries

Strict TypeScript, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are required. Values from HTTP, JSON, SQLite, process output, and course files are `unknown` until validated. Domain discriminated unions must be handled exhaustively.

## React

Components are small, named, accessible functions. Daemon data is server state and belongs in TanStack Query. Local component state is limited to transient interaction state. Feature modules consume design-system primitives instead of recreating common buttons, inputs, dialogs, tabs, or status indicators.

## Comments

Comments explain contracts, invariants, security boundaries, and non-obvious trade-offs. TSDoc is required on public exports. Comments do not narrate obvious statements.
