import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ImagePlus, Send, X, ShieldCheck, MessageCircle } from "lucide-react";
import { api, useLive } from "../../lib/live-service";
import type { ResponseMessage, ResponseIncident } from "../../lib/response";
async function preparePhoto(file: File) {
  if (
    file.size > 12 * 1024 * 1024 ||
    !/^image\/(jpeg|png|webp)$/.test(file.type)
  )
    throw Error("Choose a JPEG, PNG or WebP photo under 12 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Photo preview is unavailable.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.83).split(",")[1];
    if (data.length > 2.7 * 1024 * 1024)
      throw Error("Photo is too detailed. Choose a smaller image.");
    return data;
  } finally {
    bitmap.close();
  }
}
export function ResponseChat({ incident }: { incident: ResponseIncident }) {
  const live = useLive(),
    [messages, setMessages] = useState<ResponseMessage[]>([]),
    [body, setBody] = useState(""),
    [photo, setPhoto] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [older, setOlder] = useState<string | null>(null),
    [zoom, setZoom] = useState<string | null>(null);
  const cursorLoaded = useRef(false),
    generation = useRef(0),
    id = useRef(crypto.randomUUID()),
    input = useRef<HTMLInputElement>(null),
    bottom = useRef<HTMLDivElement>(null);
  const closed = ["completed", "cancelled", "rejected"].includes(
    incident.status,
  );
  const url = "/responses/" + incident.id + "/messages";
  useEffect(() => {
    const token = ++generation.current;
    let stopped = false;
    cursorLoaded.current = false;
    setMessages([]);
    setBody("");
    setPhoto("");
    setError("");
    setBusy(false);
    setOlder(null);
    setZoom(null);
    id.current = crypto.randomUUID();
    async function refresh() {
      if (document.hidden) return;
      try {
        const result = await api(url);
        if (stopped || token !== generation.current) return;
        setMessages((old) => {
          const known = new Map(
            [...old, ...result.messages].map((m: ResponseMessage) => [m.id, m]),
          );
          return [...known.values()].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          );
        });
        if (!cursorLoaded.current) {
          setOlder(result.olderBefore);
          cursorLoaded.current = true;
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Chat unavailable.");
      }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [incident.id]);
  useEffect(() => {
    if (!zoom) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [zoom]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  async function send() {
    setBusy(true);
    setError("");
    const token = generation.current;
    try {
      await api(url, { id: id.current, body, photo: photo || undefined });
      if (token !== generation.current) return;
      setBody("");
      setPhoto("");
      id.current = crypto.randomUUID();
      const result = await api(url);
      if (token === generation.current)
        setMessages((old) => {
          const merged = new Map(
            [...old, ...result.messages].map((m) => [m.id, m]),
          );
          return [...merged.values()].sort(
            (a, b) =>
              a.created_at.localeCompare(b.created_at) ||
              a.id.localeCompare(b.id),
          );
        });
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : "Message was not sent.");
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  return (
    <section className="rsp-chat" aria-label="Private incident chat">
      <div className="rsp-chat-heading">
        <MessageCircle size={20} />
        <div>
          <h2>Dispatch chat</h2>
          <p>Assigned responder & approved operators</p>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="rsp-messages" aria-live="polite">
        {older && (
          <button
            className="rsp-text-button"
            onClick={async () => {
              try {
                const result = await api(
                  url + "?before=" + encodeURIComponent(older),
                );
                setMessages((old) => [
                  ...result.messages,
                  ...old.filter(
                    (m) =>
                      !result.messages.some(
                        (r: ResponseMessage) => r.id === m.id,
                      ),
                  ),
                ]);
                setOlder(result.olderBefore);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Load earlier messages
          </button>
        )}
        {!messages.length && (
          <div className="rsp-chat-empty">
            <ShieldCheck size={28} />
            <strong>Keep the team informed</strong>
            <p>
              Send a field update or attach the medical information needed for
              this incident.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <article
            className={
              "rsp-message " +
              (m.sender_id === live.state?.user.id ? "is-mine" : "")
            }
            key={m.id}
          >
            <div>
              <strong>{m.sender_name}</strong>
              <time>
                {new Date(m.created_at).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </div>
            {m.body && <p>{m.body}</p>}
            {m.has_photo &&
              (m.photo_expired ? (
                <small>Photo access expired</small>
              ) : (
                <button
                  className="rsp-photo"
                  aria-label="View incident photo"
                  onClick={() => setZoom("/api" + url + "/" + m.id + "/photo")}
                >
                  <img
                    src={"/api" + url + "/" + m.id + "/photo"}
                    alt="Medical information shared with dispatch"
                    loading="lazy"
                  />
                </button>
              ))}
          </article>
        ))}
        <div ref={bottom} />
      </div>
      {error && (
        <p className="rsp-error" role="alert">
          {error}
        </p>
      )}
      {closed ? (
        <p className="rsp-caption">
          This dispatch is closed. Its conversation is read-only.
        </p>
      ) : (
        <form
          className="rsp-chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {photo && (
            <div className="rsp-photo-draft">
              <img
                src={"data:image/jpeg;base64," + photo}
                alt="Selected photo preview"
              />
              <button
                type="button"
                onClick={() => {
                  setPhoto("");
                  id.current = crypto.randomUUID();
                }}
                aria-label="Remove selected photo"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <input
            hidden
            type="file"
            ref={input}
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const token = generation.current;
              setBusy(true);
              setError("");
              try {
                const data = await preparePhoto(file);
                if (token === generation.current) {
                  setPhoto(data);
                  id.current = crypto.randomUUID();
                }
              } catch (error) {
                if (token === generation.current)
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Photo unavailable.",
                  );
              } finally {
                if (token === generation.current) setBusy(false);
              }
            }}
          />
          <button
            type="button"
            className="rsp-icon-button"
            disabled={busy}
            onClick={() => input.current?.click()}
            aria-label="Attach incident photo"
          >
            <ImagePlus size={22} />
          </button>
          <label
            className="sr-only"
            htmlFor={"response-message-" + incident.id}
          >
            Message to dispatch
          </label>
          <textarea
            id={"response-message-" + incident.id}
            rows={2}
            maxLength={2000}
            placeholder="Update dispatch…"
            value={body}
            disabled={busy}
            onChange={(e) => {
              setBody(e.target.value);
              id.current = crypto.randomUUID();
            }}
          />
          <button
            className="rsp-send"
            type="submit"
            aria-label="Send incident message"
            disabled={busy || (!body.trim() && !photo)}
          >
            <Send size={20} />
          </button>
          <small>
            Only attach information needed for this case. Photos expire after 7
            days.
          </small>
        </form>
      )}
      <Dialog.Root
        open={!!zoom}
        onOpenChange={(open) => {
          if (!open) setZoom(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="rsp-modal-overlay" />
          <Dialog.Content className="rsp-photo-view">
            <Dialog.Title className="sr-only">Incident photo</Dialog.Title>
            <Dialog.Description className="sr-only">
              Photo shared privately with this incident team.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button aria-label="Close photo">
                <X />
              </button>
            </Dialog.Close>
            {zoom && <img src={zoom} alt="Medical information attachment" />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
