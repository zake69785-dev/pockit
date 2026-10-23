import { useRef, useState, type FormEvent } from "react";
import { change } from "../data/db";
import type { Data } from "../domain/model";
export function useLocalMutation() {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    locked = useRef(false);
  async function save(
    work: (d: Data) => void,
    notice = "Saved on this device.",
  ) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await change(work);
      setMessage(notice);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const submit =
    (work: (d: Data, f: FormData) => void, notice?: string) =>
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget,
        values = new FormData(form);
      if (await save((d) => work(d, values), notice)) form.reset();
    };
  return { error, message, busy, save, submit };
}
export const formText = (f: FormData, name: string) =>
  String(f.get(name) ?? "").trim();
export function FormFeedback({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
    </>
  );
}
