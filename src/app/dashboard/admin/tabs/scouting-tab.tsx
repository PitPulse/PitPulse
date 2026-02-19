"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  updateScoutingAbilityQuestions,
  updateScoutingFormConfig,
} from "@/lib/staff-actions";
import { Button } from "@/components/ui/button";
import type { FormOptionItem, ScoutingFormConfig } from "@/lib/platform-settings";

interface ScoutingTabProps {
  scoutingAbilityQuestions: string[];
  formConfig: ScoutingFormConfig;
}

/* ── Reusable option-list editor ── */

function OptionListEditor({
  title,
  description,
  items,
  onChange,
  keyPlaceholder = "key",
  labelPlaceholder = "Label",
}: {
  title: string;
  description: string;
  items: FormOptionItem[];
  onChange: (items: FormOptionItem[]) => void;
  keyPlaceholder?: string;
  labelPlaceholder?: string;
}) {
  const updateItem = (index: number, field: "key" | "label", value: string) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      onChange([{ key: "", label: "" }]);
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { key: "", label: "" }]);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-20"
                aria-label="Move up"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, 1)}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-20"
                aria-label="Move down"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <input
              type="text"
              value={item.key}
              onChange={(e) => updateItem(index, "key", e.target.value)}
              placeholder={keyPlaceholder}
              className="dashboard-input w-28 shrink-0 px-2 py-1.5 text-xs font-mono"
            />
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(index, "label", e.target.value)}
              placeholder={labelPlaceholder}
              className="dashboard-input flex-1 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded-lg border border-red-400/30 bg-red-500/10 p-1.5 text-red-300 transition hover:bg-red-500/20"
              aria-label="Remove"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add option
      </button>
    </div>
  );
}

/* ── String list editor (for start positions) ── */

function StringListEditor({
  title,
  description,
  items,
  onChange,
  placeholder = "Value",
}: {
  title: string;
  description: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const updateItem = (index: number, value: string) => {
    const next = items.map((item, i) => (i === index ? value : item));
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => onChange([...items, ""]);

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-20"
                aria-label="Move up"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, 1)}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-20"
                aria-label="Move down"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className="dashboard-input flex-1 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="rounded-lg border border-red-400/30 bg-red-500/10 p-1.5 text-red-300 transition hover:bg-red-500/20"
              aria-label="Remove"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add position
      </button>
    </div>
  );
}

/* ── Main Scouting Tab ── */

