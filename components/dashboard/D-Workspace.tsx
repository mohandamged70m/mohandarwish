"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  WorkProject,
  Milestone,
  Lead,
  ProjectNote,
  Workspace,
} from "@/lib/workspace-types";
import s from "@/components/workspace/workspace.module.css";
const EMPTY_PROJECT = {
  title: "",
  clientName: "",
  clientEmail: "",
  summary: "",
  status: "active",
  paymentStatus: "not_applicable",
  invoiceUrl: "",
  dueDate: "",
};
const EMPTY_LEAD = { name: "", email: "", stage: "inquiry", note: "" };
const EMPTY_MILESTONE = {
  title: "",
  description: "",
  previewUrl: "",
  dueDate: "",
  status: "planned",
};
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  options,
  area = false,
  max = 5000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  options?: string[];
  area?: boolean;
  max?: number;
}) {
  return (
    <label>
      {label}
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((v) => (
            <option value={v} key={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : area ? (
        <textarea
          value={value}
          required={required}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          value={value}
          required={required}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export default function DWorkspace() {
  const [data, setData] = useState<Workspace>({
    projects: [],
    leads: [],
    milestones: [],
  });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const selectedRef = useRef("");
  const [project, setProject] = useState(EMPTY_PROJECT),
    [projectId, setProjectId] = useState<string | undefined>(),
    [sourceLead, setSourceLead] = useState<string | undefined>();
  const [lead, setLead] = useState(EMPTY_LEAD),
    [leadId, setLeadId] = useState<string | undefined>();
  const [milestone, setMilestone] = useState(EMPTY_MILESTONE),
    [milestoneId, setMilestoneId] = useState<string | undefined>();
  const [notes, setNotes] = useState<ProjectNote[]>([]),
    [note, setNote] = useState("");
  const refresh = useCallback(async () => {
    const r = await fetch("/api/dashboard/workspace", { cache: "no-store" });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b.data);
  }, []);
  const refreshNotes = useCallback(async (id: string) => {
    const r = await fetch(
      `/api/dashboard/workspace?projectId=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    if (selectedRef.current === id) setNotes(b.data);
  }, []);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        await refresh();
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Could not load workspace");
      } finally {
        if (alive) {
          setLoading(false);
          timer = setTimeout(load, 20_000);
        }
      }
    };
    timer = setTimeout(load, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(
      () => void refreshNotes(selected).catch((e) => setError(e.message)),
      0,
    );
    return () => clearTimeout(timer);
  }, [selected, refreshNotes]);
  async function mutate(operation: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/dashboard/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, args }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await refresh();
      if (selected) await refreshNotes(selected);
      setNotice("Saved successfully");
      return { data: b.data };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setBusy(false);
    }
  }
  function newProject() {
    setProject(EMPTY_PROJECT);
    setProjectId(undefined);
    setSourceLead(undefined);
    selectedRef.current = "";
    setSelected("");
    setNotes([]);
    setNote("");
    setMilestone(EMPTY_MILESTONE);
    setMilestoneId(undefined);
  }
  function chooseProject(p: WorkProject) {
    selectedRef.current = p._id;
    setSelected(p._id);
    setProjectId(p._id);
    setSourceLead(undefined);
    setNotes([]);
    setNote("");
    setProject({
      title: p.title,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      summary: p.summary,
      status: p.status,
      paymentStatus: p.paymentStatus,
      invoiceUrl: p.invoiceUrl,
      dueDate: p.dueDate,
    });
    setMilestone(EMPTY_MILESTONE);
    setMilestoneId(undefined);
  }
  function editLead(l: Lead) {
    setLeadId(l._id);
    setLead({ name: l.name, email: l.email, stage: l.stage, note: l.note });
  }
  function editMilestone(m: Milestone) {
    setMilestoneId(m._id);
    setMilestone({
      title: m.title,
      description: m.description,
      previewUrl: m.previewUrl,
      dueDate: m.dueDate,
      status: m.status,
    });
  }
  async function saveProject(e: FormEvent) {
    e.preventDefault();
    const result = await mutate("saveProject", {
      ...project,
      ...(projectId ? { id: projectId } : {}),
      ...(sourceLead ? { leadId: sourceLead } : {}),
    });
    if (result?.data) {
      selectedRef.current = result.data;
      setSelected(result.data);
      setProjectId(result.data);
      setSourceLead(undefined);
    }
  }
  async function saveLead(e: FormEvent) {
    e.preventDefault();
    if (
      await mutate("saveLead", { ...lead, ...(leadId ? { id: leadId } : {}) })
    ) {
      setLead(EMPTY_LEAD);
      setLeadId(undefined);
    }
  }
  async function saveMilestone(e: FormEvent) {
    e.preventDefault();
    if (
      await mutate("saveMilestone", {
        ...milestone,
        projectId: selected,
        ...(milestoneId ? { id: milestoneId } : {}),
      })
    ) {
      setMilestone(EMPTY_MILESTONE);
      setMilestoneId(undefined);
    }
  }
  const current = data.projects.find((p) => p._id === selected),
    milestones = data.milestones.filter((m) => m.projectId === selected);
  if (loading)
    return (
      <div className={s.workspace} role="status">
        Loading your private workspace…
      </div>
    );
  return (
    <div className={s.workspace}>
      <div className={s.row}>
        <div>
          <h1>Private workspace</h1>
          <p>
            Manage inquiries, projects and delivery behind your owner login.
          </p>
        </div>
        <button disabled={busy} onClick={newProject}>
          New project
        </button>
      </div>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}
      <div className={s.stats}>
        {[
          [
            data.leads.filter((l) => !["won", "lost"].includes(l.stage)).length,
            "Open leads",
          ],
          [
            data.projects.filter((p) => p.status === "active").length,
            "Active projects",
          ],
          [
            data.milestones.filter((m) => m.status === "review").length,
            "Awaiting review",
          ],
          [
            data.projects.filter((p) =>
              ["unpaid", "partial"].includes(p.paymentStatus),
            ).length,
            "Payment outstanding",
          ],
        ].map(([n, label]) => (
          <div className={s.card} key={label}>
            <strong>{n}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className={s.grid}>
        <section className={s.card}>
          <h2>Lead pipeline</h2>
          <p>
            <small>
              New contact messages become inquiries automatically. Most recent
              100 shown.
            </small>
          </p>
          <form className={s.form} onSubmit={saveLead}>
            <Field
              label="Name"
              value={lead.name}
              max={120}
              required
              onChange={(name) => setLead({ ...lead, name })}
            />
            <Field
              label="Email"
              type="email"
              value={lead.email}
              required
              onChange={(email) => setLead({ ...lead, email })}
            />
            <Field
              label="Stage"
              value={lead.stage}
              options={["inquiry", "qualified", "proposal", "won", "lost"]}
              onChange={(stage) => setLead({ ...lead, stage })}
            />
            <Field
              label="Lead notes"
              area
              value={lead.note}
              onChange={(note) => setLead({ ...lead, note })}
            />
            <div className={s.actions}>
              <button disabled={busy} className={s.primary}>
                {leadId ? "Update lead" : "Add lead"}
              </button>
              {leadId && (
                <button
                  type="button"
                  onClick={() => {
                    setLeadId(undefined);
                    setLead(EMPTY_LEAD);
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
          <div className={s.list}>
            {data.leads.map((l) => (
              <div className={s.item} key={l._id}>
                <div className={s.row}>
                  <strong>{l.name}</strong>
                  <span className={s.badge}>{l.stage}</span>
                </div>
                <p>{l.email}</p>
                <div className={s.actions}>
                  <button disabled={busy} onClick={() => editLead(l)}>
                    Edit lead
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      newProject();
                      setProject({
                        ...EMPTY_PROJECT,
                        clientName: l.name,
                        clientEmail: l.email,
                      });
                      setSourceLead(l._id);
                    }}
                  >
                    Start project
                  </button>
                </div>
              </div>
            ))}
            {!data.leads.length && (
              <p className={s.empty}>Your first inquiry will appear here.</p>
            )}
          </div>
        </section>
        <section className={s.card}>
          <h2>{projectId ? "Project settings" : "Create a project"}</h2>
          {sourceLead && (
            <p>
              <small>Saving this project marks the selected lead as won.</small>
            </p>
          )}
          <form className={s.form} onSubmit={saveProject}>
            <Field
              label="Project title"
              value={project.title}
              max={160}
              required
              onChange={(title) => setProject({ ...project, title })}
            />
            <Field
              label="Client name"
              value={project.clientName}
              max={120}
              required
              onChange={(clientName) => setProject({ ...project, clientName })}
            />
            <Field
              label="Client email"
              type="email"
              value={project.clientEmail}
              required
              onChange={(clientEmail) =>
                setProject({ ...project, clientEmail })
              }
            />
            <Field
              label="Project brief"
              area
              value={project.summary}
              onChange={(summary) => setProject({ ...project, summary })}
            />
            <Field
              label="Status"
              value={project.status}
              options={["active", "paused", "completed"]}
              onChange={(status) => setProject({ ...project, status })}
            />
            <Field
              label="Due date"
              type="date"
              value={project.dueDate}
              onChange={(dueDate) => setProject({ ...project, dueDate })}
            />
            <Field
              label="Payment status"
              value={project.paymentStatus}
              options={["not_applicable", "unpaid", "partial", "paid"]}
              onChange={(paymentStatus) =>
                setProject({ ...project, paymentStatus })
              }
            />
            <Field
              label="Invoice link"
              type="url"
              value={project.invoiceUrl}
              onChange={(invoiceUrl) => setProject({ ...project, invoiceUrl })}
            />
            <button className={s.primary} disabled={busy}>
              {projectId ? "Save project" : "Create project"}
            </button>
          </form>
          <div className={s.list}>
            {data.projects.map((p) => (
              <button
                className={`${s.item} ${selected === p._id ? s.selected : ""}`}
                key={p._id}
                disabled={busy}
                onClick={() => chooseProject(p)}
              >
                <div className={s.row}>
                  <strong>{p.title}</strong>
                  <span className={s.badge}>{p.status}</span>
                </div>
                <p>
                  {p.clientName} · {p.clientEmail}
                </p>
              </button>
            ))}
            {!data.projects.length && (
              <p className={s.empty}>
                Create your first project to track delivery.
              </p>
            )}
          </div>
        </section>
      </div>
      {current && (
        <div className={s.grid}>
          <section className={s.card}>
            <h2>{current.title} — milestones</h2>
            <form className={s.form} onSubmit={saveMilestone}>
              <Field
                label="Milestone title"
                value={milestone.title}
                max={160}
                required
                onChange={(title) => setMilestone({ ...milestone, title })}
              />
              <Field
                label="Deliverable / instructions"
                area
                value={milestone.description}
                onChange={(description) =>
                  setMilestone({ ...milestone, description })
                }
              />
              <Field
                label="Preview link"
                type="url"
                value={milestone.previewUrl}
                onChange={(previewUrl) =>
                  setMilestone({ ...milestone, previewUrl })
                }
              />
              <Field
                label="Milestone due date"
                type="date"
                value={milestone.dueDate}
                onChange={(dueDate) => setMilestone({ ...milestone, dueDate })}
              />
              <Field
                label="Milestone status"
                value={milestone.status}
                options={[
                  "planned",
                  "in_progress",
                  "review",
                  "done",
                  "blocked",
                ]}
                onChange={(status) => setMilestone({ ...milestone, status })}
              />
              <div className={s.actions}>
                <button disabled={busy} className={s.primary}>
                  {milestoneId ? "Update milestone" : "Add milestone"}
                </button>
                {milestoneId && (
                  <button
                    type="button"
                    onClick={() => {
                      setMilestoneId(undefined);
                      setMilestone(EMPTY_MILESTONE);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
            <div className={s.list}>
              {milestones.map((m) => (
                <article className={s.item} key={m._id}>
                  <div className={s.row}>
                    <h3>{m.title}</h3>
                    <span className={s.badge}>
                      {m.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p>{m.description}</p>
                  {m.dueDate && <small>Due {m.dueDate}</small>}
                  <div className={s.actions}>
                    <button disabled={busy} onClick={() => editMilestone(m)}>
                      Edit milestone
                    </button>
                    {m.previewUrl && (
                      <a
                        className={s.link}
                        href={m.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open preview
                      </a>
                    )}
                  </div>
                </article>
              ))}
              {!milestones.length && (
                <p className={s.empty}>
                  Break your project into small deliverables.
                </p>
              )}
            </div>
          </section>
          <section className={s.card}>
            <h2>Private project notes</h2>
            <p>
              <small>
                Record requirements, decisions and feedback received through
                your usual channels.
              </small>
            </p>
            <form
              className={s.form}
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate("addNote", { projectId: selected, body: note })
                )
                  setNote("");
              }}
            >
              <Field
                label="New note"
                area
                required
                value={note}
                onChange={setNote}
              />
              <button disabled={busy} className={s.primary}>
                Save note
              </button>
            </form>
            <div className={s.list}>
              {notes.map((n) => (
                <article className={s.item} key={n._id}>
                  <small>{new Date(n.createdAt).toLocaleString()}</small>
                  <p>{n.body}</p>
                </article>
              ))}
              {!notes.length && (
                <p className={s.empty}>Your private notes will appear here.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
