# Examples

Each workspace package ships its own runnable examples next to the code it
demonstrates:

| Where                                                        | Shows                               |
| ------------------------------------------------------------ | ----------------------------------- |
| [`packages/core/examples/`](../packages/core/examples)       | Vanilla JS + the DOM renderer       |
| [`packages/react/examples/`](../packages/react/examples)     | React adapter                       |
| [`packages/vue/examples/`](../packages/vue/examples)         | Vue 3 adapter                       |
| [`packages/angular/examples/`](../packages/angular/examples) | Angular standalone component        |
| [`apps/playground/`](../apps/playground)                     | Live code editor + feature toggles  |
| [`apps/storybook/`](../apps/storybook)                       | Component stories per feature       |
| [`apps/performance/`](../apps/performance)                   | Dataset-size performance comparison |

Run a package's example with `pnpm --filter <package> dev`.
