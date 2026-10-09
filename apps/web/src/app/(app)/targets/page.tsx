"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { apiFetch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { ScanSummary, Target } from "@/lib/types";
import { Button, Card, Empty, Field, Input, Loading, Modal, Notice, PageHeader, TD, TH } from "@/components/ui";
import { RiskChip } from "@/components/charts";

function AddTarget({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"path" | "upload">("path");
  const [form, setForm] = useState({ name: "", project_path: "", start_command: "", target_port: "5000" });
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let created: Target;
      if (mode === "upload") {
        if (!files?.length) throw new Error("Choose the project folder to upload.");
        const body = new FormData();
        body.append("name", form.name);
        body.append("start_command", form.start_command || "already running");
        body.append("target_port", form.target_port);
        for (const file of Array.from(files)) body.append("files", file, file.webkitRelativePath || file.name);
        created = await apiFetch<Target>("/targets/upload", { method: "POST", body });
      } else {
        created = await post<Target>("/targets", {
          name: form.name,
          project_path: form.project_path || ".",
          start_command: form.start_command || "already running",
          target_port: Number(form.target_port),
        });
      }
      router.push(`/targets/${created.id}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the target.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Add a target" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice tone="fail">{error}</Notice>}
        <Field label="Name">
          <Input required value={form.name} onChange={set("name")} placeholder="Support bot" autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink p-1">
          {(["path", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === m ? "bg-raised text-fg" : "text-mute hover:text-fg"}`}
            >
              {m === "path" ? "Folder on this computer" : "Upload a folder"}
            </button>
          ))}
        </div>

        {mode === "path" ? (
          <Field label="Project folder" hint="Leave blank if the app is already running and you only want to attack its port.">
            <Input mono value={form.project_path} onChange={set("project_path")} placeholder="C:\Projects\my-bot" />
          </Field>
        ) : (
          <Field label="Project folder" hint=".env files, .git and node_modules are skipped. The copy is stored next to the API.">
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="block w-full text-sm text-mute file:mr-3 file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-fg"
              {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          </Field>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Start command" hint={<>One program, no <code>&amp;&amp;</code> or pipes. Blank means it is already running.</>}>
              <Input mono value={form.start_command} onChange={set("start_command")} placeholder="python app.py" />
            </Field>
          </div>
          <Field label="Port">
            <Input mono required type="number" min={1} max={65535} value={form.target_port} onChange={set("target_port")} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>Add target</Button>
        </div>
      </form>
    </Modal>
  );
}

/** A tick or a dash: whether a part of the profile has been filled in. */
function Has({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${on ? "text-fg" : "text-faint"}`} title={on ? `${label}: set` : `${label}: not set`}>
      {on ? <Check size={13} className="text-pass" /> : <Minus size={13} />} {label}
    </span>
  );
}

export default function TargetsPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Target[]>("/targets");
  const scans = useApi<ScanSummary[]>("/campaigns");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const addPractice = async () => {
    setBusy(true);
    setNotice("");
    try {
      await post("/targets/practice-bots");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not add the practice bots.");
    } finally {
      setBusy(false);
    }
  };

  const hasPractice = data?.some((t) => t.name.startsWith("Practice bot"));
  const lastScore = (name: string) => (scans.data ?? []).find((s) => s.target_name === name && s.status === "completed");

  return (
    <>
      <PageHeader
        title="Targets"
        subtitle="The LLM apps on this computer that AYZO can attack, and what each one must protect."
        actions={
          <>
            {!hasPractice && <Button onClick={addPractice} busy={busy}>Add practice bots</Button>}
            <Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} /> Add target</Button>
          </>
        }
      />
      {adding && <AddTarget onClose={() => setAdding(false)} />}
      {notice && <div className="mb-4"><Notice tone="fail">{notice}</Notice></div>}
      {error && <Notice tone="fail">{error}</Notice>}
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No targets yet" action={<Button variant="primary" onClick={() => setAdding(true)}>Add your first target</Button>}>
          A target is an app on this computer: a folder, how to start it, and the port it listens on.
        </Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Target</th>
                <th className={TH}>How it starts</th>
                <th className={`${TH} text-right`}>Port</th>
                <th className={TH}>What AYZO knows</th>
                <th className={`${TH} text-right`}>Last score</th>
                <th className={TH}>Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((t) => {
                const last = lastScore(t.name);
                return (
                  <tr key={t.id} className="cursor-pointer hover:bg-raised/50" onClick={() => router.push(`/targets/${t.id}`)}>
                    <td className={`${TD} max-w-[18rem]`}>
                      <Link href={`/targets/${t.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-fg hover:text-accent">{t.name}</Link>
                      {t.description && <p className="mt-0.5 line-clamp-1 text-xs text-mute">{t.description}</p>}
                    </td>
                    <td className={`${TD} font-mono text-[13px] text-mute`}>{t.start_command}</td>
                    <td className={`${TD} tabular text-right font-mono text-[13px] text-mute`}>{t.target_port}</td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <Has on={Boolean(t.canaries?.length)} label="Secrets" />
                        <Has on={Boolean(t.system_prompt)} label="Prompt" />
                        <Has on={Boolean(t.rules?.length)} label="Rules" />
                        <Has on={Boolean(t.chat_path)} label="Route" />
                      </div>
                    </td>
                    <td className={`${TD} tabular text-right text-base font-semibold text-fg`}>{last?.risk_score ?? "—"}</td>
                    <td className={TD}>{last ? <RiskChip score={last.risk_score} /> : <span className="text-xs text-faint">not scanned</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}
