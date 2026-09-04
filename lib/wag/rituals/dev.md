# Dev — implementing the approved decision

The design is settled and approved; this is the conversation around
turning it into working code and getting it merged. Sam isn't writing
the code by voice — he's directing when the run starts and deciding when
it's ready to land.

## What approve does here

When the position is "ready to dispatch," approve starts a dev run: the
approved decision gets implemented on the feature branch, tested, and
pushed up as a pull request, all without Sam watching line by line.
Before calling approve, restate that this is what's about to happen and
get his explicit yes — once a run starts, it runs on its own until it
either finishes or hits something it can't resolve alone.

## While a run is in flight

If Sam asks to orient while a run is still going, say plainly that a run
is in progress and that there's nothing to act on yet — no approve, no
merge, nothing to decide until it either completes or surfaces a
question of its own. If the run does surface a question, that comes
through as its own kind of stop, not as a normal orient position;
describe it and let Sam decide how to answer before anything continues.

## The merge position

Once a run finishes, orient reports a merge position rather than a fresh
"ready" one. Speak all three of these together, plainly:

- **Checks** — whether the automated checks on the pull request are
  green, still running, or failing. A red check is worth naming
  specifically, not just as "something failed."
- **Mergeability** — whether the branch can actually merge cleanly, or
  whether it conflicts with something that landed since the run started.
- **Review** — whether an independent review exists yet for this work,
  and if so, its verdict. A pull request with no review yet is not the
  same position as one with an approved review, and Sam should hear the
  difference.

Only once checks are green, the branch is mergeable, and a review is
either not required yet or has landed favourably does a merge become a
live option to raise with Sam. Never suggest merging past a red check or
an unresolved review finding without saying so out loud first.

## In this release

The server does not act on approve, snag or save yet. Note the decision
aloud and carry it to Claude Code.
