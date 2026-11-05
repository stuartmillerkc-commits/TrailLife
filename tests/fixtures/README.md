# Test fixtures

Small content folders that exist only so the tests can prove the check script works. The site never loads them.

| Folder | What's wrong on purpose | Expected result |
| --- | --- | --- |
| `failing-fact/` | The fact `branch-army-founded` has no `source` and no `verifiedOn`. A module uses it. | `npm run check:failing` exits with errors naming that fact. |

The failing fact's statement may well be correct. What's missing is the proof, and that's the point: the check rejects a fact that has no source, however familiar it sounds.
