<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


## WIP integration and Preview environment

- The user authorizes committing and pushing reviewable WIP application changes to `origin/develop` at implementation milestones. Run appropriate checks and inspect staged files for secrets before pushing. Do not force-push or overwrite others' changes.
- Use `https://tcg-royal-git-develop-collectorsrepublic.vercel.app` as the canonical test origin; the administrator entry is `/admin`. Prefer the Git-linked Preview produced by the develop push over ad hoc CLI deployments.
- `main` and Production are outside the authorized scope. Do not merge to main, promote, deploy to Production, or change production data/settings without a separate explicit request.
- Keep credentials, native signing files, Firebase service-account files, local environment files, remote attachments, editor state and generated APK/build/test output out of Git.
- Do not commit unrelated local changes as part of a lending WIP snapshot; leave them intact unless the user includes them in scope.
