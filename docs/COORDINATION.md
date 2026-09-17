# RuFlo and ruOS coordination provenance

The earlier setup in this conversation successfully used ruOS machine `815601f9e17de8` and isolated directory `/home/ruv/projects/vibecast-studio-20260917`. It verified RuFlo 3.42.2 and initialized `swarm-1789664645133-tc7nvw` with a hierarchical topology, three-agent ceiling and strict permissions. It created implementation task `task-1789664645687-x66gh4` and testing task `task-1789664646325-jyuiat`.

Those tasks were unassigned and pending. They did not implement the application. This delivery must not attribute code or successful tests to nonexistent agent execution.

During implementation the ruOS connector could no longer be discovered in the available tool namespace. Plugin search returned no matching tool. Work therefore continued in the isolated build container, with real Python/HTTP/FFmpeg/browser tests. No existing user desktop was modified and no public federation messages were posted.

`scripts/coordinate.sh` is the executable continuation path on a ruOS desktop or GitHub runner with Node/npm access. It pins the same RuFlo version, creates a new workspace-local bounded swarm, records tasks and writes acceptance evidence to RuFlo memory. The ordinary deterministic test runner remains the source of the pass/fail evidence. Task creation is not represented as autonomous task completion.

Inputs: checked-out feature branch, Python dependencies, FFmpeg, Node/npm, network access for the pinned CLI package.
Outputs: strict local permission manifest, coordination log and memory record, backend test log, benchmark JSON. No paid inference, new desktops, public messages, secrets export, deployment, auto-merge or main-branch write.

```sh
cd /path/to/checked-out/vibecast
bash scripts/coordinate.sh
```

A local machine can run this independently of GitHub Actions. On a network-disabled execution host, the script cannot download a missing CLI and must report that limitation rather than inventing coordination results. The validation document records whether a runner actually executed it.
