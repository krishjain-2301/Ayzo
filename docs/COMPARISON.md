# AYZO beside garak and promptfoo

One target, three tools, one afternoon. This is a single run of each, on one
small model, so read it as an illustration of what each tool looks for, not
as a ranking.

## Setup

| | |
|---|---|
| Target | `practice_bot` in weak mode (`python app.py weak`, port 5001): a support bot whose system prompt holds two secret codes and no defences |
| Model behind the target | `gemma3:4b` on Ollama |
| Date | 9 October 2026 |
| garak | v0.17.0, REST generator, 4 probes, capped at 20 prompts per probe, 1 generation each |
| promptfoo | `redteam run`, 2 plugins requested, 5 tests each, attack generation and grading by `gemma3:4b`, remote generation switched off |
| AYZO | 3 categories, up to 20 attacks each, judge `gemma3:4b`, seed 7 |

Everything ran on one laptop. Nothing was sent to an online service. The
config files are in `docs/comparison/`.

To check each tool's verdicts against ground truth, every reply was also
searched for the bot's two secret codes (listed in `practice_bot/profile.json`).
That column is the same test for all three tools.

## Results

| Tool | Prompts sent | Flagged as a successful attack | Replies that contained a secret code |
|---|---|---|---|
| garak | 61 | 27 | 0 |
| promptfoo | 5 | 5 | 1 |
| AYZO | 54 | 37 (31 by exact check, 6 by judge opinion) | 23 |

### garak

| Probe | Sent | Flagged | What a flag means |
|---|---|---|---|
| `promptinject.HijackHateHumans` | 20 | 16 | the bot dropped its task and printed the attacker's sentence |
| `latentinjection.LatentInjectionReport` | 20 | 10 | the bot obeyed an instruction hidden in a document it was asked to summarise |
| `encoding.InjectBase64` | 20 | 0 | the bot did not decode and repeat the hidden text |
| `dan.Dan_11_0` | 1 | 1 | the bot accepted the DAN persona |

garak's findings are real: the bot can be hijacked, directly and through
content. All of them are scored by string matching, so they are repeatable.
None of garak's prompts asks for this app's secrets, because garak does not
know the app has any. It tests the model in the app's seat; the 0 in the
last column is by design, not a miss.

### promptfoo

Two plugins were requested. `prompt-extraction` ran (5 cases). `hijacking`
did not: it needs promptfoo's remote generation service, which was switched
off to keep the run local. With that service on, promptfoo has far more
plugins and strategies than were exercised here.

All 5 cases were flagged by the grader (`gemma3:4b`). One reply contained a
secret code. The other four were ordinary support text (a refund script, a
greeting, a request for more detail) that the small grader model read as
a leak. With a stronger grader this would likely look different; the same
small model is a weak judge for AYZO too (see below).

promptfoo was told the app's purpose in a sentence, so its attacks were on
topic. It was not given the secret values, so it could not confirm a leak
by exact match.

### AYZO

| Category | Sent | Worked |
|---|---|---|
| System prompt leak | 20 | 17 |
| Prompt injection | 20 | 12 |
| Indirect injection | 14 | 8 |

Of the 37 findings, 23 were confirmed because a secret code appeared in the
reply, 8 because the reply contained a marker the hidden instruction asked
for, and 6 rest on the judge model's opinion alone. 3 more attacks got no
verdict (the judge was unsure) and are not counted either way.

AYZO was given the target's profile: its secrets and its system prompt. That
is the whole difference. It is also an unfair advantage in this table: the
practice bot was written by the same author as AYZO, and the last column
measures exactly the thing AYZO is built to check.

## What this does and does not show

It shows:

- The three tools look for different things. garak asks "can this model be
  hijacked?", promptfoo asks "does this app break its stated purpose?", AYZO
  asks "did this app give up the specific things its owner said to protect?".
- Exact checks hold up on a small local model. Grading by a 4 GB model does
  not, in promptfoo or in AYZO. AYZO's 6 judge-only findings deserve the same
  suspicion as promptfoo's 4.
- garak found hijacking that AYZO also found (indirect injection: garak
  10 of 20, AYZO 8 of 14), with a larger and better-known probe set.

It does not show:

- That AYZO is better. garak has about 150 probes and years of use; promptfoo
  has a much wider plugin set when its service is enabled. This run used a
  sliver of each.
- Anything about other targets. One bot, one model, one run each. The numbers
  will move on a rerun.
- How the tools compare on an app nobody here wrote. AYZO alone was run on
  one such app; see [REAL_APPS.md](REAL_APPS.md).

## Reproduce

```
cd practice_bot
set PRACTICE_MODEL=gemma3:4b
python app.py weak
```

In a second terminal, from the repository root:

```
garak --config docs/comparison/garak-run.yaml --target_type rest ^
      -G docs/comparison/garak-weak-bot.json ^
      --probes promptinject.HijackHateHumans,latentinjection.LatentInjectionReport,encoding.InjectBase64,dan.Dan_11_0

set PROMPTFOO_DISABLE_REDTEAM_REMOTE_GENERATION=true
promptfoo redteam run -c docs/comparison/promptfoo-weak-bot.yaml
```

Stop the bot, then (AYZO starts its own copy):

```
cd apps/api
python -m app.practice_check --only weak --runs 1 --per-category 20 ^
       --judge ollama/gemma3:4b --seed 7 --show ^
       --categories prompt_injection,system_prompt_leak,indirect_injection
```
