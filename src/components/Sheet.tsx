import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useDragControls } from "motion/react";
import { X } from "lucide-react";
export function Sheet({
  title,
  children,
  onClose,
  hasChanges = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  hasChanges?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [dirty, setDirty] = useState(false),
    reduced = useReducedMotion(),
    dragControls = useDragControls();
  const close = () => {
    if (!(dirty || hasChanges) || confirm("Discard your unsaved changes?"))
      onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      dialog?.close();
    };
  }, []);
  useEffect(() => {
    if (!(dirty || hasChanges)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, hasChanges]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onChange={() => setDirty(true)}
    >
      <motion.div
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80) close();
        }}
        initial={reduced ? false : { y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        <button
          className="sheet-drag-target"
          type="button"
          aria-label="Dismiss form"
          onClick={close}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <span className="sheet-handle" />
        </button>
        <header className="row">
          <h2 id="sheet-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close form"
            onClick={close}
          >
            <X />
          </button>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}
