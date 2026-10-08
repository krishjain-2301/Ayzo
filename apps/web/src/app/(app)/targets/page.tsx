"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Target } from "@/lib/types";
import { Button, Empty, Field, Input, Loading, Modal, Notice, PageHeader, Tag } from "@/components/ui";

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

        <div className="grid grid-cols-2 gap-2">
          {(["path", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md border px-3 py-2 text-[13px] ${mode === m ? "border-accent/60 bg-accent-dim/40 text-fg" : "border-line text-mute hover:text-fg"}`}
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
        <p className="text-xs text-mute">Next you can tell AYZO what this app must protect. That is what makes results trustworthy.</p>
      </form>
    </Modal>
  );
}

export default function TargetsPage() {
  const { data, error, loading, reload } = useApi<Target[]>("/targets");
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
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((t) => {
            const secrets = t.canaries?.length ?? 0;
            const rules = t.rules?.length ?? 0;
            const described = Boolean(secrets || t.system_prompt || t.expected_behavior || rules);
            return (
              <Link key={t.id} href={`/targets/${t.id}`} className="group rounded-lg border border-line bg-panel p-5 transition-colors hover:border-faint">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="truncate text-[15px] font-semibold text-fg group-hover:text-accent">{t.name}</h3>
                  <span className="shrink-0 font-mono text-xs text-mute">:{t.target_port}</span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-mute">{t.start_command}</p>
                {t.description && <p className="mt-3 line-clamp-2 text-[13px] text-mute">{t.description}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {secrets > 0 && <Tag tone="accent">{secrets} protected value{secrets === 1 ? "" : "s"}</Tag>}
                  {rules > 0 && <Tag tone="accent">{rules} rule{rules === 1 ? "" : "s"}</Tag>}
                  {t.system_prompt && <Tag tone="accent">system prompt</Tag>}
                  {t.chat_path ? <Tag>{t.chat_path}</Tag> : <Tag>route auto-detected</Tag>}
                  {!described && <Tag tone="warn">no profile yet</Tag>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