export function ScoutingTab({
  scoutingAbilityQuestions,
  formConfig,
}: ScoutingTabProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Ability questions state (moved from overview tab)
  const [questions, setQuestions] = useState<string[]>(
    scoutingAbilityQuestions.length > 0 ? scoutingAbilityQuestions : [""]
  );

  // Form config state
  const [intakeOptions, setIntakeOptions] = useState<FormOptionItem[]>(formConfig.intakeOptions);
  const [climbLevelOptions, setClimbLevelOptions] = useState<FormOptionItem[]>(formConfig.climbLevelOptions);
  const [shootingRangeOptions, setShootingRangeOptions] = useState<FormOptionItem[]>(formConfig.shootingRangeOptions);
  const [autoStartPositions, setAutoStartPositions] = useState<string[]>(formConfig.autoStartPositions);
  const [ratingFields, setRatingFields] = useState<FormOptionItem[]>(formConfig.ratingFields);

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 4000);
  }, []);

  async function handleSaveQuestions() {
    const normalized = questions
      .map((q) => q.trim().replace(/\s+/g, " "))
      .filter((q) => q.length > 0);

    const formData = new FormData();
    formData.set("questionsJson", JSON.stringify(normalized));

    const result = await updateScoutingAbilityQuestions(formData);
    if (result?.error) {
      showStatus(result.error);
      return;
    }

    showStatus("Ability questions saved.");
    startTransition(() => router.refresh());
  }

  async function handleSaveFormConfig() {
    const config: ScoutingFormConfig = {
      intakeOptions,
      climbLevelOptions,
      shootingRangeOptions,
      autoStartPositions,
      ratingFields,
    };

    const formData = new FormData();
    formData.set("formConfigJson", JSON.stringify(config));

    const result = await updateScoutingFormConfig(formData);
    if (result?.error) {
      showStatus(result.error);
      return;
    }

    showStatus("Scouting form config saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Scouting Form Editor</h2>
          <p className="text-sm text-gray-400">Customize every section of the scouting form.</p>
        </div>
      </div>

      {status && (
        <div className="mt-4 rounded-xl dashboard-panel px-4 py-3 text-sm font-medium text-teal-200 border-teal-500/30 bg-teal-500/10">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {status}
          </div>
        </div>
      )}

      {/* ── Form Field Options ── */}
      <div className="mt-6 rounded-2xl dashboard-panel dashboard-card p-5 space-y-8">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Form Field Options</h3>
            <p className="mt-1 text-sm text-gray-400">
              Customize the multi-select buttons and option groups shown on the scouting form. Each item has a <code className="rounded bg-white/5 px-1 text-xs text-gray-300">key</code> (stored in the database) and a <code className="rounded bg-white/5 px-1 text-xs text-gray-300">label</code> (shown to scouts).
            </p>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6">
          <OptionListEditor
            title="Intake Methods"
            description="Teleop section: multi-select buttons for how the robot picks up game pieces."
            items={intakeOptions}
            onChange={setIntakeOptions}
            keyPlaceholder="e.g. ground"
            labelPlaceholder="e.g. Ground Intake"
          />
        </div>

        <div className="border-t border-white/5 pt-6">
          <OptionListEditor
            title="Climb Levels"
            description="Endgame section: multi-select buttons for climb stages the robot can reach."
            items={climbLevelOptions}
            onChange={setClimbLevelOptions}
            keyPlaceholder="e.g. level_1"
            labelPlaceholder="e.g. Level 1"
          />
        </div>

        <div className="border-t border-white/5 pt-6">
          <OptionListEditor
            title="Shooting Ranges"
            description="Ratings section: multi-select buttons for effective shooting distances."
            items={shootingRangeOptions}
            onChange={setShootingRangeOptions}
            keyPlaceholder="e.g. close"
            labelPlaceholder="e.g. Close Range"
          />
        </div>

        <div className="border-t border-white/5 pt-6">
          <StringListEditor
            title="Auto Start Positions"
            description="Autonomous section: position buttons for where the robot starts."
            items={autoStartPositions}
            onChange={setAutoStartPositions}
            placeholder="e.g. left"
          />
        </div>

        <div className="border-t border-white/5 pt-6">
          <OptionListEditor
            title="Star Rating Fields"
            description="Ratings section: star-rating categories. Key must be one of: defense, cycle_time, shooting_reliability, reliability."
            items={ratingFields}
            onChange={setRatingFields}
            keyPlaceholder="e.g. defense"
            labelPlaceholder="e.g. Defense Ability"
          />
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            loading={isPending}
            onClick={handleSaveFormConfig}
          >
            Save form config
          </Button>
          <p className="text-xs text-gray-500">
            Changes apply to all new scouting sessions.
          </p>
        </div>
      </div>

      {/* ── Ability Questions ── */}
      <div className="mt-6 rounded-2xl dashboard-panel dashboard-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11h6" />
              <path d="M9 15h6" />
              <path d="M5 7h14" />
              <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Ability Questions</h3>
            <p className="mt-1 text-sm text-gray-400">
              Yes/No ability questions shown at the end of every scouting form.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {questions.map((question, index) => (
            <div key={`question-${index}`} className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) => (i === index ? e.target.value : item))
                  )
                }
                placeholder="e.g. Can cross the charge station?"
                className="dashboard-input w-full px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) =>
                    prev.length <= 1
                      ? [""]
                      : prev.filter((_, i) => i !== index)
                  )
                }
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQuestions((prev) => [...prev, ""])}
          >
            Add question
          </Button>
          <Button
            type="button"
            size="sm"
            loading={isPending}
            onClick={handleSaveQuestions}
          >
            Save ability questions
          </Button>
          <p className="text-xs text-gray-500">
            These render as Yes/No ability toggles on scout forms.
          </p>
        </div>
      </div>
    </div>
  );
}
