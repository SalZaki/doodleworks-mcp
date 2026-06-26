// Conventional Commits enforcement. Run by the .husky/commit-msg hook on every commit
// (commitlint --edit) and reusable in CI. ESM because package.json sets "type": "module".
export default {
  extends: ["@commitlint/config-conventional"],
};
