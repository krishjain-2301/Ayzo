"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Play, PlugZap, ScanSearch, Trash2 } from "lucide-react";
import { del, patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ScanSummary, Suggestions, Target } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Button, Card, CardHeader, Field, Input, Loading, Mono, Notice, PageHeader, Select, StatusDot, Tabs, Tag, Textarea } from "@/components/ui";
import { RiskChip } from "@/components/charts";

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/* ---------------------------------------------------------------- profile */

function ProfileCard({ target, onSaved }: { target: Target; onSaved: (t: Target) => void }) {
  const [form, setForm] = useState({
    canaries: (target.canaries ?? []).join("\n"),
    expected_behavior: target.expected_behavior ?? "",
    rules: (target.rules ?? []).join("\n"),
    system_prompt: target.system_prompt ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [planted, setPlanted] = useState("");
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      onSaved(
        await patch<Target>(`/targets/${target.id}`, {
          canaries: lines(form.canaries),
          expected_behavior: form.expected_behavior,
          rules: lines(form.rules),
          system_prompt: form.system_prompt,
        })
      );
      setNote({ ok: true, text: "Saved." });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  const plant = async () => {
    try {
      const res = await post<{ marker: string; paste_into_system_prompt: string; canaries: string[] }>(`/targets/${target.id}/canary`);
      setForm((f) => ({ ...f, canaries: res.canaries.join("\n") }));
      setPlanted(res.paste_into_system_prompt);
      onSaved({ ...target, canaries: res.canaries });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not create a marker." });
    }
  };

  return (
    <Card>
      <CardHeader
        title="What this app must protect"
        hint="Everything here is optional, and each field makes results more certain. It stays on this computer."
      />
      <div className="space-y-5 p-5">
        <Field
          label="Protected values"
          hint="One per line: API keys, passwords, internal codes. If any of them appears in a reply, that is a confirmed leak with no judge involved."
        >
          <Textarea mono rows={3} value={form.canaries} onChange={set("canaries")} placeholder="sk-live-abc123&#10;STAFF-7731-ZETA" />
        </Field>
        <div className="-mt-2 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={plant}>Plant a marker</Button>
          <span className="text-xs text-mute">Creates a unique code to paste into your system prompt, so a prompt leak is caught for certain.</span>
        </div>
        {planted && (
          <Notice tone="pass">
            Marker added. Paste this line into your app&apos;s system prompt:
            <Mono className="mt-2 text-fg">{planted}</Mono>
          </Notice>
        )}

        <Field label="What the app should and should not do" hint="Given to the judge so it knows what correct behaviour is for this app.">
          <Textarea rows={2} value={form.expected_behavior} onChange={set("expected_behavior")} placeholder="Answers billing questions for Acme. Must not discuss other customers." />
        </Field>

        <Field
          label="Business rules"
          hint={<>One per line. The <b>Business Rules</b> attack category tries to make the app break each one.</>}
        >
          <Textarea rows={3} value={form.rules} onChange={set("rules")} placeholder="Never give a discount above 10 percent.&#10;Never promise a refund after 30 days." />
        </Field>

        <Field label="System prompt" hint="Used only to detect replies that repeat it word for word.">
          <Textarea mono rows={5} value={form.system_prompt} onChange={set("system_prompt")} placeholder="Paste the app's system prompt" />
        </Field>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={save} busy={busy}>Save profile</Button>
          {note && <span className={`text-sm ${note.ok ? "text-pass" : "text-fail"}`}>{note.text}</span>}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- read the project */

function Row({ label, values }: { label: string; values: (string | number)[] }) {
  return (
    <div className="flex gap-4 py-2">
      <dt className="w-36 shrink-0 text-sm text-mute">{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-1.5">
        {values.length ? (
          values.map((v) => <code key={String(v)} className="rounded bg-raised px-1.5 py-0.5 text-xs">{v}</code>)
        ) : (
          <span className="text-sm text-faint">nothing found</span>
        )}
      </dd>
    </div>
  );
}

function AnalyzeCard({ target, onSaved }: { target: Target; onSaved: () => void }) {
  const [found, setFound] = useState<Suggestions | null>(null);
  const [applied, setApplied] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<"" | "scan" | "apply">("");
  const [error, setError] = useState("");

  const run = async (apply: boolean) => {
    setBusy(apply ? "apply" : "scan");
    setError("");
    try {
      const res = await post<{ suggestions: Suggestions; applied: string[] }>(`/targets/${target.id}/analyze${apply ? "?apply=true" : ""}`);
      setFound(res.suggestions);
      if (apply) {
        setApplied(res.applied);
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the project.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Card>
      <CardHeader
        title="Read the project"
        hint="AYZO looks through the project's files for the chat route, the system prompt and secrets inside it. Files are only read, never run."
        right={<Button size="sm" onClick={() => run(false)} busy={busy === "scan"}><ScanSearch size={14} /> Read project</Button>}
      />
      {(found || error) && (
        <div className="p-5">
          {error && <Notice tone="fail">{error}</Notice>}
          {found && (
            <>
              <dl className="divide-y divide-line">
                <Row label="Chat route" values={found.chat_paths} />
                <Row label="Port" values={found.ports} />
                <Row label="Request field" values={found.request_fields} />
                <Row label="Secrets in prompt" values={found.canaries} />
                <Row label="Tools" values={found.tools} />
                <div className="flex gap-4 py-2">
                  <dt className="w-36 shrink-0 text-sm text-mute">System prompt</dt>
                  <dd className="min-w-0 flex-1 space-y-2">
                    {found.system_prompts.length === 0 && <span className="text-sm text-faint">nothing found</span>}
                    {found.system_prompts.map((p) => (
                      <div key={p.file + p.text.length} className="rounded-md border border-line bg-ink p-3">
                        <p className="mb-1 font-mono text-xs text-faint">{p.file}</p>
                        <Mono className="max-h-28 overflow-y-auto text-mute">{p.text}</Mono>
                      </div>
                    ))}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="primary" onClick={() => run(true)} busy={busy === "apply"}>Fill empty fields with these</Button>
                <span className="text-xs text-mute">
                  {applied
                    ? applied.length
                      ? `Filled: ${applied.join(", ").replace(/_/g, " ")}.`
                      : "Nothing to fill: those fields already have values, or there was more than one candidate."
                    : `${found.files_scanned} files read. Only empty fields are filled; nothing is overwritten.`}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- connection */

function ConnectionCard({ target, onSaved }: { target: Target; onSaved: (t: Target) => void }) {
  const [form, setForm] = useState({
    chat_path: target.chat_path ?? "",
    request_field: target.request_field ?? "",
    response_field: target.response_field ?? "",
    history_mode: target.history_mode ?? "client",
    extra_body: target.extra_body && Object.keys(target.extra_body).length ? JSON.stringify(target.extra_body) : "",
    header_name: "",
    header_value: "",
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  const headers = Object.entries(target.request_headers ?? {});

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setNote(null);
    try {
      let extraBody: unknown = {};
      if (form.extra_body.trim()) {
        try {
          extraBody = JSON.parse(form.extra_body);
        } catch {
          throw new Error('Extra fields must be JSON, for example {"stream": true}');
        }
      }
      const body: Record<string, unknown> = {
        chat_path: form.chat_path,
        request_field: form.request_field,
        response_field: form.response_field,
        history_mode: form.history_mode,
        extra_body: extraBody,
        ...extra,
      };
      if (form.header_name.trim() && form.header_value.trim() && !("request_headers" in extra)) {
        // Values come back masked, so a header can be added or replaced but not edited in place.
        body.request_headers = { [form.header_name.trim()]: form.header_value.trim() };
      }
      onSaved(await patch<Target>(`/targets/${target.id}`, body));
      setForm((f) => ({ ...f, header_name: "", header_value: "" }));
      setNote({ ok: true, text: "Saved." });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="How to talk to the app" hint="Leave these blank and AYZO will work out the route and request shape by trying common ones." />
      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Chat route">
            <Input mono value={form.chat_path} onChange={set("chat_path")} placeholder="/api/chat" />
          </Field>
          <Field label="Request field" hint={<>Where the prompt goes. <code>messages</code> sends chat history.</>}>
            <Input mono value={form.request_field} onChange={set("request_field")} placeholder="auto" />
          </Field>
          <Field label="Reply field" hint={<>Dotted path, e.g. <code>data.answer</code></>}>
            <Input mono value={form.response_field} onChange={set("response_field")} placeholder="auto" />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Extra fields in every request" hint="JSON. For apps that require a model name or a stream flag.">
            <Input mono value={form.extra_body} onChange={set("extra_body")} placeholder='{"stream": true}' />
          </Field>
          <Field label="Conversation memory" hint="Only matters for agentic attacks.">
            <Select value={form.history_mode} onChange={set("history_mode")}>
              <option value="client">AYZO sends the whole conversation each turn</option>
              <option value="server">The app remembers it (by cookie)</option>
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">Request header</p>
          {headers.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {headers.map(([name, value]) => (
                <Tag key={name} tone="accent">{name}: {value}</Tag>
              ))}
              <button className="text-xs text-mute hover:text-fail" onClick={() => save({ request_headers: {} })}>Remove</button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <Input mono value={form.header_name} onChange={set("header_name")} placeholder="Authorization" />
            <div className="md:col-span-2">
              <Input mono type="password" autoComplete="off" value={form.header_value} onChange={set("header_value")} placeholder="Bearer your-app-key" />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-mute">For apps behind a key. Sent with every request, stored on this computer, shown masked.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => save()} busy={busy}>Save connection</Button>
          {note && <span className={`text-sm ${note.ok ? "text-pass" : "text-fail"}`}>{note.text}</span>}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- page */

export default function TargetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const { data: target, error, loading, reload, setData } = useApi<Target>(`/targets/${id}`);
  const [test, setTest] = useState<{ success: boolean; message: string; output: string | null } | null>(null);
  const [testing, setTesting] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<"protect" | "connect" | "read">("protect");
  const scans = useApi<ScanSummary[]>("/campaigns");

  if (loading) return <Loading />;
  if (error || !target) return <Notice tone="fail">{error || "Target not found."}</Notice>;

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await post(`/targets/${target.id}/test`));
    } catch (e) {
      setTest({ success: false, message: e instanceof Error ? e.message : "Test failed.", output: null });
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${target.name}" and all of its scans? This cannot be undone.`)) return;
    try {
      await del(`/targets/${target.id}`);
      router.push("/targets");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete the target.");
    }
  };

  const refreshed = async () => {
    await reload();
    setVersion((v) => v + 1);
  };

  return (
    <>
      <PageHeader
        back={<Link href="/targets" className="inline-flex items-center gap-1.5 text-mute hover:text-fg"><ArrowLeft size={14} /> Targets</Link>}
        title={target.name}
        subtitle={target.description || "An app on this computer that AYZO can attack."}
        actions={
          <>
            <Button onClick={runTest} busy={testing}><PlugZap size={15} /> Test connection</Button>
            <Link href={`/scans/new?target=${target.id}`}><Button variant="primary"><Play size={14} /> Scan</Button></Link>
            <Button variant="ghost" onClick={remove} aria-label="Delete target"><Trash2 size={15} /></Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {isNew && !test && (
            <Notice>Target added. Fill in what you can below, then press <b>Test connection</b> to check AYZO can reach the app.</Notice>
          )}
          {test && (
            <Notice tone={test.success ? "pass" : "fail"}>
              {test.success ? "Connected. " : "Not connected. "}
              {test.message}
              {test.output && <Mono className="mt-2 opacity-80">{test.output}</Mono>}
            </Notice>
          )}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "protect", label: "What it must protect" },
              { id: "connect", label: "How to talk to it" },
              { id: "read", label: "Read the project" },
            ]}
          />
          {tab === "protect" && <ProfileCard key={`p${version}`} target={target} onSaved={setData} />}
          {tab === "connect" && <ConnectionCard key={`c${version}`} target={target} onSaved={setData} />}
          {tab === "read" && <AnalyzeCard target={target} onSaved={refreshed} />}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title="About this target" />
            <dl className="divide-y divide-line px-5 text-[13px]">
              {(
                [
                  ["Start command", <code key="c">{target.start_command}</code>],
                  ["Port", <code key="p">{target.target_port}</code>],
                  ["Chat route", target.chat_path ? <code key="r">{target.chat_path}</code> : "auto-detected"],
                  ["Protected values", target.canaries?.length ?? 0],
                  ["Business rules", target.rules?.length ?? 0],
                  ["System prompt", target.system_prompt ? "provided" : "not provided"],
                ] as [string, React.ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-mute">{label}</dt>
                  <dd className="truncate text-right text-fg">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="break-all border-t border-line px-5 py-3 font-mono text-xs text-faint">{target.project_path}</p>
          </Card>

          <Card>
            <CardHeader title="Scans of this target" />
            {(() => {
              const mine = (scans.data ?? []).filter((x) => x.target_name === target.name).slice(0, 6);
              if (!mine.length) return <p className="px-5 py-6 text-[13px] text-mute">Not scanned yet.</p>;
              return (
                <ul className="divide-y divide-line">
                  {mine.map((x) => (
                    <li key={x.id}>
                      <Link href={`/scans/${x.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-raised/50">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-fg">{x.name}</span>
                          <span className="block text-xs text-mute">{timeAgo(x.created_at)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          {x.risk_score !== null ? (
                            <>
                              <RiskChip score={x.risk_score} />
                              <span className="tabular w-10 text-right text-sm font-semibold text-fg">{x.risk_score}</span>
                            </>
                          ) : (
                            <StatusDot status={x.status} />
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Card>
        </aside>
      </div>
    </>
  );
}
