# Tarteeb portfolio entry

Tarteeb appears on the home page, project archive, and `/projects/Tarteeb`.
The code-backed entry in `data/showcase-projects.ts` includes the existing public
Vercel app, repository, problem, engineering role, features, stack, and real screenshots of a synthetic local demo. It contains
no invented user counts, commercial results, or performance metrics.

Project reads combine dashboard records with this entry on the server and after
client subscriptions update. A dashboard project named **Tarteeb** (case
insensitive) takes precedence, so adding that record lets the owner edit it from
the existing dashboard without producing a duplicate. Other projects and their
ordering values are preserved. To remove the code-backed entry entirely, remove
it from `SHOWCASE_PROJECTS`.

The app link is an existing deployment. Public rollout of the hardened Tarteeb
build requires its new database migration, production environment settings, and
email-confirmation setup; see the Tarteeb repository's `docs/DEPLOYMENT.md`.
