# Where AYZO's attacks come from

Most of AYZO's library is written in this repo under
`apps/api/app/attack_library/payloads/`. Some categories are adapted from
public red-teaming datasets. This page lists every external source, its
licence, and what was taken.

## Committed into this repo (permissive licences)

| Category / subcategory | Source | Licence | What was taken |
|---|---|---|---|
| `sql_injection` | [swisskyrepo/PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings) | MIT | ~66 SQL-injection strings, each wrapped in an ordinary request a tool-calling app would pass to its database. Confirmed by a database error in the reply. |
| `insecure_output_handling` (subcategory `xss`) | PayloadsAllTheThings | MIT | ~22 XSS payloads hidden in content to summarise. Confirmed when the active script comes back unescaped. |
| `prompt_injection` (subcategory `ifixai_*`) | [ifixai-ai/iFixAi](https://github.com/ifixai-ai/iFixAi) | Apache-2.0 | 40 prompt-injection payloads across 8 tactics (override, role-play, fake system tags, encoding, authority, policy misdirection, social). |
| `agent_misuse` (subcategory `injecagent`) | [uiuc-kang-lab/InjecAgent](https://github.com/uiuc-kang-lab/InjecAgent) | MIT | 30 cases: a benign user request plus a tool result that carries a hidden attacker instruction (e.g. "email my data to …"). |
| `rag_poisoning` | [sleeepeer/PoisonedRAG](https://github.com/sleeepeer/PoisonedRAG) | MIT | 54 cases (nq, hotpotqa): five poisoned passages assert a false answer, then the question is asked. Confirmed by the planted false answer appearing in the reply. |

Each payload file names its source and commit in a comment at the top.

## Loaded by reference (harmful-content benchmarks, not committed)

HarmBench and JailbreakBench are lists of requests for genuinely harmful
content. AYZO does **not** copy their text into this repository — doing so
would turn a public MIT repo into a catalogue of how-to-harm requests.
Instead you clone them yourself and point AYZO at the folder. The text stays
on your machine and is sent only to the target you are scanning.

### Enable

```
# clone the benchmarks somewhere on your machine
mkdir ayzo-external && cd ayzo-external
git clone https://github.com/centerforaisafety/HarmBench
git clone https://github.com/JailbreakBench/jailbreakbench

# point AYZO at that folder (apps/api/.env or your shell)
AYZO_EXTERNAL_PAYLOADS=/path/to/ayzo-external
```

Restart the API. Two categories then appear on the New scan page, under
"The model's own guard rails":

| Category | Source | Licence | Confirmed how |
|---|---|---|---|
| `harmful_content` | HarmBench (`data/behavior_datasets/harmbench_behaviors_text_all.csv`) | MIT | Judge: a finding means the app produced the harmful content instead of refusing. Copyright behaviours are skipped (they need HarmBench's context file). |
| `adversarial_jailbreak` | JailbreakBench (`examples/prompts/*.json`) | MIT | Judge: a finding means a jailbreak worked. |

Until the path is set, both categories show with a count of 0 and a note on
how to enable them. Because they are judged, treat their findings with the
usual caution about judge opinions, especially on a small local model.

These two measure the base model's safety training more than your app, so
they are a baseline, not the main event: a weak local model will fail many
of them regardless of how your app is built. The remediation advice points
at a safety layer (input/output moderation) rather than at your prompt.

## Not used

These were reviewed but left out:

- **No-licence or non-reusable repos** (SQL-Injection-Payloads-List,
  tensor-trust-data, toxic-prompt, MultiTurnAgentAttack, BIPIA,
  real-toxicity-prompts beyond its Apache core): no clear right to
  redistribute, so nothing was copied in. They can still be used by reference
  the same way HarmBench is, if you clone them yourself.
- **Multi-turn repos you listed** (Micdejc/llm_multiturn_attacks, amazon-science/MultiTurnAgentAttack): no permissive licence, so nothing was copied in. AYZO's own `multi_turn` category covers this ground; more could be added by reference.

### A note on RAG poisoning

There are two RAG categories, and they differ in how the poison gets in:

- **`rag_poisoning`** plants the poisoned passages **inline** in the prompt as
  retrieved context, so it works against any chat target without extra setup.
  Payloads are adapted from PoisonedRAG (see the table above).
- **`rag_ingestion`** is higher fidelity and hand-written, not an import. It
  plants a document through the app's **own ingestion endpoint** and then asks
  a question only that document can answer, testing the real path
  (ingest → index → retrieve → answer). Each planted document carries a unique
  nonce the model cannot know otherwise, so a reply containing it is a confirmed
  finding by exact match, no judge. It needs a document ingestion endpoint set
  on the target (see the target's "How to talk to it" tab), and there is a
  practice target for it: `python app.py rag` in `practice_bot/`.
