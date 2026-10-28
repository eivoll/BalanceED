# BalanceEd

A workload-balancing app for Mongolian high-school students. It puts the weekly
schedule, homework, exams and extracurricular opportunities in one place, scores
how heavy a student's week is, and shows the result to the student, their
teacher and their parent — each with a different view and different permissions.
An admin account sees every signup and sets which role each one has.

The interface is in Mongolian.

## Run it

Requires Node 24. No database server to install — it uses the `node:sqlite`
module that ships with Node.

    git clone https://github.com/eivoll/BalanceED.git
    cd BalanceED
    npm install
    npm run dev

Then open **http://localhost:5173** and sign in with one of the demo accounts.

`npm run dev` starts two processes: the GraphQL API on `:3300` and the Vite dev
server on `:5173`, which proxies `/graphql` to the API. On first start it creates
`data/balanceed.db` and seeds a small demo class.

### Demo accounts

All four share the password `Demo!2026`.

| Role | Email | Sees |
| --- | --- | --- |
| Admin | `admin@demo.mn` | every signup, the role each account has, and a form to open a teacher login |
| Teacher | `teacher@demo.mn` | class workload index, per-student schedule, post homework/exams, publish opportunities |
| Student | `student@demo.mn` | own schedule, assignments, matched opportunities, AI analysis, About Me |
| Parent | `parent@demo.mn` | child's schedule for approval, completion progress, a summary to read |

The admin account is seeded like the others, and existing databases get it on
their next start. It can list every account, change an account's role, and
create a teacher login that has no student profile behind it. It cannot read a
student's schedule or change its own role.

That password is printed on the login screen on purpose. Before using this with
real people, sign in and call `changePassword` for every account — the admin
first.

## Pages and URLs

Every page has its own path, so a bookmark or a pasted link opens that page
directly. Paths are Mongolian, written in Latin letters.

| Path | Page | Role |
| --- | --- | --- |
| `/` | Login and sign-up | anyone |
| `/student` | Weekly schedule, workload gauges | student |
| `/daalgwar` | Homework and exams | student |
| `/bolomj` | Matched opportunities | student |
| `/shinjelgee` | AI workload analysis | student |
| `/taniltsuulga` | About Me editor | student |
| `/teacher` | Class roster and the workload index | teacher |
| `/niitleh` | Post homework/exams, publish and list opportunities | teacher |
| `/parent` | Schedule approval and progress | parent |
| `/admin` | Account list, roles, teacher logins | admin |

Opening a path that is not yours sends you to your own first page instead, and
the API refuses the same data a second time — the path is not a security
boundary. `src/router.ts` holds the table; it uses the History API, so there is
no router dependency to install.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | API + UI with hot reload (the two ports above) |
| `npm run typecheck` | type-checks client and server, no emit |
| `npm run build` | compiles the server to `dist-server/` and the UI to `dist/` |
| `npm start` | runs the built server, which also serves `dist/` from `:3300` |

## Configuration

Everything has a working default, so `.env` is optional. Copy `.env.example` to
`.env` to change anything:

- `PORT` — API port, `3300` by default.
- `DB_PATH` — SQLite file, `./data/balanceed.db` by default.
- `GOOGLE_AI_API_KEY` — leave it empty and the app scores workload locally and
  writes the summaries from templates, so it runs fully offline. Set it (from
  <https://aistudio.google.com/apikey>) to have Gemma write the analyses.
- `COOKIE_SECURE` — set to `1` only when serving over HTTPS.

`GET /health` reports which AI backend is active.

## Layout

    server/      Express + Apollo GraphQL API, SQLite access, auth, AI fallback
    src/         React UI — Landing (login), then StudentView / TeacherView /
                 ParentView / AdminView, with src/router.ts mapping the paths above
    shared/      types used by both sides
    brand/       the mascot artwork, kept out of the served bundle
    public/      static files as-is — icon-32/192 favicons, icon-180 for iOS,
                 icon-80 for the header, all cut from brand/mascot-src.png
    data/        the SQLite file — gitignored, delete it to reseed

## Notes

- Roles are enforced on the server, not just in the UI: a student's session
  cannot read another student's data, and only an admin session can call the
  `adminUsers`, `adminSetRole` and `adminCreateTeacher` operations.
- Sessions are random tokens stored hashed; passwords use `crypto.scrypt`.
- `data/` and `.env` are gitignored, so cloning gives you an empty database that
  reseeds itself on first run.
